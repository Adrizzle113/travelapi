import axios from 'axios';
import crypto from 'crypto';

let prisma = null;
let prismaAvailable = false;

try {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
  prismaAvailable = true;
  console.log('✅ Prisma client initialized for autocomplete cache');
} catch (error) {
  console.warn('⚠️ Prisma not available, caching disabled:', error.message);
  prismaAvailable = false;
}

const RATEHAWK_AUTOCOMPLETE_URL = 'https://www.ratehawk.com/api/site/multicomplete.json';
const CACHE_TTL = 24 * 60 * 60 * 1000;

const PREFERRED_TYPES = ['city', 'region', 'location', 'hotel_city', 'poi', 'hotel'];

function generateCacheKey(query, locale) {
  const normalized = `${query.toLowerCase().trim()}:${locale}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function normalizeResult(item) {
  if (!item) return null;

  const type = (item.type || item.object_type || 'location').toLowerCase();
  const isHotel = type === 'hotel' || item.hotel_id || item.hotelId || item.id?.startsWith('h-');

  // Handle hotels differently from regions
  if (isHotel) {
    const hotelId = item.hotel_id || item.hotelId || item.id || null;
    
    if (!hotelId) {
      console.warn('⚠️ Skipping hotel without hotel_id:', JSON.stringify(item).substring(0, 200));
      return null;
    }

    let label = item.label || item.name || item.fullName || item.full_name || 'Unknown';
    const city = item.city || item.city_name || null;
    const countryName = item.country_name || item.countryName || item.country || null;

    // Format hotel label with location context
    if (city && !label.includes(city)) {
      label = `${label}, ${city}`;
    }
    if (countryName && !label.includes(countryName)) {
      label = `${label}, ${countryName}`;
    }

    return {
      label,
      hotel_id: hotelId,
      type: 'hotel',
      star_rating: item.star_rating || item.starRating || item.stars || null,
      city: city || null,
      country_code: item.country_code || item.countryCode || item.country_iso_code || null,
      country_name: countryName || null,
      coordinates: item.coordinates || item.center || item.location || null,
      _raw: process.env.NODE_ENV === 'production' ? undefined : item
    };
  }

  // Handle regions/destinations (existing logic)
  const regionId = item.region_id || item.regionId || item.id || item.regionID;

  if (!regionId) {
    console.warn('⚠️ Skipping result without region_id:', JSON.stringify(item).substring(0, 200));
    return null;
  }

  let label = item.label || item.name || item.fullName || item.full_name || 'Unknown';
  const countryName = item.country_name || item.countryName || item.country;

  if (countryName && !label.includes(countryName)) {
    label = `${label}, ${countryName}`;
  }

  return {
    label,
    region_id: parseInt(regionId, 10),
    type,
    country_code: item.country_code || item.countryCode || item.country_iso_code || null,
    country_name: countryName || null,
    coordinates: item.coordinates || item.center || item.location || null,
    _raw: process.env.NODE_ENV === 'production' ? undefined : item
  };
}

function filterAndSortResults(results, limit = 10) {
  if (!results || results.length === 0) return [];

  const hotels = [];
  const prioritized = [];
  const other = [];

  results.forEach(r => {
    if (!r) return;
    
    // Separate hotels for special handling
    if (r.type === 'hotel') {
      hotels.push(r);
    } else if (PREFERRED_TYPES.includes(r.type)) {
      prioritized.push(r);
    } else {
      other.push(r);
    }
  });

  // Prioritize hotels first, then regions, then others
  // Hotels are most relevant for direct hotel searches
  const sorted = [...hotels, ...prioritized, ...other].slice(0, limit);
  
  console.log(`🔍 Filtered ${results.length} results → ${sorted.length} (${hotels.length} hotels, ${prioritized.length} regions, ${other.length} other)`);

  return sorted;
}

async function getFromCache(queryKey) {
  if (!prismaAvailable || !prisma) {
    return null;
  }

  try {
    const cached = await prisma.autocompleteCache.findUnique({
      where: { query_key: queryKey }
    });

    if (!cached) {
      return null;
    }

    if (new Date(cached.expires_at) < new Date()) {
      console.log(`🗑️ Autocomplete cache expired for key: ${queryKey}`);
      await prisma.autocompleteCache.delete({
        where: { query_key: queryKey }
      });
      return null;
    }

    return cached.results;
  } catch (error) {
    console.error('❌ Autocomplete cache read error:', error.message);
    return null;
  }
}

async function saveToCache(queryKey, query, locale, results) {
  if (!prismaAvailable || !prisma) {
    console.log('⚠️ Skipping cache write (Prisma not available)');
    return;
  }

  try {
    await prisma.autocompleteCache.upsert({
      where: { query_key: queryKey },
      update: {
        results,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + CACHE_TTL)
      },
      create: {
        query_key: queryKey,
        query,
        locale,
        results,
        expires_at: new Date(Date.now() + CACHE_TTL)
      }
    });
    console.log(`💾 Cached autocomplete results: ${queryKey} (${results.length} items, TTL: 24h)`);
  } catch (error) {
    console.error('❌ Autocomplete cache write error:', error.message);
  }
}

export async function searchDestinations(query, locale = 'en', limit = 10) {
  const startTime = Date.now();

  if (!query || query.trim().length < 2) {
    return {
      results: [],
      total: 0,
      from_cache: false,
      message: 'Query must be at least 2 characters'
    };
  }

  const queryKey = generateCacheKey(query, locale);

  const cached = await getFromCache(queryKey);
  if (cached) {
    const duration = Date.now() - startTime;
    console.log(`✅ Autocomplete cache HIT: "${query}" (${duration}ms)`);
    return {
      results: cached.slice(0, limit),
      total: cached.length,
      from_cache: true,
      cache_key: queryKey,
      duration_ms: duration
    };
  }

  console.log(`⚠️ Autocomplete cache MISS: "${query}" - calling RateHawk API`);

  try {
    const response = await axios.get(RATEHAWK_AUTOCOMPLETE_URL, {
      params: { query, locale },
      timeout: 5000
    });

    // Public API may return hotels in different structure
    // Check for both regions array and hotels array, or combined array
    let rawResults = [];
    
    if (Array.isArray(response.data)) {
      rawResults = response.data;
    } else if (response.data?.regions) {
      rawResults = response.data.regions;
      // Also check for hotels in the response
      if (response.data.hotels && Array.isArray(response.data.hotels)) {
        rawResults = [...rawResults, ...response.data.hotels];
      }
    } else if (response.data?.hotels) {
      rawResults = response.data.hotels;
    } else {
      rawResults = [];
    }
    
    console.log(`🔍 RateHawk returned ${rawResults.length} results for "${query}"`);

    if (rawResults.length > 0 && process.env.NODE_ENV !== 'production') {
      console.log('📊 Sample RateHawk result:', JSON.stringify(rawResults[0], null, 2).substring(0, 500));
      // Log structure info
      const sample = rawResults[0];
      console.log('📊 Result structure:', {
        hasHotelId: !!(sample.hotel_id || sample.hotelId || sample.id?.startsWith('h-')),
        hasRegionId: !!(sample.region_id || sample.regionId),
        type: sample.type || sample.object_type,
        keys: Object.keys(sample)
      });
    }

    const normalized = rawResults
      .map(normalizeResult)
      .filter(r => r !== null);

    console.log(`📝 Normalized ${rawResults.length} → ${normalized.length} results`);

    const filtered = filterAndSortResults(normalized, limit * 2);

    await saveToCache(queryKey, query, locale, filtered);

    const duration = Date.now() - startTime;
    console.log(`✅ Autocomplete complete: "${query}" (${filtered.length} results, ${duration}ms)`);

    return {
      results: filtered.slice(0, limit),
      total: filtered.length,
      from_cache: false,
      cache_key: queryKey,
      duration_ms: duration
    };

  } catch (error) {
    console.error('❌ RateHawk autocomplete error:', error.message);
    const duration = Date.now() - startTime;

    return {
      results: [],
      total: 0,
      from_cache: false,
      error: 'Failed to fetch destinations',
      duration_ms: duration
    };
  }
}

export default {
  searchDestinations
};
