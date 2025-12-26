/**
 * Destination Resolver with 3-Tier Strategy
 * Tier 1: Static map (instant, most common cities)
 * Tier 2: Database cache (fast, previously resolved)
 * Tier 3: ETG API (slow, requires network call)
 * 
 * Now includes fuzzy matching for partial city names
 */

import { PrismaClient } from '@prisma/client';

/**
 * Search destination via ETG API and cache result
 * TODO: Implement when ETG regions endpoint is added
 */
async function findViaAPI(query) {
  console.log(`⚠️ [TIER 3] API lookup not implemented yet for: ${query}`);
  return null;
}

const prisma = new PrismaClient();

// Tier 1: Static map of top 100 destinations
const STATIC_DESTINATIONS = {
  // United States
  'New York': { region_id: 2621, region_name: 'New York City' },
  'New York City': { region_id: 2621, region_name: 'New York City' },
  'NYC': { region_id: 2621, region_name: 'New York City' },
  'Los Angeles': { region_id: 1555, region_name: 'Los Angeles' },
  'LA': { region_id: 1555, region_name: 'Los Angeles' },
  'Chicago': { region_id: 2358, region_name: 'Chicago' },
  'Miami': { region_id: 2199, region_name: 'Miami' },
  'San Francisco': { region_id: 2674, region_name: 'San Francisco' },
  'Las Vegas': { region_id: 2007, region_name: 'Las Vegas' },
  'Orlando': { region_id: 2088, region_name: 'Orlando' },
  'Seattle': { region_id: 2693, region_name: 'Seattle' },
  'Boston': { region_id: 2279, region_name: 'Boston' },
  'Washington': { region_id: 2760, region_name: 'Washington, D.C.' },
  'Washington DC': { region_id: 2760, region_name: 'Washington, D.C.' },
  'San Diego': { region_id: 2672, region_name: 'San Diego' },
  'Denver': { region_id: 2422, region_name: 'Denver' },
  'Atlanta': { region_id: 2246, region_name: 'Atlanta' },
  'Phoenix': { region_id: 2633, region_name: 'Phoenix' },
  'Dallas': { region_id: 2405, region_name: 'Dallas' },
  'Houston': { region_id: 2508, region_name: 'Houston' },
  'Nashville': { region_id: 2222, region_name: 'Nashville' },
  'Austin': { region_id: 2251, region_name: 'Austin' },
  'Portland': { region_id: 2644, region_name: 'Portland' },
  'New Orleans': { region_id: 2207, region_name: 'New Orleans' },
  'Long Beach': { region_id: 2058, region_name: 'Long Beach' },
  'Long Beach, California': { region_id: 2058, region_name: 'Long Beach' },
  
  // International
  'London': { region_id: 2114, region_name: 'London' },
  'Paris': { region_id: 2138, region_name: 'Paris' },
  'Tokyo': { region_id: 2276, region_name: 'Tokyo' },
  'Dubai': { region_id: 1859, region_name: 'Dubai' },
  'Barcelona': { region_id: 2088, region_name: 'Barcelona' },
  'Rome': { region_id: 2152, region_name: 'Rome' },
  'Amsterdam': { region_id: 2003, region_name: 'Amsterdam' },
  'Sydney': { region_id: 2721, region_name: 'Sydney' },
  'Singapore': { region_id: 2697, region_name: 'Singapore' },
  'Hong Kong': { region_id: 2503, region_name: 'Hong Kong' },
  'Bangkok': { region_id: 2259, region_name: 'Bangkok' },
  'Istanbul': { region_id: 2524, region_name: 'Istanbul' },
  'Mexico City': { region_id: 2167, region_name: 'Mexico City' },
  'Toronto': { region_id: 2732, region_name: 'Toronto' },
  'Vancouver': { region_id: 2746, region_name: 'Vancouver' },
  'Montreal': { region_id: 2176, region_name: 'Montreal' },
};

/**
 * Normalize destination string for matching
 */
function normalizeDestination(destination) {
  return destination
    .trim()
    .toLowerCase()
    .replace(/,.*$/, '') // Remove state/country suffix
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Parse slug format (e.g., "united_states_of_america/los_angeles")
 * Returns the city name in proper format
 */
function parseSlugFormat(slug) {
  if (!slug.includes('/')) {
    return null;
  }
  
  const parts = slug.split('/');
  const citySlug = parts[parts.length - 1];
  
  // Convert snake_case to Title Case
  const cityName = citySlug
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  console.log(`📍 Parsed slug "${slug}" → "${cityName}"`);
  return cityName;
}

/**
 * Find destination in static map with fuzzy matching
 */
function findInStaticMap(query) {
  const normalized = normalizeDestination(query);
  
  // Try exact match first
  for (const [key, value] of Object.entries(STATIC_DESTINATIONS)) {
    if (normalizeDestination(key) === normalized) {
      console.log(`✅ [TIER 1] Exact match: ${query} → ${value.region_id}`);
      return value;
    }
  }
  
  // Try partial match (e.g., "Long Beach" matches "Long Beach, California")
  for (const [key, value] of Object.entries(STATIC_DESTINATIONS)) {
    const normalizedKey = normalizeDestination(key);
    
    // Check if query is a substring of the key or vice versa
    if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      console.log(`✅ [TIER 1] Fuzzy match: ${query} → ${key} (${value.region_id})`);
      return value;
    }
  }
  
  return null;
}

/**
 * Search destination in database cache
 */
async function findInCache(query) {
  try {
    const normalized = normalizeDestination(query);
    
    const cached = await prisma.destinationCache.findFirst({
      where: {
        OR: [
          { search_query: { equals: query, mode: 'insensitive' } },
          { search_query: { equals: normalized, mode: 'insensitive' } },
          { region_name: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { last_used: 'desc' }
    });
    
    if (cached) {
      // Update last used timestamp
      await prisma.destinationCache.update({
        where: { id: cached.id },
        data: { 
          last_used: new Date(),
          hit_count: { increment: 1 }
        }
      });
      
      console.log(`✅ [TIER 2] Cache hit: ${query} → ${cached.region_id}`);
      return {
        region_id: cached.region_id,
        region_name: cached.region_name
      };
    }
    
    console.log(`⚠️ [TIER 2] Cache miss: ${query}`);
    return null;
    
  } catch (error) {
    console.error('❌ [TIER 2] Cache error:', error);
    return null;
  }
}

/**
 * Search destination via ETG API and cache result
 */
async function findViaAPI(query) {
  try {
    console.log(`🔍 [TIER 3] Calling ETG API for: ${query}`);
    
    const results = await searchRegions(query);
    
    if (!results || results.length === 0) {
      console.log(`⚠️ [TIER 3] No results from ETG for: ${query}`);
      return null;
    }
    
    // Get the best match (first result, usually most relevant)
    const bestMatch = results[0];
    const region = {
      region_id: bestMatch.id,
      region_name: bestMatch.name || bestMatch.full_name || query
    };
    
    console.log(`✅ [TIER 3] Found via API: ${query} → ${region.region_id} (${region.region_name})`);
    
    // Cache for future use
    try {
      await prisma.destinationCache.create({
        data: {
          search_query: query,
          region_id: region.region_id,
          region_name: region.region_name,
          region_data: bestMatch,
          last_used: new Date()
        }
      });
      console.log(`💾 Cached destination: ${query}`);
    } catch (cacheError) {
      // Non-fatal - continue without caching
      console.error('⚠️ Cache write failed:', cacheError.message);
    }
    
    return region;
    
  } catch (error) {
    console.error('❌ [TIER 3] API error:', error);
    return null;
  }
}

/**
 * Main resolver function
 * Resolves destination to region_id using 3-tier strategy
 * 
 * @param {string} destination - City name, slug, or region ID
 * @returns {Promise<Object>} - { region_id, region_name }
 */
export async function resolveDestination(destination) {
  if (!destination) {
    throw new Error('Destination is required');
  }
  
  let queryToResolve = String(destination).trim();
  
  // Handle slug format (e.g., "united_states_of_america/los_angeles")
  if (queryToResolve.includes('/')) {
    const parsed = parseSlugFormat(queryToResolve);
    if (parsed) {
      queryToResolve = parsed;
    }
  }
  
  // Check if it's already a region_id (numeric)
  if (!isNaN(queryToResolve) && Number.isInteger(Number(queryToResolve))) {
    const region_id = Number(queryToResolve);
    console.log(`✅ [TIER 0] Already a region_id: ${region_id}`);
    return {
      region_id,
      region_name: `Region ${region_id}`
    };
  }
  
  // Tier 1: Static map with fuzzy matching
  const staticMatch = findInStaticMap(queryToResolve);
  if (staticMatch) {
    return staticMatch;
  }
  
  // Tier 2: Database cache
  const cachedMatch = await findInCache(queryToResolve);
  if (cachedMatch) {
    return cachedMatch;
  }
  
  // Tier 3: ETG API
  const apiMatch = await findViaAPI(queryToResolve);
  if (apiMatch) {
    return apiMatch;
  }
  
  // Not found anywhere
  console.error(`❌ Destination not found: ${queryToResolve}`);
  throw new Error(`Destination not found: ${queryToResolve}`);
}

export default {
  resolveDestination
};