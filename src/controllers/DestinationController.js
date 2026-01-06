import { WorldOTAService } from "../../services/worldotaService.js";

const worldotaService = new WorldOTAService();

/**
 * Destination Controller
 * Uses WorldOTA B2B API multicomplete endpoint instead of public RateHawk API
 */
const destinationController = async (req, res) => {
  const startTime = Date.now();
  const { query } = req.body;
  
  console.log("🔍 === DESTINATION SEARCH ===");
  console.log(`📝 Query: "${query}"`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  try {
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Use B2B API multicomplete instead of public API
    const result = await worldotaService.multicomplete({
      query: query.trim(),
      language: "en",
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch destinations");
    }

    // Transform B2B API response to match expected frontend format
    const transformedData = {
      hotels: result.hotels || [],
      regions: result.regions || [],
      query: query.trim(),
    };

    res.json(transformedData);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Destination search error:", error.message);
    
    res.status(503).json({
      success: false,
      error: `Destination lookup failed: ${error.message}`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

export default destinationController;