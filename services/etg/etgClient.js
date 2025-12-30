import axios from 'axios';

// ETG API Configuration
const BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const API_KEY = process.env.ETG_API_KEY || '11606:ff9702bb-ba93-4996-a31e-547983c51530';

// Parse API credentials
const [partnerId, password] = API_KEY.split(':');

// Create axios instance with authentication
const apiClient = axios.create({
  baseURL: BASE_URL,
  auth: {
    username: partnerId,
    password: password
  },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Timeout configurations (in milliseconds)
const TIMEOUTS = {
  search: 30000,      // 30 seconds for search
  hotelInfo: 15000,   // 15 seconds for hotel info
  prebook: 20000,     // 20 seconds for prebook
  booking: 30000,     // 30 seconds for booking
  default: 15000      // 15 seconds default
};

// Rate limiting configuration based on ETG limits
const RATE_LIMITS = {
  '/search/serp/region/': { requests: 10, window: 60000 },  // 10/min
  '/search/hp/': { requests: 10, window: 60000 },           // 10/min
  '/hotel/info/': { requests: 30, window: 60000 },          // 30/min
  '/hotel/prebook/': { requests: 30, window: 60000 },       // 30/min
  '/hotel/order/booking/finish/': { requests: 30, window: 60000 }  // 30/min
};

// Rate limit tracking
const rateLimitTrackers = {};

// Initialize rate limit tracker for an endpoint
function initRateLimitTracker(endpoint) {
  if (!rateLimitTrackers[endpoint]) {
    rateLimitTrackers[endpoint] = {
      requests: [],
      limit: RATE_LIMITS[endpoint]
    };
  }
}

// Check if request is within rate limit
function checkRateLimit(endpoint) {
  if (!RATE_LIMITS[endpoint]) {
    return { allowed: true, remaining: Infinity, waitTime: 0 };
  }

  initRateLimitTracker(endpoint);
  const tracker = rateLimitTrackers[endpoint];
  const now = Date.now();
  const windowStart = now - tracker.limit.window;

  // Remove old requests outside the time window
  tracker.requests = tracker.requests.filter(time => time > windowStart);

  const remaining = tracker.limit.requests - tracker.requests.length;
  
  if (remaining > 0) {
    return { allowed: true, remaining, waitTime: 0 };
  }

  // Calculate wait time until oldest request expires
  const oldestRequest = tracker.requests[0];
  const waitTime = Math.ceil((oldestRequest + tracker.limit.window - now) / 1000);
  
  return { allowed: false, remaining: 0, waitTime };
}

// Record a request for rate limiting
function recordRequest(endpoint) {
  if (!RATE_LIMITS[endpoint]) return;
  
  initRateLimitTracker(endpoint);
  rateLimitTrackers[endpoint].requests.push(Date.now());
}

// Wait for rate limit to reset
async function waitForRateLimit(endpoint) {
  const { waitTime } = checkRateLimit(endpoint);
  if (waitTime > 0) {
    console.log(`⏳ Rate limit reached for ${endpoint}. Waiting ${waitTime}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }
}

// Format axios error for better logging
function formatAxiosError(error, context = '') {
  if (error.response) {
    // Server responded with error status
    return {
      context,
      status: error.response.status,
      statusText: error.response.statusText,
      message: error.response.data?.error || error.response.data?.message || error.message,
      data: error.response.data,
      path: error.config?.url
    };
  } else if (error.request) {
    // Request made but no response
    return {
      context,
      message: 'No response from server',
      error: error.message,
      path: error.config?.url
    };
  } else {
    // Error in request setup
    return {
      context,
      message: error.message
    };
  }
}

/**
 * Get static hotel information
 * Endpoint: /hotel/info/
 * Method: POST
 * Rate Limit: 30 requests/minute
 * Official Doc: "Retrieve hotel information - Fetch details for specific hotel IDs"
 */
export async function getHotelInformation(hotelId, language = 'en') {
  const endpoint = '/hotel/info/';

  try {
    // Check rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`🏨 ETG getHotelInfo: ${hotelId}`);

    const response = await apiClient.post('/hotel/info/', {
      id: hotelId,  // Single ID (not array)
      language
    }, {
      timeout: TIMEOUTS.hotelInfo
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      return response.data.data;
    }

    throw new Error('Hotel information not found');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get hotel information');
    console.error('❌ ETG getHotelInfo error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Search hotels by region with live rates
 * Endpoint: /search/hp/ (NOT /search/serp/region/)
 * Method: POST
 * Rate Limit: 10 requests/minute
 * Official Doc: "Homepage search helpers" but actually returns full hotel search with rates
 * 
 * This is the CORRECT endpoint for getting hotel rates with availability
 */
export async function searchHotelsByRegion(searchParams) {
  const endpoint = '/search/hp/';

  try {
    // Check rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    const {
      regionId,
      checkin,
      checkout,
      guests = [{ adults: 2, children: [] }],
      residency = 'US',
      language = 'en',
      currency = 'USD'
    } = searchParams;

    console.log(`🔍 ETG searchHotels: region=${regionId}, checkin=${checkin}, checkout=${checkout}`);

    const requestBody = {
      region_id: parseInt(regionId),  // Must be integer
      checkin,
      checkout,
      residency,  // Must be uppercase country code
      language,
      guests,
      currency
    };

    const response = await apiClient.post('/search/hp/', requestBody, {
      timeout: TIMEOUTS.search
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const hotels = response.data.data?.hotels || [];
      
      console.log(`✅ ETG searchHotels: ${hotels.length} hotels found`);
      
      // Extract match_hash from each hotel
      hotels.forEach(hotel => {
        if (hotel.rates && hotel.rates.length > 0) {
          const firstRate = hotel.rates[0];
          if (firstRate.match_hash) {
            hotel.match_hash = firstRate.match_hash;
            console.log(`📋 Match hash for ${hotel.id}: ${firstRate.match_hash.substring(0, 20)}...`);
          }
        }
      });
      
      return {
        hotels,
        search_id: response.data.data?.search_id,
        region_id: response.data.data?.region_id
      };
    }

    throw new Error('Search failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Search hotels by region');
    console.error('❌ ETG searchHotels error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Get hotel details with live rates (single hotel with availability)
 * Endpoint: /search/hp/
 * Method: POST
 * Rate Limit: 10 requests/minute
 * 
 * This endpoint returns:
 * - Hotel static info (name, address, amenities, photos)
 * - Live rates with availability
 * - match_hash for each rate (needed for prebook)
 */
export async function getHotelWithRates(hotelId, searchParams) {
  const endpoint = '/search/hp/';

  try {
    // Check rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    const {
      checkin,
      checkout,
      guests = [{ adults: 2, children: [] }],
      residency = 'US',
      language = 'en',
      currency = 'USD'
    } = searchParams;

    console.log(`🏨 ETG getHotelWithRates: ${hotelId}`);

    const requestBody = {
      ids: [hotelId],  // Array of hotel IDs
      checkin,
      checkout,
      residency,
      language,
      guests,
      currency
    };

    const response = await apiClient.post('/search/hp/', requestBody, {
      timeout: TIMEOUTS.search
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const hotels = response.data.data?.hotels || [];
      
      if (hotels.length === 0) {
        throw new Error('Hotel not found');
      }

      const hotel = hotels[0];
      
      // Extract match_hash from rates
      if (hotel.rates && hotel.rates.length > 0) {
        hotel.rates.forEach(rate => {
          if (rate.match_hash) {
            console.log(`📋 Match hash for rate: ${rate.match_hash.substring(0, 20)}...`);
          }
        });
      }

      console.log(`✅ ETG getHotelWithRates: ${hotel.rates?.length || 0} rates found`);
      
      return hotel;
    }

    throw new Error('Hotel details not found');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get hotel with rates');
    console.error('❌ ETG getHotelWithRates error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Prebook a hotel room (price validation + availability hold)
 * Endpoint: /hotel/prebook/
 * Method: POST
 * Rate Limit: 30 requests/minute
 * Official Doc: "Prebook hotel - Price validation + availability hold"
 * 
 * Input: match_hash (from search results)
 * Output: book_hash (needed for booking.finish)
 * 
 * This is STEP 1 of the booking flow
 */
export async function prebookHotel(matchHash, language = 'en') {
  const endpoint = '/hotel/prebook/';

  try {
    // Check rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📋 ETG prebook: ${matchHash.substring(0, 20)}...`);

    const response = await apiClient.post('/hotel/prebook/', {
      hash: matchHash,
      language
    }, {
      timeout: TIMEOUTS.prebook
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const prebookData = response.data.data;
      
      // Extract book_hash
      if (prebookData.book_hash) {
        console.log(`✅ Prebook successful. Book hash: ${prebookData.book_hash.substring(0, 20)}...`);
      } else {
        console.warn('⚠️ Prebook response missing book_hash');
      }
      
      return prebookData;
    }

    throw new Error('Prebook failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Prebook hotel');
    console.error('❌ ETG prebook error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Get booking form requirements
 * Endpoint: /hotel/order/booking/form/
 * Method: POST
 * Rate Limit: 30 requests/minute
 * Official Doc: "Retrieve booking form - Required guest fields"
 * 
 * This is STEP 2 of the booking flow (optional but recommended)
 */
export async function getBookingForm(bookHash, language = 'en') {
  const endpoint = '/hotel/order/booking/form/';

  try {
    console.log(`📝 ETG getBookingForm: ${bookHash.substring(0, 20)}...`);

    const response = await apiClient.post('/hotel/order/booking/form/', {
      hash: bookHash,
      language
    }, {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      console.log('✅ Booking form retrieved');
      return response.data.data;
    }

    throw new Error('Failed to get booking form');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get booking form');
    console.error('❌ ETG getBookingForm error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Create booking (finish)
 * Endpoint: /hotel/order/booking/finish/
 * Method: POST
 * Rate Limit: 30 requests/minute
 * Official Doc: "Start booking process - Creates booking (async)"
 * 
 * Input: book_hash (from prebook)
 * Output: order_id + status (usually "processing")
 * 
 * This is STEP 3 of the booking flow
 * Note: This is ASYNC - you must poll /finish/status/ until confirmed
 */
export async function finishBooking(bookingData) {
  const endpoint = '/hotel/order/booking/finish/';

  try {
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    const {
      bookHash,
      language = 'en',
      userIp,
      paymentType = 'deposit'
    } = bookingData;

    console.log(`🎯 ETG finishBooking: ${bookHash.substring(0, 20)}...`);

    const requestBody = {
      hash: bookHash,
      language,
      payment_type: paymentType,
      user_ip: userIp
    };

    const response = await apiClient.post('/hotel/order/booking/finish/', requestBody, {
      timeout: TIMEOUTS.booking
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const bookingResult = response.data.data;
      
      console.log(`✅ Booking initiated: order_id=${bookingResult.order_id}, status=${bookingResult.status}`);
      
      if (bookingResult.status === 'processing') {
        console.log('⏳ Booking is async - must poll /finish/status/');
      }
      
      return bookingResult;
    }

    throw new Error('Booking failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Finish booking');
    console.error('❌ ETG finishBooking error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Check booking status (poll this endpoint)
 * Endpoint: /hotel/order/booking/finish/status/
 * Method: POST
 * Rate Limit: 30 requests/minute
 * Official Doc: "Retrieve booking status - Poll until confirmed"
 * 
 * Input: order_id (from finish booking)
 * Output: status (processing/confirmed/failed)
 * 
 * This is STEP 4 of the booking flow
 * Poll this endpoint every 2-5 seconds until status is "confirmed" or "failed"
 */
export async function getBookingStatus(orderId, language = 'en') {
  try {
    console.log(`🔍 ETG getBookingStatus: order_id=${orderId}`);

    const response = await apiClient.post('/hotel/order/booking/finish/status/', {
      order_id: orderId,
      language
    }, {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      const statusData = response.data.data;
      console.log(`📊 Booking status: ${statusData.status}`);
      return statusData;
    }

    throw new Error('Failed to get booking status');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get booking status');
    console.error('❌ ETG getBookingStatus error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Get order information
 * Endpoint: /hotel/order/info/
 * Method: POST
 * Official Doc: "Retrieve order info - Full booking details"
 */
export async function getOrderInfo(orderId, language = 'en') {
  try {
    console.log(`📋 ETG getOrderInfo: order_id=${orderId}`);

    const response = await apiClient.post('/hotel/order/info/', {
      order_id: orderId,
      language
    }, {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      console.log('✅ Order info retrieved');
      return response.data.data;
    }

    throw new Error('Failed to get order info');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order info');
    console.error('❌ ETG getOrderInfo error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Cancel order
 * Endpoint: /hotel/order/cancel/
 * Method: POST
 * Official Doc: "Cancel order - Cancel booking (penalty rules apply)"
 */
export async function cancelOrder(orderId, language = 'en') {
  try {
    console.log(`❌ ETG cancelOrder: order_id=${orderId}`);

    const response = await apiClient.post('/hotel/order/cancel/', {
      order_id: orderId,
      language
    }, {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      console.log('✅ Order cancelled');
      return response.data.data;
    }

    throw new Error('Failed to cancel order');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Cancel order');
    console.error('❌ ETG cancelOrder error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Autocomplete search (destinations, hotels, etc.)
 * Endpoint: /search/multicomplete/
 * Method: POST
 * Official Doc: "Suggest hotel and region - Autocomplete for cities, regions, hotels, airports"
 */
export async function autocomplete(query, language = 'en') {
  try {
    console.log(`🔍 ETG autocomplete: ${query}`);

    const response = await apiClient.post('/search/multicomplete/', {
      query,
      language
    }, {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      const results = response.data.data?.regions || [];
      console.log(`✅ Autocomplete: ${results.length} results`);
      return results;
    }

    return [];

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Autocomplete');
    console.error('❌ ETG autocomplete error:', formattedError.message);
    return [];
  }
}

// Export rate limit info for monitoring
export function getRateLimitStatus() {
  const status = {};
  
  Object.keys(RATE_LIMITS).forEach(endpoint => {
    const check = checkRateLimit(endpoint);
    status[endpoint] = {
      limit: RATE_LIMITS[endpoint].requests,
      remaining: check.remaining,
      window: `${RATE_LIMITS[endpoint].window / 1000}s`
    };
  });
  
  return status;
}

export default {
  getHotelInformation,
  searchHotelsByRegion,
  getHotelWithRates,
  prebookHotel,
  getBookingForm,
  finishBooking,
  getBookingStatus,
  getOrderInfo,
  cancelOrder,
  autocomplete,
  getRateLimitStatus
};