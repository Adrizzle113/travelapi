/**
 * RateHawk Filter Values Routes
 * Handles fetching filter values (amenities, star ratings, etc.)
 */

import express from "express";
import { WorldOTAService } from "../../services/worldotaService.js";

const router = express.Router();
const worldotaService = new WorldOTAService();

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
    
    // getFilterValues() always returns success: true (even for 403, it returns defaults)
    // So we can safely return the result
    res.json({
      success: true,
      message: "Filter values fetched successfully",
      data: filterValuesResult.data,
      status: filterValuesResult.status || "ok",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Filter values error:", error.message);
    
    // Return default values instead of 500 error
    res.json({
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
    });
  }
});

export default router;

