/**
 * RateHawk Filter Values Routes
 * Handles fetching filter values (amenities, star ratings, etc.)
 */

import express from "express";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { WorldOTAService } = require("../../services/worldotaService.js");

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
    
    if (!filterValuesResult.success) {
      throw new Error(filterValuesResult.error || "Failed to fetch filter values");
    }

    res.json({
      success: true,
      message: "Filter values fetched successfully",
      data: filterValuesResult.data,
      status: filterValuesResult.status,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Filter values error:", error.message);
    
    res.status(500).json({
      success: false,
      error: `Failed to fetch filter values: ${error.message}`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

