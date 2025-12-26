/**
 * Search Service with Caching
 * Manages hotel searches with 3-tier caching strategy
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
 * Execute hotel search with caching
 * @param {Object} searchParams
 * @returns {Promise<Object>} - Search results
 */
export async function executeSearch(searchParams) {
  const startTime = Date.now();

  try {
    // Step 1: Resolve destination to region_id
    let region_id = searchParams.region_id;
    
    // If no region_id, check destination parameter
    if (!region_id && searchParams.destination) {
      // Check if destination is already a number (region_id from frontend autocomplete)
      if (!isNaN(searchParams.destination) && Number.isInteger(Number(searchParams.destination))) {
        region_id = Number(searchParams.destination);
        console.log(`✅ Using provided region_id: ${region_id}`);
      } else {
        // It's a city name string, resolve it
        console.log(`🔍 Resolving destination: "${searchParams.destination}"`);
        const resolved = await resolveDestination(searchParams.destination);
        
        if (!resolved.region_id) {
          throw new Error(`Destination not found: ${searchParams.destination}`);
        }
        
        region_id = resolved.region_id;
        console.log(`✅ Resolved to region_id: ${region_id} (${resolved.region_name})`);
      }
    }

    if (!region_id) {
      throw new Error('region_id or destination is required');
    }

    // Step 2: Generate cache signature
    const fullParams = { 
      ...searchParams, 
      region_id,
      checkin: searchParams.checkin,
      checkout: searchParams.checkout,
      guests: searchParams.guests,
      currency: searchParams.currency || 'USD',
      residency: searchParams.residency || 'us'
    };
    const signature = generateSearchSignature(fullParams);

    // Step 3: Check cache
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

    // Step 4: Call ETG API
    console.log(`🔍 ETG Search: region_id=${region_id}, ${fullParams.checkin} → ${fullParams.checkout}`);
    const results = await searchHotels(fullParams);

    // Step 5: Cache the results
    await saveToCache(signature, fullParams, results);

    console.log(`✅ Search complete: ${results.hotels?.length || 0} hotels (${Date.now() - startTime}ms)`);

    return {
      hotels: results.hotels || [],
      total_hotels: results.hotels?.length || 0,
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

    return {
      hotels: cached.hotel_ids.map(id => ({
        hotel_id: id,
        ...(cached.rates_index[id] || {})
      })),
      total_hotels: cached.total_hotels,
      cached_at: cached.cached_at
    };

  } catch (error) {
    console.error('Cache read error:', error);
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
    console.error('Cache write error:', error);
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
    pagination: {
      page,
      limit,
      total: cached.total_hotels,
      total_pages: Math.ceil(cached.total_hotels / limit),
      has_next: end < cached.total_hotels,
      has_prev: page > 1
    },
    from_cache: true
  };
}

export default {
  executeSearch,
  paginateSearch
};