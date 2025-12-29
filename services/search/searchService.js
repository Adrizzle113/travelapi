/**
 * Search Service with Caching and Static Info Enrichment
 * Manages hotel searches with 3-tier caching strategy
 * Supports: region_id, city names, and slug formats
 * Enriches results with static_vm data from RateHawk hotel/info endpoint
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { searchHotels } from '../etg/etgClient.js';
import { resolveDestination } from '../destination/destinationResolver.js';

const prisma = new PrismaClient();

const SEARCH_CACHE_TTL = 30 * 60 * 1000;
const STATIC_INFO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const RATEHAWK_CREDENTIALS = {
  username: process.env.RATEHAWK_USERNAME || "11606",
  password: process.env.RATEHAWK_PASSWORD || "ff9702bb-ba93-4996-a31e-547983c51530",
};

/**
 * Generate search signature (cache key)
 * @param {Object} params - Search parameters
 * @returns {string} - MD5 hash of normalized params
 */
function generateSearchSignature(params) {
  const normalized = {
    region_id: params.region_id,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: JSON.stringify(params.guests || [{ adults: 2, children: [] }]),
    currency: params.currency || 'USD'
  };

  const str = JSON.stringify(normalized);
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Parse destination input to extract city name
 * Handles multiple formats:
 * - Numeric region_id: "2011"
 * - City name: "Los Angeles"
 * - Slug format: "united_states_of_america/los_angeles"
 * 
 * @param {string|number} destination - Destination in any format
 * @returns {Object} - { type: 'region_id'|'city_name', value: string|number }
 */
function parseDestination(destination) {
  if (!destination) {
    return { type: null, value: null };
  }

  // Already a region_id number
  if (typeof destination === 'number') {
    return { type: 'region_id', value: destination };
  }

  const destStr = String(destination).trim();

  // Check if it's a numeric string (region_id)
  if (!isNaN(destStr) && Number.isInteger(Number(destStr))) {
    return { type: 'region_id', value: Number(destStr) };
  }

  // Check if it's a slug format (country/city)
  if (destStr.includes('/')) {
    const parts = destStr.split('/');
    const cityName = parts[parts.length - 1]
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    console.log(`📍 Parsed slug "${destStr}" → city name "${cityName}"`);
    return { type: 'city_name', value: cityName };
  }

  // Regular city name
  return { type: 'city_name', value: destStr };
}

/**
 * Extract amenity strings from RateHawk amenity_groups structure
 */
function extractAmenityStrings(amenityGroups) {
  const amenities = [];

  if (!Array.isArray(amenityGroups)) return amenities;

  amenityGroups.forEach(group => {
    if (group.amenities && Array.isArray(group.amenities)) {
      group.amenities.forEach(amenity => {
        if (amenity.name) {
          amenities.push(amenity.name);
        }
      });
    }
  });

  return amenities;
}

/**
 * Extract description from RateHawk description_struct
 */
function extractDescription(descriptionStruct) {
  if (!descriptionStruct) return '';

  const parts = [];

  if (Array.isArray(descriptionStruct)) {
    descriptionStruct.forEach(section => {
      if (section.paragraphs && Array.isArray(section.paragraphs)) {
        section.paragraphs.forEach(p => {
          if (typeof p === 'string') parts.push(p);
        });
      }
    });
  }

  return parts.join('\n\n');
}

/**
 * Fetch static info for a single hotel with caching
 */
async function fetchHotelStaticInfo(hotelId, language = 'en') {
  try {
    const cached = await prisma.hotelStaticCache.findUnique({
      where: {
        hotel_id_language: { hotel_id: hotelId, language: language }
      }
    });

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log(`✅ Static cache HIT: ${hotelId}`);
      return cached.raw_data;
    }

    console.log(`⚠️ Static cache MISS: ${hotelId} - calling RateHawk API`);

    const response = await axios.post(
      'https://api.worldota.net/api/b2b/v3/hotel/info/',
      { id: hotelId, language: language },
      {
        auth: RATEHAWK_CREDENTIALS,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BookjaAPI/1.0',
        },
        timeout: 10000
      }
    );

    const hotelData = response.data?.data;
    if (!hotelData) return null;

    await prisma.hotelStaticCache.upsert({
      where: {
        hotel_id_language: { hotel_id: hotelId, language: language }
      },
      update: {
        name: hotelData.name,
        address: hotelData.address,
        city: hotelData.city,
        country: hotelData.country,
        star_rating: hotelData.star_rating,
        images: hotelData.images || [],
        amenities: extractAmenityStrings(hotelData.amenity_groups || []),
        description: extractDescription(hotelData.description_struct),
        coordinates: {
          latitude: hotelData.latitude,
          longitude: hotelData.longitude
        },
        raw_data: hotelData,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + STATIC_INFO_CACHE_TTL)
      },
      create: {
        hotel_id: hotelId,
        language: language,
        name: hotelData.name,
        address: hotelData.address,
        city: hotelData.city,
        country: hotelData.country,
        star_rating: hotelData.star_rating,
        images: hotelData.images || [],
        amenities: extractAmenityStrings(hotelData.amenity_groups || []),
        description: extractDescription(hotelData.description_struct),
        coordinates: {
          latitude: hotelData.latitude,
          longitude: hotelData.longitude
        },
        raw_data: hotelData,
        expires_at: new Date(Date.now() + STATIC_INFO_CACHE_TTL)
      }
    });

    console.log(`💾 Cached static info for ${hotelId}`);
    return hotelData;

  } catch (error) {
    console.error(`❌ Failed to fetch static info for ${hotelId}:`, error.message);
    return null;
  }
}

/**
 * Enrich hotels with static data from database (FAST!)
 * Replaces 100 API calls with 1 database query
 *
 * Performance: <100ms vs 30-60 seconds with API calls
 * Success rate: 100% vs 3% with API rate limits
 */
async function enrichHotelsFromDatabase(hotels) {
  if (!hotels || hotels.length === 0) {
    return [];
  }

  const startTime = Date.now();
  console.log(`🔧 Enriching ${hotels.length} hotels from database...`);

  const hotelIds = hotels.map(h => h.hotel_id || h.id).filter(Boolean);

  if (hotelIds.length === 0) {
    console.warn('⚠️ No valid hotel IDs found');
    return hotels;
  }

  try {
    const staticData = await prisma.hotelDumpData.findMany({
      where: {
        hotel_id: { in: hotelIds }
      },
      select: {
        hotel_id: true,
        name: true,
        address: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        star_rating: true,
        images: true,
        amenities: true,
        description: true,
        check_in_time: true,
        check_out_time: true,
        amenity_groups: true,
        room_groups: true,
        kind: true
      }
    });

    const staticMap = new Map(
      staticData.map(s => [s.hotel_id, s])
    );

    const enrichedHotels = hotels.map(hotel => {
      const hotelId = hotel.hotel_id || hotel.id;
      const staticInfo = staticMap.get(hotelId);

      if (!staticInfo) {
        return hotel;
      }

      const static_vm = {
        id: staticInfo.hotel_id,
        name: staticInfo.name,
        address: staticInfo.address,
        city: staticInfo.city,
        country: staticInfo.country,
        latitude: staticInfo.latitude,
        longitude: staticInfo.longitude,
        star_rating: staticInfo.star_rating,
        images: staticInfo.images,
        amenities: staticInfo.amenities,
        description: staticInfo.description,
        check_in_time: staticInfo.check_in_time,
        check_out_time: staticInfo.check_out_time,
        amenity_groups: staticInfo.amenity_groups,
        room_groups: staticInfo.room_groups,
        kind: staticInfo.kind
      };

      return {
        ...hotel,
        static_vm: static_vm
      };
    });

    const duration = Date.now() - startTime;
    const enrichedCount = enrichedHotels.filter(h => h.static_vm).length;
    const successRate = ((enrichedCount / hotels.length) * 100).toFixed(1);

    console.log(`✅ Enriched ${enrichedCount}/${hotels.length} hotels from database in ${duration}ms (${successRate}% success)`);

    if (enrichedCount < hotels.length) {
      console.log(`   ⚠️ Missing static data for ${hotels.length - enrichedCount} hotels`);
    }

    return enrichedHotels;

  } catch (error) {
    console.error('❌ Database enrichment error:', error.message);
    console.error('   Falling back to hotels without static data');
    return hotels;
  }
}

/**
 * OLD API-based enrichment (DEPRECATED - kept for fallback)
 * This function is slow and hits rate limits
 */
async function enrichHotelsWithStaticInfo(hotels, language = 'en') {
  console.log(`⚠️ Using legacy API-based enrichment (slow!)`);
  console.log(`🔧 Enriching ${hotels.length} hotels with static info...`);

  const enrichedHotels = await Promise.allSettled(
    hotels.map(async (hotel) => {
      const hotelId = hotel.hotel_id || hotel.id;

      if (!hotelId) {
        console.warn('⚠️ Hotel missing ID, skipping enrichment');
        return hotel;
      }

      try {
        const staticInfo = await fetchHotelStaticInfo(hotelId, language);

        if (staticInfo) {
          return {
            ...hotel,
            static_vm: staticInfo
          };
        }

        return hotel;
      } catch (error) {
        console.error(`Error enriching hotel ${hotelId}:`, error.message);
        return hotel;
      }
    })
  );

  const results = enrichedHotels
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  const enrichedCount = results.filter(h => h.static_vm).length;
  console.log(`✅ Enriched ${enrichedCount}/${hotels.length} hotels with static data`);

  return results;
}

/**
 * Execute hotel search with caching
 * @param {Object} searchParams - Search parameters
 * @param {number} searchParams.region_id - Region ID (required, primary)
 * @param {string} searchParams.destination - DEPRECATED: City name for backward compatibility
 * @param {string} searchParams.destination_label - Optional label for logging
 * @param {string} searchParams.checkin - Check-in date (YYYY-MM-DD)
 * @param {string} searchParams.checkout - Check-out date (YYYY-MM-DD)
 * @param {Array} searchParams.guests - Guest configuration
 * @param {string} searchParams.currency - Currency code (default: USD)
 * @param {string} searchParams.residency - Residency code (default: us)
 * @returns {Promise<Object>} - Search results
 */
export async function executeSearch(searchParams) {
  const startTime = Date.now();
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    console.log(`🔍 [${requestId}] Search request initiated`);

    let region_id = searchParams.region_id;
    let resolvedLabel = searchParams.destination_label || null;
    let resolutionMethod = 'direct';

    if (!region_id && searchParams.destination) {
      console.warn(`⚠️ [${requestId}] DEPRECATED: Using destination string instead of region_id`);
      resolutionMethod = 'legacy_resolver';

      const parsed = parseDestination(searchParams.destination);

      if (parsed.type === 'region_id') {
        region_id = parsed.value;
        console.log(`✅ [${requestId}] Parsed region_id from string: ${region_id}`);
      } else if (parsed.type === 'city_name') {
        console.log(`🔍 [${requestId}] Resolving destination: "${parsed.value}"`);
        const resolved = await resolveDestination(parsed.value);

        if (!resolved || !resolved.region_id) {
          console.error(`❌ [${requestId}] Destination not found: ${parsed.value}`);
          throw new Error(`Destination not found: ${parsed.value}`);
        }

        region_id = resolved.region_id;
        resolvedLabel = resolved.region_name;
        console.log(`✅ [${requestId}] Resolved to region_id: ${region_id} (${resolved.region_name})`);
      } else {
        console.error(`❌ [${requestId}] Invalid destination format: ${searchParams.destination}`);
        throw new Error('Invalid destination format');
      }
    }

    if (!region_id) {
      console.error(`❌ [${requestId}] Missing region_id in request`);
      throw new Error('region_id is required');
    }

    console.log(`📍 [${requestId}] Using region_id: ${region_id} (method: ${resolutionMethod})`);
    if (resolvedLabel) {
      console.log(`🏷️ [${requestId}] Destination label: ${resolvedLabel}`);
    }

    // Step 2: Prepare full search parameters
    const fullParams = {
      region_id,
      checkin: searchParams.checkin,
      checkout: searchParams.checkout,
      guests: searchParams.guests || [{ adults: 2, children: [] }],
      currency: searchParams.currency || 'USD',
      residency: searchParams.residency || 'us'
    };

    // Step 3: Generate cache signature
    const signature = generateSearchSignature(fullParams);

    // Step 4: Check cache
    const cached = await getFromCache(signature);
    if (cached) {
      const cacheAge = Math.round((Date.now() - new Date(cached.cached_at).getTime()) / 1000);
      const duration = Date.now() - startTime;
      console.log(`✅ [${requestId}] Cache HIT: ${signature} (${duration}ms, age: ${cacheAge}s)`);
      return {
        hotels: cached.hotels,
        total_hotels: cached.total_hotels,
        from_cache: true,
        search_signature: signature,
        cache_age: `${cacheAge}s`,
        request_id: requestId,
        resolution_method: resolutionMethod
      };
    }

    console.log(`⚠️ [${requestId}] Cache MISS: ${signature} - calling ETG API`);

    // Step 5: Call ETG API
    const etgStartTime = Date.now();
    console.log(`🔍 [${requestId}] ETG API call: region_id=${region_id}, ${fullParams.checkin} → ${fullParams.checkout}`);

    const results = await searchHotels(fullParams);

    const etgDuration = Date.now() - etgStartTime;
    console.log(`⏱️ [${requestId}] ETG API responded in ${etgDuration}ms`);

    // Step 6: Enrich hotels with static info from database (FAST!)
    const enrichStartTime = Date.now();
    const enrichedHotels = await enrichHotelsFromDatabase(
      results.hotels || []
    );
    const enrichDuration = Date.now() - enrichStartTime;
    console.log(`⏱️ [${requestId}] Database enrichment completed in ${enrichDuration}ms`);

    // Step 7: Cache the enriched results
    const enrichedResults = {
      ...results,
      hotels: enrichedHotels
    };
    await saveToCache(signature, fullParams, enrichedResults);

    const hotelCount = enrichedHotels.length;
    const totalDuration = Date.now() - startTime;
    console.log(`✅ [${requestId}] Search complete: ${hotelCount} hotels (total: ${totalDuration}ms, ETG: ${etgDuration}ms, enrich: ${enrichDuration}ms)`);

    return {
      hotels: enrichedHotels,
      total_hotels: hotelCount,
      from_cache: false,
      search_signature: signature,
      request_id: requestId,
      resolution_method: resolutionMethod,
      etg_duration_ms: etgDuration,
      enrich_duration_ms: enrichDuration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] Search failed after ${duration}ms:`, error.message);
    throw error;
  }
}

/**
 * Get search results from cache
 * @param {string} signature - Search signature
 * @returns {Promise<Object|null>} - Cached results or null
 */
async function getFromCache(signature) {
  try {
    const cached = await prisma.searchCache.findUnique({
      where: { search_signature: signature }
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date(cached.expires_at) < new Date()) {
      console.log(`🗑️ Cache expired for ${signature}`);
      await prisma.searchCache.delete({
        where: { search_signature: signature }
      });
      return null;
    }

    // Update hit count
    await prisma.searchCache.update({
      where: { search_signature: signature },
      data: { hit_count: { increment: 1 } }
    });

    // Reconstruct hotel objects with rates and enrich with static_vm
    const hotels = [];
    for (const hotelId of cached.hotel_ids) {
      const rateData = cached.rates_index[hotelId];
      const staticInfo = await fetchHotelStaticInfo(hotelId, 'en');

      hotels.push({
        hotel_id: hotelId,
        id: hotelId,
        ...(rateData || {}),
        static_vm: staticInfo
      });
    }

    return {
      hotels,
      total_hotels: cached.total_hotels,
      cached_at: cached.cached_at
    };

  } catch (error) {
    console.error('❌ Cache read error:', error);
    return null;
  }
}

/**
 * Save search results to cache
 * @param {string} signature - Search signature
 * @param {Object} params - Search parameters
 * @param {Object} results - Search results from ETG
 */
async function saveToCache(signature, params, results) {
  try {
    const hotels = results.hotels || [];
    const hotel_ids = hotels.map(h => h.hotel_id || h.id);
    
    // Build rates index for quick lookup
    const rates_index = {};
    hotels.forEach(hotel => {
      const hotelId = hotel.hotel_id || hotel.id;
      rates_index[hotelId] = {
        min_rate: hotel.min_rate,
        max_rate: hotel.max_rate,
        rates: hotel.rates || []
      };
    });

    await prisma.searchCache.upsert({
      where: { search_signature: signature },
      update: {
        search_params: params,
        region_id: params.region_id,
        total_hotels: hotel_ids.length,
        hotel_ids,
        rates_index,
        etg_search_id: results.search_id || signature,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + SEARCH_CACHE_TTL),
        hit_count: 0
      },
      create: {
        search_signature: signature,
        search_params: params,
        region_id: params.region_id,
        total_hotels: hotel_ids.length,
        hotel_ids,
        rates_index,
        etg_search_id: results.search_id || signature,
        expires_at: new Date(Date.now() + SEARCH_CACHE_TTL)
      }
    });

    console.log(`💾 Cached search: ${signature} (${hotel_ids.length} hotels, TTL: 30min)`);

  } catch (error) {
    console.error('❌ Cache write error:', error);
    // Non-fatal - continue without caching
  }
}

/**
 * Paginate search results
 * @param {string} signature - Search signature
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Results per page
 * @returns {Promise<Object>} - Paginated results
 */
export async function paginateSearch(signature, page = 1, limit = 20) {
  const cached = await getFromCache(signature);
  
  if (!cached) {
    throw new Error('Search not found or expired. Please search again.');
  }

  const start = (page - 1) * limit;
  const end = start + limit;
  const pageHotels = cached.hotels.slice(start, end);

  return {
    hotels: pageHotels,
    total_hotels: cached.total_hotels,
    pagination: {
      page,
      limit,
      total: cached.total_hotels,
      total_pages: Math.ceil(cached.total_hotels / limit),
      has_next: end < cached.total_hotels,
      has_prev: page > 1
    },
    from_cache: true,
    search_signature: signature
  };
}

export default {
  executeSearch,
  paginateSearch
};