/**
 * Destination Resolver with 3-Tier Strategy
 * Tier 1: Static map (instant)
 * Tier 2: Database cache (fast)
 * Tier 3: ETG API (network call)
 */

import { PrismaClient } from '@prisma/client';
import { searchRegions } from '../etg/etgClient.js';

const prisma = new PrismaClient();

// Tier 1: Static destinations map
const STATIC_DESTINATIONS = {
  // US Cities
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
};

function normalizeQuery(query) {
  return query.trim().toLowerCase().replace(/,.*$/, '').replace(/\s+/g, ' ');
}

function parseSlug(slug) {
  if (!slug.includes('/')) return null;
  
  const citySlug = slug.split('/').pop();
  return citySlug
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function findInStaticMap(query) {
  const normalized = normalizeQuery(query);
  
  // Exact match
  for (const [key, value] of Object.entries(STATIC_DESTINATIONS)) {
    if (normalizeQuery(key) === normalized) {
      console.log(`✅ [TIER 1] Static match: ${query} → ${value.region_id}`);
      return value;
    }
  }
  
  // Fuzzy match
  for (const [key, value] of Object.entries(STATIC_DESTINATIONS)) {
    const normalizedKey = normalizeQuery(key);
    if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      console.log(`✅ [TIER 1] Fuzzy match: ${query} → ${key}`);
      return value;
    }
  }
  
  return null;
}

async function findInCache(query) {
  try {
    const cached = await prisma.destinationCache.findFirst({
      where: {
        OR: [
          { search_query: { equals: query, mode: 'insensitive' } },
          { region_name: { contains: query, mode: 'insensitive' } }
        ]
      }
    });
    
    if (cached) {
      await prisma.destinationCache.update({
        where: { id: cached.id },
        data: { last_used: new Date(), hit_count: { increment: 1 } }
      });
      
      console.log(`✅ [TIER 2] Cache hit: ${query} → ${cached.region_id}`);
      return { region_id: cached.region_id, region_name: cached.region_name };
    }
    
    return null;
  } catch (error) {
    console.error('❌ [TIER 2] Cache error:', error);
    return null;
  }
}

async function findViaETG(query) {
  try {
    console.log(`🔍 [TIER 3] Calling ETG API: ${query}`);
    
    const regions = await searchRegions(query);
    
    if (!regions || regions.length === 0) {
      return null;
    }
    
    const bestMatch = regions[0];
    const result = {
      region_id: bestMatch.id,
      region_name: bestMatch.name || query
    };
    
    console.log(`✅ [TIER 3] ETG found: ${query} → ${result.region_id}`);
    
    // Cache it
    try {
      await prisma.destinationCache.create({
        data: {
          search_query: query,
          region_id: result.region_id,
          region_name: result.region_name,
          region_data: bestMatch
        }
      });
    } catch (e) {
      // Ignore cache errors
    }
    
    return result;
  } catch (error) {
    console.error('❌ [TIER 3] ETG error:', error);
    return null;
  }
}

export async function resolveDestination(destination) {
  if (!destination) {
    throw new Error('Destination is required');
  }
  
  let query = String(destination).trim();
  
  // Parse slug format
  if (query.includes('/')) {
    const parsed = parseSlug(query);
    if (parsed) query = parsed;
  }
  
  // Already a region_id?
  if (!isNaN(query) && Number.isInteger(Number(query))) {
    const region_id = Number(query);
    console.log(`✅ [TIER 0] Numeric region_id: ${region_id}`);
    return { region_id, region_name: `Region ${region_id}` };
  }
  
  // Try Tier 1: Static map
  const staticMatch = findInStaticMap(query);
  if (staticMatch) return staticMatch;
  
  // Try Tier 2: Cache
  const cachedMatch = await findInCache(query);
  if (cachedMatch) return cachedMatch;
  
  // Try Tier 3: ETG API
  const etgMatch = await findViaETG(query);
  if (etgMatch) return etgMatch;
  
  // Not found
  throw new Error(`Destination not found: ${query}`);
}

export default { resolveDestination };