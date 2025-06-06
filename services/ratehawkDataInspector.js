// ================================
// RATEHAWK DATA INSPECTOR
// Comprehensive analysis of RateHawk API responses
// ================================

/**
 * Debug function to inspect and log all RateHawk data structures
 */
function inspectRateHawkData(apiResponse, context = 'Unknown') {
  console.log(`🔍 === RATEHAWK DATA INSPECTION: ${context} ===`);
  
  const inspection = {
    timestamp: new Date().toISOString(),
    context: context,
    dataStructure: {},
    possibleBookingData: [],
    rateInformation: [],
    missingData: [],
    recommendations: []
  };
  
  try {
    // Analyze top-level structure
    if (apiResponse) {
      inspection.dataStructure.topLevelKeys = Object.keys(apiResponse);
      console.log('📋 Top-level keys:', inspection.dataStructure.topLevelKeys);
      
      // Check for different data locations
      const possibleDataPaths = [
        'data',
        'hotels',
        'results',
        'response',
        'items'
      ];
      
      possibleDataPaths.forEach(path => {
        if (apiResponse[path]) {
          console.log(`📂 Found data at path: ${path}`);
          inspection.dataStructure[path] = {
            type: Array.isArray(apiResponse[path]) ? 'array' : typeof apiResponse[path],
            length: Array.isArray(apiResponse[path]) ? apiResponse[path].length : 'N/A',
            keys: typeof apiResponse[path] === 'object' ? Object.keys(apiResponse[path]) : 'N/A'
          };
        }
      });
      
      // Find hotels data
      const hotelsData = findHotelsData(apiResponse);
      if (hotelsData) {
        console.log(`🏨 Found hotels data: ${hotelsData.hotels.length} hotels`);
        inspection.dataStructure.hotelsFound = true;
        inspection.dataStructure.hotelsCount = hotelsData.hotels.length;
        inspection.dataStructure.hotelsPath = hotelsData.path;
        
        // Analyze first hotel structure
        if (hotelsData.hotels.length > 0) {
          const firstHotel = hotelsData.hotels[0];
          inspection.sampleHotel = analyzeHotelStructure(firstHotel);
          
          // Look for booking/rate data
          const bookingAnalysis = analyzeBookingData(firstHotel);
          inspection.bookingAnalysis = bookingAnalysis;
          
          console.log('🏨 Sample hotel analysis:', JSON.stringify(inspection.sampleHotel, null, 2));
          console.log('💰 Booking analysis:', JSON.stringify(bookingAnalysis, null, 2));
        }
      } else {
        console.log('❌ No hotels data found');
        inspection.dataStructure.hotelsFound = false;
        inspection.missingData.push('hotels array');
      }
      
      // Look for session information
      const sessionInfo = findSessionInfo(apiResponse);
      if (sessionInfo) {
        inspection.sessionInfo = sessionInfo;
        console.log('🔗 Session info found:', sessionInfo);
      } else {
        inspection.missingData.push('session information');
      }
      
    } else {
      console.log('❌ No API response data provided');
      inspection.dataStructure.empty = true;
    }
    
    // Generate recommendations
    generateRecommendations(inspection);
    
  } catch (error) {
    console.error('💥 Data inspection failed:', error);
    inspection.error = error.message;
  }
  
  console.log('📊 Final inspection report:', JSON.stringify(inspection, null, 2));
  return inspection;
}

/**
 * Find hotels data in various possible locations
 */
function findHotelsData(response) {
  const possiblePaths = [
    ['data', 'hotels'],
    ['hotels'],
    ['results', 'hotels'],
    ['data', 'results'],
    ['response', 'hotels'],
    ['items']
  ];
  
  for (const path of possiblePaths) {
    let current = response;
    let pathStr = '';
    
    for (const segment of path) {
      pathStr += (pathStr ? '.' : '') + segment;
      if (current && current[segment]) {
        current = current[segment];
      } else {
        current = null;
        break;
      }
    }
    
    if (current && Array.isArray(current) && current.length > 0) {
      return {
        hotels: current,
        path: pathStr
      };
    }
  }
  
  return null;
}

/**
 * Analyze individual hotel structure
 */
function analyzeHotelStructure(hotel) {
  const analysis = {
    topLevelKeys: Object.keys(hotel),
    identifiers: {},
    pricing: {},
    ratesInfo: {},
    bookingInfo: {},
    staticInfo: {}
  };
  
  // Look for hotel identifiers
  const idFields = ['id', 'hotel_id', 'ota_hotel_id', 'requested_hotel_id', 'ratehawk_id'];
  idFields.forEach(field => {
    if (hotel[field]) {
      analysis.identifiers[field] = hotel[field];
    }
  });
  
  // Look for pricing information
  const priceFields = ['price', 'rates', 'pricing', 'rate_info', 'payment_options'];
  priceFields.forEach(field => {
    if (hotel[field]) {
      analysis.pricing[field] = {
        type: Array.isArray(hotel[field]) ? 'array' : typeof hotel[field],
        length: Array.isArray(hotel[field]) ? hotel[field].length : 'N/A',
        sample: Array.isArray(hotel[field]) && hotel[field].length > 0 ? 
          hotel[field][0] : hotel[field]
      };
    }
  });
  
  // Look for rates specifically
  if (hotel.rates && Array.isArray(hotel.rates)) {
    analysis.ratesInfo = {
      count: hotel.rates.length,
      structure: hotel.rates.length > 0 ? Object.keys(hotel.rates[0]) : [],
      samples: hotel.rates.slice(0, 2) // First 2 rates for analysis
    };
  }
  
  // Look for static_vm data
  if (hotel.static_vm) {
    analysis.staticInfo = {
      hasStaticVm: true,
      keys: Object.keys(hotel.static_vm),
      images: hotel.static_vm.images ? hotel.static_vm.images.length : 0
    };
  }
  
  return analysis;
}

/**
 * Analyze booking and rate data to find booking links
 */
function analyzeBookingData(hotel) {
  const analysis = {
    hasRates: false,
    ratesCount: 0,
    bookingLinksFound: [],
    rateStructures: [],
    possibleBookingFields: [],
    extractedBookingData: []
  };
  
  // Check for rates array
  if (hotel.rates && Array.isArray(hotel.rates)) {
    analysis.hasRates = true;
    analysis.ratesCount = hotel.rates.length;
    
    hotel.rates.forEach((rate, index) => {
      const rateAnalysis = {
        index: index,
        keys: Object.keys(rate),
        identifiers: {},
        pricing: {},
        bookingData: {}
      };
      
      // Look for rate identifiers
      const rateIdFields = ['id', 'rate_id', 'rate_key', 'booking_id', 'reserve_id'];
      rateIdFields.forEach(field => {
        if (rate[field]) {
          rateAnalysis.identifiers[field] = rate[field];
        }
      });
      
      // Look for booking-related fields
      const bookingFields = [
        'booking_url', 'reserve_url', 'order_url', 'book_url',
        'booking_link', 'reserve_link', 'book_link',
        'href', 'url', 'link'
      ];
      
      bookingFields.forEach(field => {
        if (rate[field]) {
          rateAnalysis.bookingData[field] = rate[field];
          analysis.bookingLinksFound.push({
            rateIndex: index,
            field: field,
            value: rate[field]
          });
        }
      });
      
      // Look for payment options structure
      if (rate.payment_options) {
        rateAnalysis.paymentOptions = {
          keys: Object.keys(rate.payment_options),
          hasPaymentTypes: !!rate.payment_options.payment_types,
          paymentTypesCount: Array.isArray(rate.payment_options.payment_types) ? 
            rate.payment_options.payment_types.length : 0
        };
        
        // Check for booking data in payment types
        if (rate.payment_options.payment_types && Array.isArray(rate.payment_options.payment_types)) {
          rate.payment_options.payment_types.forEach((paymentType, ptIndex) => {
            bookingFields.forEach(field => {
              if (paymentType[field]) {
                analysis.bookingLinksFound.push({
                  rateIndex: index,
                  paymentTypeIndex: ptIndex,
                  field: field,
                  value: paymentType[field]
                });
              }
            });
          });
        }
      }
      
      analysis.rateStructures.push(rateAnalysis);
    });
  }
  
  // Try to extract booking data using common patterns
  analysis.extractedBookingData = extractBookingLinksFromHotel(hotel);
  
  return analysis;
}

/**
 * Extract booking links using known patterns
 */
function extractBookingLinksFromHotel(hotel) {
  const bookingData = [];
  
  if (!hotel.rates || !Array.isArray(hotel.rates)) {
    return bookingData;
  }
  
  hotel.rates.forEach((rate, rateIndex) => {
    const rateBookingData = {
      rateIndex: rateIndex,
      rateName: rate.room_name || rate.name || `Rate ${rateIndex + 1}`,
      bookingLinks: [],
      rateIds: {},
      price: null,
      currency: null
    };
    
    // Extract rate identifiers
    const rateIdFields = ['id', 'rate_id', 'rate_key', 'booking_id'];
    rateIdFields.forEach(field => {
      if (rate[field]) {
        rateBookingData.rateIds[field] = rate[field];
      }
    });
    
    // Extract pricing
    if (rate.payment_options?.payment_types?.[0]) {
      const payment = rate.payment_options.payment_types[0];
      rateBookingData.price = payment.show_amount || payment.amount;
      rateBookingData.currency = payment.show_currency_code || payment.currency_code;
    }
    
    // Direct booking URL fields
    const directBookingFields = ['booking_url', 'reserve_url', 'href', 'book_url'];
    directBookingFields.forEach(field => {
      if (rate[field]) {
        rateBookingData.bookingLinks.push({
          type: 'direct',
          field: field,
          url: rate[field]
        });
      }
    });
    
    // Construct booking URLs from rate IDs
    Object.entries(rateBookingData.rateIds).forEach(([idType, idValue]) => {
      if (idValue) {
        // Pattern 1: Standard RateHawk booking URL
        const bookingUrl1 = `/orders/reserve/h-${idValue}/?price=one&residency=en-us`;
        rateBookingData.bookingLinks.push({
          type: 'constructed',
          pattern: 'standard',
          idType: idType,
          url: bookingUrl1,
          fullUrl: `https://www.ratehawk.com${bookingUrl1}`
        });
        
        // Pattern 2: With session ID (needs to be added dynamically)
        rateBookingData.bookingLinks.push({
          type: 'constructed',
          pattern: 'with_session',
          idType: idType,
          url: `${bookingUrl1}&sid={SESSION_ID}`,
          note: 'SESSION_ID needs to be replaced with actual session'
        });
      }
    });
    
    bookingData.push(rateBookingData);
  });
  
  return bookingData;
}

/**
 * Find session information
 */
function findSessionInfo(response) {
  const sessionInfo = {};
  
  // Look for session in various locations
  const sessionPaths = [
    ['session_id'],
    ['data', 'session_id'],
    ['session_info', 'session', 'id'],
    ['search_session_id'],
    ['data', 'search_session_id']
  ];
  
  sessionPaths.forEach(path => {
    let current = response;
    for (const segment of path) {
      if (current && current[segment]) {
        current = current[segment];
      } else {
        current = null;
        break;
      }
    }
    
    if (current) {
      sessionInfo[path.join('.')] = current;
    }
  });
  
  return Object.keys(sessionInfo).length > 0 ? sessionInfo : null;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(inspection) {
  const recommendations = [];
  
  if (!inspection.dataStructure.hotelsFound) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'No hotels data found',
      solution: 'Check API endpoint and response structure. Hotels might be in a different path.',
      action: 'Add logging to see full API response structure'
    });
  }
  
  if (inspection.bookingAnalysis && inspection.bookingAnalysis.ratesCount === 0) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'No rates found in hotel data',
      solution: 'The search endpoint might only return basic hotel info. Need to call hotel details endpoint.',
      action: 'Implement fetchHotelDetails() for each hotel after search'
    });
  }
  
  if (inspection.bookingAnalysis && inspection.bookingAnalysis.bookingLinksFound.length === 0) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'No direct booking links found',
      solution: 'Booking links need to be constructed from rate IDs and session data.',
      action: 'Use rate IDs to construct booking URLs with pattern: /orders/reserve/h-{rate_id}/?price=one&residency=en-us&sid={session_id}'
    });
  }
  
  if (!inspection.sessionInfo) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'No session information found',
      solution: 'Session ID is needed for booking URLs.',
      action: 'Extract session ID from search response or user session cookies'
    });
  }
  
  recommendations.push({
    priority: 'INFO',
    issue: 'Data structure analysis complete',
    solution: 'Use the extracted patterns to implement booking functionality.',
    action: 'Implement booking URL construction and hotel details fetching'
  });
  
  inspection.recommendations = recommendations;
}

/**
 * Main function to inspect search results and provide actionable data
 */
function analyzeSearchResponse(searchResponse, userSession) {
  console.log('🔬 === COMPREHENSIVE RATEHAWK ANALYSIS ===');
  
  const analysis = {
    searchResponse: inspectRateHawkData(searchResponse, 'Search Response'),
    userSession: userSession ? {
      hasSession: true,
      cookieCount: userSession.cookies ? userSession.cookies.length : 0,
      sessionId: userSession.sessionId,
      ratehawkSessionId: userSession.ratehawkSessionId
    } : null,
    extractedData: {
      hotels: [],
      bookingOptions: [],
      sessionInfo: null
    },
    actionableRecommendations: []
  };
  
  // Extract usable data
  const hotelsData = findHotelsData(searchResponse);
  if (hotelsData) {
    analysis.extractedData.hotels = hotelsData.hotels.map((hotel, index) => ({
      index: index,
      id: hotel.id || hotel.ota_hotel_id || hotel.hotel_id,
      name: hotel.name || hotel.static_vm?.name || `Hotel ${index + 1}`,
      hasRates: !!(hotel.rates && hotel.rates.length > 0),
      ratesCount: hotel.rates ? hotel.rates.length : 0,
      bookingOptions: extractBookingLinksFromHotel(hotel)
    }));
  }
  
  // Extract session info
  analysis.extractedData.sessionInfo = findSessionInfo(searchResponse);
  
  // Generate actionable recommendations
  generateActionableRecommendations(analysis);
  
  console.log('📋 Analysis complete:', JSON.stringify(analysis, null, 2));
  return analysis;
}

/**
 * Generate specific actionable recommendations
 */
function generateActionableRecommendations(analysis) {
  const recommendations = [];
  
  const hotelsWithRates = analysis.extractedData.hotels.filter(h => h.hasRates);
  const hotelsWithBookingOptions = analysis.extractedData.hotels.filter(h => h.bookingOptions.length > 0);
  
  if (hotelsWithRates.length === 0) {
    recommendations.push({
      priority: 'CRITICAL',
      issue: 'No hotels have rate data',
      solution: 'Current search endpoint only returns basic hotel info. You need to call individual hotel details endpoints.',
      code: `
// For each hotel, call:
const hotelDetails = await fetch('https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?session=SESSION_ID&hotel_id=HOTEL_ID');
// or
const hotelDetails = await fetch('https://www.ratehawk.com/hotel/REGION/CITY/HOTEL_ID/?dates=CHECKIN-CHECKOUT&guests=X&residency=en-us');
      `,
      nextSteps: [
        '1. Extract hotel IDs from search results',
        '2. Call hotel details endpoint for each hotel',
        '3. Extract rates and booking data from details response'
      ]
    });
  }
  
  if (hotelsWithBookingOptions.length > 0) {
    recommendations.push({
      priority: 'GOOD',
      issue: `Found booking data for ${hotelsWithBookingOptions.length} hotels`,
      solution: 'Use the extracted rate IDs to construct booking URLs',
      code: `
// Construct booking URL:
const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
const bookingUrl = \`/orders/reserve/h-\${rateId}/?price=one&residency=en-us&sid=\${sessionId}\`;
const fullUrl = \`https://www.ratehawk.com\${bookingUrl}\`;
      `,
      nextSteps: [
        '1. Extract rate IDs from hotel data',
        '2. Get session ID from user session',
        '3. Construct booking URLs using the pattern above',
        '4. Open booking URLs in new tabs or redirect users'
      ]
    });
  }
  
  if (!analysis.extractedData.sessionInfo && analysis.userSession) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'No session ID in search response',
      solution: 'Use session ID from user login session',
      code: `
const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
// Use this sessionId in booking URLs
      `,
      nextSteps: [
        '1. Get session ID from stored user session',
        '2. Include in all booking URL constructions'
      ]
    });
  }
  
  analysis.actionableRecommendations = recommendations;
}

module.exports = {
  inspectRateHawkData,
  analyzeSearchResponse,
  extractBookingLinksFromHotel,
  findHotelsData,
  analyzeHotelStructure,
  analyzeBookingData
};