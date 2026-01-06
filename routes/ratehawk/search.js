/**
 * RateHawk Search Routes
 * Handles hotel search functionality
 */

import express from "express";
import { validateSession } from "../../services/ratehawkLoginService.js";
import { searchHotels } from "../../services/ratehawkSearchService.js";
import { WorldOTAService } from "../../services/worldotaService.js";

const router = express.Router();
// #region agent log
fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/ratehawk/search.js:15',message:'Importing WorldOTAService via ES module',data:{importType:'ESM',serviceName:'WorldOTAService'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion
const worldotaService = new WorldOTAService();
// #region agent log
fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/ratehawk/search.js:17',message:'WorldOTAService instantiated successfully',data:{serviceType:typeof worldotaService,hasSearchByPOI:typeof worldotaService.searchHotelsByPOI},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// ================================
// HOTEL SEARCH
// ================================

/**
 * POST /api/ratehawk/search
 * Legacy search endpoint - now uses WorldOTA API (no session required)
 * Accepts destination as region_id (number) or region name (string)
 */
router.post("/search", async (req, res) => {
  const startTime = Date.now();
  const {
    userId,
    destination,
    destId,
    regionId: regionIdFromBody,  // ← Add this
    region_id,                    // ← Add this
    checkin,
    checkout,
    guests,
    residency = "us",
    currency = "USD",
    page = 1,
    filters = {},
  } = req.body;

  console.log("🔍 === LEGACY SEARCH REQUEST (WorldOTA API) ===");
  console.log(`👤 User ID: ${userId || "N/A (not required)"}`);
  console.log(`🗺️ Destination: ${destination}`);
  console.log(`🆔 Dest ID: ${destId || "N/A"}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`💰 Currency: ${currency}`);
  console.log(`🆔 Dest ID: ${destId || regionIdFromBody || region_id || "N/A"}`);

  // Validation - userId is now optional
  if (!destination && !destId) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: destination or destId, checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
    });
  }

  if (!checkin || !checkout || !guests) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
    });
  }

  try {
    let regionId = destId || regionIdFromBody || region_id;

    // If no destId provided, try to parse destination or look it up
    if (!regionId) {
      // Try to parse destination as region_id (if it's numeric)
      const numericDest = parseInt(destination);
      if (!isNaN(numericDest)) {
        regionId = numericDest;
        console.log(`✅ Parsed destination as region_id: ${regionId}`);
      } else {
        // Use multicomplete to find region_id from destination name
        console.log(`🔍 Looking up region_id for destination: "${destination}"`);
        const multicompleteResult = await worldotaService.multicomplete({
          query: destination,
          language: "en",
        });

        if (multicompleteResult.success && multicompleteResult.data?.regions?.length > 0) {
          // Use the first matching region
          regionId = multicompleteResult.data.regions[0].id;
          console.log(`✅ Found region_id: ${regionId} for "${destination}"`);
        } else {
          console.log(`❌ Could not find region_id for "${destination}"`);
          return res.status(400).json({
            success: false,
            error: `Could not find region for destination: ${destination}`,
            hotels: [],
            totalHotels: 0,
            availableHotels: 0,
            searchDuration: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Normalize residency format (e.g., "en-us" -> "us")
    const normalizedResidency = residency.includes("-") 
      ? residency.split("-")[1] 
      : residency;

    // Perform search using WorldOTA API
    const searchResult = await worldotaService.searchHotels({
      regionId: regionId.toString(),
      checkin,
      checkout,
      guests: Array.isArray(guests) ? guests : [{ adults: guests.adults || 2, children: guests.children || [] }],
      residency: normalizedResidency,
      currency,
      language: "en",
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Search completed in ${duration}ms`);

    // Transform response to match expected format
    const response = {
      success: true,
      hotels: searchResult.hotels || [],
      totalHotels: searchResult.totalHotels || 0,
      availableHotels: searchResult.availableHotels || 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      regionId: regionId,
      destination: destination,
    };

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel search error:", error);

    res.status(500).json({
      success: false,
      error: `Search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      debug: {
        userId: userId,
        destination: destination,
        destId: destId,
        errorType: error.name || "Unknown",
      },
    });
  }
});

// ================================
// WORLDOTA API SEARCH ROUTES
// ================================

/**
 * POST /api/ratehawk/search/by-poi
 * Search hotels by Point of Interest name
 * Geocodes POI name to coordinates, then searches nearby hotels
 */
router.post("/search/by-poi", async (req, res) => {
  const startTime = Date.now();
  const {
    poiName,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    radius = 5000,
    residency = "us",
    currency = "USD",
  } = req.body;

  console.log("🔍 === POI SEARCH REQUEST ===");
  console.log(`📍 POI Name: ${poiName}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`📏 Radius: ${radius}m`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`💰 Currency: ${currency}`);

  // Validation
  if (!poiName || !checkin || !checkout || !guests) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: poiName, checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Normalize residency format (remove 'en-' prefix if present)
    const normalizedResidency = residency?.replace('en-', '') || residency || "us";

    const searchResult = await worldotaService.searchHotelsByPOI({
      poiName,
      checkin,
      checkout,
      guests,
      radius,
      residency: normalizedResidency,
      currency,
      language: "en",
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ POI search completed in ${duration}ms`);

    // Add duration and timestamp to result
    const response = {
      ...searchResult,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 POI search error:", error);

    // Handle specific error cases
    if (error.message.includes("MAPBOX_TOKEN")) {
      return res.status(500).json({
        success: false,
        error: "Mapbox token not configured",
        message: "POI search requires MAPBOX_TOKEN environment variable",
        hotels: [],
        totalHotels: 0,
        availableHotels: 0,
        searchDuration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: `POI not found: ${poiName}`,
        message: error.message,
        hotels: [],
        totalHotels: 0,
        availableHotels: 0,
        searchDuration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      success: false,
      error: `POI search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ratehawk/search/by-geo
 * Search hotels by geographic coordinates
 */
router.post("/search/by-geo", async (req, res) => {
  const startTime = Date.now();
  const {
    latitude,
    longitude,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    radius = 5000,
    residency = "us",
    currency = "USD",
  } = req.body;

  console.log("🌍 === GEO SEARCH REQUEST ===");
  console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`📏 Radius: ${radius}m`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`💰 Currency: ${currency}`);

  // Validation
  if (!latitude || !longitude || !checkin || !checkout || !guests) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: latitude, longitude, checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  // Validate radius
  if (radius < 1 || radius > 70000) {
    return res.status(400).json({
      success: false,
      error: "Radius must be between 1 and 70000 meters",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Normalize residency format (remove 'en-' prefix if present)
    const normalizedResidency = residency?.replace('en-', '') || residency || "us";

    const searchResult = await worldotaService.searchHotelsByGeo({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      checkin,
      checkout,
      guests,
      radius: parseInt(radius),
      residency: normalizedResidency,
      currency,
      language: "en",
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Geo search completed in ${duration}ms`);

    // Add duration and timestamp to result
    const response = {
      ...searchResult,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Geo search error:", error);

    res.status(500).json({
      success: false,
      error: `Geo search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ratehawk/search/by-ids
 * Search hotels by hotel IDs
 */
router.post("/search/by-ids", async (req, res) => {
  const startTime = Date.now();
  const {
    ids,
    hids,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    residency = "us",
    currency = "USD",
  } = req.body;

  console.log("🏨 === HOTEL IDS SEARCH REQUEST ===");
  console.log(`🏨 Hotel IDs: ${ids || hids}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`💰 Currency: ${currency}`);

  // Validation
  if ((!ids && !hids) || !checkin || !checkout || !guests) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: ids or hids, checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Normalize residency format (remove 'en-' prefix if present)
    const normalizedResidency = residency?.replace('en-', '') || residency || "us";

    const searchResult = await worldotaService.searchHotelsByIds({
      ids,
      hids,
      checkin,
      checkout,
      guests,
      residency: normalizedResidency,
      currency,
      language: "en",
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Hotel IDs search completed in ${duration}ms`);

    // Add duration and timestamp to result
    const response = {
      ...searchResult,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel IDs search error:", error);

    res.status(500).json({
      success: false,
      error: `Hotel IDs search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
