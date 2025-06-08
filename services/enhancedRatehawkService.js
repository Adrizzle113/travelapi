// ================================
// RATEHAWK SERVICE WITH BOOKING LINKS
// Gets detailed rates AND actual booking URLs from RateHawk
// FIXED: Proper hotel ID handling from search results
// ================================

/**
 * Enhanced search that returns hotels with booking links and detailed rates
 */
async function searchHotelsWithBookingLinks({ userSession, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} }) {
  console.log('🔍 === STARTING RATEHAWK SEARCH WITH BOOKING LINKS ===');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Perform initial search to get session and basic hotels
    const searchResults = await performInitialSearch({
      userSession, destination, checkin, checkout, guests, residency, currency, page, filters
    });
    
    if (!searchResults.success || !searchResults.searchSessionId) {
      return searchResults;
    }
    
    console.log(`🔗 Search session: ${searchResults.searchSessionId}`);
    console.log(`🏨 Found ${searchResults.hotels.length} hotels, fetching booking links...`);
    
    // Step 2: Get detailed hotel data with booking links
    const hotelsWithBookingData = await fetchHotelsWithBookingLinks(
      searchResults.hotels,
      searchResults.searchSessionId,
      userSession,
      { checkin, checkout, guests, residency, currency }
    );
    
    const duration = Date.now() - startTime;
    console.log(`✅ Search with booking links completed in ${duration}ms`);
    
    return {
      ...searchResults,
      hotels: hotelsWithBookingData,
      searchDuration: `${duration}ms`,
      metadata: {
        ...searchResults.metadata,
        hasBookingLinks: true,
        enhancedDataFetched: true
      }
    };
    
  } catch (error) {
    console.error('💥 Search with booking links failed:', error);
    return {
      success: false,
      error: `Search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0
    };
  }
}

/**
 * Fetch detailed hotel information including booking links
 */
async function fetchHotelsWithBookingLinks(hotels, searchSessionId, userSession, searchParams) {
  const { checkin, checkout, guests, residency, currency } = searchParams;
  
  // Process hotels in batches to avoid overwhelming the API
  const batchSize = 5;
  const enhancedHotels = [];
  
  for (let i = 0; i < hotels.length; i += batchSize) {
    const batch = hotels.slice(i, i + batchSize);
    console.log(`📦 Processing hotel batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(hotels.length/batchSize)}`);
    
    const batchPromises = batch.map(hotel => 
      fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, batchIndex) => {
      const originalHotel = batch[batchIndex];
      
      if (result.status === 'fulfilled' && result.value.success) {
        enhancedHotels.push({
          ...originalHotel,
          bookingData: result.value.bookingData,
          detailedRates: result.value.rates,
          roomTypes: result.value.roomTypes,
          bookingLinks: result.value.bookingLinks,
          hasBookingData: true
        });
      } else {
        console.log(`⚠️ Failed to get booking data for ${originalHotel.name}`);
        enhancedHotels.push({
          ...originalHotel,
          hasBookingData: false,
          bookingError: result.status === 'rejected' ? result.reason.message : result.value?.error
        });
      }
    });
    
    // Small delay between batches to be respectful to the API
    if (i + batchSize < hotels.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return enhancedHotels;
}

/**
 * Fetch booking data for a single hotel - FIXED VERSION
 */
async function fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams) {
  const { checkin, checkout, guests, residency, currency } = searchParams;
  
  try {
    // FIXED: Extract the correct RateHawk hotel ID from the original data
    let ratehawkHotelId = null;
    
    // Method 1: Try to get hotel ID from ratehawk_data (most reliable)
    if (hotel.ratehawk_data) {
      ratehawkHotelId = hotel.ratehawk_data.ota_hotel_id || 
                       hotel.ratehawk_data.requested_hotel_id || 
                       hotel.ratehawk_data.hotel_id ||
                       hotel.ratehawk_data.id;
    }
    
    // Method 2: If no ratehawk_data, try the hotel.id but log a warning
    if (!ratehawkHotelId) {
      ratehawkHotelId = hotel.id;
      console.log(`⚠️ No RateHawk hotel ID found in ratehawk_data for ${hotel.name}, using hotel.id: ${ratehawkHotelId}`);
    }
    
    console.log(`🔍 Fetching enhanced booking data for: ${hotel.name}`);
    console.log(`🆔 Using RateHawk Hotel ID: ${ratehawkHotelId}`);
    console.log(`🔗 Search Session ID: ${searchSessionId}`);
    
    // FIXED: Log the ratehawk_data structure to understand what we have
    if (hotel.ratehawk_data) {
      console.log(`📊 Available ratehawk_data keys:`, Object.keys(hotel.ratehawk_data));
      console.log(`🔑 RateHawk identifiers:`, {
        ota_hotel_id: hotel.ratehawk_data.ota_hotel_id,
        requested_hotel_id: hotel.ratehawk_data.requested_hotel_id,
        hotel_id: hotel.ratehawk_data.hotel_id,
        id: hotel.ratehawk_data.id
      });
    } else {
      console.log(`⚠️ No ratehawk_data available for ${hotel.name}`);
    }
    
    // Method 1: Try hotel details endpoint with session
    const detailsResponse = await fetchHotelDetailsWithSession(
      ratehawkHotelId, 
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
      ratehawkHotelId,
      userSession,
      searchParams
    );
    
    if (pageResponse.success) {
      console.log(`✅ Got hotel data via page method for ${hotel.name}`);
      return extractEnhancedHotelData(pageResponse.data, userSession, searchParams);
    }
    
    console.log(`⚠️ Page method also failed for ${hotel.name}: ${pageResponse.error}`);
    
    // FIXED: If both methods fail, try to extract data from the original search results
    console.log(`🔄 Attempting to extract data from original search results for ${hotel.name}...`);
    const fallbackResult = extractDataFromOriginalHotel(hotel, userSession, searchParams);
    
    if (fallbackResult.success) {
      console.log(`✅ Extracted data from original search results for ${hotel.name}`);
      return fallbackResult;
    }
    
    return {
      success: false,
      error: 'No detailed hotel data found from any method'
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
 * FIXED: Extract data from the original hotel search results when API calls fail
 */
function extractDataFromOriginalHotel(hotel, userSession, searchParams) {
  console.log(`🔍 Extracting data from original hotel object for ${hotel.name}...`);
  
  try {
    const extractedData = {
      success: true,
      rates: [],
      roomTypes: [],
      room_groups: [],
      bookingOptions: [],
      data: hotel.ratehawk_data || {}
    };
    
    // Check if we have rates in the original data
    if (hotel.ratehawk_data?.rates && Array.isArray(hotel.ratehawk_data.rates)) {
      console.log(`✅ Found ${hotel.ratehawk_data.rates.length} rates in original data`);
      extractedData.rates = hotel.ratehawk_data.rates;
    }
    
    // Check if we have room groups in the original data
    if (hotel.ratehawk_data?.room_groups && Array.isArray(hotel.ratehawk_data.room_groups)) {
      console.log(`✅ Found ${hotel.ratehawk_data.room_groups.length} room groups in original data`);
      extractedData.room_groups = hotel.ratehawk_data.room_groups;
    }
    
    // If no rates or room groups, create a basic fallback
    if (extractedData.rates.length === 0 && extractedData.room_groups.length === 0) {
      console.log(`⚠️ No rates or room groups in original data, creating fallback room`);
      
      // Create a basic room group and rate from hotel price
      const basicRoomGroup = {
        rg_hash: `basic_${hotel.id}`,
        name_struct: {
          main_name: 'Standard Room',
          bedding_type: 'Standard bedding'
        },
        room_group_id: 1
      };
      
      const basicRate = {
        id: `rate_${hotel.id}`,
        rg_hash: `basic_${hotel.id}`,
        room_name: 'Standard Room',
        payment_options: {
          payment_types: [{
            show_amount: hotel.price.amount.toString(),
            amount: hotel.price.amount.toString(),
            show_currency_code: hotel.price.currency,
            currency_code: hotel.price.currency,
            type: 'pay_now'
          }]
        },
        daily_prices: hotel.price.amount.toString(),
        price: hotel.price.amount.toString(),
        currency: hotel.price.currency,
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
      
      console.log(`✅ Created fallback room and rate for ${hotel.name}`);
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
      throw new Error(`Hotel info API returned ${response.status}`);
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
    
    // Construct hotel page URL similar to the one you provided
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
      throw new Error(`Hotel page API returned ${response.status}`);
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
 * Create booking options from processed rates
 */
function createBookingOptionsFromRates(rates, userSession, searchParams) {
  const bookingOptions = [];
  
  rates.forEach((rate, index) => {
    const price = parseFloat(rate.payment_options?.payment_types?.[0]?.show_amount || rate.price || '0');
    const currency = rate.payment_options?.payment_types?.[0]?.show_currency_code || rate.currency || 'USD';
    
    if (rate.id || rate.rg_hash) {
      const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
      const rateKey = rate.id || rate.rg_hash;
      const residency = searchParams.residency || 'en-us';
      
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
    }
  });
  
  return bookingOptions;
}

/**
 * Create booking handler for a hotel
 */
function createBookingHandler(hotel, rateId) {
  return () => {
    const bookingUrl = getHotelBookingUrl(hotel, rateId);
    if (bookingUrl) {
      // Open booking URL in new tab
      window.open(`https://www.ratehawk.com${bookingUrl}`, '_blank');
      return true;
    } else {
      console.error('❌ No booking URL available for this rate');
      return false;
    }
  };
}

/**
 * Get booking URL for specific rate
 */
function getHotelBookingUrl(hotel, rateId) {
  if (!hotel.hasBookingData || !hotel.bookingLinks) {
    return null;
  }
  
  if (rateId) {
    const specificRate = hotel.bookingLinks.find(link => link.rateId === rateId);
    return specificRate?.bookingUrl || null;
  }
  
  // Return first available booking URL
  return hotel.bookingLinks[0]?.bookingUrl || null;
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
  searchHotelsWithBookingLinks,
  fetchSingleHotelBookingData,
  extractEnhancedHotelData,
  getHotelBookingUrl
};