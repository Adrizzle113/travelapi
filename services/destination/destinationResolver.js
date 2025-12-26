/**
 * Destination Resolver with 3-Tier Strategy
 * Tier 1: Static map (instant lookup for popular cities)
 * Tier 2: Database cache (previously resolved destinations)
 * Tier 3: ETG API (fallback for unknown destinations)
 */

import { PrismaClient } from '@prisma/client';
import { searchRegions } from '../etg/etgClient.js';

const prisma = new PrismaClient();

// ================================
// TIER 1: STATIC DESTINATIONS MAP
// ================================
const STATIC_DESTINATIONS = {
  // United States - Major Cities
  'New York': { region_id: 2621, region_name: 'New York City' },
  'New York City': { region_id: 2621, region_name: 'New York City' },
  'NYC': { region_id: 2621, region_name: 'New York City' },
  'Los Angeles': { region_id: 1555, region_name: 'Los Angeles' },
  'Los Angeles, California': { region_id: 1555, region_name: 'Los Angeles' },
  'LA': { region_id: 1555, region_name: 'Los Angeles' },
  'Chicago': { region_id: 2358, region_name: 'Chicago' },
  'Chicago, Illinois': { region_id: 2358, region_name: 'Chicago' },
  'Miami': { region_id: 2199, region_name: 'Miami' },
  'Miami, Florida': { region_id: 2199, region_name: 'Miami' },
  'San Francisco': { region_id: 2674, region_name: 'San Francisco' },
  'San Francisco, California': { region_id: 2674, region_name: 'San Francisco' },
  'Las Vegas': { region_id: 2007, region_name: 'Las Vegas' },
  'Las Vegas, Nevada': { region_id: 2007, region_name: 'Las Vegas' },
  'Orlando': { region_id: 2088, region_name: 'Orlando' },
  'Orlando, Florida': { region_id: 2088, region_name: 'Orlando' },
  'Seattle': { region_id: 2693, region_name: 'Seattle' },
  'Seattle, Washington': { region_id: 2693, region_name: 'Seattle' },
  'Boston': { region_id: 2279, region_name: 'Boston' },
  'Boston, Massachusetts': { region_id: 2279, region_name: 'Boston' },
  'Washington': { region_id: 2760, region_name: 'Washington, D.C.' },
  'Washington DC': { region_id: 2760, region_name: 'Washington, D.C.' },
  'Washington, D.C.': { region_id: 2760, region_name: 'Washington, D.C.' },
  'San Diego': { region_id: 2672, region_name: 'San Diego' },
  'San Diego, California': { region_id: 2672, region_name: 'San Diego' },
  'Denver': { region_id: 2422, region_name: 'Denver' },
  'Denver, Colorado': { region_id: 2422, region_name: 'Denver' },
  'Atlanta': { region_id: 2246, region_name: 'Atlanta' },
  'Atlanta, Georgia': { region_id: 2246, region_name: 'Atlanta' },
  'Phoenix': { region_id: 2633, region_name: 'Phoenix' },
  'Phoenix, Arizona': { region_id: 2633, region_name: 'Phoenix' },
  'Dallas': { region_id: 2405, region_name: 'Dallas' },
  'Dallas, Texas': { region_id: 2405, region_name: 'Dallas' },
  'Houston': { region_id: 2508, region_name: 'Houston' },
  'Houston, Texas': { region_id: 2508, region_name: 'Houston' },
  'Nashville': { region_id: 2222, region_name: 'Nashville' },
  'Nashville, Tennessee': { region_id: 2222, region_name: 'Nashville' },
  'Austin': { region_id: 2251, region_name: 'Austin' },
  'Austin, Texas': { region_id: 2251, region_name: 'Austin' },
  'Portland': { region_id: 2644, region_name: 'Portland' },
  'Portland, Oregon': { region_id: 2644, region_name: 'Portland' },
  'New Orleans': { region_id: 2207, region_name: 'New Orleans' },
  'New Orleans, Louisiana': { region_id: 2207, region_name: 'New Orleans' },
  
  // California - Additional Cities
  'Long Beach': { region_id: 2058, region_name: 'Long Beach' },
  'Long Beach, California': { region_id: 2058, region_name: 'Long Beach' },
  'West Hollywood': { region_id: 10371, region_name: 'West Hollywood' },
  'West Hollywood, California': { region_id: 10371, region_name: 'West Hollywood' },
  'Beverly Hills': { region_id: 6912, region_name: 'Beverly Hills' },
  'Beverly Hills, California': { region_id: 6912, region_name: 'Beverly Hills' },
  'Santa Monica': { region_id: 2702, region_name: 'Santa Monica' },
  'Santa Monica, California': { region_id: 2702, region_name: 'Santa Monica' },
  'Pasadena': { region_id: 2626, region_name: 'Pasadena' },
  'Pasadena, California': { region_id: 2626, region_name: 'Pasadena' },
  'Anaheim': { region_id: 2223, region_name: 'Anaheim' },
  'Anaheim, California': { region_id: 2223, region_name: 'Anaheim' },
  
  // International - Major Cities
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
  'Berlin': { region_id: 536, region_name: 'Berlin' },
  'Madrid': { region_id: 2155, region_name: 'Madrid' },
  'Lisbon': { region_id: 2109, region_name: 'Lisbon' },
  'Dublin': { region_id: 2454, region_name: 'Dublin' },
};

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Normalize destination string for matching
 */
function normalizeQuery(query) {
  return query
    .trim()
    .toLowerCase()
    .replace(/,.*$/, '') // Remove state/country suffix
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Parse slug format (e.g., "united_states_of_america/los_angeles")
 */
function parseSlug(slug) {
  if (!slug || !slug.includes('/')) {
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

// ================================
// TIER 1: STATIC MAP
// ================================

/**
 * Find destination in static map with fuzzy matching
 */
function findInStaticMap(query) {
  const normalized = normalizeQuery(query);
  
  // Try exact match first
  for (const [key, value] of Object.entries(STATIC_DESTINATIONS)) {
    if (normalizeQuery(key) === normalized) {
      console.log(`✅ [TIER 1] Static match: ${query} → ${value.region_id}`);
      return value;
    }
  }
  
  // Try partial/fuzzy match
  for (const [key, value] of Object.entries(STATIC_DESTINATIONS)) {
    const normalizedKey = normalizeQuery(key);
    
    // Check if query is contained in key or vice versa
    if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      console.log(`✅ [TIER 1] Fuzzy match: ${query} → ${key} (${value.region_id})`);
      return value;
    }
  }
  
  console.log(`⚠️ [TIER 1] No static match for: ${query}`);
  return null;
}

// ================================
// TIER 2: DATABASE CACHE
// ================================

/**
 * Search destination in database cache
 */
async function findInCache(query) {
  try {
    const normalized = normalizeQuery(query);
    
    const cached = await prisma.destinationCache.findFirst({
      where: {
        OR: [
          { destination_name: { equals: query, mode: 'insensitive' } },
          { destination_name: { equals: normalized, mode: 'insensitive' } },
          { destination_name: { contains: query, mode: 'insensitive' } },
          { region_name: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: {
        last_verified: 'desc'
      }
    });
    
    if (cached) {
      // Update last_verified timestamp
      try {
        await prisma.destinationCache.update({
          where: { id: cached.id },
          data: { last_verified: new Date() }
        });
      } catch (updateError) {
        // Non-fatal - continue
        console.warn('⚠️ Could not update last_verified:', updateError.message);
      }
      
      console.log(`✅ [TIER 2] Cache hit: ${query} → ${cached.region_id}`);
      return {
        region_id: cached.region_id,
        region_name: cached.region_name || `Region ${cached.region_id}`
      };
    }
    
    console.log(`⚠️ [TIER 2] Cache miss for: ${query}`);
    return null;
    
  } catch (error) {
    console.error('❌ [TIER 2] Cache error:', error.message);
    return null;
  }
}

// ================================
// TIER 3: ETG API
// ================================

/**
 * Search via ETG API and cache result
 */
async function findViaETG(query) {
  try {
    console.log(`🔍 [TIER 3] Calling ETG API for: ${query}`);
    
    const regions = await searchRegions(query);
    
    if (!regions || regions.length === 0) {
      console.log(`⚠️ [TIER 3] No results from ETG for: ${query}`);
      return null;
    }
    
    const bestMatch = regions[0];
    const result = {
      region_id: bestMatch.id,
      region_name: bestMatch.name || query
    };
    
    console.log(`✅ [TIER 3] ETG found: ${query} → ${result.region_id} (${result.region_name})`);
    
    // Cache the result
    try {
      await prisma.destinationCache.upsert({
        where: {
          destination_name: query
        },
        update: {
          region_id: result.region_id,
          region_name: result.region_name,
          last_verified: new Date()
        },
        create: {
          destination_name: query,
          region_id: result.region_id,
          region_name: result.region_name
        }
      });
      console.log(`💾 Cached destination: ${query} → ${result.region_id}`);
    } catch (cacheError) {
      // Non-fatal - continue without caching
      console.warn('⚠️ Cache write failed:', cacheError.message);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ [TIER 3] ETG API error:', error.message);
    return null;
  }
}

// ================================
// MAIN RESOLVER
// ================================

/**
 * Resolve destination to region_id using 3-tier strategy
 * 
 * @param {string|number} destination - City name, slug, or region_id
 * @returns {Promise<Object>} { region_id, region_name }
 */
export async function resolveDestination(destination) {
  if (!destination) {
    throw new Error('Destination is required');
  }
  
  let query = String(destination).trim();
  
  // Handle slug format (e.g., "united_states_of_america/los_angeles")
  if (query.includes('/')) {
    const parsed = parseSlug(query);
    if (parsed) {
      query = parsed;
    }
  }
  
  // Check if it's already a numeric region_id
  if (!isNaN(query) && Number.isInteger(Number(query))) {
    const region_id = Number(query);
    console.log(`✅ [TIER 0] Numeric region_id provided: ${region_id}`);
    return {
      region_id,
      region_name: `Region ${region_id}`
    };
  }
  
  // Tier 1: Static map (instant lookup)
  const staticMatch = findInStaticMap(query);
  if (staticMatch) {
    return staticMatch;
  }
  
  // Tier 2: Database cache (fast lookup)
  const cachedMatch = await findInCache(query);
  if (cachedMatch) {
    return cachedMatch;
  }
  
  // Tier 3: ETG API (network call)
  const etgMatch = await findViaETG(query);
  if (etgMatch) {
    return etgMatch;
  }
  
  // Not found anywhere
  console.error(`❌ Destination not found: ${query}`);
  throw new Error(`Destination not found: ${query}`);
}

export default {
  resolveDestination
};