/**
 * RateHawk POI Routes - FIXED VERSION
 * Pre-loads POI dump at server startup to avoid timeouts
 */

import express from "express";
import axios from "axios";

const router = express.Router();

// RateHawk API Credentials
const RATEHAWK_CREDENTIALS = {
  username: "11606",
  password: "ff9702bb-ba93-4996-a31e-547983c51530",
};

// ================================
// POI CACHE - NEVER EXPIRES
// ================================

let poiCache = null;
let poiCacheTime = null;
let poiCacheLoading = false;

/**
 * Transform POI data into categorized format
 */
function transformPOIData(pois) {
  const result = {
    nearby: [],
    airports: [],
    subways: [],
    placesOfInterest: [],
  };

  if (!pois || pois.length === 0) {
    return result;
  }

  pois.forEach(poi => {
    const distanceKm = (poi.distance / 1000).toFixed(1);
    const distanceM = poi.distance;
    
    const item = {
      name: poi.poi_name_en || poi.poi_name,
      distance: poi.distance < 1000 ? `${distanceM} m` : `${distanceKm} km`,
      type: poi.poi_type,
      subtype: poi.poi_subtype,
    };

    // Categorize POIs
    if (poi.poi_type === 'Airport') {
      result.airports.push(item);
    } 
    else if (poi.poi_type === 'Subway (Entrace)') {
      result.subways.push(item);
    }
    else if (poi.poi_type === 'Point of Interest') {
      const specialSubtypes = ['museum', 'historical_poi', 'park', 'theater', 'beach', 'shopping'];
      if (specialSubtypes.includes(poi.poi_subtype)) {
        result.placesOfInterest.push(item);
      } else {
        result.nearby.push(item);
      }
    }
    else {
      result.nearby.push(item);
    }
  });

  // Sort by distance
  const sortByDistance = (a, b) => {
    const distA = parseFloat(a.distance);
    const distB = parseFloat(b.distance);
    return distA - distB;
  };

  result.nearby.sort(sortByDistance);
  result.airports.sort(sortByDistance);
  result.subways.sort(sortByDistance);
  result.placesOfInterest.sort(sortByDistance);

  // Limit results
  result.nearby = result.nearby.slice(0, 10);
  result.airports = result.airports.slice(0, 5);
  result.subways = result.subways.slice(0, 10);
  result.placesOfInterest = result.placesOfInterest.slice(0, 10);

  return result;
}

/**
 * Initialize POI cache at server startup
 * THIS FUNCTION IS CALLED FROM server.js
 */
export async function initializePOICache() {
  if (poiCacheLoading) {
    console.log("⏳ POI cache initialization already in progress...");
    return;
  }

  try {
    poiCacheLoading = true;
    console.log("🚀 === INITIALIZING POI CACHE AT STARTUP ===");
    
    // Step 1: Get dump URL from RateHawk
    console.log("📡 Requesting POI dump URL from RateHawk...");
    const dumpUrlResponse = await axios.post(
      "https://api.worldota.net/api/b2b/v3/hotel/poi/dump/",
      { language: "en" },
      {
        auth: RATEHAWK_CREDENTIALS,
        headers: { "Content-Type": "application/json" },
        timeout: 10000, // 10 seconds for URL request
      }
    );

    if (!dumpUrlResponse.data?.data?.url) {
      throw new Error("POI dump URL not returned from API");
    }

    const dumpUrl = dumpUrlResponse.data.data.url;
    console.log(`📥 POI dump URL obtained: ${dumpUrl}`);

    // Step 2: Download dump file (this is the slow part)
    console.log("⏬ Downloading POI dump... (this may take 30-60 seconds)");
    const startTime = Date.now();
    
    const dumpResponse = await axios.get(dumpUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minutes timeout for download
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (percentCompleted % 20 === 0) {
          console.log(`📊 Download progress: ${percentCompleted}%`);
        }
      }
    });

    const downloadDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ POI dump downloaded in ${downloadDuration}s`);

    // Step 3: Parse JSON
    console.log("🔍 Parsing POI dump...");
    const parseStart = Date.now();
    
    let poiData;
    try {
      const textData = Buffer.from(dumpResponse.data).toString('utf-8');
      poiData = JSON.parse(textData);
    } catch (parseError) {
      console.log("⚠️ POI dump appears to be compressed (.zst format)");
      console.log("📝 Zstandard decompression not implemented yet");
      console.log("💡 Solution: RateHawk should provide uncompressed JSON or we need zstd package");
      
      // Set empty cache instead of failing
      poiCache = [];
      poiCacheTime = Date.now();
      poiCacheLoading = false;
      return;
    }

    const parseDuration = ((Date.now() - parseStart) / 1000).toFixed(1);
    console.log(`✅ POI dump parsed in ${parseDuration}s`);

    // Step 4: Store in cache
    poiCache = Array.isArray(poiData) ? poiData : [];
    poiCacheTime = Date.now();
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`🎉 POI CACHE INITIALIZED SUCCESSFULLY!`);
    console.log(`   📦 Hotels with POI data: ${poiCache.length.toLocaleString()}`);
    console.log(`   ⏱️ Total initialization time: ${totalDuration}s`);
    
    poiCacheLoading = false;

  } catch (error) {
    poiCacheLoading = false;
    console.error("💥 FAILED TO INITIALIZE POI CACHE:", error.message);
    
    // Set empty cache so server can still start
    if (!poiCache) {
      poiCache = [];
      poiCacheTime = Date.now();
    }
    
    console.log("⚠️ POI endpoints will return empty data");
    console.log("💡 Server will continue running without POI data");
  }
}

// ================================
// GET POI FOR HOTEL
// ================================

router.get("/hotel/:hotelId/poi", async (req, res) => {
  const startTime = Date.now();
  const { hotelId } = req.params;

  console.log("📍 === HOTEL POI REQUEST ===");
  console.log(`🏨 Hotel ID: ${hotelId}`);

  try {
    // Check if cache is initialized
    if (!poiCache) {
      console.log("⚠️ POI cache not yet initialized");
      return res.status(503).json({
        success: false,
        error: "POI data is still being loaded. Please try again in a few moments.",
        loading: poiCacheLoading,
        timestamp: new Date().toISOString(),
      });
    }

    // Find POI data for this specific hotel
    const hotelPOI = poiCache.find(hotel => 
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

    // Transform POI data
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
        source: "ETG POI Dump (Pre-loaded)",
        cacheAge: Math.round((Date.now() - poiCacheTime) / 1000 / 60) + " minutes",
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
// MANUAL CACHE REFRESH (Admin only)
// ================================

router.post("/poi/refresh-cache", async (req, res) => {
  try {
    console.log("🔄 Manual POI cache refresh requested");
    
    if (poiCacheLoading) {
      return res.status(429).json({
        success: false,
        error: "POI cache refresh already in progress",
        timestamp: new Date().toISOString(),
      });
    }

    // Trigger refresh in background
    initializePOICache().catch(err => {
      console.error("Background POI refresh failed:", err);
    });
    
    res.json({
      success: true,
      message: "POI cache refresh initiated in background",
      currentHotelsInCache: poiCache?.length || 0,
      cacheAge: poiCacheTime ? Math.round((Date.now() - poiCacheTime) / 1000 / 60) + " minutes" : "N/A",
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

// ================================
// POI CACHE STATUS (Debug endpoint)
// ================================

router.get("/poi/status", (req, res) => {
  res.json({
    cacheInitialized: !!poiCache,
    hotelsInCache: poiCache?.length || 0,
    cacheAge: poiCacheTime ? Math.round((Date.now() - poiCacheTime) / 1000 / 60) + " minutes" : "N/A",
    loading: poiCacheLoading,
    lastInitialized: poiCacheTime ? new Date(poiCacheTime).toISOString() : null,
    timestamp: new Date().toISOString(),
  });
});

export default router;