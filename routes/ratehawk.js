import express from "express";
import {
  loginUserToRateHawk,
  validateSession,
} from "../services/ratehawkLoginService.js";
import { searchHotels } from "../services/ratehawkSearchService.js";
import { logAuthAttempt, getAuthStats } from "../config/database.js";
import axios from "axios";

const router = express.Router();

// ================================
// HOTEL DETAILS ENDPOINT
// ================================

// Get hotel details using RateHawk API flow
router.get("/hotel/details-t", async (req, res) => {
  const startTime = Date.now();
  const { hotel_id } = req.query;

  console.log("🏨 === HOTEL DETAILS REQUEST ===");
  console.log(`🏨 Hotel ID: ${hotel_id}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  if (!hotel_id) {
    return res.status(400).json({
      error: "Hotel ID is required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Step 1: Create Session
    console.log("🔗 Step 1: Creating RateHawk session...");

    const searchUuid = generateSearchUuid();
    const createSessionUrl =
      "https://www.ratehawk.com/hotel/search/v1/hp/create_session";

    const sessionData = {
      region_id: 234,
      hotel: hotel_id,
      arrival_date: "2025-09-23",
      departure_date: "2025-09-26",
      paxes: [{ adults: 2 }],
      metahash: "s-d07e082a-5598-53e0-9200-992deaa995db",
      residency: "en-pk",
    };

    const sessionParams = new URLSearchParams({
      partner_slug_force: "211401.b2b.8a23",
      search_uuid: searchUuid,
      data: JSON.stringify(sessionData),
    });

    const sessionResponse = await fetch(
      `${createSessionUrl}?${sessionParams}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
        },
      }
    );

    if (!sessionResponse.ok) {
      throw new Error(
        `Create Session failed: ${sessionResponse.status} ${sessionResponse.statusText}`
      );
    }

    const sessionResult = await sessionResponse.json();
    console.log("📊 Session response:", JSON.stringify(sessionResult, null, 2));

    if (!sessionResult.session || !sessionResult.session.id) {
      throw new Error("No session ID received from RateHawk");
    }

    const sessionId = sessionResult.session.id;
    console.log(`✅ Session created: ${sessionId}`);

    // Step 2: Get Hotel Pages
    console.log("📄 Step 2: Fetching hotel pages...");

    const hotelPagesUrl =
      "https://www.ratehawk.com/hotel/search/v2/b2bsite/hp/pages/";
    const pagesParams = new URLSearchParams({
      session: sessionId,
      search_uuid: searchUuid,
      start_page: "1",
      end_page: "3",
      client_uid: "E5DBF44D38F661685854AF7202680E12",
    });

    const pagesResponse = await fetch(`${hotelPagesUrl}?${pagesParams}`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    if (!pagesResponse.ok) {
      throw new Error(
        `Hotel Pages failed: ${pagesResponse.status} ${pagesResponse.statusText}`
      );
    }

    const hotelDetails = await pagesResponse.json();
    console.log("📊 Hotel pages response received");

    const duration = Date.now() - startTime;
    console.log(`✅ Hotel details completed in ${duration}ms`);

    // Return the exact RateHawk response for frontend to map
    res.json({
      error: "",
      data: hotelDetails.data || hotelDetails,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      sessionId: sessionId,
      searchUuid: searchUuid,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel details error:", error);

    res.status(500).json({
      error: `Hotel details failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

router.post("/hotel/details", async (req, res) => {
  // const { hotel_id } = req.query;
  const { hotelId, searchContext, residency, currency } = req.body;
  console.log(hotelId, searchContext, residency, currency);
  console.log("🚀 ~ hotel_id:", hotelId);

  const checkin = searchContext.checkin;
  console.log("🚀 ~ checkin:", checkin);
  const checkout = searchContext.checkout;
  const guests = searchContext.guests;

  if (!hotelId && checkin && checkout && guests) {
    return res
      .status(400)
      .json({ error: "Hotel ID  and searchContext are required " });
  }

  const reqData = {
    checkin: searchContext.checkin,
    checkout: searchContext.checkout,
    residency: "gb",
    language: "en",
    guests: [
      {
        adults: 2,
        children: [],
      },
    ],
    id: hotelId,
    currency: currency,
  };

  const result = await axios.post(
    "https://api.worldota.net/api/b2b/v3/search/hp/",
    reqData,
    {
      auth: {
        username: "11606",
        password: "ff9702bb-ba93-4996-a31e-547983c51530",
      },
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  res.json({
    message: "Hotel details endpoint is working",
    data: result.data || {},
    timestamp: new Date().toISOString(),
  });
});

// ================================
// HOTEL STATIC INFO ENDPOINT (NEW!)
// Fetches descriptions, amenities, policies from RateHawk
// ================================
router.post("/hotel/static-info", async (req, res) => {
  const startTime = Date.now();
  const { hotelId, residency = "en-us" } = req.body;

  console.log("📚 === HOTEL STATIC INFO REQUEST ===");
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`🌍 Residency: ${residency}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  // Validation
  if (!hotelId) {
    return res.status(400).json({
      success: false,
      error: "Hotel ID is required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Try multiple RateHawk endpoints for static hotel data
    const endpoints = [
      // Worldota API (RateHawk backend)
      {
        name: "Worldota API v3",
        url: `https://api.worldota.net/api/b2b/v3/hotel/info/${hotelId}/?language=en`,
        method: "GET",
      },
      {
        name: "Worldota API v3 (query param)",
        url: `https://api.worldota.net/api/b2b/v3/hotel/info/?hotel_id=${hotelId}&language=en`,
        method: "GET",
      },
      // RateHawk web interface endpoints
      {
        name: "RateHawk Hotel Info",
        url: `https://www.ratehawk.com/hotel/info/${hotelId}?residency=${residency}`,
        method: "GET",
      },
      {
        name: "RateHawk Hotel Info (alt)",
        url: `https://www.ratehawk.com/api/hotel/info?hotel_id=${hotelId}&residency=${residency}`,
        method: "GET",
      },
    ];

    let staticData = null;
    let successEndpoint = null;
    let lastError = null;

    // Try each endpoint
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying: ${endpoint.name}`);
        console.log(`   URL: ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });

        console.log(`   Status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Success with ${endpoint.name}`);
          console.log(`   Response keys:`, Object.keys(data));
          
          // Check if response has useful data
          const hasDescription = !!(
            data.description || 
            data.hotel_description || 
            data.data?.description ||
            data.hotel?.description
          );
          
          if (hasDescription || Object.keys(data).length > 3) {
            staticData = data;
            successEndpoint = endpoint.name;
            console.log(`✅ Found useful static data in ${endpoint.name}`);
            break;
          } else {
            console.log(`⚠️ Response from ${endpoint.name} doesn't contain useful data`);
          }
        } else if (response.status === 404) {
          console.log(`   404 - Hotel not found or endpoint doesn't exist`);
        } else if (response.status === 401 || response.status === 403) {
          console.log(`   ${response.status} - Authentication required`);
        } else {
          console.log(`   ${response.status} - ${response.statusText}`);
        }
      } catch (fetchError) {
        console.log(`   ❌ Error: ${fetchError.message}`);
        lastError = fetchError;
        continue;
      }
    }

    // If we couldn't get static data from any endpoint
    if (!staticData) {
      const duration = Date.now() - startTime;
      console.log(`⚠️ Could not fetch static info from any endpoint (${duration}ms)`);
      
      return res.status(404).json({
        success: false,
        error: "Hotel static information not available from RateHawk API",
        message: "The hotel exists but detailed information is not accessible. This is common for some properties.",
        attemptedEndpoints: endpoints.length,
        lastError: lastError?.message,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      });
    }

    // Extract and normalize data from various possible response structures
    const extractedInfo = {
      // Description - check multiple possible locations
      description: 
        staticData.description || 
        staticData.hotel_description || 
        staticData.data?.description ||
        staticData.hotel?.description ||
        staticData.data?.hotel?.description ||
        null,
      
      fullDescription: 
        staticData.full_description || 
        staticData.detailed_description ||
        staticData.data?.full_description ||
        staticData.hotel?.full_description ||
        null,
      
      // Times
      checkInTime: 
        staticData.check_in_time || 
        staticData.checkin_time ||
        staticData.data?.check_in_time ||
        staticData.hotel?.check_in_time ||
        null,
      
      checkOutTime: 
        staticData.check_out_time || 
        staticData.checkout_time ||
        staticData.data?.check_out_time ||
        staticData.hotel?.check_out_time ||
        null,
      
      // Policies - handle both array and string
      policies: (() => {
        const policies = 
          staticData.policies || 
          staticData.hotel_policies ||
          staticData.data?.policies ||
          staticData.hotel?.policies ||
          [];
        
        return Array.isArray(policies) ? policies : (policies ? [policies] : []);
      })(),
      
      // Amenities
      amenities: 
        staticData.amenities || 
        staticData.facilities ||
        staticData.data?.amenities ||
        staticData.hotel?.amenities ||
        [],
      
      // Facts (additional info)
      facts: 
        staticData.facts || 
        staticData.hotel_facts ||
        staticData.data?.facts ||
        staticData.hotel?.facts ||
        {},
      
      // Address
      address: 
        staticData.address || 
        staticData.data?.address ||
        staticData.hotel?.address ||
        null,
      
      // Coordinates
      coordinates: {
        latitude: 
          staticData.latitude || 
          staticData.lat || 
          staticData.data?.latitude ||
          staticData.hotel?.latitude ||
          null,
        longitude: 
          staticData.longitude || 
          staticData.lon || 
          staticData.data?.longitude ||
          staticData.hotel?.longitude ||
          null,
      },
      
      // Contact
      phone: 
        staticData.phone || 
        staticData.telephone ||
        staticData.data?.phone ||
        staticData.hotel?.phone ||
        null,
      
      email: 
        staticData.email || 
        staticData.data?.email ||
        staticData.hotel?.email ||
        null,
      
      // Rating
      starRating: 
        staticData.star_rating || 
        staticData.stars ||
        staticData.data?.star_rating ||
        staticData.hotel?.star_rating ||
        null,
      
      // Images
      images: 
        staticData.images || 
        staticData.photos ||
        staticData.data?.images ||
        staticData.hotel?.images ||
        [],
    };

    const duration = Date.now() - startTime;
    
    // Log what we found
    console.log(`✅ Static info extraction completed in ${duration}ms`);
    console.log(`   Source: ${successEndpoint}`);
    console.log(`   Description: ${extractedInfo.description ? `${extractedInfo.description.length} chars` : 'Not found'}`);
    console.log(`   Check-in: ${extractedInfo.checkInTime || 'Not found'}`);
    console.log(`   Check-out: ${extractedInfo.checkOutTime || 'Not found'}`);
    console.log(`   Policies: ${extractedInfo.policies.length} items`);
    console.log(`   Am
    
    // Log what we found
    console.log(`✅ Static info extraction completed in ${duration}ms`);
    console.log(`   Source: ${successEndpoint}`);
    console.log(`   Description: ${extractedInfo.description ? `${extractedInfo.description.length} chars` : 'Not found'}`);
    console.log(`   Check-in: ${extractedInfo.checkInTime || 'Not found'}`);
    console.log(`   Check-out: ${extractedInfo.checkOutTime || 'Not found'}`);
    console.log(`   Policies: ${extractedInfo.policies.length} items`);
    console.log(`   Amenities: ${extractedInfo.amenities.length} items`);
    console.log(`   Coordinates: ${extractedInfo.coordinates.latitude && extractedInfo.coordinates.longitude ? 'Found' : 'Not found'}`);

    // Return success response
    res.json({
      success: true,
      data: extractedInfo,
      metadata: {
        source: successEndpoint,
        hotelId: hotelId,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        dataQuality: {
          hasDescription: !!extractedInfo.description,
          hasCheckInTime: !!extractedInfo.checkInTime,
          hasCheckOutTime: !!extractedInfo.checkOutTime,
          policiesCount: extractedInfo.policies.length,
          amenitiesCount: extractedInfo.amenities.length,
          hasCoordinates: !!(extractedInfo.coordinates.latitude && extractedInfo.coordinates.longitude),
        }
      },
      // Include raw data for debugging in development
      rawData: process.env.NODE_ENV === 'development' ? staticData : undefined,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Static info fetch error:", error);

    res.status(500).json({
      success: false,
      error: `Failed to fetch static info: ${error.message}`,
      hotelId: hotelId,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

// Login to RateHawk
router.post("/login", async (req, res) => {
  const startTime = Date.now();
  const { email, password } = req.body;

  console.log("🔐 === RATEHAWK LOGIN REQUEST ===");
  console.log(`📧 Email: ${email}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
      timestamp: new Date().toISOString(),
    });
  }

  // Generate user ID from email
  const userId = email.replace("@", "_").replace(/\./g, "_");
  console.log(`👤 Generated User ID: ${userId}`);

  try {
    // Attempt RateHawk login
    const loginResult = await loginUserToRateHawk(email, password, userId);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Login attempt completed in ${duration}ms`);
    console.log(
      `🎯 Login result: ${loginResult.success ? "SUCCESS" : "FAILED"}`
    );

    // Log the attempt to database
    try {
      await logAuthAttempt(userId, email, loginResult, duration);
    } catch (logError) {
      console.error("📝 Failed to log auth attempt:", logError);
    }

    if (loginResult.success) {
      // Store session in global storage
      global.userSessions.set(userId, {
        sessionId: loginResult.sessionId,
        cookies: loginResult.cookies,
        email: email,
        loginTime: new Date(),
        lastUsed: new Date(),
        ratehawkSessionId: loginResult.ratehawkSessionId,
        loginUrl: loginResult.loginUrl,
      });

      console.log(`✅ RateHawk session stored for ${email}`);
      console.log(`🔑 Session ID: ${loginResult.sessionId}`);
      console.log(`🍪 Cookies: ${loginResult.cookies?.length || 0}`);

      res.json({
        success: true,
        message: "Successfully logged into RateHawk",
        sessionId: loginResult.sessionId,
        ratehawkSessionId: loginResult.ratehawkSessionId,
        loginUrl: loginResult.loginUrl,
        userId: userId,
        email: email,
        loginTime: new Date().toISOString(),
        cookieCount: loginResult.cookies?.length || 0,
        sessionStored: true,
        duration: `${duration}ms`,
      });
    } else {
      console.log(`❌ RateHawk login failed: ${loginResult.error}`);

      res.status(401).json({
        success: false,
        error: loginResult.error || "RateHawk authentication failed",
        finalUrl: loginResult.finalUrl,
        cookieCount: loginResult.cookieCount || 0,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 RateHawk login error:", error);

    // Log the failed attempt
    try {
      await logAuthAttempt(
        userId,
        email,
        { success: false, error: error.message },
        duration
      );
    } catch (logError) {
      console.error("📝 Failed to log failed auth attempt:", logError);
    }

    res.status(500).json({
      success: false,
      error: `Login failed: ${error.message}`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Search hotels endpoint
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
      error:
        "Missing required fields: userId, destination, checkin, checkout, guests",
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

// Hotel details endpoint - NEW
router.post("/hotel-details", async (req, res) => {
  const startTime = Date.now();
  const { userId, hotelId, searchSessionId, searchParams } = req.body;

  console.log("🏨 === HOTEL DETAILS REQUEST ===");
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`🔗 Search Session ID: ${searchSessionId}`);
  console.log(`📋 Search Params:`, searchParams);

  // Validation
  if (!userId || !hotelId) {
    console.log("❌ Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required fields: userId, hotelId",
      hotelDetails: null,
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
        hotelDetails: null,
      });
    }

    // Validate session
    if (!validateSession(userSession)) {
      console.log("❌ Invalid/expired session for user:", userId);
      global.userSessions.delete(userId);
      return res.status(401).json({
        success: false,
        error: "RateHawk session expired. Please login again.",
        hotelDetails: null,
      });
    }

    // Update last used timestamp
    userSession.lastUsed = new Date();
    global.userSessions.set(userId, userSession);

    console.log(`✅ Using valid session for hotel details fetch`);

    // Import the hotel details fetching function
    const { fetchSingleHotelBookingData } = await import(
      "../services/enhancedRatehawkService.js"
    );

    // Create mock hotel object with basic info
    const basicHotel = {
      id: hotelId,
      name: `Hotel ${hotelId}`,
      ratehawk_data: {
        ota_hotel_id: hotelId,
        requested_hotel_id: hotelId,
      },
    };

    // Fetch detailed hotel data
    const detailsResult = await fetchSingleHotelBookingData(
      basicHotel,
      searchSessionId,
      userSession,
      searchParams || {}
    );

    const duration = Date.now() - startTime;
    console.log(`⏱️ Hotel details fetch completed in ${duration}ms`);

    if (detailsResult.success) {
      console.log(`✅ Hotel details fetched successfully`);
      console.log(
        `🏨 Room types found: ${detailsResult.roomTypes?.length || 0}`
      );
      console.log(`💰 Rates found: ${detailsResult.rates?.length || 0}`);

      res.json({
        success: true,
        hotelDetails: {
          hotelId: hotelId,
          rates: detailsResult.rates || [],
          roomTypes: detailsResult.roomTypes || [],
          bookingOptions: detailsResult.bookingOptions || [],
          room_groups: detailsResult.room_groups || [],
          detailedData: detailsResult.data || null,
        },
        fetchDuration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`❌ Hotel details fetch failed: ${detailsResult.error}`);

      res.status(500).json({
        success: false,
        error: detailsResult.error || "Failed to fetch hotel details",
        hotelDetails: null,
        fetchDuration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel details error:", error);

    console.log(
      "Raw RateHawk API response ========:",
      JSON.stringify(detailsResult, null, 2)
    );
    console.log(
      "Extracted room_groups ============:",
      detailsResult.room_groups?.length || 0
    );
    console.log(
      "Extracted rates   ================:",
      detailsResult.rates?.length || 0
    );

    res.status(500).json({
      success: false,
      error: `Hotel details fetch failed: ${error.message}`,
      hotelDetails: null,
      fetchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get RateHawk statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await getAuthStats();

    res.json({
      success: true,
      stats: {
        totalAttempts: stats.total_attempts || 0,
        successfulAttempts: stats.successful_attempts || 0,
        averageDuration: Math.round(stats.avg_duration || 0) + "ms",
        uniqueUsers: stats.unique_users || 0,
        attempts24h: stats.attempts_24h || 0,
        successRate:
          stats.total_attempts > 0
            ? Math.round(
                (stats.successful_attempts / stats.total_attempts) * 100
              ) + "%"
            : "0%",
      },
      activeSessions: global.userSessions.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Stats error:", error);
    res.status(500).json({
      success: false,
      error: `Failed to get stats: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test authentication endpoint
router.post("/test-auth", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required for testing",
    });
  }

  const userId = `test_${email
    .replace("@", "_")
    .replace(/\./g, "_")}_${Date.now()}`;

  try {
    console.log("🧪 Testing RateHawk authentication...");

    const testResult = await loginUserToRateHawk(email, password, userId);

    // Don't store test sessions in global storage

    res.json({
      success: testResult.success,
      message: testResult.success
        ? "Authentication test successful"
        : "Authentication test failed",
      error: testResult.error || null,
      sessionId: testResult.sessionId || null,
      cookieCount: testResult.cookies?.length || 0,
      testMode: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Auth test error:", error);
    res.status(500).json({
      success: false,
      error: `Auth test failed: ${error.message}`,
      testMode: true,
      timestamp: new Date().toISOString(),
    });
  }
});

// Logout endpoint
router.post("/logout/:userId", (req, res) => {
  const { userId } = req.params;

  console.log(`👋 Logging out user: ${userId}`);

  if (global.userSessions.has(userId)) {
    global.userSessions.delete(userId);
    console.log(`✅ Session removed for user: ${userId}`);

    res.json({
      success: true,
      message: "Successfully logged out from RateHawk",
      userId: userId,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log(`⚠️ No session found for user: ${userId}`);

    res.json({
      success: true,
      message: "No active session found (already logged out)",
      userId: userId,
      timestamp: new Date().toISOString(),
    });
  }
});

// ================================
// SESSION CHECK ENDPOINT
// ================================

// Check session status for a user
router.get("/session/:userId", async (req, res) => {
  const { userId } = req.params;
  console.log(`🔍 Checking session for user: ${userId}`);

  try {
    const userSession = global.userSessions.get(userId);

    if (!userSession) {
      console.log(`❌ No session found for user: ${userId}`);
      return res.json({
        hasSession: false,
        error: "No active session found",
        userId: userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Validate session
    if (!validateSession(userSession)) {
      console.log(`❌ Invalid/expired session for user: ${userId}`);
      global.userSessions.delete(userId);
      return res.json({
        hasSession: false,
        error: "Session expired or invalid",
        userId: userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Update last used
    userSession.lastUsed = new Date();
    global.userSessions.set(userId, userSession);

    console.log(`✅ Valid session found for user: ${userId}`);

    res.json({
      hasSession: true,
      sessionId: userSession.sessionId,
      ratehawkSessionId: userSession.ratehawkSessionId,
      email: userSession.email,
      loginTime: userSession.loginTime,
      lastUsed: userSession.lastUsed,
      cookieCount: userSession.cookies?.length || 0,
      sessionAge:
        Math.round(
          (Date.now() - new Date(userSession.loginTime)) / (1000 * 60)
        ) + " minutes",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Session check error:", error);
    res.status(500).json({
      hasSession: false,
      error: `Session check failed: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Helper function to generate search UUID
function generateSearchUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default router;
