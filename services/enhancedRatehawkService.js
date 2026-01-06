/**
 * Enhanced RateHawk Service
 * 
 * Note: This service was removed during merge. Hotel details functionality
 * has been moved to other services.
 */

/**
 * Fetch single hotel booking data (stub - deprecated)
 * @param {Object} hotel - Hotel object
 * @param {string} searchSessionId - Search session ID
 * @param {Object} userSession - User session
 * @param {Object} searchParams - Search parameters
 * @returns {Object} - Error response
 */
export async function fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams) {
  console.warn("⚠️ fetchSingleHotelBookingData is deprecated");
  
  return {
    success: false,
    error: "This service has been moved. Please use the new hotel details endpoints.",
    hotelDetails: null,
  };
}

