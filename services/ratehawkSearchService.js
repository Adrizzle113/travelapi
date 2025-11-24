// ================================
// FINAL RATEHAWK SEARCH SERVICE
// Replace your existing ratehawkSearchService.js with this
// ================================

/**
 * Main search function that gets hotels WITH booking links
 * NOTE: This function is commented out - using enhanced version at bottom of file
 */
/*
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
*/

/**
 * Fetch booking data for all hotels
 */
async function fetchHotelBookingData(hotels, searchSessionId, userSession, searchParams) {
  console.log(`🔍 Fetching booking data for ${hotels.length} hotels...`);

  const enhancedHotels = [];
  const batchSize = 3; // Process in small batches to avoid overwhelming the API

  for (let i = 0; i < hotels.length; i += batchSize) {
    const batch = hotels.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(hotels.length / batchSize)}`);

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
          // Add room_groups and rates for frontend compatibility
          ratehawk_data: {
            ...originalHotel.ratehawk_data,
            room_groups: bookingData.room_groups || originalHotel.ratehawk_data?.static_vm?.room_groups || [],
            rates: bookingData.rates || [],
            enhancedData: bookingData.enhancedData || {}
          },
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
          bookingOptions: [],
          ratehawk_data: {
            ...originalHotel.ratehawk_data,
            room_groups: originalHotel.ratehawk_data?.static_vm?.room_groups || [],
            rates: [],
            enhancedData: {}
          }
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
    // Check if hotel already has rates in the initial search results
    const existingRates = hotel.ratehawk_data?.rates || hotel.rates || [];
    const existingRoomGroups = hotel.ratehawk_data?.room_groups || hotel.room_groups || [];

    if (existingRates.length > 0 || existingRoomGroups.length > 0) {
      console.log(`✅ Using existing rates/room_groups from search results for ${hotel.name}`);
      return extractBookingDataFromHotelDetails({
        rates: existingRates,
        room_groups: existingRoomGroups,
        hotel: hotel.ratehawk_data
      }, userSession, searchParams);
    }

    // Method 1: Try hotel details endpoint with search session
    const detailsResponse = await fetchHotelDetails(hotelId, searchSessionId, userSession);

    if (detailsResponse.success && detailsResponse.data) {
      console.log(`✅ Got hotel details for ${hotel.name}`);
      return extractBookingDataFromHotelDetails(detailsResponse.data, userSession, searchParams);
    }

    // Method 2: Try individual hotel page with session ID in searchParams
    console.log(`🔄 Trying alternative method for ${hotel.name}...`);
    const pageResponse = await fetchHotelPageDetails(hotelId, userSession, {
      ...searchParams,
      searchSessionId: searchSessionId
    });

    if (pageResponse.success && pageResponse.data) {
      console.log(`✅ Got hotel page data for ${hotel.name}`);
      return extractBookingDataFromHotelDetails(pageResponse.data, userSession, searchParams);
    }

    // If both methods failed, return with basic hotel info (no detailed rates)
    console.log(`⚠️ No detailed booking data found for ${hotel.name}, returning basic hotel info`);
    return {
      success: false,
      error: 'No booking data found - hotel details endpoints returned 404. This may be due to RateHawk API changes or invalid hotel IDs.',
      rates: existingRates,
      room_groups: existingRoomGroups,
      roomTypes: existingRoomGroups.map(rg => ({
        id: rg.room_group_id || rg.rg_hash,
        name: rg.name_struct?.main_name || rg.name || 'Room Type'
      })),
      bookingOptions: []
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

    // Try multiple URL formats
    const urlFormats = [
      `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?session=${searchSessionId}&hotel_id=${hotelId}`,
      `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?session=${searchSessionId}&hotel_id=${encodeURIComponent(hotelId)}`,
      `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel_info?hotel_id=${hotelId}&session=${searchSessionId}`
    ];

    for (const detailsUrl of urlFormats) {
      try {
        console.log(`📡 Fetching hotel details: ${detailsUrl}`);

        const headers = {
          'accept': 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'cookie': cookieString,
          'referer': 'https://www.ratehawk.com/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
          'origin': 'https://www.ratehawk.com',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          ...(csrfToken && { 'x-csrftoken': csrfToken })
        };

        const response = await fetch(detailsUrl, {
          method: 'GET',
          headers: headers
        });

        if (response.ok) {
          const data = await response.json();

          // Log structure for debugging
          console.log('🔍 Hotel details response structure:', {
            hasRoomGroups: !!data.room_groups,
            hasRates: !!data.rates,
            hasData: !!data.data,
            hasHotel: !!data.hotel,
            topLevelKeys: Object.keys(data),
            roomGroupsCount: data.room_groups?.length || 0,
            ratesCount: data.rates?.length || 0
          });

          return {
            success: true,
            data: data
          };
        } else if (response.status === 404) {
          console.log(`⚠️ 404 error for hotel_info endpoint, trying next format...`);
          continue;
        } else {
          console.log(`⚠️ HTTP ${response.status} for hotel_info, trying next format...`);
          continue;
        }
      } catch (fetchError) {
        console.log(`⚠️ Error with hotel_info URL format: ${fetchError.message}`);
        continue;
      }
    }

    // If all formats failed
    console.error(`💥 All hotel_info URL formats failed for ${hotelId}`);
    return {
      success: false,
      error: `Hotel info endpoint returned 404 - session may be invalid or endpoint structure changed`
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
    const csrfToken = extractCSRFToken(userSession.cookies);

    // Construct hotel-specific search
    const guestCount = Array.isArray(guests) ? guests.reduce((sum, room) => sum + room.adults, 0) : guests;
    const dateRange = `${formatDateForRateHawk(checkin)}-${formatDateForRateHawk(checkout)}`;

    // Try multiple URL formats in case the endpoint structure changed
    const urlFormats = [
      `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel?hotel_id=${hotelId}&dates=${dateRange}&guests=${guestCount}&residency=${residency}`,
      `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel?hotel_id=${encodeURIComponent(hotelId)}&dates=${dateRange}&guests=${guestCount}&residency=${residency}`,
      // Try with session if available
      searchParams.searchSessionId ? `https://www.ratehawk.com/hotel/search/v2/b2bsite/hotel?session=${searchParams.searchSessionId}&hotel_id=${hotelId}&dates=${dateRange}&guests=${guestCount}&residency=${residency}` : null
    ].filter(Boolean);

    for (const pageUrl of urlFormats) {
      try {
        console.log(`📡 Fetching hotel page: ${pageUrl}`);

        const headers = {
          'accept': 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'cookie': cookieString,
          'referer': 'https://www.ratehawk.com/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
          'origin': 'https://www.ratehawk.com',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          ...(csrfToken && { 'x-csrftoken': csrfToken })
        };

        const response = await fetch(pageUrl, {
          method: 'GET',
          headers: headers
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Hotel page fetch successful for ${hotelId}`);
          return {
            success: true,
            data: data
          };
        } else if (response.status === 404) {
          console.log(`⚠️ 404 error for URL format: ${pageUrl.substring(0, 80)}...`);
          // Try next URL format
          continue;
        } else {
          console.log(`⚠️ HTTP ${response.status} for hotel page, trying next format...`);
          continue;
        }
      } catch (fetchError) {
        console.log(`⚠️ Error with URL format, trying next: ${fetchError.message}`);
        continue;
      }
    }

    // If all URL formats failed, return error
    console.error(`💥 All hotel page URL formats failed for ${hotelId}`);
    return {
      success: false,
      error: `Hotel page endpoint returned 404 - hotel ID may be invalid or endpoint structure changed`
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
    bookingOptions: [],
    room_groups: [], // Add room_groups for frontend compatibility
    enhancedData: {} // Store the full enhanced data structure
  };

  try {
    // Extract room_groups and rates from various possible locations
    const roomGroups = hotelData.room_groups || hotelData.data?.room_groups || hotelData.hotel?.room_groups || [];
    const rates = hotelData.rates || hotelData.data?.rates || hotelData.hotel?.rates || [];

    console.log(`🔍 Found ${roomGroups.length} room groups and ${rates.length} rates`);

    // Store room_groups for frontend
    bookingData.room_groups = roomGroups;

    if (rates.length === 0) {
      console.log('⚠️ No rates found in hotel details');
      return {
        success: false,
        error: 'No rates found in hotel details',
        room_groups: roomGroups,
        rates: [],
        roomTypes: [],
        bookingOptions: []
      };
    }

    console.log(`💰 Found ${rates.length} rates, extracting booking data...`);

    // Process rates and create booking options
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
          paymentInfo: rate.payment_options || {},
          rg_hash: rate.rg_hash, // Include rg_hash for frontend matching
          rooms: rate.rooms || [], // Include room details
          amenities: rate.amenities || [],
          room_amenities: rate.room_amenities || []
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
            mealPlan: rateInfo.mealPlan,
            rg_hash: rateInfo.rg_hash
          });

          console.log(`🔗 Created booking URL: ${bookingUrl}`);
        }

      } catch (rateError) {
        console.error(`💥 Error processing rate ${rateIndex}:`, rateError);
      }
    });

    // Create enhanced data structure for frontend
    bookingData.enhancedData = {
      room_groups: roomGroups,
      rates: rates, // Include the original rates data
      processed_rates: bookingData.rates,
      booking_options: bookingData.bookingOptions,
      metadata: {
        total_room_groups: roomGroups.length,
        total_rates: rates.length,
        processed_rates: bookingData.rates.length,
        booking_options: bookingData.bookingOptions.length,
        extraction_success: true
      }
    };

    console.log(`✅ Extracted ${bookingData.bookingOptions.length} booking options`);
    console.log(`✅ Enhanced data structure created with ${roomGroups.length} room groups and ${rates.length} rates`);

  } catch (error) {
    console.error('💥 Error extracting booking data:', error);
    return {
      success: false,
      error: error.message,
      room_groups: [],
      rates: [],
      roomTypes: [],
      bookingOptions: [],
      enhancedData: {
        room_groups: [],
        rates: [],
        processed_rates: [],
        booking_options: [],
        metadata: {
          extraction_success: false,
          error: error.message
        }
      }
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
import {
  performBasicSearch,
  formatGuestsForRateHawk,
  getDestinationInfo,
  formatCookiesForRequest,
  extractCSRFToken,
  transformHotelData
} from './ratehawkHelpers.js';

/**
 * Main hotel search function with real RateHawk API integration
 */
async function searchHotels({ userSession, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} }) {
  console.log('🔍 === STARTING ENHANCED RATEHAWK HOTEL SEARCH ===');
  console.log('📋 Search parameters:', JSON.stringify({
    destination,
    checkin,
    checkout,
    guests,
    residency,
    currency,
    page
  }, null, 2));

  const startTime = Date.now();

  try {
    // Validate user session
    if (!userSession || !userSession.cookies || !Array.isArray(userSession.cookies)) {
      console.log('❌ Invalid user session');
      return {
        success: false,
        error: 'Invalid user session. Please login again.',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }

    console.log(`✅ User session valid: ${userSession.cookies?.length || 0} cookies`);

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
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Enhanced hotel search failed:', error);

    return {
      success: false,
      error: `Enhanced search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      debug: {
        destination,
        checkin,
        checkout,
        errorType: error.name || 'Unknown'
      }
    };
  } finally {
    const duration = Date.now() - startTime;
    console.log(`🏁 Enhanced search service completed in ${duration}ms`);
    console.log('=== END ENHANCED RATEHAWK HOTEL SEARCH ===');
  }
}

export {
  searchHotels
};