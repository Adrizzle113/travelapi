/**
 * RateHawk POI (Points of Interest) Routes
 * Handles fetching nearby places, airports, subways
 */

import express from "express";
import { 
  getPOICache, 
  needsPOIRefresh, 
  refreshPOICache, 
  transformPOIData 
} from "../../utils/ratehawk-helpers.js";

const router = express.Router();

// RateHawk API Credentials
const RATEHAWK_CREDENTIALS = {
  username: "11606",
  password: "ff9702bb-ba93-4996-a31e-547983c51530",
};

// ================================
// GET POI FOR HOTEL
// ================================

router.get("/hotel/:hotelId/poi", async (req, res) => {
  const startTime = Date.now();
  const { hotelId } = req.params;

  console.log("📍 === HOTEL POI REQUEST ===");
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  try {
    // Check if we need to refresh the POI cache
    if (needsPOIRefresh()) {
      console.log("🔄 POI cache expired or missing, fetching new dump...");
      await refreshPOICache(RATEHAWK_CREDENTIALS);
    } else {
      console.log("✅ Using cached POI data");
    }

    // Get cache
    const { data: poiCache } = getPOICache();

    // Find POI data for this specific hotel
    const hotelPOI = poiCache?.find(hotel => 
      hotel.id === hotelId || hotel.hid?.toString() === hotelId
    );

    if (!hotelPOI || !hotelPOI.pois || hotelPOI.pois.length === 0) {
      console.log(`⚠️ No POI data found for hotel: ${hotelId}`);
      return res.json({
        success: true,
        data: {
          nearby: [],
          airports: [],
          subways: [],
          placesOfInterest: [],
        },
        metadata: {
          hotelId,
          poisFound: 0,
          source: "ETG POI Dump",
          timestamp: new Date().toISOString(),
        }
      });
    }

    // Transform POI data into categorized format
    const transformedPOI = transformPOIData(hotelPOI.pois);

    const duration = Date.now() - startTime;
    console.log(`✅ POI data retrieved in ${duration}ms`);
    console.log(`   Total POIs: ${hotelPOI.pois.length}`);
    console.log(`   Nearby: ${transformedPOI.nearby.length}`);
    console.log(`   Airports: ${transformedPOI.airports.length}`);
    console.log(`   Subways: ${transformedPOI.subways.length}`);
    console.log(`   Places of Interest: ${transformedPOI.placesOfInterest.length}`);

    res.json({
      success: true,
      data: transformedPOI,
      metadata: {
        hotelId,
        poisFound: hotelPOI.pois.length,
        source: "ETG POI Dump",
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 POI fetch error:", error.message);

    res.status(500).json({
      success: false,
      error: `Failed to fetch POI data: ${error.message}`,
      hotelId,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

// ================================
// MANUAL CACHE REFRESH
// ================================

router.post("/poi/refresh-cache", async (req, res) => {
  try {
    console.log("🔄 Manual POI cache refresh requested");
    await refreshPOICache(RATEHAWK_CREDENTIALS);
    
    const { data: poiCache } = getPOICache();
    
    res.json({
      success: true,
      message: "POI cache refreshed successfully",
      hotelsInCache: poiCache?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Cache refresh error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
