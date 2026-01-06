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
  
  // #region agent log
  if (typeof fetch !== 'undefined') {
    fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filter-values.js:20',message:'Filter values route entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
  
  console.log("🔍 === FILTER VALUES REQUEST ===");
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  try {
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filter-values.js:27',message:'Calling getFilterValues',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    const filterValuesResult = await worldotaService.getFilterValues();
    
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filter-values.js:32',message:'getFilterValues returned',data:{success:filterValuesResult.success,hasData:!!filterValuesResult.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    const duration = Date.now() - startTime;
    
    // getFilterValues() always returns success: true (even for 403, it returns defaults)
    // So we can safely return the result
    const response = {
      success: true,
      message: "Filter values fetched successfully",
      data: filterValuesResult.data,
      status: filterValuesResult.status || "ok",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
    
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filter-values.js:45',message:'Sending success response',data:{statusCode:200},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    return res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Filter values error:", error.message);
    console.error("💥 Filter values error stack:", error.stack);
    
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filter-values.js:55',message:'Filter values catch block',data:{errorMessage:error.message,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
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
    
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'filter-values.js:75',message:'Sending default response',data:{statusCode:200},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    return res.json(defaultResponse);
  }
});

export default router;

