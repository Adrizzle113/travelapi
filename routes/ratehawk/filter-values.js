/**
 * Filter Values Routes
 * Provides access to ETG Content API filter values with caching
 */

import express from "express";
import { getFilterValues } from "../../services/content/filterValuesService.js";

const router = express.Router();

// ================================
// GET FILTER VALUES
// ================================

/**
 * GET /api/ratehawk/filter-values
 * Get all available filter values for hotel search
 * 
 * Returns:
 * - language: Array of language codes with descriptions
 * - country: Array of country codes with names
 * - serp_filter: Array of SERP filter options (amenities)
 * - star_rating: Array of valid star ratings (0-5)
 * - kind: Array of hotel kinds (Hotel, Resort, etc.)
 * 
 * Response includes cache metadata (from_cache, cache_age_hours)
 */
router.get("/filter-values", async (req, res) => {
  const startTime = Date.now();

  try {
    const filterValues = await getFilterValues();
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: filterValues,
      meta: {
        from_cache: filterValues.from_cache || false,
        cache_age_hours: filterValues.cache_age_hours || 0,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Filter values error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to get filter values",
        code: error.code || "FILTER_VALUES_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

export default router;

