import { WorldOTAService } from "../../services/worldotaService.js";

// Initialize service with error handling
let worldotaService;
try {
  worldotaService = new WorldOTAService();
} catch (error) {
  console.error("❌ Failed to initialize WorldOTAService:", error);
  // Create a fallback service that returns empty results
  worldotaService = {
    multicomplete: async () => ({
      success: false,
      error: "Service initialization failed",
      hotels: [],
      regions: [],
    }),
  };
}

/**
 * Destination Controller
 * Uses WorldOTA B2B API multicomplete endpoint instead of public RateHawk API
 */
const destinationController = async (req, res) => {
  const startTime = Date.now();
  const { query } = req.body;
  
  // #region agent log
  if (typeof fetch !== 'undefined') {
    fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DestinationController.js:9',message:'Destination controller entry',data:{hasQuery:!!query,query:query},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }
  // #endregion
  
  console.log("🔍 === DESTINATION SEARCH ===");
  console.log(`📝 Query: "${query}"`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  try {
    if (!query || query.trim().length === 0) {
      // #region agent log
      if (typeof fetch !== 'undefined') {
        fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DestinationController.js:20',message:'Missing query parameter',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      }
      // #endregion
      return res.status(400).json({
        success: false,
        error: "Query parameter is required",
        timestamp: new Date().toISOString(),
      });
    }

    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DestinationController.js:30',message:'Calling multicomplete',data:{query:query.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion

    // Use B2B API multicomplete instead of public API
    const result = await worldotaService.multicomplete({
      query: query.trim(),
      language: "en",
    });

    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DestinationController.js:38',message:'multicomplete returned',data:{success:result.success,hotelsCount:result.hotels?.length||0,regionsCount:result.regions?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion

    const duration = Date.now() - startTime;

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch destinations");
    }

    // Transform B2B API response to match expected frontend format
    // Ensure all IDs are strings to prevent .startsWith() errors on numeric IDs
    const transformedData = {
      hotels: (result.hotels || []).map((hotel, index) => {
        try {
          return {
            ...hotel,
            id: String(hotel.id || hotel.hotel_id || hotel.region_id || `hotel_${index}`),
            // Ensure any nested ID fields are also strings
            ...(hotel.region_id && { region_id: String(hotel.region_id) }),
          };
        } catch (transformError) {
          console.error(`⚠️ Error transforming hotel at index ${index}:`, transformError);
          return {
            ...hotel,
            id: String(hotel.id || `hotel_${index}`),
          };
        }
      }),
      regions: (result.regions || []).map((region, index) => {
        try {
          return {
            ...region,
            id: String(region.id || region.region_id || `region_${index}`),
            // Ensure any nested ID fields are also strings
            ...(region.region_id && { region_id: String(region.region_id) }),
          };
        } catch (transformError) {
          console.error(`⚠️ Error transforming region at index ${index}:`, transformError);
          return {
            ...region,
            id: String(region.id || `region_${index}`),
          };
        }
      }),
      query: query.trim(),
    };

    // Log response structure for debugging
    console.log(`✅ Transformed ${transformedData.hotels.length} hotels and ${transformedData.regions.length} regions`);
    if (transformedData.hotels.length > 0) {
      console.log(`📊 Sample hotel ID type: ${typeof transformedData.hotels[0].id}, value: ${transformedData.hotels[0].id}`);
    }
    if (transformedData.regions.length > 0) {
      console.log(`📊 Sample region ID type: ${typeof transformedData.regions[0].id}, value: ${transformedData.regions[0].id}`);
    }

    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DestinationController.js:52',message:'Sending success response',data:{statusCode:200,hotelsCount:transformedData.hotels.length,regionsCount:transformedData.regions.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion

    return res.json(transformedData);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Destination search error:", error.message);
    console.error("💥 Destination search error stack:", error.stack);
    
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DestinationController.js:65',message:'Destination catch block',data:{errorMessage:error.message,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
    
    return res.status(503).json({
      success: false,
      error: `Destination lookup failed: ${error.message}`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

export default destinationController;