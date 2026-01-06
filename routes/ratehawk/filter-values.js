/**
 * RateHawk Filter Values Routes
 * Handles fetching filter values (amenities, star ratings, etc.)
 */

import express from "express";
import { WorldOTAService } from "../../services/worldotaService.js";

const router = express.Router();

// Initialize service with error handling
let worldotaService;
try {
  worldotaService = new WorldOTAService();
} catch (error) {
  console.error("❌ Failed to initialize WorldOTAService:", error);
  // Create a fallback service that returns defaults
  worldotaService = {
    getFilterValues: async () => ({
      success: true,
      data: {
        languages: ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"],
        countries: [],
        amenities: [],
        star_ratings: [1, 2, 3, 4, 5],
        hotel_types: [],
        note: "Using default values - Service initialization failed"
      },
      status: "default",
    }),
  };
}

// ================================
// FILTER VALUES
// ================================

/**
 * GET /api/ratehawk/filter-values
 * Get available filter values from WorldOTA API
 */
router.get("/filter-values", async (req, res) => {
  const startTime = Date.now();
  
  console.log("🔍 === FILTER VALUES REQUEST ===");
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  try {
    const filterValuesResult = await worldotaService.getFilterValues();
    
    const duration = Date.now() - startTime;
    
    // Normalize the response to ensure all expected arrays exist
    // This prevents frontend errors when calling .map() on undefined
    const rawData = filterValuesResult.data || {};
    const normalizedData = {
      languages: Array.isArray(rawData.languages) ? rawData.languages : ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"],
      countries: Array.isArray(rawData.countries) ? rawData.countries : [],
      amenities: Array.isArray(rawData.amenities) ? rawData.amenities : [],
      star_ratings: Array.isArray(rawData.star_ratings) ? rawData.star_ratings : [1, 2, 3, 4, 5],
      hotel_types: Array.isArray(rawData.hotel_types) ? rawData.hotel_types : [],
      // Preserve any other fields from the API response
      ...(typeof rawData === 'object' && rawData !== null ? Object.fromEntries(
        Object.entries(rawData).filter(([key]) => 
          !['languages', 'countries', 'amenities', 'star_ratings', 'hotel_types'].includes(key)
        )
      ) : {}),
    };
    
    // getFilterValues() always returns success: true (even for 403, it returns defaults)
    // So we can safely return the result
    const response = {
      success: true,
      message: "Filter values fetched successfully",
      data: normalizedData,
      status: filterValuesResult.status || "ok",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
    
    return res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Filter values error:", error.message);
    console.error("💥 Filter values error stack:", error.stack);
    
    // Return default values instead of 500 error
    const defaultResponse = {
      success: true,
      message: "Using default filter values (API unavailable)",
      data: {
        languages: ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"],
        countries: [],
        amenities: [],
        star_ratings: [1, 2, 3, 4, 5],
        hotel_types: [],
        note: "Using default values - API error occurred"
      },
      status: "default",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
    
    return res.json(defaultResponse);
  }
});

export default router;
