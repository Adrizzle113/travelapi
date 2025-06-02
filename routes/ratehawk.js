const express = require('express');
const { loginUserToRateHawk, validateSession } = require('../services/ratehawkLoginService'); 
const { searchHotels } = require('../services/ratehawkSearchService');
const { logAuthAttempt, getAuthStats } = require('../config/database');

const router = express.Router();

// Validation functions
function validateCredentials(email, password) {
  const errors = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!email.includes('@') || !email.includes('.')) {
    errors.push('Email format appears invalid');
  }
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password appears too short (RateHawk typically requires 6+ characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// RateHawk Login endpoint
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const { userId, email, password } = req.body;
  
  console.log('🔐 === RATEHAWK LOGIN REQUEST ===');
  console.log(`👤 User ID: ${userId}`);
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password ? '[PROVIDED]' : '[MISSING]'}`);
  console.log(`🌍 Browserless: ${process.env.BROWSERLESS_TOKEN ? '[CONFIGURED]' : '[MISSING]'}`);
  console.log('==========================================');
  
  // Validation
  if (!userId || !email || !password) {
    console.log('❌ Missing required fields');
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, email, password'
    });
  }
  
  // Validate credentials format
  const validation = validateCredentials(email, password);
  if (!validation.isValid) {
    console.log('❌ Credential validation failed:', validation.errors);
    return res.status(400).json({
      success: false,
      error: `Credential validation failed: ${validation.errors.join(', ')}`
    });
  }
  
  // Check if Browserless is configured
  if (!process.env.BROWSERLESS_TOKEN) {
    console.log('❌ Browserless token not configured');
    return res.status(500).json({
      success: false,
      error: 'Browserless authentication service not configured. Please contact support.'
    });
  }
  
  // Check if user already has an active session
  const existingSession = global.userSessions.get(userId);
  if (existingSession && validateSession(existingSession)) {
    console.log(`♻️ Using existing valid session for user ${userId}`);
    return res.json({
      success: true,
      message: 'Using existing RateHawk session',
      sessionId: existingSession.sessionId,
      loginUrl: existingSession.loginUrl,
      timestamp: existingSession.loginTime.toISOString(),
      cached: true
    });
  } else if (existingSession) {
    console.log(`🗑️ Removing invalid/expired session for user ${userId}`);
    global.userSessions.delete(userId);
  }
  
  try {
    console.log('🚀 Starting fresh RateHawk authentication...');
    const loginResult = await loginUserToRateHawk(email, password, userId);
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Authentication took ${duration}ms`);
    
    // Log the attempt to database
    try {
      await logAuthAttempt(userId, email, loginResult, duration);
    } catch (logError) {
      console.error('⚠️ Failed to log auth attempt:', logError);
    }
    
    if (loginResult.success === true) {
      // Store session for future use
      global.userSessions.set(userId, {
        sessionId: loginResult.sessionId,
        cookies: loginResult.cookies,
        email: email,
        loginTime: new Date(),
        lastUsed: new Date(),
        ratehawkSessionId: loginResult.ratehawkSessionId,
        ratehawkUserId: loginResult.userId,
        domainUid: loginResult.domainUid,
        isAuth: loginResult.isAuth,
        loginUrl: loginResult.loginUrl,
        navigationDetected: loginResult.navigationDetected
      });
      
      console.log(`✅ RateHawk session stored for user: ${userId}`);
      console.log(`📊 Active sessions: ${global.userSessions.size}`);
      
      res.json({
        success: true,
        message: 'RateHawk authentication successful',
        sessionId: loginResult.sessionId,
        loginUrl: loginResult.loginUrl,
        timestamp: loginResult.timestamp,
        duration: `${duration}ms`,
        debug: {
          email: email,
          browserlessUsed: true,
          sessionStored: true,
          navigationDetected: loginResult.navigationDetected,
          cookieCount: loginResult.cookies?.length || 0
        }
      });
    } else {
      console.log(`❌ RateHawk authentication failed: ${loginResult.error}`);
      
      // Provide more specific error messages
      let userFriendlyError = loginResult.error;
      if (loginResult.error?.includes('Invalid credentials') || 
          loginResult.error?.includes('wrong password')) {
        userFriendlyError = 'Invalid email or password. Please check your RateHawk credentials.';
      } else if (loginResult.error?.includes('context') || 
                 loginResult.error?.includes('destroyed')) {
        userFriendlyError = 'Authentication process was interrupted. Please try again.';
      } else if (loginResult.error?.includes('timeout')) {
        userFriendlyError = 'Authentication timed out. Please check your connection and try again.';
      }
      
      res.json({
        success: false,
        error: userFriendlyError,
        duration: `${duration}ms`,
        debug: {
          email: email,
          browserlessUsed: true,
          authenticationAttempted: true,
          originalError: loginResult.error,
          finalUrl: loginResult.finalUrl,
          cookieCount: loginResult.cookieCount || 0
        }
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Authentication endpoint error:', error);
    
    // Log the failed attempt
    try {
      await logAuthAttempt(userId, email, { success: false, error: error.message }, duration);
    } catch (logError) {
      console.error('⚠️ Failed to log failed auth attempt:', logError);
    }
    
    res.status(500).json({
      success: false,
      error: `Authentication failed: ${error.message}`,
      duration: `${duration}ms`,
      debug: {
        email: email,
        browserlessConfigured: !!process.env.BROWSERLESS_TOKEN,
        errorType: error.name || 'Unknown',
        activeSessions: global.userSessions.size
      }
    });
  }
});

// Hotel search endpoint
router.post('/search', async (req, res) => {
  const startTime = Date.now();
  const { userId, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD' } = req.body;
  
  console.log('🔍 === HOTEL SEARCH REQUEST ===');
  console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}, Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}, Currency: ${currency}`);
  
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
      currency
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

// Check session status
router.get('/session/:userId', (req, res) => {
  const { userId } = req.params;
  const session = global.userSessions.get(userId);
  
  if (session) {
    const sessionAge = Date.now() - new Date(session.loginTime);
    const hoursOld = sessionAge / (1000 * 60 * 60);
    const isValid = validateSession(session);
    
    res.json({
      hasSession: true,
      isValid: isValid,
      sessionId: session.sessionId,
      loginTime: session.loginTime,
      email: session.email,
      lastUsed: session.lastUsed,
      ratehawkUserId: session.ratehawkUserId,
      ageHours: Math.round(hoursOld * 100) / 100,
      isExpired: hoursOld > 24,
      cookieCount: session.cookies?.length || 0
    });
  } else {
    res.json({
      hasSession: false,
      isValid: false
    });
  }
});

// Get authentication statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getAuthStats();
    
    res.json({
      success: true,
      stats: {
        totalAttempts: stats.total_attempts || 0,
        successfulAttempts: stats.successful_attempts || 0,
        successRate: stats.total_attempts > 0 ? 
          Math.round((stats.successful_attempts / stats.total_attempts) * 100) : 0,
        averageDuration: Math.round(stats.avg_duration || 0),
        uniqueUsers: stats.unique_users || 0,
        attempts24h: stats.attempts_24h || 0,
        activeSessions: global.userSessions.size,
        activeSessionDetails: Array.from(global.userSessions.entries()).map(([userId, session]) => ({
          userId,
          email: session.email,
          loginTime: session.loginTime,
          lastUsed: session.lastUsed,
          cookieCount: session.cookies?.length || 0,
          isValid: validateSession(session)
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// Health check for RateHawk service
router.get('/health', (req, res) => {
  const sessionCount = global.userSessions.size;
  const browserlessConfigured = !!process.env.BROWSERLESS_TOKEN;
  
  res.json({
    success: true,
    service: 'RateHawk Integration',
    status: 'operational',
    activeSessions: sessionCount,
    browserlessConfigured: browserlessConfigured,
    timestamp: new Date().toISOString(),
    endpoints: {
      login: '/api/ratehawk/login',
      search: '/api/ratehawk/search',
      session: '/api/ratehawk/session/:userId',
      stats: '/api/ratehawk/stats',
      cleanup: '/api/ratehawk/cleanup-sessions',
      testAuth: '/api/ratehawk/test-auth'
    }
  });
});

// Clean up expired sessions endpoint
router.post('/cleanup-sessions', (req, res) => {
  const beforeCount = global.userSessions.size;
  let cleanedCount = 0;
  
  // Remove expired sessions (older than 24 hours)
  global.userSessions.forEach((session, userId) => {
    if (!validateSession(session)) {
      global.userSessions.delete(userId);
      cleanedCount++;
    }
  });
  
  const afterCount = global.userSessions.size;
  
  console.log(`🧹 Session cleanup: ${cleanedCount} expired sessions removed`);
  
  res.json({
    success: true,
    message: 'Session cleanup completed',
    beforeCount: beforeCount,
    afterCount: afterCount,
    cleanedCount: cleanedCount,
    timestamp: new Date().toISOString()
  });
});

// Test authentication endpoint
router.post('/test-auth', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password required for authentication test'
    });
  }
  
  const testUserId = `test_${Date.now()}`;
  
  try {
    console.log('🧪 Testing authentication with provided credentials...');
    const loginResult = await loginUserToRateHawk(email, password, testUserId);
    
    res.json({
      success: true,
      testResult: loginResult,
      testUserId: testUserId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Authentication test failed: ${error.message}`,
      testUserId: testUserId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;