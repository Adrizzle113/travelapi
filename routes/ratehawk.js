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

module.exports = router;