/**
 * RateHawk Hotel Details Routes
 * Handles fetching detailed hotel information and rates
 */

import express from "express";
import axios from "axios";
import { validateSession } from "../../services/ratehawkLoginService.js";
import { generateSearchUuid } from "../../utils/uuid-generator.js";

const router = express.Router();

// RateHawk API Credentials
const RATEHAWK_CREDENTIALS = {
  username: "11606",
  password: "ff9702bb-ba93-4996-a31e-547983c51530",
};

// ================================
// HOTEL DETAILS (Old Method - RateHawk Session-Based)
// ================================

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

    const sessionResponse = await fetch(`${createSessionUrl}?${sessionParams}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
    });

    if (!sessionResponse.ok) {
      throw new Error(`Create Session failed: ${sessionResponse.status}`);
    }

    const sessionResult = await sessionResponse.json();
    if (!sessionResult.session || !sessionResult.session.id) {
      throw new Error("No session ID received from RateHawk");
    }

    const sessionId = sessionResult.session.id;
    console.log(`✅ Session created: ${sessionId}`);

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!pagesResponse.ok) {
      throw new Error(`Hotel Pages failed: ${pagesResponse.status}`);
    }

    const hotelDetails = await pagesResponse.json();
    const duration = Date.now() - startTime;
    console.log(`✅ Hotel details completed in ${duration}ms`);

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

// ================================
// HOTEL DETAILS (Current Method - Worldota API)
// ================================

router.post("/hotel/details", async (req, res) => {
  const { hotelId, searchContext, residency, currency } = req.body;
  
  console.log("🚀 ~ hotel_id:", hotelId);
  console.log("🚀 ~ checkin:", searchContext?.checkin);

  if (!hotelId || !searchContext?.checkin || !searchContext?.checkout || !searchContext?.guests) {
    return res.status(400).json({ 
      error: "Hotel ID and searchContext are required" 
    });
  }

  const reqData = {
    checkin: searchContext.checkin,
    checkout: searchContext.checkout,
    residency: residency || "gb",
    language: "en",
    guests: searchContext.guests || [{ adults: 2, children: [] }],
    id: hotelId,
    currency: currency || "USD",
  };

  try {
    const result = await axios.post(
      "https://api.worldota.net/api/b2b/v3/search/hp/",
      reqData,
      {
        auth: RATEHAWK_CREDENTIALS,
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
  } catch (error) {
    console.error("💥 Hotel details error:", error);
    res.status(500).json({
      error: `Failed to fetch hotel details: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// ================================
// ENHANCED HOTEL DETAILS (With Rates)
// ================================

router.post("/hotel-details", async (req, res) => {
  const startTime = Date.now();
  const { userId, hotelId, searchSessionId, searchParams } = req.body;

  console.log("🏨 === HOTEL DETAILS REQUEST ===");
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`🔗 Search Session ID: ${searchSessionId}`);

  if (!userId || !hotelId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: userId, hotelId",
      hotelDetails: null,
    });
  }

  try {
    const userSession = global.userSessions.get(userId);
    if (!userSession) {
      return res.status(401).json({
        success: false,
        error: "No RateHawk session found. Please login first.",
        hotelDetails: null,
      });
    }

    if (!validateSession(userSession)) {
      global.userSessions.delete(userId);
      return res.status(401).json({
        success: false,
        error: "RateHawk session expired. Please login again.",
        hotelDetails: null,
      });
    }

    userSession.lastUsed = new Date();
    global.userSessions.set(userId, userSession);

    const { fetchSingleHotelBookingData } = await import(
      "../../services/enhancedRatehawkService.js"
    );

    const basicHotel = {
      id: hotelId,
      name: `Hotel ${hotelId}`,
      ratehawk_data: {
        ota_hotel_id: hotelId,
        requested_hotel_id: hotelId,
      },
    };

    const detailsResult = await fetchSingleHotelBookingData(
      basicHotel,
      searchSessionId,
      userSession,
      searchParams || {}
    );

    const duration = Date.now() - startTime;

    if (detailsResult.success) {
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

    res.status(500).json({
      success: false,
      error: `Hotel details fetch failed: ${error.message}`,
      hotelDetails: null,
      fetchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
