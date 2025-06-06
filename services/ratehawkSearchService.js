// ================================
// FINAL RATEHAWK SEARCH SERVICE
// Replace your existing ratehawkSearchService.js with this
// ================================

/**
 * Main search function that gets hotels WITH booking links
 */
async function searchHotels({ userSession, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} }) {
  console.log('🔍 === ENHANCED RATEHAWK SEARCH WITH BOOKING LINKS ===');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Perform basic search to get hotel list and session
    const basicSearch = await performBasicSearch({
      userSession, destination, checkin, checkout, guests, residency, currency, page, filters
    });
    
    if (!basicSearch.success) {
      return basicSearch;
    }
    
    console.log(`✅ Basic search completed: ${basicSearch.hotels.length} hotels found`);
    console.log(`🔗 Search session: ${basicSearch.searchSessionId}`);
    
    // Step 2: Fetch detailed rates and booking data for each hotel
    const hotelsWithBookingData = await fetchHotelBookingData(
      basicSearch.hotels,
      basicSearch.searchSessionId,
      userSession,
      { checkin, checkout, guests, residency, currency }
    );
    
    const duration = Date.now() - startTime;
    console.log(`🎯 Enhanced search completed in ${duration}ms`);
    console.log(`💰 Hotels with booking data: ${hotelsWithBookingData.filter(h => h.hasBookingData).length}/${hotelsWithBookingData.length}`);
    
    return {
      success: true,
      hotels: hotelsWithBookingData,
      totalHotels: basicSearch.totalHotels,
      availableHotels: basicSearch.availableHotels,
      searchSessionId: basicSearch.searchSessionId,
      searchDuration: `${duration}ms`,
      hasMorePages: basicSearch.hasMorePages,
      currentPage: page,
      metadata: {
        strategy: 'enhanced_with_booking_data',
        hotelsWithBookingData: hotelsWithBookingData.filter(h => h.hasBookingData).length,
        searchAndDetailsCompleted: true
      }
    };
    
  } catch (error) {
    console.error('💥 Enhanced search failed:', error);
    return {
      success: false,
      error: `Enhanced search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0
    };
  }
}

/**
 * Fetch booking data for all hotels
 */
async function fetchHotelBookingData(hotels, searchSessionId, userSession, searchParams) {
  console.log(`🔍 Fetching booking data for ${hotels.length} hotels...`);
  
  const enhancedHotels = [];
  const batchSize = 3; // Process in small batches to avoid overwhelming the API
  
  for (let i = 0; i < hotels.length; i += batchSize) {
    const batch = hotels.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(hotels.length/batchSize)}`);
    
    // Process batch concurrently
    const batchPromises = batch.map(hotel => 
      fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process results
    batchResults.forEach((result, batchIndex) => {
      const originalHotel = batch[batchIndex];
      
      if (result.status === 'fulfilled' && result.value.success) {
        const bookingData = result.value;
        enhancedHotels.push({
          ...originalHotel,
          // Add booking functionality
          hasBookingData: true,
          detailedRates: bookingData.rates || [],
          roomTypes: bookingData.roomTypes || [],
          bookingOptions: bookingData.bookingOptions || [],
          // Add convenience methods
          getBookingUrl: (rateIndex = 0) => getBookingUrlForRate(bookingData.bookingOptions, rateIndex, userSession),
          bookNow: (rateIndex = 0) => openBookingUrl(bookingData.bookingOptions, rateIndex, userSession)
        });
      } else {
        // Keep original hotel data if booking data fetch failed
        console.log(`⚠️ Failed to get booking data for ${originalHotel.name}`);
        enhancedHotels.push({
          ...originalHotel,
          hasBookingData: false,
          bookingError: result.status === 'rejected' ? result.reason?.message : result.value?.error,
          detailedRates: [],
          roomTypes: [],
          bookingOptions: []
        });
      }
    });
    
    // Small delay between batches
    if (i + batchSize < hotels.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return enhancedHotels;
}

/**
 * Fetch booking data for a single hotel
 */
async function fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams) {
  const hotelId = hotel.ratehawk_data?.ota_hotel_id || 
                 hotel.ratehawk_data?.requested_hotel_id || 
                 hotel.id;
  
  console.log(`🏨 Fetching booking data for: ${hotel.name} (${hotelId})`);
  
  try {
    // Method 1: Try hotel details endpoint with search session
    const detailsResponse = await fetchHotelDetails(hotelId, searchSessionId, userSession);
    
    if (detailsResponse.success && detailsResponse.data) {
      console.log(`✅ Got hotel details for ${hotel.name}`);
      return extractBookingDataFromHotelDetails(detailsResponse.data, userSession, searchParams);
    }
    
    // Method 2: Try individual hotel page
    console.log(`🔄 Trying alternative method for ${hotel.name}...`);
    const pageResponse = await fetchHotelPageDetails(hotelId, userSession, searchParams);
    
    if (pageResponse.success && pageResponse.data) {
      console.log(`✅ Got hotel page data for ${hotel.name}`);
      return extractBookingDataFromHotelDetails(pageResponse.data, userSession, searchParams);
    }
    
    return {
      success: false,
      error: 'No booking data found'
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
 * Fetch hotel details using search session
 */
async function fetchHotelDetails(hotelId, searchSessionId, userSession) {
  try {
    const cookieString = formatCookiesForRequest(userSession.cookies);
    const csrfToken = extractCSRFToken(userSession.cookies);
    
    const detailsUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?session=${searchSessionId}&hotel_id=${hotelId}`;
    
    console.log(`📡 Fetching: ${detailsUrl}`);
    
    const response = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'cookie': cookieString,
        'referer': 'https://www.ratehawk.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
        'x-requested-with': 'XMLHttpRequest',
        ...(csrfToken && { 'x-csrftoken': csrfToken })
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error(`💥 Hotel details fetch failed:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch hotel page details (alternative method)
 */
async function fetchHotelPageDetails(hotelId, userSession, searchParams) {
  try {
    const { checkin, checkout, guests, residency } = searchParams;
    const cookieString = formatCookiesForRequest(userSession.cookies);
    
    // Construct hotel-specific search
    const guestCount = Array.isArray(guests) ? guests.reduce((sum, room) => sum + room.adults, 0) : guests;
    const dateRange = `${formatDateForRateHawk(checkin)}-${formatDateForRateHawk(checkout)}`;
    
    const pageUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel?hotel_id=${hotelId}&dates=${dateRange}&guests=${guestCount}&residency=${residency}`;
    
    console.log(`📡 Fetching hotel page: ${pageUrl}`);
    
    const response = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'cookie': cookieString,
        'referer': 'https://www.ratehawk.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error(`💥 Hotel page fetch failed:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract booking data from hotel details response
 */
function extractBookingDataFromHotelDetails(hotelData, userSession, searchParams) {
  console.log('🔍 Extracting booking data from hotel details...');
  
  const bookingData = {
    success: true,
    rates: [],
    roomTypes: [],
    bookingOptions: []
  };
  
  try {
    // Look for rates in various locations
    const rates = hotelData.rates || hotelData.data?.rates || hotelData.hotel?.rates || [];
    
    if (rates.length === 0) {
      console.log('⚠️ No rates found in hotel details');
      return {
        success: false,
        error: 'No rates found in hotel details'
      };
    }
    
    console.log(`💰 Found ${rates.length} rates, extracting booking data...`);
    
    rates.forEach((rate, rateIndex) => {
      try {
        // Extract rate information
        const rateInfo = {
          id: rate.id || rate.rate_id || rate.rate_key || `rate_${rateIndex}`,
          roomName: rate.room_name || rate.name || `Room ${rateIndex + 1}`,
          price: extractPriceFromRate(rate),
          currency: rate.currency || searchParams.currency || 'USD',
          cancellationPolicy: rate.cancellation_policy || 'Check with hotel',
          mealPlan: rate.meal_type || rate.breakfast || 'Room only',
          bedding: rate.bedding || 'Standard bedding',
          occupancy: rate.occupancy || 'Standard occupancy',
          rateKey: rate.rate_key || rate.rate_id || rate.id,
          paymentInfo: rate.payment_options || {}
        };
        
        bookingData.rates.push(rateInfo);
        
        // Create booking option with URL
        if (rateInfo.rateKey) {
          const sessionId = userSession.ratehawkSessionId || userSession.sessionId;
          const bookingUrl = `/orders/reserve/h-${rateInfo.rateKey}/?price=one&residency=${searchParams.residency || 'en-us'}&sid=${sessionId}`;
          
          bookingData.bookingOptions.push({
            rateIndex: rateIndex,
            rateId: rateInfo.id,
            rateKey: rateInfo.rateKey,
            roomName: rateInfo.roomName,
            price: rateInfo.price,
            currency: rateInfo.currency,
            bookingUrl: bookingUrl,
            fullBookingUrl: `https://www.ratehawk.com${bookingUrl}`,
            cancellationPolicy: rateInfo.cancellationPolicy,
            mealPlan: rateInfo.mealPlan
          });
          
          console.log(`🔗 Created booking URL: ${bookingUrl}`);
        }
        
      } catch (rateError) {
        console.error(`💥 Error processing rate ${rateIndex}:`, rateError);
      }
    });
    
    console.log(`✅ Extracted ${bookingData.bookingOptions.length} booking options`);
    
  } catch (error) {
    console.error('💥 Error extracting booking data:', error);
    return {
      success: false,
      error: error.message
    };
  }
  
  return bookingData;
}

/**
 * Extract price from rate object
 */
function extractPriceFromRate(rate) {
  // Try different price locations in order of preference
  if (rate.payment_options?.payment_types?.[0]) {
    const payment = rate.payment_options.payment_types[0];
    return parseFloat(payment.show_amount || payment.amount || 0);
  }
  
  return parseFloat(
    rate.total_price || 
    rate.price || 
    rate.amount || 
    rate.daily_prices || 
    rate.net_price || 
    0
  );
}

/**
 * Get booking URL for specific rate
 */
function getBookingUrlForRate(bookingOptions, rateIndex, userSession) {
  if (!bookingOptions || bookingOptions.length === 0) {
    return null;
  }
  
  const option = bookingOptions[rateIndex] || bookingOptions[0];
  return option?.fullBookingUrl || null;
}

/**
 * Open booking URL in new tab
 */
function openBookingUrl(bookingOptions, rateIndex, userSession) {
  const url = getBookingUrlForRate(bookingOptions, rateIndex, userSession);
  if (url) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    return url;
  }
  return null;
}

/**
 * Format date for RateHawk (DD.MM.YYYY)
 */
function formatDateForRateHawk(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Import helper functions
const { 
  performBasicSearch, 
  formatGuestsForRateHawk, 
  getDestinationInfo,
  formatCookiesForRequest,
  extractCSRFToken
} = require('./ratehawkHelpers');

module.exports = {
  searchHotels,
  fetchSingleHotelBookingData,
  getBookingUrlForRate,
  openBookingUrl
};