const express = require('express');
const { loginUserToRateHawk, validateSession } = require('../services/ratehawkLoginService');
const { searchHotels } = require('../services/ratehawkSearchService');
const { logAuthAttempt, getAuthStats } = require('../config/database');

const router = express.Router();

// ================================
// HOTEL DETAILS ENDPOINT
// ================================

// Get hotel details using RateHawk API flow
router.get('/hotel/details', async (req, res) => {
  const startTime = Date.now();
  const { hotel_id } = req.query;

  console.log('🏨 === HOTEL DETAILS REQUEST ===');
  console.log(`🏨 Hotel ID: ${hotel_id}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  if (!hotel_id) {
    return res.status(400).json({
      error: 'Hotel ID is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Step 1: Create Session
    console.log('🔗 Step 1: Creating RateHawk session...');

    const searchUuid = generateSearchUuid();
    const createSessionUrl = 'https://www.ratehawk.com/hotel/search/v1/hp/create_session';

    const sessionData = {
      region_id: 234,
      hotel: hotel_id,
      arrival_date: "2025-08-31",
      departure_date: "2025-09-02",
      paxes: [{ adults: 2 }],
      metahash: "s-d07e082a-5598-53e0-9200-992deaa995db",
      residency: "en-pk"
    };

    const sessionParams = new URLSearchParams({
      partner_slug_force: '211401.b2b.8a23',
      search_uuid: searchUuid,
      data: JSON.stringify(sessionData)
    });

    const sessionResponse = await fetch(`${createSessionUrl}?${sessionParams}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    });

    if (!sessionResponse.ok) {
      throw new Error(`Create Session failed: ${sessionResponse.status} ${sessionResponse.statusText}`);
    }

    const sessionResult = await sessionResponse.json();
    console.log('📊 Session response:', JSON.stringify(sessionResult, null, 2));

    if (!sessionResult.session || !sessionResult.session.id) {
      throw new Error('No session ID received from RateHawk');
    }

    const sessionId = sessionResult.session.id;
    console.log(`✅ Session created: ${sessionId}`);

    // Step 2: Get Hotel Pages
    console.log('📄 Step 2: Fetching hotel pages...');

    const hotelPagesUrl = 'https://www.ratehawk.com/hotel/search/v2/b2bsite/hp/pages/';
    const pagesParams = new URLSearchParams({
      session: sessionId,
      search_uuid: searchUuid,
      start_page: '1',
      end_page: '3',
      client_uid: 'E5DBF44D38F661685854AF7202680E12'
    });

    const pagesResponse = await fetch(`${hotelPagesUrl}?${pagesParams}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    });

    if (!pagesResponse.ok) {
      throw new Error(`Hotel Pages failed: ${pagesResponse.status} ${pagesResponse.statusText}`);
    }

    const hotelDetails = await pagesResponse.json();
    console.log('📊 Hotel pages response received');

    const duration = Date.now() - startTime;
    console.log(`✅ Hotel details completed in ${duration}ms`);

    // Return the exact RateHawk response for frontend to map
    res.json({
      error: "",
      data: hotelDetails.data || hotelDetails,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      sessionId: sessionId,
      searchUuid: searchUuid
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Hotel details error:', error);

    res.status(500).json({
      error: `Hotel details failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// Login to RateHawk
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const { email, password } = req.body;

  console.log('🔐 === RATEHAWK LOGIN REQUEST ===');
  console.log(`📧 Email: ${email}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
      timestamp: new Date().toISOString()
    });
  }

  // Generate user ID from email
  const userId = email.replace('@', '_').replace(/\./g, '_');
  console.log(`👤 Generated User ID: ${userId}`);

  try {
    // Attempt RateHawk login
    const loginResult = await loginUserToRateHawk(email, password, userId);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Login attempt completed in ${duration}ms`);
    console.log(`🎯 Login result: ${loginResult.success ? 'SUCCESS' : 'FAILED'}`);

    // Log the attempt to database
    try {
      await logAuthAttempt(userId, email, loginResult, duration);
    } catch (logError) {
      console.error('📝 Failed to log auth attempt:', logError);
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
        loginUrl: loginResult.loginUrl
      });

      console.log(`✅ RateHawk session stored for ${email}`);
      console.log(`🔑 Session ID: ${loginResult.sessionId}`);
      console.log(`🍪 Cookies: ${loginResult.cookies?.length || 0}`);

      res.json({
        success: true,
        message: 'Successfully logged into RateHawk',
        sessionId: loginResult.sessionId,
        ratehawkSessionId: loginResult.ratehawkSessionId,
        loginUrl: loginResult.loginUrl,
        userId: userId,
        email: email,
        loginTime: new Date().toISOString(),
        cookieCount: loginResult.cookies?.length || 0,
        sessionStored: true,
        duration: `${duration}ms`
      });
    } else {
      console.log(`❌ RateHawk login failed: ${loginResult.error}`);

      res.status(401).json({
        success: false,
        error: loginResult.error || 'RateHawk authentication failed',
        finalUrl: loginResult.finalUrl,
        cookieCount: loginResult.cookieCount || 0,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 RateHawk login error:', error);

    // Log the failed attempt
    try {
      await logAuthAttempt(userId, email, { success: false, error: error.message }, duration);
    } catch (logError) {
      console.error('📝 Failed to log failed auth attempt:', logError);
    }

    res.status(500).json({
      success: false,
      error: `Login failed: ${error.message}`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// Search hotels endpoint
router.post('/search', async (req, res) => {
  const startTime = Date.now();
  const { userId, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} } = req.body;

  console.log('🔍 === RATEHAWK SEARCH REQUEST ===');
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
    console.log('❌ Missing required parameters');
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, destination, checkin, checkout, guests',
      hotels: [],
      totalHotels: 0,
      availableHotels: 0
    });
  }

  try {
    // Get user session
    const userSession = global.userSessions.get(userId);
    if (!userSession) {
      console.log('❌ No session found for user:', userId);
      return res.status(401).json({
        success: false,
        error: 'No RateHawk session found. Please login first.',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      });
    }

    // Validate session
    if (!validateSession(userSession)) {
      console.log('❌ Invalid/expired session for user:', userId);
      global.userSessions.delete(userId);
      return res.status(401).json({
        success: false,
        error: 'RateHawk session expired. Please login again.',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
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
      filters
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Search completed in ${duration}ms`);

    // Add duration to result
    searchResult.searchDuration = `${duration}ms`;
    searchResult.timestamp = new Date().toISOString();

    res.json(searchResult);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Hotel search error:', error);

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
        errorType: error.name || 'Unknown'
      }
    });
  }
});

// Hotel details endpoint - NEW
router.post('/hotel-details', async (req, res) => {
  const startTime = Date.now();
  const { userId, hotelId, searchSessionId, searchParams } = req.body;

  console.log('🏨 === HOTEL DETAILS REQUEST ===');
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`🔗 Search Session ID: ${searchSessionId}`);
  console.log(`📋 Search Params:`, searchParams);

  // Validation
  if (!userId || !hotelId) {
    console.log('❌ Missing required parameters');
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, hotelId',
      hotelDetails: null
    });
  }

  try {
    // Get user session
    const userSession = global.userSessions.get(userId);
    if (!userSession) {
      console.log('❌ No session found for user:', userId);
      return res.status(401).json({
        success: false,
        error: 'No RateHawk session found. Please login first.',
        hotelDetails: null
      });
    }

    // Validate session
    if (!validateSession(userSession)) {
      console.log('❌ Invalid/expired session for user:', userId);
      global.userSessions.delete(userId);
      return res.status(401).json({
        success: false,
        error: 'RateHawk session expired. Please login again.',
        hotelDetails: null
      });
    }

    // Update last used timestamp
    userSession.lastUsed = new Date();
    global.userSessions.set(userId, userSession);

    console.log(`✅ Using valid session for hotel details fetch`);

    // Import the hotel details fetching function
    const { fetchSingleHotelBookingData } = require('../services/enhancedRatehawkService');

    // Create mock hotel object with basic info
    const basicHotel = {
      id: hotelId,
      name: `Hotel ${hotelId}`,
      ratehawk_data: {
        ota_hotel_id: hotelId,
        requested_hotel_id: hotelId
      }
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
      console.log(`🏨 Room types found: ${detailsResult.roomTypes?.length || 0}`);
      console.log(`💰 Rates found: ${detailsResult.rates?.length || 0}`);

      res.json({
        success: true,
        hotelDetails: {
          hotelId: hotelId,
          rates: detailsResult.rates || [],
          roomTypes: detailsResult.roomTypes || [],
          bookingOptions: detailsResult.bookingOptions || [],
          room_groups: detailsResult.room_groups || [],
          detailedData: detailsResult.data || null
        },
        fetchDuration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`❌ Hotel details fetch failed: ${detailsResult.error}`);

      res.status(500).json({
        success: false,
        error: detailsResult.error || 'Failed to fetch hotel details',
        hotelDetails: null,
        fetchDuration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Hotel details error:', error);

    console.log('Raw RateHawk API response ========:', JSON.stringify(detailsResult, null, 2));
    console.log('Extracted room_groups ============:', detailsResult.room_groups?.length || 0);
    console.log('Extracted rates   ================:', detailsResult.rates?.length || 0);


    res.status(500).json({
      success: false,
      error: `Hotel details fetch failed: ${error.message}`,
      hotelDetails: null,
      fetchDuration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// Get RateHawk statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getAuthStats();

    res.json({
      success: true,
      stats: {
        totalAttempts: stats.total_attempts || 0,
        successfulAttempts: stats.successful_attempts || 0,
        averageDuration: Math.round(stats.avg_duration || 0) + 'ms',
        uniqueUsers: stats.unique_users || 0,
        attempts24h: stats.attempts_24h || 0,
        successRate: stats.total_attempts > 0 ?
          Math.round((stats.successful_attempts / stats.total_attempts) * 100) + '%' : '0%'
      },
      activeSessions: global.userSessions.size,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Stats error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to get stats: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// Test authentication endpoint
router.post('/test-auth', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required for testing'
    });
  }

  const userId = `test_${email.replace('@', '_').replace(/\./g, '_')}_${Date.now()}`;

  try {
    console.log('🧪 Testing RateHawk authentication...');

    const testResult = await loginUserToRateHawk(email, password, userId);

    // Don't store test sessions in global storage

    res.json({
      success: testResult.success,
      message: testResult.success ? 'Authentication test successful' : 'Authentication test failed',
      error: testResult.error || null,
      sessionId: testResult.sessionId || null,
      cookieCount: testResult.cookies?.length || 0,
      testMode: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Auth test error:', error);
    res.status(500).json({
      success: false,
      error: `Auth test failed: ${error.message}`,
      testMode: true,
      timestamp: new Date().toISOString()
    });
  }
});

// Logout endpoint
router.post('/logout/:userId', (req, res) => {
  const { userId } = req.params;

  console.log(`👋 Logging out user: ${userId}`);

  if (global.userSessions.has(userId)) {
    global.userSessions.delete(userId);
    console.log(`✅ Session removed for user: ${userId}`);

    res.json({
      success: true,
      message: 'Successfully logged out from RateHawk',
      userId: userId,
      timestamp: new Date().toISOString()
    });
  } else {
    console.log(`⚠️ No session found for user: ${userId}`);

    res.json({
      success: true,
      message: 'No active session found (already logged out)',
      userId: userId,
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// SESSION CHECK ENDPOINT
// ================================

// Check session status for a user
router.get('/session/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log(`🔍 Checking session for user: ${userId}`);

  try {
    const userSession = global.userSessions.get(userId);

    if (!userSession) {
      console.log(`❌ No session found for user: ${userId}`);
      return res.json({
        hasSession: false,
        error: 'No active session found',
        userId: userId,
        timestamp: new Date().toISOString()
      });
    }

    // Validate session
    if (!validateSession(userSession)) {
      console.log(`❌ Invalid/expired session for user: ${userId}`);
      global.userSessions.delete(userId);
      return res.json({
        hasSession: false,
        error: 'Session expired or invalid',
        userId: userId,
        timestamp: new Date().toISOString()
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
      sessionAge: Math.round((Date.now() - new Date(userSession.loginTime)) / (1000 * 60)) + ' minutes',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Session check error:', error);
    res.status(500).json({
      hasSession: false,
      error: `Session check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to generate search UUID
function generateSearchUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = router;
