/**
 * RateHawk Search Routes - ETG API Integration
 * Uses new ETG API with caching (Phase 1)
 * Supports both GET (frontend) and POST (API) methods
 */

import express from "express";
import { executeSearch, paginateSearch } from "../../services/search/searchService.js";

const router = express.Router();

// ================================
// HOTEL SEARCH - GET (Frontend Compatibility)
// ================================

router.get("/search", async (req, res) => {
  const startTime = Date.now();
  const {
    destination,
    checkin,
    checkout,
    guests: guestsParam,
    residency = "us",
    currency = "USD",
  } = req.query;

  console.log("🔍 === ETG API SEARCH REQUEST (GET) ===");
  console.log(`🗺️ Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests (raw): ${guestsParam}`);

  // Parse guests if it's a string
  let guests;
  try {
    guests = typeof guestsParam === 'string' ? JSON.parse(guestsParam) : guestsParam || [{ adults: 2, children: [] }];
  } catch (e) {
    console.log("⚠️ Failed to parse guests, using default");
    guests = [{ adults: 2, children: [] }];
  }

  // Validation
  if (!destination || !checkin || !checkout) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: destination, checkin, checkout",
      hotels: [],
      totalHotels: 0,
    });
  }

  try {
    // Execute search with caching
    const searchResult = await executeSearch({
      destination,
      checkin,
      checkout,
      guests,
      currency,
      residency,
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ GET Search completed in ${duration}ms`);

    // Return results
    res.json({
      success: true,
      hotels: searchResult.hotels || [],
      totalHotels: searchResult.total_hotels || 0,
      from_cache: searchResult.from_cache || false,
      search_signature: searchResult.search_signature,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 ETG search error (GET):", error);

    res.status(500).json({
      success: false,
      error: `Search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      debug: {
        destination,
        errorType: error.name || "Unknown",
        message: error.message,
      },
    });
  }
});

// ================================
// HOTEL SEARCH - POST (API)
// ================================

router.post("/search", async (req, res) => {
  const startTime = Date.now();
  const {
    userId,
    destination,
    checkin,
    checkout,
    guests,
    residency = "us",
    currency = "USD",
    page = 1,
    filters = {},
  } = req.body;

  console.log("🔍 === ETG API SEARCH REQUEST (POST) ===");
  console.log(`👤 User ID: ${userId}`);
  console.log(`🗺️ Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`💰 Currency: ${currency}`);
  console.log(`📄 Page: ${page}`);

  // Validation
  if (!destination || !checkin || !checkout || !guests) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: destination, checkin, checkout, guests",
      hotels: [],
      totalHotels: 0,
    });
  }

  try {
    // Execute search with caching
    const searchResult = await executeSearch({
      destination,
      checkin,
      checkout,
      guests,
      currency,
      residency,
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ POST Search completed in ${duration}ms`);

    // Paginate results if needed
    if (page > 1 && searchResult.search_signature) {
      const paginatedResult = await paginateSearch(
        searchResult.search_signature,
        page,
        20
      );

      return res.json({
        success: true,
        ...paginatedResult,
        searchDuration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }

    // Return first page
    res.json({
      success: true,
      hotels: searchResult.hotels || [],
      totalHotels: searchResult.total_hotels || 0,
      from_cache: searchResult.from_cache || false,
      search_signature: searchResult.search_signature,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 ETG search error (POST):", error);

    res.status(500).json({
      success: false,
      error: `Search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      debug: {
        destination,
        errorType: error.name || "Unknown",
        message: error.message,
      },
    });
  }
});

export default router;