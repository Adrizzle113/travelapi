// ================================
// ENHANCED RATEHAWK SERVICE - FINAL FIXED VERSION
// CRITICAL FIX: Extract correct RateHawk hotel IDs for API calls
// ================================

/**
 * CRITICAL FIX: Fetch booking data for a single hotel using correct hotel ID from stored data
 */
async function fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams) {
  const { checkin, checkout, guests, residency, currency } = searchParams;
  
  try {
    // CRITICAL: We need to get the hotel data from localStorage since the backend is passing incomplete data
    console.log(`🔍 Fetching RateHawk hotel ID for: ${hotel.name || hotel.id}`);
    console.log(`📊 Hotel object keys:`, Object.keys(hotel));
    
    let actualRateHawkHotelId = null;
    
    // Method 1: Check stored search results in localStorage for the correct mapping
    try {
      const storedResults = localStorage.getItem('hotelSearchResults');
      if (storedResults) {
        const searchResults = JSON.parse(storedResults);
        const matchedHotel = searchResults.hotels.find(h => h.id === hotel.id);
        
        if (matchedHotel && matchedHotel.ratehawk_data) {
          actualRateHawkHotelId = matchedHotel.ratehawk_data.ota_hotel_id || 
                                  matchedHotel.ratehawk_data.requested_hotel_id ||
                                  matchedHotel.ratehawk_data.hotel_id ||
                                  matchedHotel.ratehawk_data.original_id;
          
          console.log(`✅ Found RateHawk ID from stored search results: ${actualRateHawkHotelId}`);
          console.log(`🔗 Matched hotel: ${matchedHotel.name}`);
        }
      }
    } catch (storageError) {
      console.log(`⚠️ Could not access localStorage: ${storageError.message}`);
    }
    
    // Method 2: Extract from ratehawk_data if available
    if (!actualRateHawkHotelId && hotel.ratehawk_data) {
      actualRateHawkHotelId = hotel.ratehawk_data.ota_hotel_id || 
                             hotel.ratehawk_data.requested_hotel_id || 
                             hotel.ratehawk_data.hotel_id ||
                             hotel.ratehawk_data.original_id;
      
      console.log(`🔍 Extracted from ratehawk_data: ${actualRateHawkHotelId}`);
    }
    
    // Method 3: Check direct hotel properties
    if (!actualRateHawkHotelId) {
      actualRateHawkHotelId = hotel.ota_hotel_id || 
                             hotel.requested_hotel_id || 
                             hotel.hotel_id ||
                             hotel.original_id;
      
      console.log(`🔍 Extracted from hotel properties: ${actualRateHawkHotelId}`);
    }
    
    // Method 4: Last resort - but warn that it might not work
    if (!actualRateHawkHotelId) {
      actualRateHawkHotelId = hotel.id;
      console.log(`⚠️ WARNING: Using hotel.id as fallback: ${actualRateHawkHotelId}`);
      console.log(`⚠️ This may not work with RateHawk API calls`);
    }
    
    console.log(`🆔 Final RateHawk Hotel ID: ${actualRateHawkHotelId}`);
    console.log(`🔗 Search Session ID: ${searchSessionId}`);
    
    // Validate that we have a reasonable ID
    if (!actualRateHawkHotelId) {
      throw new Error('No valid RateHawk hotel ID found');
    }
    
    // Method 1: Try hotel details endpoint with session
    const detailsResponse = await fetchHotelDetailsWithSession(
      actualRateHawkHotelId, 
      searchSessionId, 
      userSession,
      searchParams
    );
    
    if (detailsResponse.success) {
      console.log(`✅ Got hotel details via session method for ${hotel.name}`);
      return extractEnhancedHotelData(detailsResponse.data, userSession, searchParams);
    }
    
    console.log(`⚠️ Session method failed for ${hotel.name}: ${detailsResponse.error}`);
    
    // Method 2: Try individual hotel page approach
    console.log(`🔄 Trying alternative method for ${hotel.name}...`);
    const pageResponse = await fetchHotelPageData(
      actualRateHawkHotelId,
      userSession,
      searchParams
    );
    
    if (pageResponse.success) {
      console.log(`✅ Got hotel data via page method for ${hotel.name}`);
      return extractEnhancedHotelData(pageResponse.data, userSession, searchParams);
    }
    
    console.log(`⚠️ Page method also failed for ${hotel.name}: ${pageResponse.error}`);
    
    // Method 3: Extract data from the original search results
    console.log(`🔄 Attempting to extract data from original search results for ${hotel.name}...`);
    const fallbackResult = extractDataFromOriginalHotel(hotel, userSession, searchParams, actualRateHawkHotelId);
    
    if (fallbackResult.success) {
      console.log(`✅ Extracted data from original search results for ${hotel.name}`);
      return fallbackResult;
    }
    
    return {
      success: false,
      error: `No detailed hotel data found for RateHawk ID: ${actualRateHawkHotelId}`
    };
    
  } catch (error) {
    console.error(`💥 Error fetching booking data for ${hotel.name}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ENHANCED: Extract data from the original hotel search results when API calls fail
 */
function extractDataFromOriginalHotel(hotel, userSession, searchParams, ratehawkHotelId) {
  console.log(`🔍 Extracting data from original hotel object for ${hotel.name}...`);
  
  try {
    const extractedData = {
      success: true,
      rates: [],
      roomTypes: [],
      room_groups: [],
      bookingOptions: [],
      data: hotel.ratehawk_data || hotel
    };
    
    // Check if we have rates in the original data
    if (hotel.ratehawk_data?.rates && Array.isArray(hotel.ratehawk_data.rates)) {
      console.log(`✅ Found ${hotel.ratehawk_data.rates.length} rates in original data`);
      extractedData.rates = hotel.ratehawk_data.rates;
    } else if (hotel.rates && Array.isArray(hotel.rates)) {
      console.log(`✅ Found ${hotel.rates.length} rates in hotel object`);
      extractedData.rates = hotel.rates;
    }
    
    // Check if we have room groups in the original data
    if (hotel.ratehawk_data?.room_groups && Array.isArray(hotel.ratehawk_data.room_groups)) {
      console.log(`✅ Found ${hotel.ratehawk_data.room_groups.length} room groups in original data`);
      extractedData.room_groups = hotel.ratehawk_data.room_groups;
    } else if (hotel.room_groups && Array.isArray(hotel.room_groups)) {
      console.log(`✅ Found ${hotel.room_groups.length} room groups in hotel object`);
      extractedData.room_groups = hotel.room_groups;
    }
    
    // If no rates or room groups, create a basic fallback
    if (extractedData.rates.length === 0 && extractedData.room_groups.length === 0) {
      console.log(`⚠️ No rates or room groups in original data, creating fallback room`);
      
      // Create a basic room group and rate from hotel price
      const basicRoomGroup = {
        rg_hash: `basic_${ratehawkHotelId}`,
        name_struct: {
          main_name: 'Standard Room',
          bedding_type: 'Standard bedding'
        },
        room_group_id: 1
      };
      
      const basicRate = {
        id: ratehawkHotelId, // CRITICAL: Use actual RateHawk ID
        rate_id: ratehawkHotelId,
        rg_hash: `basic_${ratehawkHotelId}`,
        room_name: 'Standard Room',
        payment_options: {
          payment_types: [{
            show_amount: hotel.price?.amount?.toString() || '100',
            amount: hotel.price?.amount?.toString() || '100',
            show_currency_code: hotel.price?.currency || 'USD',
            currency_code: hotel.price?.currency || 'USD',
            type: 'pay_now'
          }]
        },
        daily_prices: hotel.price?.amount?.toString() || '100',
        price: hotel.price?.amount?.toString() || '100',
        currency: hotel.price?.currency || 'USD',
        cancellation_policy: { type: 'free_cancellation' },
        meal_type: 'room_only',
        amenities: hotel.amenities || [],
        room_amenities: [],
        rooms: [{
          amenities_data: hotel.amenities || [],
          size: 'standard'
        }]
      };
      
      extractedData.room_groups = [basicRoomGroup];
      extractedData.rates = [basicRate];
      
      console.log(`✅ Created fallback room and rate for ${hotel.name} with RateHawk ID: ${ratehawkHotelId}`);
    }
    
    // Create booking options from available rates
    extractedData.bookingOptions = createBookingOptionsFromRates(extractedData.rates, userSession, searchParams);
    
    // Create room types for backwards compatibility
    extractedData.roomTypes = extractedData.room_groups.map(rg => ({
      id: rg.room_group_id,
      name: rg.name_struct.main_name,
      bedding: rg.name_struct.bedding_type
    }));
    
    console.log(`✅ Extracted data summary for ${hotel.name}:`, {
      rates: extractedData.rates.length,
      roomGroups: extractedData.room_groups.length,
      bookingOptions: extractedData.bookingOptions.length,
      roomTypes: extractedData.roomTypes.length
    });
    
    return extractedData;
    
  } catch (error) {
    console.error(`💥 Error extracting data from original hotel:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Method 1: Fetch hotel details using search session
 */
async function fetchHotelDetailsWithSession(hotelId, sessionId, userSession, searchParams) {
  try {
    const cookieString = formatCookiesForRequest(userSession.cookies);
    const csrfToken = extractCSRFToken(userSession.cookies);
    
    // Try the hotel info endpoint
    const infoUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?session=${sessionId}&hotel_id=${hotelId}`;
    
    console.log(`📡 Fetching hotel info: ${infoUrl}`);
    
    const response = await fetch(infoUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': cookieString,
        'referer': 'https://www.ratehawk.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
        'x-requested-with': 'XMLHttpRequest',
        ...(csrfToken && { 'x-csrftoken': csrfToken })
      }
    });
    
    console.log(`📨 Hotel info response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Hotel info API error response: ${errorText}`);
      throw new Error(`Hotel info API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`📊 Hotel info response keys:`, Object.keys(data));
    
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error('💥 Hotel details with session failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Method 2: Fetch hotel page data directly
 */
async function fetchHotelPageData(hotelId, userSession, searchParams) {
  try {
    const { checkin, checkout, guests, residency } = searchParams;
    
    // Construct hotel page URL
    const dateRange = `${formatDateForUrl(checkin)}-${formatDateForUrl(checkout)}`;
    const guestCount = Array.isArray(guests) ? guests.reduce((sum, room) => sum + room.adults, 0) : guests;
    
    const hotelPageUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel?hotel_id=${hotelId}&dates=${dateRange}&guests=${guestCount}&residency=${residency}`;
    
    console.log(`📡 Fetching hotel page: ${hotelPageUrl}`);
    
    const cookieString = formatCookiesForRequest(userSession.cookies);
    const csrfToken = extractCSRFToken(userSession.cookies);
    
    const response = await fetch(hotelPageUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': cookieString,
        'referer': 'https://www.ratehawk.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
        'x-requested-with': 'XMLHttpRequest',
        ...(csrfToken && { 'x-csrftoken': csrfToken })
      }
    });
    
    console.log(`📨 Hotel page response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Hotel page API error response: ${errorText}`);
      throw new Error(`Hotel page API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`📊 Hotel page response keys:`, Object.keys(data));
    
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error('💥 Hotel page data fetch failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enhanced extraction of room groups and rates from RateHawk hotel details
 */
function extractEnhancedHotelData(hotelData, userSession, searchParams) {
  console.log('🔍 Enhanced extraction of hotel data...');
  console.log('📊 Raw hotel data keys:', Object.keys(hotelData));
  
  const extractedData = {
    success: true,
    rates: [],
    roomTypes: [],
    room_groups: [],
    bookingOptions: [],
    rawData: hotelData
  };
  
  try {
    // Look for room groups in various locations
    let roomGroups = hotelData.room_groups || 
                    hotelData.data?.room_groups || 
                    hotelData.hotel?.room_groups || 
                    [];
    
    // Look for rates in various locations  
    let rates = hotelData.rates || 
               hotelData.data?.rates || 
               hotelData.hotel?.rates || 
               [];
    
    console.log(`📊 Found ${roomGroups.length} room groups and ${rates.length} rates`);
    
    // If no room groups found, try to extract from rates
    if (roomGroups.length === 0 && rates.length > 0) {
      console.log('🔄 No room_groups found, extracting from rates...');
      roomGroups = extractRoomGroupsFromRates(rates);
    }
    
    // Process room groups
    if (roomGroups.length > 0) {
      extractedData.room_groups = roomGroups.map((rg, index) => ({
        rg_hash: rg.rg_hash || rg.hash || `rg_${index}`,
        name_struct: {
          main_name: rg.name_struct?.main_name || rg.name || rg.room_name || `Room Type ${index + 1}`,
          bedding_type: rg.name_struct?.bedding_type || rg.bedding_type || ''
        },
        room_group_id: rg.room_group_id || rg.id || index
      }));
      
      console.log(`✅ Processed ${extractedData.room_groups.length} room groups`);
    }
    
    // Process rates with enhanced structure
    if (rates.length > 0) {
      extractedData.rates = rates.map((rate, index) => {
        // Extract pricing information
        let price = 0;
        let currency = searchParams.currency || 'USD';
        
        if (rate.payment_options?.payment_types?.length > 0) {
          const paymentType = rate.payment_options.payment_types[0];
          price = parseFloat(paymentType.show_amount || paymentType.amount || '0');
          currency = paymentType.show_currency_code || paymentType.currency_code || currency;
        } else {
          price = parseFloat(rate.daily_prices || rate.price || rate.total_price || '0');
          currency = rate.currency || currency;
        }
        
        // Create enhanced rate object
        const enhancedRate = {
          id: rate.id || rate.rate_id || `rate_${index}`,
          rg_hash: rate.rg_hash || '',
          room_name: rate.room_name || rate.name || `Room ${index + 1}`,
          payment_options: rate.payment_options || {
            payment_types: [{
              show_amount: price.toString(),
              amount: price.toString(),
              show_currency_code: currency,
              currency_code: currency,
              type: rate.payment_type || 'pay_now'
            }]
          },
          daily_prices: rate.daily_prices || price.toString(),
          price: rate.price || price.toString(),
          currency: currency,
          cancellation_policy: rate.cancellation_policy || {
            type: rate.cancellation || 'free_cancellation'
          },
          meal_type: rate.meal_type || rate.breakfast || 'room_only',
          amenities: rate.amenities || [],
          room_amenities: rate.room_amenities || [],
          rooms: rate.rooms || [{
            amenities_data: rate.room_amenities || [],
            size: rate.room_size || 'standard'
          }],
          bedding: rate.bedding || '',
          occupancy: rate.occupancy || '',
          // Keep original rate data
          _original: rate
        };
        
        return enhancedRate;
      });
      
      console.log(`✅ Processed ${extractedData.rates.length} rates`);
    }
    
    // Create booking options from rates
    extractedData.bookingOptions = createBookingOptionsFromRates(extractedData.rates, userSession, searchParams);
    
    console.log(`💰 Created ${extractedData.bookingOptions.length} booking options`);
    
    // Legacy format for backwards compatibility
    extractedData.roomTypes = extractedData.room_groups.map(rg => ({
      id: rg.room_group_id,
      name: rg.name_struct.main_name,
      bedding: rg.name_struct.bedding_type
    }));
    
    return extractedData;
    
  } catch (error) {
    console.error('💥 Error in enhanced data extraction:', error);
    return {
      success: false,
      error: error.message,
      rates: [],
      roomTypes: [],
      room_groups: [],
      bookingOptions: []
    };
  }
}

/**
 * Extract room groups from rates when room_groups is not available
 */
function extractRoomGroupsFromRates(rates) {
  const roomGroupMap = new Map();
  
  rates.forEach((rate, index) => {
    const rgHash = rate.rg_hash || `rg_${index}`;
    const roomName = rate.room_name || rate.name || `Room Type ${index + 1}`;
    
    if (!roomGroupMap.has(rgHash)) {
      roomGroupMap.set(rgHash, {
        rg_hash: rgHash,
        name_struct: {
          main_name: roomName,
          bedding_type: rate.bedding || ''
        },
        room_group_id: rate.room_group_id || index
      });
    }
  });
  
  return Array.from(roomGroupMap.values());
}

/**
 * Create booking options from processed rates - FIXED VERSION
 */
function createBookingOptionsFromRates(rates, userSession, searchParams) {
  const bookingOptions = [];
  
  rates.forEach((rate, index) => {
    const price = parseFloat(rate.payment_options?.payment_types?.[0]?.show_amount || rate.price || '0');
    const currency = rate.payment_options?.payment_types?.[0]?.show_currency_code || rate.currency || 'USD';
    
    // CRITICAL: Use the correct rate ID for booking URLs
    const rateKey = rate.id || rate.rate_id || rate.rg_hash;
    
    if (rateKey) {
      const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
      const residency = searchParams.residency || 'en-us';
      
      // FIXED: Use the exact format that RateHawk expects
      const bookingUrl = `/orders/reserve/h-${rateKey}/?price=one&residency=${residency}&sid=${sessionId}`;
      
      bookingOptions.push({
        rateIndex: index,
        rateId: rate.id,
        rateKey: rateKey,
        roomName: rate.room_name,
        price: price,
        currency: currency,
        bookingUrl: bookingUrl,
        fullBookingUrl: `https://www.ratehawk.com${bookingUrl}`,
        cancellationPolicy: rate.cancellation_policy?.type || 'check_policy',
        mealPlan: rate.meal_type || 'room_only'
      });
      
      console.log(`🔗 Created booking option ${index + 1}: ${rateKey} → ${bookingUrl}`);
    } else {
      console.log(`⚠️ No rate key available for rate ${index + 1}, skipping booking option`);
    }
  });
  
  return bookingOptions;
}

/**
 * Format date for URL (DD.MM.YYYY format)
 */
function formatDateForUrl(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Helper functions (reuse from your existing code)
function formatCookiesForRequest(cookies) {
  if (!Array.isArray(cookies)) return '';
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

function extractCSRFToken(cookies) {
  if (!Array.isArray(cookies)) return '';
  const csrfCookie = cookies.find(cookie => 
    cookie.name === 'csrftoken' || 
    cookie.name === 'csrf_token' ||
    cookie.name === '_token'
  );
  return csrfCookie ? csrfCookie.value : '';
}

// Export the main function
module.exports = {
  fetchSingleHotelBookingData,
  extractEnhancedHotelData,
  extractDataFromOriginalHotel,
  fetchHotelDetailsWithSession,
  fetchHotelPageData,
  createBookingOptionsFromRates
};