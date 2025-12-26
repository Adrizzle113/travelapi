import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const RATEHAWK_AUTOCOMPLETE_URL = 'https://www.ratehawk.com/api/site/multicomplete.json';
const CACHE_TTL = 24 * 60 * 60 * 1000;

const ALLOWED_TYPES = new Set(['city', 'region']);

function generateCacheKey(query, locale) {
  const normalized = `${query.toLowerCase().trim()}:${locale}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function normalizeResult(item) {
  if (!item || !item.region_id) return null;

  const type = item.type?.toLowerCase() || 'unknown';

  let label = item.label || item.name || 'Unknown';
  if (item.country_name && !label.includes(item.country_name)) {
    label = `${label}, ${item.country_name}`;
  }

  return {
    label,
    region_id: parseInt(item.region_id, 10),
    type,
    country_code: item.country_code || item.country_iso_code || null,
    country_name: item.country_name || null,
    coordinates: item.coordinates || item.center || null,
    _raw: process.env.NODE_ENV === 'production' ? undefined : item
  };
}

function filterAndSortResults(results, limit = 10) {
  const filtered = results
    .filter(r => r && ALLOWED_TYPES.has(r.type))
    .slice(0, limit * 2);

  const cities = filtered.filter(r => r.type === 'city');
  const regions = filtered.filter(r => r.type === 'region');

  return [...cities, ...regions].slice(0, limit);
}

async function getFromCache(queryKey) {
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

    const rawResults = response.data?.regions || response.data || [];
    console.log(`🔍 RateHawk returned ${rawResults.length} results for "${query}"`);

    const normalized = rawResults
      .map(normalizeResult)
      .filter(r => r !== null);

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
