/**
 * RateHawk Search Service
 * 
 * Note: This service was removed during merge. The old session-based search
 * has been replaced with WorldOTA B2B API routes that don't require sessions.
 * 
 * New routes to use instead:
 * - POST /api/ratehawk/search/by-poi - Search by Point of Interest
 * - POST /api/ratehawk/search/by-geo - Search by geographic coordinates
 * - POST /api/ratehawk/search/by-ids - Search by hotel IDs
 */

/**
 * Search hotels (stub - deprecated)
 * @param {Object} params - Search parameters
 * @returns {Object} - Error response directing to new routes
 */
export async function searchHotels(params) {
  console.warn("⚠️ Old searchHotels function called - this route is deprecated");
  console.warn("   Use new WorldOTA B2B API routes instead:");
  console.warn("   - POST /api/ratehawk/search/by-poi");
  console.warn("   - POST /api/ratehawk/search/by-geo");
  console.warn("   - POST /api/ratehawk/search/by-ids");
  
  return {
    success: false,
    error: "This search method is deprecated. Please use the new WorldOTA B2B API routes: /api/ratehawk/search/by-poi, /api/ratehawk/search/by-geo, or /api/ratehawk/search/by-ids",
    hotels: [],
    totalHotels: 0,
    availableHotels: 0,
  };
}

