const express = require('express');
const { loginUserToRateHawk, validateSession } = require('../services/ratehawkLoginService'); 
const { searchHotels } = require('../services/ratehawkSearchService');
const { logAuthAttempt, getAuthStats } = require('../config/database');

const router = express.Router();

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

// Check session status
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

// Hotel search endpoint
router.post('/search', async (req, res) => {
  const startTime = Date.now();
  const { userId, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} } = req.body;
  
  console.log('🔍 === HOTEL SEARCH REQUEST ===');
  console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}, Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}, Currency: ${currency}`);
  console.log(`📄 Page: ${page}`);
  
  // Validation
  if (!userId || !destination || !checkin || !checkout || !guests) {
    console.log('❌ Missing required search parameters');
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

    console.log(`✅ Using valid session for user: ${userId}`);
    console.log(`🍪 Session has ${userSession.cookies?.length || 0} cookies`);

    // Perform hotel search
    const searchResult = await searchHotels({
      userSession,
      destination,
      checkin,
      checkout,
      guests,
      residency,
      currency,
      page: parseInt(page) || 1,
      filters: filters || {}
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Search completed in ${duration}ms`);
    console.log(`📊 Search result: ${searchResult.hotels?.length || 0} hotels found`);

    // Add timing information
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

// NEW: Hotel details endpoint - FIXED VERSION
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

    // CRITICAL FIX: Create a mock hotel object with just the ID for the enhanced service
    const basicHotel = {
      id: hotelId,
      name: `Hotel ${hotelId}`,
      // The enhanced service will get the real data from localStorage
    };

    // Import the enhanced service
    let fetchSingleHotelBookingData;
    try {
      const enhancedService = require('../services/enhancedRatehawkService');
      fetchSingleHotelBookingData = enhancedService.fetchSingleHotelBookingData;
    } catch (importError) {
      console.log('⚠️ Enhanced service not available, using fallback method');
      return res.json({
        success: false,
        error: 'Hotel details service not available',
        hotelDetails: null,
        fetchDuration: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Fetching enhanced booking data for: ${basicHotel.name} (ID: ${hotelId})`);

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
      
      res.json({
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
    
    res.status(500).json({
      success: false,
      error: `Hotel details fetch failed: ${error.message}`,
      hotelDetails: null,
      fetchDuration: `${duration}ms`,
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

module.exports = router;