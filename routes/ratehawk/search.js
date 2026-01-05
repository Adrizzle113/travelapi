/**
 * RateHawk Search Routes - ETG API Integration
 * Uses new ETG API with caching (Phase 1)
 * Supports both GET (frontend) and POST (API) methods
 * Enhanced with standardized error handling, retry logic, and pagination
 */

import express from "express";
import { executeSearch, paginateSearch } from "../../services/search/searchService.js";
import { searchHotelsByHotelIds } from "../../services/etg/etgClient.js";
import { validateRegionId, validateSearchParams } from "../../middleware/validation.js";
import { handleApiError } from "../../utils/errorHandler.js";
import { PAGINATION } from "../../config/constants.js";
import { normalizeResidency } from "../../utils/residencyNormalizer.js";

const router = express.Router();

/**
 * Normalize and validate pagination parameters
 * @param {number|string} page - Page number
 * @param {number|string} limit - Items per page
 * @returns {Object} - { page, limit } validated values
 */
function normalizePaginationParams(page, limit) {
  const pageNum = Math.max(parseInt(page, 10) || PAGINATION.DEFAULT_PAGE, 1);
  const limitNum = Math.min(
    Math.max(
      parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MIN_LIMIT
    ),
    PAGINATION.MAX_LIMIT
  );

  return { page: pageNum, limit: limitNum };
}

/**
 * Build standardized paginated response
 * @param {Array} hotels - Hotel results
 * @param {Object} searchResult - Full search result
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} duration - Request duration in ms
 * @returns {Object} - Standardized response
 */
function buildPaginatedResponse(hotels, searchResult, page, limit, duration) {
  const total = searchResult.total_hotels || 0;
  const returned = hotels.length;
  const hasMore = (page * limit) < total;

  return {
    success: true,
    hotels,
    total,
    page,
    limit,
    hasMore,
    returned,
    from_cache: searchResult.from_cache || false,
    search_signature: searchResult.search_signature,
    searchDuration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  };
}

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
    page: pageParam,
    limit: limitParam,
  } = req.query;

  // Normalize pagination parameters
  const { page, limit } = normalizePaginationParams(pageParam, limitParam);

  // Normalize residency parameter (e.g., "en-us" → "us")
  const normalizedResidency = normalizeResidency(residency);

  console.log("🔍 === ETG API SEARCH REQUEST (GET) ===");
  console.log(`🗺️ Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests (raw): ${guestsParam}`);
  console.log(`🌍 Residency: ${residency} → ${normalizedResidency} (normalized)`);
  console.log(`📄 Pagination: page=${page}, limit=${limit}`);

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
      total: 0,
      page,
      limit,
      hasMore: false,
      returned: 0,
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
      residency: normalizedResidency,
    });

    const duration = Date.now() - startTime;

    // Apply pagination
    const allHotels = searchResult.hotels || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedHotels = allHotels.slice(startIndex, endIndex);

    // Log pagination metrics
    console.log(`📊 Pagination Metrics: page=${page}, limit=${limit}, total=${allHotels.length}, returned=${paginatedHotels.length}, hasMore=${endIndex < allHotels.length}`);
    console.log(`⏱️ GET Search completed in ${duration}ms`);

    const response = buildPaginatedResponse(paginatedHotels, searchResult, page, limit, duration);

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 ETG search error (GET):", error);

    if (error.category && error.isRetryable !== undefined) {
      return handleApiError(error, req, res);
    }

    res.status(500).json({
      success: false,
      error: {
        message: `Search failed: ${error.message}`,
        category: error.category || 'server_error',
        isRetryable: error.isRetryable || false,
        statusCode: error.statusCode || 500,
        timestamp: new Date().toISOString()
      },
      hotels: [],
      total: 0,
      page,
      limit,
      hasMore: false,
      returned: 0,
      searchDuration: `${duration}ms`,
      requestId: req.requestId,
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

router.post("/search", validateRegionId, validateSearchParams, async (req, res) => {
  const startTime = Date.now();
  const {
    userId,
    region_id,
    destination,
    destination_label,
    checkin,
    checkout,
    guests,
    residency = "us",
    currency = "USD",
    page: pageParam,
    limit: limitParam,
    filters = {},
  } = req.body;

  // Normalize pagination parameters
  const { page, limit } = normalizePaginationParams(pageParam, limitParam);

  // Normalize residency parameter (e.g., "en-us" → "us")
  const normalizedResidency = normalizeResidency(residency);

  console.log("🔍 === ETG API SEARCH REQUEST (POST) ===");
  console.log(`👤 User ID: ${userId}`);
  console.log(`🔢 Region ID: ${region_id}`);
  console.log(`🗺️ Destination (legacy): ${destination}`);
  console.log(`🏷️ Destination Label: ${destination_label}`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency} → ${normalizedResidency} (normalized)`);
  console.log(`💰 Currency: ${currency}`);
  console.log(`📄 Pagination: page=${page}, limit=${limit}`);

  if (req.deprecated_params) {
    console.warn(`⚠️ DEPRECATED USAGE: ${req.deprecated_params.message}`);
  }

  try {
    const searchResult = await executeSearch({
      region_id: region_id || undefined,
      destination: destination || undefined,
      destination_label: destination_label || undefined,
      checkin,
      checkout,
      guests,
      currency,
      residency: normalizedResidency,
    });

    const duration = Date.now() - startTime;

    if (req.deprecated_params) {
      searchResult._deprecated = req.deprecated_params;
    }

    // Apply pagination to all results
    const allHotels = searchResult.hotels || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedHotels = allHotels.slice(startIndex, endIndex);
    const totalHotels = allHotels.length;
    const hasMore = endIndex < totalHotels;

    // Log pagination metrics
    const percentLoaded = totalHotels > 0 ? ((endIndex / totalHotels) * 100).toFixed(1) : 0;
    console.log(`📊 Pagination Metrics:`, {
      totalHotels,
      page,
      limit,
      returned: paginatedHotels.length,
      hasMore,
      percentageLoaded: `${percentLoaded}%`,
      from_cache: searchResult.from_cache || false
    });
    console.log(`⏱️ POST Search completed in ${duration}ms`);

    const response = buildPaginatedResponse(paginatedHotels, searchResult, page, limit, duration);

    if (req.deprecated_params) {
      response._deprecated = req.deprecated_params;
    }

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 ETG search error (POST):", error);

    if (error.category && error.isRetryable !== undefined) {
      return handleApiError(error, req, res);
    }

    res.status(500).json({
      success: false,
      error: {
        message: `Search failed: ${error.message}`,
        category: error.category || 'server_error',
        isRetryable: error.isRetryable || false,
        statusCode: error.statusCode || 500,
        timestamp: new Date().toISOString()
      },
      hotels: [],
      total: 0,
      page,
      limit,
      hasMore: false,
      returned: 0,
      searchDuration: `${duration}ms`,
      requestId: req.requestId,
      debug: {
        destination,
        errorType: error.name || "Unknown",
        message: error.message,
      },
    });
  }
});

// ================================
// SEARCH BY HOTEL IDs - POST
// ================================

/**
 * POST /api/ratehawk/search/hotels
 * Search multiple hotels by their IDs (up to 300 hotels per request)
 * Uses ETG API /search/serp/hotels/ endpoint (150 requests/minute limit)
 * 
 * Request body:
 * - hotel_ids (array, required) - Array of hotel IDs (max 300)
 * - checkin (string, required) - Check-in date (YYYY-MM-DD)
 * - checkout (string, required) - Check-out date (YYYY-MM-DD)
 * - guests (array, optional) - Guest configuration (default: [{ adults: 2, children: [] }])
 * - residency (string, optional) - Country code (default: 'us')
 * - currency (string, optional) - Currency code (default: 'USD')
 * - language (string, optional) - Language code (default: 'en')
 */
router.post("/search/hotels", async (req, res) => {
  const startTime = Date.now();
  const {
    hotel_ids,
    hotelIds,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    residency = "us",
    currency = "USD",
    language = "en"
  } = req.body;

  // Normalize residency parameter (e.g., "en-us" → "us")
  const normalizedResidency = normalizeResidency(residency);

  // Support both hotel_ids and hotelIds parameter names
  const finalHotelIds = hotel_ids || hotelIds;

  console.log("🔍 === SEARCH BY HOTEL IDs REQUEST ===");
  console.log(`🏨 Hotel IDs: ${finalHotelIds?.length || 0} hotels`);
  console.log(`📅 Check-in: ${checkin}`);
  console.log(`📅 Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency} → ${normalizedResidency} (normalized)`);
  console.log(`💰 Currency: ${currency}`);

  // Validation
  if (!finalHotelIds || !Array.isArray(finalHotelIds) || finalHotelIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: "hotel_ids or hotelIds array is required and must not be empty",
      hotels: [],
      total: 0
    });
  }

  if (finalHotelIds.length > 300) {
    return res.status(400).json({
      success: false,
      error: "Maximum 300 hotel IDs allowed per request",
      hotels: [],
      total: 0
    });
  }

  if (!checkin || !checkout) {
    return res.status(400).json({
      success: false,
      error: "checkin and checkout dates are required",
      hotels: [],
      total: 0
    });
  }

  try {
    const searchResult = await searchHotelsByHotelIds({
      hotelIds: finalHotelIds,
      checkin,
      checkout,
      guests,
      residency: normalizedResidency,
      currency,
      language
    });

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      hotels: searchResult.hotels || [],
      total: searchResult.total_hotels || searchResult.hotels?.length || 0,
      search_id: searchResult.search_id,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Search by hotel IDs error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to search hotels",
        code: error.code || "SEARCH_ERROR"
      },
      hotels: [],
      total: 0,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

export default router;