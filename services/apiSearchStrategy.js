// ================================
// API SEARCH STRATEGY
// Direct API calls to RateHawk endpoints
// ================================

const {
  formatGuestsForRateHawk,
  getDestinationInfo,
  generateSessionData,
  buildAPIHeaders,
  validateSearchParams,
  validateUserSession,
  handleAPIError,
  createSuccessResponse
} = require('../utils');

const { pollSearchResults } = require('./pollingService');

/**
 * Execute hotel search using RateHawk API
 */
async function executeAPISearch(searchParams) {
  console.log('🚀 Starting API search strategy...');
  
  const { userSession, destination, checkin, checkout, guests, residency, currency } = searchParams;
  
  // Validate inputs
  const sessionValidation = validateUserSession(userSession);
  if (!sessionValidation.isValid) {
    return handleAPIError(new Error(sessionValidation.error), 'Session Validation');
  }
  
  const paramValidation = validateSearchParams({ destination, checkin, checkout, guests });
  if (!paramValidation.isValid) {
    return handleAPIError(new Error(paramValidation.errors.join(', ')), 'Parameter Validation');
  }
  
  try {
    // Format and validate data
    const formattedGuests = formatGuestsForRateHawk(guests);
    const destinationInfo = getDestinationInfo(destination);
    const sessionData = generateSessionData(userSession);
    
    console.log('📋 Search configuration:', {
      destination: destinationInfo.name,
      destinationId: destinationInfo.id,
      checkin,
      checkout,
      guests: formattedGuests,
      residency: residency || 'en-us',
      currency: currency || 'USD'
    });
    
    // Prepare RateHawk API payload
    const searchPayload = {
      region_id: destinationInfo.id,
      checkin: checkin,
      checkout: checkout,
      guests: formattedGuests,
      residency: residency || 'en-us',
      currency: currency || 'USD',
      language: 'en'
    };
    
    console.log('📡 Sending initial search request...');
    console.log('🎯 RateHawk payload:', JSON.stringify(searchPayload, null, 2));
    
    // Make initial search request
    const response = await fetch('https://www.ratehawk.com/hotel/search/v2/b2bsite/serp', {
      method: 'POST',
      headers: buildAPIHeaders(userSession, sessionData),
      body: JSON.stringify(searchPayload)
    });
    
    console.log('📨 Initial search response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`RateHawk API returned ${response.status}: ${response.statusText}`);
    }
    
    const initialData = await response.json();
    console.log('📊 Initial search response:', JSON.stringify(initialData, null, 2));
    
    // Handle initial response errors
    if (initialData.error) {
      console.log('❌ RateHawk API error:', initialData.error);
      return {
        success: false,
        error: `RateHawk API error: ${initialData.error}`,
        details: initialData.err || {},
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    // Check for search session ID
    if (!initialData.data || !initialData.data.search_session_id) {
      console.log('❌ No search session ID in response');
      return {
        success: false,
        error: 'No search session created by RateHawk',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    const searchSessionId = initialData.data.search_session_id;
    console.log('🔗 Search session ID:', searchSessionId);
    
    // Extract initial data
    const initialHotels = initialData.data.hotels || [];
    const initialTotalHotels = initialData.data.total_hotels || 0;
    const initialAvailableHotels = initialData.data.available_hotels || 0;
    const searchFinished = initialData.data.search_finished || false;
    
    console.log('📊 Initial results:', {
      hotels: initialHotels.length,
      totalHotels: initialTotalHotels,
      availableHotels: initialAvailableHotels,
      searchFinished: searchFinished
    });
    
    // If search is already finished, return initial results
    if (searchFinished) {
      console.log('✅ Search completed immediately');
      return createSuccessResponse({
        hotels: initialHotels,
        totalHotels: initialTotalHotels,
        availableHotels: initialAvailableHotels,
        searchSessionId: searchSessionId,
        searchParams: {
          destination: destinationInfo.name,
          destinationId: destinationInfo.id,
          guests: formattedGuests,
          checkin: checkin,
          checkout: checkout
        },
        metadata: {
          strategy: 'api',
          immediate: true
        }
      });
    }
    
    // If search is not finished, start polling
    console.log('🔄 Search not finished, starting polling...');
    const pollResults = await pollSearchResults(searchSessionId, userSession.cookies);
    
    // Combine initial and polled results
    const allHotels = [...initialHotels, ...(pollResults.hotels || [])];
    const finalTotalHotels = pollResults.totalHotels || initialTotalHotels;
    const finalAvailableHotels = pollResults.availableHotels || initialAvailableHotels;
    
    console.log('✅ API search completed:', {
      totalHotels: allHotels.length,
      finalTotalHotels: finalTotalHotels,
      finalAvailableHotels: finalAvailableHotels
    });
    
    return createSuccessResponse({
      hotels: allHotels,
      totalHotels: finalTotalHotels,
      availableHotels: finalAvailableHotels,
      searchSessionId: searchSessionId,
      searchParams: {
        destination: destinationInfo.name,
        destinationId: destinationInfo.id,
        guests: formattedGuests,
        checkin: checkin,
        checkout: checkout
      },
      metadata: {
        strategy: 'api',
        pollingCompleted: true
      }
    });
    
  } catch (error) {
    console.error('💥 API search failed:', error);
    return handleAPIError(error, 'API Search');
  }
}

/**
 * Test API connectivity
 */
async function testAPIConnectivity(userSession) {
  try {
    const testPayload = {
      region_id: "2998", // Las Vegas
      checkin: "2025-06-10",
      checkout: "2025-06-12",
      guests: [{ adults: 2 }],
      residency: "en-us",
      currency: "USD",
      language: "en"
    };
    
    const sessionData = generateSessionData(userSession);
    
    const response = await fetch('https://www.ratehawk.com/hotel/search/v2/b2bsite/serp', {
      method: 'POST',
      headers: buildAPIHeaders(userSession, sessionData),
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      hasSearchSessionId: !!(data.data && data.data.search_session_id),
      error: data.error || null,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  executeAPISearch,
  testAPIConnectivity
};