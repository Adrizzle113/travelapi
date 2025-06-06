// ================================
// RATEHAWK SERVICE WITH BOOKING LINKS
// Gets detailed rates AND actual booking URLs from RateHawk
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
 * Fetch booking data for a single hotel
 */
async function fetchSingleHotelBookingData(hotel, searchSessionId, userSession, searchParams) {
  const { checkin, checkout, guests, residency, currency } = searchParams;
  
  try {
    const ratehawkHotelId = hotel.ratehawk_data?.ota_hotel_id || 
                           hotel.ratehawk_data?.requested_hotel_id || 
                           hotel.id;
    
    console.log(`🔍 Fetching booking data for: ${hotel.name} (ID: ${ratehawkHotelId})`);
    
    // Method 1: Try hotel details endpoint with session
    const detailsResponse = await fetchHotelDetailsWithSession(
      ratehawkHotelId, 
      searchSessionId, 
      userSession,
      searchParams
    );
    
    if (detailsResponse.success) {
      return detailsResponse;
    }
    
    // Method 2: Try individual hotel page approach
    console.log(`🔄 Trying alternative method for ${hotel.name}...`);
    const pageResponse = await fetchHotelPageData(
      ratehawkHotelId,
      userSession,
      searchParams
    );
    
    return pageResponse;
    
  } catch (error) {
    console.error(`💥 Error fetching booking data for ${hotel.name}:`, error);
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
    
    if (!response.ok) {
      throw new Error(`Hotel info API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`📊 Hotel info response for ${hotelId}:`, JSON.stringify(data, null, 2));
    
    // Extract booking data from response
    const bookingData = extractBookingDataFromResponse(data, sessionId, searchParams);
    
    return {
      success: true,
      bookingData: bookingData,
      rates: data.rates || [],
      roomTypes: data.room_types || [],
      bookingLinks: bookingData.bookingLinks || []
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
    // Format: /hotel/country/city/hotelId/name/?q=dest&dates=checkin-checkout&guests=X&residency=X
    const dateRange = `${formatDateForUrl(checkin)}-${formatDateForUrl(checkout)}`;
    const guestCount = Array.isArray(guests) ? guests.reduce((sum, room) => sum + room.adults, 0) : guests;
    
    // We need to construct the proper hotel page URL
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
    
    if (!response.ok) {
      throw new Error(`Hotel page API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`📊 Hotel page response for ${hotelId}:`, JSON.stringify(data, null, 2));
    
    // Extract booking data from response
    const bookingData = extractBookingDataFromResponse(data, null, searchParams);
    
    return {
      success: true,
      bookingData: bookingData,
      rates: data.rates || [],
      roomTypes: data.room_types || [],
      bookingLinks: bookingData.bookingLinks || []
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
 * Extract booking data and links from API response
 */
function extractBookingDataFromResponse(data, sessionId, searchParams) {
  const bookingData = {
    bookingLinks: [],
    rates: [],
    roomOptions: []
  };
  
  try {
    // Look for rates data in various possible locations
    const rates = data.rates || data.data?.rates || data.hotel?.rates || [];
    
    rates.forEach((rate, rateIndex) => {
      // Extract rate information
      const rateInfo = {
        id: rate.id || `rate_${rateIndex}`,
        roomName: rate.room_name || rate.name || `Room ${rateIndex + 1}`,
        price: extractPriceFromRate(rate),
        currency: rate.currency || searchParams.currency || 'USD',
        cancellation: rate.cancellation_policy || 'Unknown',
        breakfast: rate.meal_type || rate.breakfast || 'Not specified',
        bedding: rate.bedding || 'Standard',
        occupancy: rate.occupancy || `${searchParams.guests} guests`,
        bookingLink: null
      };
      
      // Try to extract booking link
      if (rate.booking_url) {
        rateInfo.bookingLink = rate.booking_url;
      } else if (rate.reserve_url) {
        rateInfo.bookingLink = rate.reserve_url;
      } else if (rate.order_url) {
        rateInfo.bookingLink = rate.order_url;
      } else if (rate.rate_key || rate.rate_id) {
        // Construct booking URL from rate key/ID
        rateInfo.bookingLink = constructBookingUrl(rate, sessionId, searchParams);
      }
      
      bookingData.rates.push(rateInfo);
      
      if (rateInfo.bookingLink) {
        bookingData.bookingLinks.push({
          roomName: rateInfo.roomName,
          price: rateInfo.price,
          currency: rateInfo.currency,
          bookingUrl: rateInfo.bookingLink,
          rateId: rateInfo.id
        });
      }
    });
    
    console.log(`📋 Extracted ${bookingData.rates.length} rates with ${bookingData.bookingLinks.length} booking links`);
    
  } catch (error) {
    console.error('💥 Error extracting booking data:', error);
  }
  
  return bookingData;
}

/**
 * Construct booking URL from rate data
 */
function constructBookingUrl(rate, sessionId, searchParams) {
  try {
    // Pattern: /orders/reserve/h-{rate_key}/?price=one&residency={residency}&sid={sessionId}
    const rateKey = rate.rate_key || rate.rate_id || rate.id;
    const residency = searchParams.residency || 'en-us';
    
    if (!rateKey) {
      return null;
    }
    
    let bookingUrl = `/orders/reserve/h-${rateKey}/?price=one&residency=${residency}`;
    
    if (sessionId) {
      bookingUrl += `&sid=${sessionId}`;
    }
    
    console.log(`🔗 Constructed booking URL: ${bookingUrl}`);
    return bookingUrl;
    
  } catch (error) {
    console.error('💥 Error constructing booking URL:', error);
    return null;
  }
}

/**
 * Extract price from rate object
 */
function extractPriceFromRate(rate) {
  if (rate.payment_options?.payment_types?.[0]) {
    const paymentType = rate.payment_options.payment_types[0];
    return parseFloat(paymentType.show_amount || paymentType.amount || 0);
  }
  
  return parseFloat(rate.total_price || rate.price || rate.amount || rate.daily_prices || 0);
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

/**
 * Enhanced hotel search that includes booking functionality
 */
async function searchHotelsWithBooking(searchParams) {
  console.log('🏨 === ENHANCED HOTEL SEARCH WITH BOOKING ===');
  
  try {
    // Get hotels with booking links
    const results = await searchHotelsWithBookingLinks(searchParams);
    
    if (!results.success) {
      return results;
    }
    
    // Transform hotels to include booking functionality
    const enhancedHotels = results.hotels.map(hotel => ({
      ...hotel,
      // Add easy booking methods
      bookNow: (rateId) => createBookingHandler(hotel, rateId),
      getBookingUrl: (rateId) => getHotelBookingUrl(hotel, rateId),
      hasBookingAvailable: hotel.hasBookingData && hotel.bookingLinks?.length > 0,
      availableRates: hotel.detailedRates || [],
      bookingOptions: hotel.bookingLinks || []
    }));
    
    console.log(`✅ Enhanced search complete: ${enhancedHotels.length} hotels with booking data`);
    console.log(`🔗 Hotels with booking links: ${enhancedHotels.filter(h => h.hasBookingAvailable).length}`);
    
    return {
      ...results,
      hotels: enhancedHotels,
      metadata: {
        ...results.metadata,
        bookingEnabled: true,
        hotelsWithBooking: enhancedHotels.filter(h => h.hasBookingAvailable).length
      }
    };
    
  } catch (error) {
    console.error('💥 Enhanced hotel search failed:', error);
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
  searchHotelsWithBooking,
  searchHotelsWithBookingLinks,
  fetchSingleHotelBookingData,
  getHotelBookingUrl
};