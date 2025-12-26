/**
 * RateHawk Search Routes - ETG API Integration
 * Uses new ETG API with caching (Phase 1)
 */

import express from "express";
import { validateSession } from "../../services/ratehawkLoginService.js";
import { executeSearch, paginateSearch } from "../../services/search/searchService.js";

const router = express.Router();

// ================================
// HOTEL SEARCH (NEW ETG API)
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

  console.log("🔍 === ETG API SEARCH REQUEST ===");
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
    console.log(`⏱️ Search completed in ${duration}ms`);

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
    console.error("💥 ETG search error:", error);

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