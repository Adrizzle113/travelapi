/**
 * RateHawk Search Routes
 * Handles hotel search functionality
 */

import express from "express";
import { validateSession } from "../../services/ratehawkLoginService.js";
import { searchHotels } from "../../services/ratehawkSearchService.js";

const router = express.Router();

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

export default router;
