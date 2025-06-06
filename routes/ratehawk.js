// ================================
// ENHANCED RATEHAWK ROUTES
// Updated routes/ratehawk.js with booking links
// ================================

const express = require('express');
const { loginUserToRateHawk, validateSession } = require('../services/ratehawkLoginService'); 
const { searchHotelsWithBooking } = require('../services/enhancedRatehawkService'); // New service
const { logAuthAttempt, getAuthStats } = require('../config/database');
//const { analyzeSearchResponse, inspectRateHawkData } = require('../services/ratehawkDataInspector');

const router = express.Router();

// Enhanced hotel search endpoint with booking links
router.post('/search', async (req, res) => {
  const startTime = Date.now();
  const { userId, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} } = req.body;
  
  console.log('🔍 === ENHANCED HOTEL SEARCH REQUEST ===');
  console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Destination: ${destination}`);
  console.log(`📅 Check-in: ${checkin}, Check-out: ${checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌍 Residency: ${residency}, Currency: ${currency}`);
  console.log(`📄 Page: ${page}`);
  console.log(`🔧 Filters:`, JSON.stringify(filters, null, 2));
  
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

    // ✅ NEW: Use enhanced search with booking links
    const searchResult = await searchHotelsWithBooking({
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
    console.log(`⏱️ Enhanced search completed in ${duration}ms`);
    console.log(`📊 Search result: ${searchResult.hotels?.length || 0} hotels found`);
    console.log(`🔗 Hotels with booking data: ${searchResult.metadata?.hotelsWithBooking || 0}`);

    // Add timing information
    searchResult.searchDuration = `${duration}ms`;
    searchResult.timestamp = new Date().toISOString();

    res.json(searchResult);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Enhanced hotel search error:', error);
    
    res.status(500).json({
      success: false,
      error: `Enhanced search failed: ${error.message}`,
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

// ✅ NEW: Individual hotel details endpoint with booking links
router.get('/hotel/:hotelId/details', async (req, res) => {
  const { hotelId } = req.params;
  const { userId, checkin, checkout, guests, residency = 'en-us', currency = 'USD' } = req.query;
  
  console.log(`🏨 === HOTEL DETAILS REQUEST ===`);
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`👤 User ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }
  
  try {
    // Get user session
    const userSession = global.userSessions.get(userId);
    if (!userSession || !validateSession(userSession)) {
      return res.status(401).json({
        success: false,
        error: 'Valid RateHawk session required'
      });
    }
    
    // Fetch detailed hotel information with booking links
    const hotelDetails = await fetchSingleHotelBookingData(
      { id: hotelId, ratehawk_data: { ota_hotel_id: hotelId } },
      null, // No search session for individual lookup
      userSession,
      { checkin, checkout, guests, residency, currency }
    );
    
    if (hotelDetails.success) {
      res.json({
        success: true,
        hotel: {
          id: hotelId,
          detailedRates: hotelDetails.rates,
          roomTypes: hotelDetails.roomTypes,
          bookingLinks: hotelDetails.bookingLinks,
          bookingData: hotelDetails.bookingData
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: hotelDetails.error || 'Hotel details not found'
      });
    }
    
  } catch (error) {
    console.error('💥 Hotel details error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch hotel details: ${error.message}`
    });
  }
});

// ✅ NEW: Generate booking URL endpoint
router.post('/booking/generate-url', async (req, res) => {
  const { userId, hotelId, rateId, checkin, checkout, guests, residency = 'en-us' } = req.body;
  
  console.log(`🔗 === GENERATE BOOKING URL ===`);
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`💰 Rate ID: ${rateId}`);
  console.log(`👤 User ID: ${userId}`);
  
  if (!userId || !hotelId) {
    return res.status(400).json({
      success: false,
      error: 'User ID and Hotel ID are required'
    });
  }
  
  try {
    // Get user session for session ID
    const userSession = global.userSessions.get(userId);
    if (!userSession || !validateSession(userSession)) {
      return res.status(401).json({
        success: false,
        error: 'Valid RateHawk session required'
      });
    }
    
    // Generate booking URL
    const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
    const bookingUrl = `/orders/reserve/h-${rateId}/?price=one&residency=${residency}&sid=${sessionId}`;
    const fullBookingUrl = `https://www.ratehawk.com${bookingUrl}`;
    
    console.log(`✅ Generated booking URL: ${fullBookingUrl}`);
    
    res.json({
      success: true,
      bookingUrl: bookingUrl,
      fullBookingUrl: fullBookingUrl,
      hotelId: hotelId,
      rateId: rateId,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 Booking URL generation error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to generate booking URL: ${error.message}`
    });
  }
});

// ✅ NEW: Debug endpoint to see what data we're receiving
router.get('/debug/hotel-data/:userId', async (req, res) => {
  const { userId } = req.params;
  const { destination = '2998', checkin = '2025-06-10', checkout = '2025-06-12' } = req.query;
  
  console.log(`🐛 === DEBUG HOTEL DATA ===`);
  console.log(`👤 User ID: ${userId}`);
  
  try {
    const userSession = global.userSessions.get(userId);
    if (!userSession || !validateSession(userSession)) {
      return res.status(401).json({
        success: false,
        error: 'Valid RateHawk session required'
      });
    }
    
    // Perform a small search to see raw data
    const debugSearch = await performBasicSearch({
      userSession,
      destination,
      checkin,
      checkout,
      guests: [{ adults: 2 }],
      residency: 'en-us',
      currency: 'USD',
      page: 1,
      filters: {}
    });
    
    if (debugSearch.success && debugSearch.hotels.length > 0) {
      const firstHotel = debugSearch.hotels[0];
      
      res.json({
        success: true,
        debug: {
          searchSessionId: debugSearch.searchSessionId,
          totalHotels: debugSearch.hotels.length,
          sampleHotel: {
            id: firstHotel.id,
            name: firstHotel.name,
            ratehawk_data: firstHotel.ratehawk_data,
            price: firstHotel.price,
            hasRates: !!(firstHotel.ratehawk_data?.rates),
            ratesCount: firstHotel.ratehawk_data?.rates?.length || 0
          },
          rawSampleData: firstHotel.ratehawk_data ? 
            JSON.stringify(firstHotel.ratehawk_data, null, 2).substring(0, 2000) + '...' : 
            'No ratehawk_data available'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        error: 'No hotels found in debug search',
        debugSearch: debugSearch
      });
    }
    
  } catch (error) {
    console.error('💥 Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: `Debug failed: ${error.message}`
    });
  }
});

// ✅ NEW: Test booking link generation
router.post('/test/booking-link', async (req, res) => {
  const { userId, sampleRateData } = req.body;
  
  console.log(`🧪 === TEST BOOKING LINK GENERATION ===`);
  
  try {
    const userSession = global.userSessions.get(userId);
    if (!userSession || !validateSession(userSession)) {
      return res.status(401).json({
        success: false,
        error: 'Valid RateHawk session required'
      });
    }
    
    // Test different booking URL patterns
    const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
    const testLinks = [];
    
    // Pattern 1: Basic rate key
    if (sampleRateData?.rate_key) {
      testLinks.push({
        pattern: 'rate_key',
        url: `/orders/reserve/h-${sampleRateData.rate_key}/?price=one&residency=en-us&sid=${sessionId}`,
        fullUrl: `https://www.ratehawk.com/orders/reserve/h-${sampleRateData.rate_key}/?price=one&residency=en-us&sid=${sessionId}`
      });
    }
    
    // Pattern 2: Rate ID
    if (sampleRateData?.rate_id) {
      testLinks.push({
        pattern: 'rate_id',
        url: `/orders/reserve/h-${sampleRateData.rate_id}/?price=one&residency=en-us&sid=${sessionId}`,
        fullUrl: `https://www.ratehawk.com/orders/reserve/h-${sampleRateData.rate_id}/?price=one&residency=en-us&sid=${sessionId}`
      });
    }
    
    // Pattern 3: Generic ID
    if (sampleRateData?.id) {
      testLinks.push({
        pattern: 'generic_id',
        url: `/orders/reserve/h-${sampleRateData.id}/?price=one&residency=en-us&sid=${sessionId}`,
        fullUrl: `https://www.ratehawk.com/orders/reserve/h-${sampleRateData.id}/?price=one&residency=en-us&sid=${sessionId}`
      });
    }
    
    res.json({
      success: true,
      sessionId: sessionId,
      testLinks: testLinks,
      sampleData: sampleRateData,
      note: "These are test booking URLs based on your rate data patterns",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 Test booking link error:', error);
    res.status(500).json({
      success: false,
      error: `Test failed: ${error.message}`
    });
  }
});

router.get('/debug/analyze-data/:userId', async (req, res) => {
  const { userId } = req.params;
  const { 
    destination = '2998', 
    checkin = '2025-06-10', 
    checkout = '2025-06-12',
    guests = JSON.stringify([{ adults: 2 }])
  } = req.query;
  
  console.log(`🔬 === COMPREHENSIVE RATEHAWK DATA ANALYSIS ===`);
  console.log(`👤 User ID: ${userId}`);
  console.log(`🏨 Test search: ${destination} (${checkin} to ${checkout})`);
  
  try {
    // Get user session
    const userSession = global.userSessions.get(userId);
    if (!userSession || !validateSession(userSession)) {
      return res.status(401).json({
        success: false,
        error: 'Valid RateHawk session required for analysis'
      });
    }
    
    console.log(`✅ User session valid: ${userSession.cookies?.length || 0} cookies`);
    
    // Perform test search to get raw data
    console.log('🔍 Performing test search...');
    const testSearchData = {
      userSession,
      destination,
      checkin,
      checkout,
      guests: JSON.parse(guests),
      residency: 'en-us',
      currency: 'USD',
      page: 1,
      filters: {}
    };
    
    // Use your existing search function to get raw response
    const rawSearchResponse = await performRawSearch(testSearchData);
    
    console.log('📊 Raw search response received, analyzing...');
    
    // Comprehensive analysis
    const analysis = analyzeSearchResponse(rawSearchResponse, userSession);
    
    // Additional tests
    const additionalTests = await runAdditionalTests(userSession, {
      destination, checkin, checkout, guests: JSON.parse(guests)
    });
    
    // Compile full report
    const fullReport = {
      success: true,
      timestamp: new Date().toISOString(),
      userId: userId,
      testParameters: {
        destination,
        checkin,
        checkout,
        guests: JSON.parse(guests)
      },
      userSession: {
        hasSession: !!userSession,
        cookieCount: userSession?.cookies?.length || 0,
        sessionId: userSession?.sessionId,
        ratehawkSessionId: userSession?.ratehawkSessionId,
        email: userSession?.email
      },
      rawSearchResponse: {
        success: !!rawSearchResponse,
        dataSize: JSON.stringify(rawSearchResponse).length,
        topLevelKeys: rawSearchResponse ? Object.keys(rawSearchResponse) : [],
        hasHotels: !!(rawSearchResponse && findHotelsInResponse(rawSearchResponse))
      },
      analysis: analysis,
      additionalTests: additionalTests,
      actionableNextSteps: generateNextSteps(analysis),
      sampleBookingUrls: generateSampleBookingUrls(analysis, userSession)
    };
    
    // Log summary for console
    console.log('📋 === ANALYSIS SUMMARY ===');
    console.log(`🏨 Hotels found: ${analysis.extractedData.hotels.length}`);
    console.log(`💰 Hotels with rates: ${analysis.extractedData.hotels.filter(h => h.hasRates).length}`);
    console.log(`🔗 Hotels with booking options: ${analysis.extractedData.hotels.filter(h => h.bookingOptions.length > 0).length}`);
    console.log(`📝 Recommendations: ${analysis.actionableRecommendations.length}`);
    
    res.json(fullReport);
    
  } catch (error) {
    console.error('💥 Data analysis failed:', error);
    res.status(500).json({
      success: false,
      error: `Analysis failed: ${error.message}`,
      stack: error.stack?.substring(0, 1000)
    });
  }
});

// Helper function to perform raw search (use your existing search logic)
async function performRawSearch(searchData) {
  try {
    // This should use your existing search implementation
    // but return the RAW response before any transformation
    
    const { userSession, destination, checkin, checkout, guests, residency, currency } = searchData;
    
    // Format data (use your existing helpers)
    const formattedGuests = formatGuestsForRateHawk(guests);
    const destinationInfo = getDestinationInfo(destination);
    const cookieString = formatCookiesForRequest(userSession.cookies);
    const csrfToken = extractCSRFToken(userSession.cookies);
    
    // Make the actual API call (copy from your existing searchHotels function)
    const searchPayload = {
      session_params: {
        currency: currency.toUpperCase(),
        language: "en",
        search_uuid: generateUUID(),
        arrival_date: checkin,
        departure_date: checkout,
        region_id: parseInt(destinationInfo.id),
        residency: residency,
        paxes: formattedGuests
      },
      page: 1,
      map_hotels: true,
      session_id: generateSessionId()
    };
    
    console.log('📡 Making raw search request...');
    
    const response = await fetch('https://www.ratehawk.com/hotel/search/v2/b2bsite/serp', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'cookie': cookieString,
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
        'referer': 'https://www.ratehawk.com/',
        'x-requested-with': 'XMLHttpRequest',
        ...(csrfToken && { 'x-csrftoken': csrfToken })
      },
      body: JSON.stringify(searchPayload)
    });
    
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
    }
    
    const rawData = await response.json();
    console.log('📨 Raw search response received');
    
    return rawData;
    
  } catch (error) {
    console.error('💥 Raw search failed:', error);
    return null;
  }
}

// Helper function to find hotels in response
function findHotelsInResponse(response) {
  const possiblePaths = [
    response?.data?.hotels,
    response?.hotels,
    response?.results?.hotels,
    response?.data?.results
  ];
  
  for (const path of possiblePaths) {
    if (Array.isArray(path) && path.length > 0) {
      return path;
    }
  }
  return null;
}

// Run additional tests to understand the API better
async function runAdditionalTests(userSession, searchParams) {
  const tests = {
    hotelDetailsTest: null,
    sessionInfoTest: null,
    cookieAnalysis: null
  };
  
  try {
    // Test 1: Try to get hotel details for a known hotel
    console.log('🧪 Test 1: Hotel details endpoint...');
    tests.hotelDetailsTest = await testHotelDetailsEndpoint(userSession, searchParams);
    
    // Test 2: Analyze session information
    console.log('🧪 Test 2: Session info analysis...');
    tests.sessionInfoTest = analyzeSessionInfo(userSession);
    
    // Test 3: Cookie analysis
    console.log('🧪 Test 3: Cookie analysis...');
    tests.cookieAnalysis = analyzeCookies(userSession.cookies);
    
  } catch (error) {
    console.error('💥 Additional tests failed:', error);
  }
  
  return tests;
}

// Test hotel details endpoint
async function testHotelDetailsEndpoint(userSession, searchParams) {
  try {
    // Try a known hotel ID for Las Vegas (destination 2998)
    const testHotelId = 'mid1234567'; // This would be a real hotel ID from your search results
    const cookieString = formatCookiesForRequest(userSession.cookies);
    
    const detailsUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?hotel_id=${testHotelId}`;
    
    const response = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'cookie': cookieString,
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
        'referer': 'https://www.ratehawk.com/'
      }
    });
    
    return {
      success: response.ok,
      status: response.status,
      data: response.ok ? await response.json() : null,
      error: response.ok ? null : `HTTP ${response.status}`
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Analyze session information
function analyzeSessionInfo(userSession) {
  const analysis = {
    hasSessionId: !!userSession.sessionId,
    hasRatehawkSessionId: !!userSession.ratehawkSessionId,
    sessionAge: null,
    cookieCount: userSession.cookies?.length || 0,
    importantCookies: [],
    sessionData: {}
  };
  
  if (userSession.loginTime) {
    const ageMs = Date.now() - new Date(userSession.loginTime).getTime();
    analysis.sessionAge = `${Math.round(ageMs / (1000 * 60))} minutes`;
  }
  
  // Extract important session data
  const sessionFields = ['sessionId', 'ratehawkSessionId', 'email', 'loginTime', 'lastUsed'];
  sessionFields.forEach(field => {
    if (userSession[field]) {
      analysis.sessionData[field] = userSession[field];
    }
  });
  
  // Find important cookies
  if (userSession.cookies) {
    const importantCookieNames = ['sessionid', 'csrftoken', 'uid', 'is_auth'];
    analysis.importantCookies = userSession.cookies
      .filter(cookie => importantCookieNames.some(name => cookie.name.includes(name)))
      .map(cookie => ({
        name: cookie.name,
        hasValue: !!cookie.value,
        valueLength: cookie.value?.length || 0,
        domain: cookie.domain
      }));
  }
  
  return analysis;
}

// Analyze cookies
function analyzeCookies(cookies) {
  if (!cookies || !Array.isArray(cookies)) {
    return { error: 'No cookies provided' };
  }
  
  const analysis = {
    total: cookies.length,
    domains: {},
    sessionCookies: [],
    authCookies: [],
    otherCookies: []
  };
  
  cookies.forEach(cookie => {
    // Group by domain
    const domain = cookie.domain || 'unknown';
    analysis.domains[domain] = (analysis.domains[domain] || 0) + 1;
    
    // Categorize cookies
    const name = cookie.name.toLowerCase();
    if (name.includes('session')) {
      analysis.sessionCookies.push({
        name: cookie.name,
        domain: cookie.domain,
        hasValue: !!cookie.value
      });
    } else if (name.includes('auth') || name.includes('csrf') || name.includes('uid')) {
      analysis.authCookies.push({
        name: cookie.name,
        domain: cookie.domain,
        hasValue: !!cookie.value
      });
    } else {
      analysis.otherCookies.push({
        name: cookie.name,
        domain: cookie.domain
      });
    }
  });
  
  return analysis;
}

// Generate next steps based on analysis
function generateNextSteps(analysis) {
  const steps = [];
  
  const hotelsWithRates = analysis.extractedData.hotels.filter(h => h.hasRates).length;
  const totalHotels = analysis.extractedData.hotels.length;
  
  if (totalHotels === 0) {
    steps.push({
      priority: 1,
      action: 'Fix search endpoint',
      description: 'No hotels found in search response. Check API endpoint and request format.',
      code: 'Verify your search request matches RateHawk API documentation'
    });
  } else if (hotelsWithRates === 0) {
    steps.push({
      priority: 1,
      action: 'Implement hotel details fetching',
      description: 'Search returns basic hotel info only. Need to fetch detailed rates separately.',
      code: `
// For each hotel in search results:
for (const hotel of searchResults.hotels) {
  const hotelId = hotel.ota_hotel_id || hotel.id;
  const detailsUrl = \`https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?session=\${sessionId}&hotel_id=\${hotelId}\`;
  const details = await fetch(detailsUrl, { headers: { cookie: cookieString } });
  const rateData = await details.json();
  // Extract rates and booking links from rateData
}
      `
    });
  } else {
    steps.push({
      priority: 1,
      action: 'Extract booking URLs',
      description: `You have rates for ${hotelsWithRates} hotels. Now extract booking URLs.`,
      code: `
// Extract booking URLs from rate data:
hotel.rates.forEach(rate => {
  const rateId = rate.rate_key || rate.rate_id || rate.id;
  const sessionId = userSession.ratehawkSessionId;
  const bookingUrl = \`/orders/reserve/h-\${rateId}/?price=one&residency=en-us&sid=\${sessionId}\`;
  const fullUrl = \`https://www.ratehawk.com\${bookingUrl}\`;
});
      `
    });
  }
  
  steps.push({
    priority: 2,
    action: 'Implement booking functionality',
    description: 'Create functions to open booking URLs or redirect users.',
    code: `
function bookHotel(rateId, sessionId) {
  const bookingUrl = \`https://www.ratehawk.com/orders/reserve/h-\${rateId}/?price=one&residency=en-us&sid=\${sessionId}\`;
  window.open(bookingUrl, '_blank');
}
    `
  });
  
  steps.push({
    priority: 3,
    action: 'Add error handling',
    description: 'Handle cases where booking URLs fail or sessions expire.',
    code: 'Add try-catch blocks and session validation before booking attempts'
  });
  
  return steps;
}

// Generate sample booking URLs
function generateSampleBookingUrls(analysis, userSession) {
  const samples = [];
  
  const sessionId = userSession?.ratehawkSessionId || userSession?.sessionId || 'SESSION_ID_PLACEHOLDER';
  
  // Generate samples from analysis
  analysis.extractedData.hotels.forEach((hotel, hotelIndex) => {
    if (hotel.bookingOptions.length > 0) {
      hotel.bookingOptions.forEach((booking, bookingIndex) => {
        booking.bookingLinks.forEach(link => {
          if (link.type === 'constructed') {
            const urlWithSession = link.url.replace('{SESSION_ID}', sessionId);
            samples.push({
              hotelIndex: hotelIndex,
              hotelName: hotel.name,
              rateName: booking.rateName,
              price: booking.price,
              currency: booking.currency,
              bookingUrl: urlWithSession,
              fullUrl: `https://www.ratehawk.com${urlWithSession}`,
              rateId: Object.values(booking.rateIds)[0]
            });
          }
        });
      });
    }
  });
  
  // If no real samples, create template samples
  if (samples.length === 0) {
    samples.push({
      type: 'template',
      description: 'This is how booking URLs should look',
      pattern: `/orders/reserve/h-{RATE_ID}/?price=one&residency=en-us&sid=${sessionId}`,
      fullUrlPattern: `https://www.ratehawk.com/orders/reserve/h-{RATE_ID}/?price=one&residency=en-us&sid=${sessionId}`,
      note: 'Replace {RATE_ID} with actual rate ID from hotel rate data'
    });
  }
  
  return samples;
}

// Helper functions (you already have these, but including for completeness)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateSessionId() {
  return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = router;