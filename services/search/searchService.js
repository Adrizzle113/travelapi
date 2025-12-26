/**
 * Search Service with Caching
 * Manages hotel searches with 3-tier caching strategy
 * Supports: region_id, city names, and slug formats
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { searchHotels } from '../etg/etgClient.js';
import { resolveDestination } from '../destination/destinationResolver.js';

const prisma = new PrismaClient();

// Cache TTL: 30 minutes for search results
const SEARCH_CACHE_TTL = 30 * 60 * 1000;

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
 * Execute hotel search with caching
 * @param {Object} searchParams - Search parameters
 * @param {string|number} searchParams.destination - City name, region_id, or slug
 * @param {number} searchParams.region_id - Direct region_id (optional)
 * @param {string} searchParams.checkin - Check-in date (YYYY-MM-DD)
 * @param {string} searchParams.checkout - Check-out date (YYYY-MM-DD)
 * @param {Array} searchParams.guests - Guest configuration
 * @param {string} searchParams.currency - Currency code (default: USD)
 * @param {string} searchParams.residency - Residency code (default: us)
 * @returns {Promise<Object>} - Search results
 */
export async function executeSearch(searchParams) {
  const startTime = Date.now();

  try {
    // Step 1: Resolve destination to region_id
    let region_id = searchParams.region_id;
    
    // If no region_id provided, parse destination
    if (!region_id && searchParams.destination) {
      const parsed = parseDestination(searchParams.destination);
      
      if (parsed.type === 'region_id') {
        // Already a region_id
        region_id = parsed.value;
        console.log(`✅ Using provided region_id: ${region_id}`);
      } else if (parsed.type === 'city_name') {
        // Need to resolve city name to region_id
        console.log(`🔍 Resolving destination: "${parsed.value}"`);
        const resolved = await resolveDestination(parsed.value);
        
        if (!resolved || !resolved.region_id) {
          throw new Error(`Destination not found: ${parsed.value}`);
        }
        
        region_id = resolved.region_id;
        console.log(`✅ Resolved to region_id: ${region_id} (${resolved.region_name})`);
      } else {
        throw new Error('Invalid destination format');
      }
    }

    if (!region_id) {
      throw new Error('region_id or destination is required');
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
      console.log(`✅ Cache HIT: ${signature} (${Date.now() - startTime}ms)`);
      return {
        hotels: cached.hotels,
        total_hotels: cached.total_hotels,
        from_cache: true,
        search_signature: signature,
        cache_age: `${cacheAge}s`
      };
    }

    console.log(`⚠️ Cache MISS: ${signature} - calling ETG API`);

    // Step 5: Call ETG API
    console.log(`🔍 ETG Search: region_id=${region_id}, ${fullParams.checkin} → ${fullParams.checkout}`);
    const results = await searchHotels(fullParams);

    // Step 6: Cache the results
    await saveToCache(signature, fullParams, results);

    const hotelCount = results.hotels?.length || 0;
    console.log(`✅ Search complete: ${hotelCount} hotels (${Date.now() - startTime}ms)`);

    return {
      hotels: results.hotels || [],
      total_hotels: hotelCount,
      from_cache: false,
      search_signature: signature
    };

  } catch (error) {
    console.error('❌ Search failed:', error);
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

    // Reconstruct hotel objects with rates
    const hotels = cached.hotel_ids.map(id => ({
      hotel_id: id,
      ...(cached.rates_index[id] || {})
    }));

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