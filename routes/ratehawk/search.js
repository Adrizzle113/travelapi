/**
 * RateHawk Search Routes
 * Handles hotel search functionality
 */

import express from "express";
import { validateSession } from "../../services/ratehawkLoginService.js";
import { searchHotels } from "../../services/ratehawkSearchService.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { WorldOTAService } = require("../../services/worldotaService.js");

const router = express.Router();
const worldotaService = new WorldOTAService();

// ================================
// HOTEL SEARCH
// ================================

router.post("/search", async (req, res) => {
  const startTime = Date.now();
  const {
    userId,
    destination,
    checkin,
    checkout,
    guests,
    residency = "en-us",
    currency = "USD",
    page = 1,
    filters = {},
  } = req.body;

  console.log("🔍 === RATEHAWK SEARCH REQUEST ===");
  console.log(`👤 User ID: ${userId}`);
  console.log(`🗺️ Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`💰 Currency: ${currency}`);
  console.log(`📄 Page: ${page}`);

  // Validation
  if (!userId || !destination || !checkin || !checkout || !guests) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: userId, destination, checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
    });
  }

  try {
    // Get user session
    const userSession = global.userSessions.get(userId);
    if (!userSession) {
      console.log("❌ No session found for user:", userId);
      return res.status(401).json({
        success: false,
        error: "No RateHawk session found. Please login first.",
        hotels: [],
        totalHotels: 0,
        availableHotels: 0,
      });
    }

    // Validate session
    if (!validateSession(userSession)) {
      console.log("❌ Invalid/expired session for user:", userId);
      global.userSessions.delete(userId);
      return res.status(401).json({
        success: false,
        error: "RateHawk session expired. Please login again.",
        hotels: [],
        totalHotels: 0,
        availableHotels: 0,
      });
    }

    // Update last used timestamp
    userSession.lastUsed = new Date();
    global.userSessions.set(userId, userSession);

    console.log(`✅ Using valid session for search`);

    // Perform search
    const searchResult = await searchHotels({
      userSession,
      destination,
      checkin,
      checkout,
      guests,
      residency,
      currency,
      page,
      filters,
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Search completed in ${duration}ms`);

    // Add duration to result
    searchResult.searchDuration = `${duration}ms`;
    searchResult.timestamp = new Date().toISOString();

    res.json(searchResult);
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
