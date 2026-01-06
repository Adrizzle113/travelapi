import axios from 'axios';

// ETG API Configuration
const BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const CONTENT_API_BASE_URL = 'https://api.worldota.net/api/content/v1';

const partnerId = process.env.ETG_PARTNER_ID || '11606';
const password = process.env.ETG_API_KEY || 'ff9702bb-ba93-4996-a31e-547983c51530';

// Create axios instance with authentication for B2B API
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

// Create axios instance for Content API (same auth)
const contentApiClient = axios.create({
  baseURL: CONTENT_API_BASE_URL,
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
  '/search/serp/hotels/': { requests: 150, window: 60000 }, // 150/min (highest limit)
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
 * Endpoint: /search/serp/region/
 * Method: POST
 * Rate Limit: 10 requests/minute
 * 
 * This endpoint is for region-based searches (by region_id).
 * For hotel ID-based searches, use /search/hp/ with ids parameter.
 * 
 * Request body requires:
 * - region_id (integer) - Region ID for the search location
 * - checkin, checkout (dates)
 * - guests (array)
 * - residency (country code, uppercase)
 * - language, currency
 */
export async function searchHotelsByRegion(searchParams) {
  const endpoint = '/search/serp/region/';

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

    const response = await apiClient.post('/search/serp/region/', requestBody, {
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
 * Search hotels by hotel IDs with live rates
 * Endpoint: /search/serp/hotels/
 * Method: POST
 * Rate Limit: 150 requests/minute (highest limit)
 * 
 * This endpoint is for searching multiple specific hotels by their IDs (up to 300 hotels per request).
 * It's more efficient than calling /search/hp/ multiple times when you have a list of hotel IDs.
 * 
 * Request body requires:
 * - ids (array of strings/integers) - Array of hotel IDs (max 300)
 * - checkin, checkout (dates)
 * - guests (array)
 * - residency (country code, uppercase)
 * - language, currency
 * 
 * @param {Object} searchParams - Search parameters
 * @param {Array<string|number>} searchParams.hotelIds - Array of hotel IDs (required, max 300)
 * @param {string} searchParams.checkin - Check-in date (YYYY-MM-DD)
 * @param {string} searchParams.checkout - Check-out date (YYYY-MM-DD)
 * @param {Array} searchParams.guests - Guest configuration array
 * @param {string} searchParams.residency - Country code (default: 'US')
 * @param {string} searchParams.language - Language code (default: 'en')
 * @param {string} searchParams.currency - Currency code (default: 'USD')
 * @returns {Promise<Object>} - Search results with hotels array
 */
export async function searchHotelsByHotelIds(searchParams) {
  const endpoint = '/search/serp/hotels/';

  try {
    // Check rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    const {
      hotelIds,
      checkin,
      checkout,
      guests = [{ adults: 2, children: [] }],
      residency = 'US',
      language = 'en',
      currency = 'USD'
    } = searchParams;

    // Validate hotel IDs
    if (!hotelIds || !Array.isArray(hotelIds) || hotelIds.length === 0) {
      throw new Error('hotelIds array is required and must not be empty');
    }

    if (hotelIds.length > 300) {
      throw new Error('Maximum 300 hotel IDs allowed per request');
    }

    // Normalize hotel IDs to strings (ETG API accepts both strings and integers)
    const normalizedIds = hotelIds.map(id => String(id));

    console.log(`🔍 ETG searchHotelsByHotelIds: ${normalizedIds.length} hotels, checkin=${checkin}, checkout=${checkout}`);

    const requestBody = {
      ids: normalizedIds,  // Array of hotel IDs
      checkin,
      checkout,
      residency: residency.toUpperCase(),  // Must be uppercase country code
      language,
      guests,
      currency
    };

    const response = await apiClient.post('/search/serp/hotels/', requestBody, {
      timeout: TIMEOUTS.search
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const hotels = response.data.data?.hotels || [];
      
      console.log(`✅ ETG searchHotelsByHotelIds: ${hotels.length} hotels found`);
      
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
        total_hotels: hotels.length
      };
    }

    throw new Error('Search failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Search hotels by hotel IDs');
    console.error('❌ ETG searchHotelsByHotelIds error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Get hotel details with live rates (single hotel with availability)
 * Endpoint: /search/hp/
 * Method: POST
 * Rate Limit: 10 requests/minute
 * 
 * This endpoint is for hotel ID-based searches (uses ids parameter).
 * For region-based searches, use /search/serp/region/ with region_id parameter.
 * For multiple hotel IDs (up to 300), use /search/serp/hotels/ instead.
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
      id: hotelId,  // Single hotel ID string - use 'id' not 'ids'
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
 * Input: book_hash (from search results - format: h-...)
 * Output: booking_hash (needed for booking.finish)
 * 
 * This is STEP 1 of the booking flow
 */
export async function prebookHotel(bookHash, residency = 'US', language = 'en') {
  const endpoint = '/hotel/prebook/';

  try {
    // Check rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📋 ETG prebook:`, {
      hash: bookHash.substring(0, 30) + '...',
      residency,
      language
    });

    const response = await apiClient.post('/hotel/prebook/', {
      hash: bookHash,
      residency: residency.toUpperCase(),
      language
    }, {
      timeout: TIMEOUTS.prebook
    });

    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const prebookData = response.data.data;
      
      console.log(`✅ Prebook successful`);
      
      return prebookData;
    }

    throw new Error('Prebook failed - API returned non-ok status');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Prebook hotel');
    console.error('❌ ETG prebook error:', formattedError);
    
    // Re-throw with more context
    const enhancedError = new Error(formattedError.message || 'Prebook failed');
    enhancedError.status = formattedError.status;
    enhancedError.code = formattedError.code;
    enhancedError.data = formattedError.data;
    throw enhancedError;
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
 * 
 * Input: bookHash (from prebook), partnerOrderId (unique order ID)
 * Output: order_id, item_id, payment_types, etc.
 */
export async function getBookingForm(bookHash, partnerOrderId, language = 'en') {
  const endpoint = '/hotel/order/booking/form/';

  try {
    // Validate required parameters
    if (!bookHash) {
      throw new Error('bookHash is required for booking form');
    }
    
    if (!partnerOrderId) {
      throw new Error('partnerOrderId is required for booking form');
    }

    console.log(`📝 ETG getBookingForm:`, {
      hash: bookHash.substring(0, 30) + '...',
      partner_order_id: partnerOrderId,
      language
    });

    const response = await apiClient.post('/hotel/order/booking/form/', {
      hash: bookHash,
      partner_order_id: partnerOrderId,  // ✅ Added required parameter
      language
    }, {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      const formData = response.data.data;
      
      console.log(`✅ Booking form retrieved - order_id: ${formData.order_id}, item_id: ${formData.item_id}`);
      
      return formData;
    }

    throw new Error('Failed to get booking form - API returned non-ok status');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get booking form');
    console.error('❌ ETG getBookingForm error:', formattedError);
    
    // Re-throw with context
    const enhancedError = new Error(formattedError.message || 'Failed to get booking form');
    enhancedError.status = formattedError.status;
    enhancedError.code = formattedError.code;
    enhancedError.data = formattedError.data;
    throw enhancedError;
  }
}

/**
 * Create booking (finish)
 * Endpoint: /hotel/order/booking/finish/
 * Method: POST
 * Rate Limit: 30 requests/minute
 * Official Doc: "Start booking process - Creates booking (async)"
 * 
 * Supports two flows:
 * - Flow 1: Input: book_hash (from prebook) → Output: order_id + status
 * - Flow 2: Input: order_id + item_id (from booking/form) → Output: booking confirmation
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
      order_id,
      item_id,
      partner_order_id,
      guests,
      payment_type,
      paymentType,
      language = 'en',
      userIp,
      user_ip,
      email,
      phone,
      upsell_data
    } = bookingData;

    let requestBody;

    // Flow 2: Using order_id and item_id (from booking/form step)
    if (order_id && item_id) {
      // Validate required parameters
      if (!partner_order_id) {
        throw new Error('partner_order_id is required when using order_id and item_id');
      }
      if (!guests || !Array.isArray(guests) || guests.length === 0) {
        throw new Error('guests array is required and must not be empty');
      }
      if (!payment_type && !paymentType) {
        throw new Error('payment_type is required');
      }

      // Convert order_id and item_id to numbers (RateHawk API expects numbers, not strings)
      const orderIdNum = typeof order_id === 'string' ? parseInt(order_id, 10) : Number(order_id);
      const itemIdNum = typeof item_id === 'string' ? parseInt(item_id, 10) : Number(item_id);
      
      if (isNaN(orderIdNum) || isNaN(itemIdNum)) {
        throw new Error(`Invalid order_id or item_id: order_id=${order_id}, item_id=${item_id}`);
      }

      // Normalize payment_type
      const normalizedPaymentType = (payment_type || paymentType || 'deposit').toLowerCase().trim();
      const validPaymentTypes = ['deposit', 'now', 'hotel'];
      
      if (!validPaymentTypes.includes(normalizedPaymentType)) {
        throw new Error(`Invalid payment_type: "${payment_type || paymentType}". Must be one of: ${validPaymentTypes.join(', ')}`);
      }

      console.log(`🎯 ETG finishBooking: order_id=${orderIdNum}, item_id=${itemIdNum}`);

      requestBody = {
        order_id: orderIdNum,  // Send as number
        item_id: itemIdNum,    // Send as number
        guests,
        payment_type: normalizedPaymentType,
        partner_order_id,
        language
      };

      // Add optional fields
      if (upsell_data && Array.isArray(upsell_data) && upsell_data.length > 0) {
        requestBody.upsell_data = upsell_data;
      }
      // Note: email, phone, and user_ip might not be accepted at top level
      // They may need to be in guests array or not included at all

    } 
    // Flow 1: Using bookHash (from prebook step)
    else if (bookHash) {
      console.log(`🎯 ETG finishBooking: ${bookHash.substring(0, 20)}...`);

      requestBody = {
        hash: bookHash,
        language,
        payment_type: paymentType || payment_type || 'deposit',
        user_ip: userIp || user_ip
      };
    } 
    else {
      throw new Error('Either bookHash or (order_id and item_id) must be provided');
    }

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
 * Get filter values for hotel search filtering
 * Endpoint: /filter_values
 * Method: GET
 * Content API endpoint - returns available filter options
 * 
 * This endpoint provides metadata for:
 * - Language codes and descriptions
 * - Country codes and names
 * - SERP filters (amenities like has_breakfast, has_pool, etc.)
 * - Star ratings (0-5)
 * - Hotel kinds (Hotel, Resort, Apartment, etc.)
 * 
 * Note: Filter values change infrequently, so this should be cached (recommended: 24 hours)
 * 
 * @returns {Promise<Object>} - Filter values object with language, country, serp_filter, star_rating, kind
 */
export async function getFilterValues() {
  try {
    console.log('🔍 ETG getFilterValues: Fetching filter values from Content API');

    const response = await contentApiClient.get('/filter_values', {
      timeout: TIMEOUTS.default
    });

    if (response.data && response.data.status === 'ok') {
      const filterValues = response.data.data;
      console.log(`✅ ETG getFilterValues: Retrieved filter values`);
      console.log(`   - Languages: ${filterValues.language?.length || 0}`);
      console.log(`   - Countries: ${filterValues.country?.length || 0}`);
      console.log(`   - SERP Filters: ${filterValues.serp_filter?.length || 0}`);
      console.log(`   - Star Ratings: ${filterValues.star_rating?.length || 0}`);
      console.log(`   - Hotel Kinds: ${filterValues.kind?.length || 0}`);
      
      return filterValues;
    }

    throw new Error('Failed to get filter values');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get filter values');
    console.error('❌ ETG getFilterValues error:', formattedError.message);
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
      const data = response.data.data || {};
      
      // Log full response structure for debugging (first time only)
      if (process.env.NODE_ENV !== 'production') {
        console.log('📊 Multicomplete response structure:', {
          hasRegions: !!data.regions,
          hasHotels: !!data.hotels,
          regionsCount: data.regions?.length || 0,
          hotelsCount: data.hotels?.length || 0,
          dataKeys: Object.keys(data)
        });
        
        if (data.hotels && data.hotels.length > 0) {
          console.log('🏨 Sample hotel structure:', JSON.stringify(data.hotels[0], null, 2).substring(0, 500));
        }
      }
      
      // Combine regions and hotels into unified results
      const regions = data.regions || [];
      const hotels = data.hotels || [];
      const allResults = [...regions, ...hotels];
      
      console.log(`✅ Autocomplete: ${regions.length} regions, ${hotels.length} hotels (${allResults.length} total)`);
      return allResults;
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
  searchHotelsByHotelIds,
  getHotelWithRates,
  prebookHotel,
  getBookingForm,
  finishBooking,
  getBookingStatus,
  getOrderInfo,
  cancelOrder,
  autocomplete,
  getFilterValues,
  getRateLimitStatus
};