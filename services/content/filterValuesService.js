/**
 * Filter Values Service with Caching
 * Manages filter values from ETG Content API with 24-hour cache TTL
 * Filter values change infrequently, so caching is highly recommended
 */

import { PrismaClient } from '@prisma/client';
import { getFilterValues as fetchFilterValuesFromETG } from '../etg/etgClient.js';

const prisma = new PrismaClient();

// Cache TTL: 24 hours for filter values (they change infrequently)
const FILTER_VALUES_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Get filter values with caching
 * @returns {Promise<Object>} - Filter values object
 */
export async function getFilterValues() {
  const startTime = Date.now();

  try {
    // Check cache first
    const cached = await getFromCache();
    if (cached) {
      const cacheAge = Math.floor((Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60));
      console.log(`✅ Filter values cache HIT (age: ${cacheAge}h) - ${Date.now() - startTime}ms`);
      return {
        ...cached.filter_values,
        from_cache: true,
        cache_age_hours: cacheAge
      };
    }

    console.log(`⚠️ Filter values cache MISS - calling ETG Content API`);

    // Fetch from ETG Content API
    const filterValues = await fetchFilterValuesFromETG();

    // Cache the result
    await saveToCache(filterValues);

    console.log(`✅ Filter values retrieved (${Date.now() - startTime}ms)`);

    return {
      ...filterValues,
      from_cache: false
    };

  } catch (error) {
    console.error(`❌ Failed to get filter values:`, error);
    throw error;
  }
}

/**
 * Get filter values from cache
 * @returns {Promise<Object|null>} - Cached filter values or null
 */
async function getFromCache() {
  try {
    const cached = await prisma.filterValuesCache.findFirst({
      orderBy: { cached_at: 'desc' }
    });

    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
    if (cacheAge > FILTER_VALUES_CACHE_TTL) {
      console.log(`⚠️ Filter values cache expired (age: ${Math.floor(cacheAge / (1000 * 60 * 60))}h)`);
      return null;
    }

    return cached;

  } catch (error) {
    console.error('❌ Cache read error:', error);
    return null; // Non-fatal - continue without cache
  }
}

/**
 * Save filter values to cache
 * @param {Object} filterValues - Filter values from ETG API
 */
async function saveToCache(filterValues) {
  try {
    // Delete old cache entries (keep only the latest)
    await prisma.filterValuesCache.deleteMany({});

    // Save new cache entry
    await prisma.filterValuesCache.create({
      data: {
        filter_values: filterValues,
        cached_at: new Date()
      }
    });

    console.log(`💾 Cached filter values (TTL: 24h)`);

  } catch (error) {
    console.error('❌ Cache write error:', error);
    // Non-fatal - continue without caching
  }
}

