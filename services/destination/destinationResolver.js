import { PrismaClient } from '@prisma/client';
import { getStaticRegion, normalizeDestination } from '../../config/destinations/staticDestinationMap.js';

const prisma = new PrismaClient();

export async function resolveDestination(destination) {
  const startTime = Date.now();
  
  try {
    const staticResult = getStaticRegion(destination);
    if (staticResult) {
      console.log(`✅ [TIER 1] Static map hit: ${destination} → ${staticResult.region_id}`);
      return {
        region_id: staticResult.region_id,
        region_name: staticResult.region_name,
        country: staticResult.country,
        source: 'static_map',
        latency_ms: Date.now() - startTime
      };
    }

    const normalized = normalizeDestination(destination);
    const cachedResult = await prisma.destinationCache.findUnique({
      where: { destination_name: normalized }
    });

    if (cachedResult) {
      console.log(`✅ [TIER 2] Database cache hit: ${destination} → ${cachedResult.region_id}`);
      
      await prisma.destinationCache.update({
        where: { id: cachedResult.id },
        data: { last_verified: new Date() }
      });

      return {
        region_id: cachedResult.region_id,
        region_name: cachedResult.region_name,
        source: 'database_cache',
        latency_ms: Date.now() - startTime
      };
    }

    console.log(`⚠️ [TIER 3] No cache hit for: ${destination}`);
    return {
      region_id: null,
      region_name: null,
      source: 'not_found',
      latency_ms: Date.now() - startTime,
      error: 'Destination not found in cache'
    };

  } catch (error) {
    console.error('❌ Destination resolution error:', error);
    throw new Error(`Failed to resolve destination: ${error.message}`);
  }
}

export async function cacheDestination(destination, region_id, region_name) {
  const normalized = normalizeDestination(destination);
  
  try {
    await prisma.destinationCache.upsert({
      where: { destination_name: normalized },
      update: { region_id, region_name, last_verified: new Date() },
      create: { destination_name: normalized, region_id, region_name }
    });
    console.log(`✅ Cached destination: ${destination} → ${region_id}`);
  } catch (error) {
    console.error(`❌ Failed to cache destination: ${error.message}`);
  }
}

export default { resolveDestination, cacheDestination };
