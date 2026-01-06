/**
 * Booking Service
 * Handles RateHawk API v3 booking and order management operations
 */

import { createAxiosWithRetry } from '../../middleware/retryHandler.js';
import { categorizeError } from '../../utils/errorHandler.js';
import { checkRateLimit, recordRequest, waitForRateLimit } from '../etg/etgRateLimiter.js';

// ETG API Configuration
const ETG_BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const ETG_PARTNER_ID = process.env.ETG_PARTNER_ID || '11606';
const ETG_API_KEY = process.env.ETG_API_KEY;

if (!ETG_API_KEY) {
  console.warn('⚠️ ETG_API_KEY not set - Booking API calls will fail');
}

// Development mode configuration - DISABLED by default for certification
// Only enable for explicit testing, not for real bookings
const ENABLE_MOCK_BOOKINGS = process.env.ENABLE_MOCK_BOOKINGS === 'true';

// Timeout configurations for booking operations
const TIMEOUTS = {
  prebook: 20000,
  orderForm: 15000,
  orderFinish: 30000,
  orderStatus: 10000,
  orderInfo: 15000,
  orderDocuments: 15000,
  default: 25000
};

// Create axios instance with auth and retry logic
// Note: For booking operations, we use fewer retries to avoid duplicate bookings
const apiClient = createAxiosWithRetry({
  baseURL: ETG_BASE_URL,
  auth: {
    username: ETG_PARTNER_ID,
    password: ETG_API_KEY
  },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: TIMEOUTS.default,
  maxRetries: 1 // Reduced retries for booking operations to prevent duplicates
});

/**
 * Detect if an order ID is a fake/simulated ID from frontend
 * Format: ORD-{timestamp} (e.g., ORD-1767062835773)
 * @param {string} orderId - Order ID to check
 * @returns {boolean} - True if fake order ID
 */
function isFakeOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    return false;
  }
  // Match pattern: ORD- followed by digits (timestamp)
  return /^ORD-\d+$/.test(orderId);
}

/**
 * Generate mock order status response for fake order IDs
 * @param {string} orderId - Fake order ID
 * @returns {Object} - Mock status response
 */
function generateMockOrderStatus(orderId) {
  // Simulate processing status that eventually becomes confirmed
  const timestamp = parseInt(orderId.split('-')[1]) || Date.now();
  const age = Date.now() - timestamp;
  const status = age > 10000 ? 'confirmed' : 'processing'; // Confirmed after 10 seconds

  return {
    status,
    order_id: orderId,
    message: status === 'confirmed' ? 'Order confirmed successfully' : 'Order is being processed',
    created_at: new Date(timestamp).toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Generate mock order info response for fake order IDs
 * @param {string} orderId - Fake order ID
 * @returns {Object} - Mock info response
 */
function generateMockOrderInfo(orderId) {
  return {
    order_id: orderId,
    hotel_name: 'Sample Hotel',
    hotel_id: 'sample-hotel-123',
    checkin: '2025-01-15',
    checkout: '2025-01-17',
    guests: [
      {
        name: 'John Doe',
        email: 'john@example.com'
      }
    ],
    total_amount: 299.99,
    currency: 'USD',
    status: 'confirmed',
    created_at: new Date().toISOString()
  };
}

/**
 * Generate mock order documents response for fake order IDs
 * @param {string} orderId - Fake order ID
 * @returns {Object} - Mock documents response
 */
function generateMockOrderDocuments(orderId) {
  return {
    order_id: orderId,
    voucher_url: `https://example.com/vouchers/${orderId}.pdf`,
    invoice_url: `https://example.com/invoices/${orderId}.pdf`,
    confirmation_url: `https://example.com/confirmations/${orderId}.pdf`
  };
}

function formatAxiosError(error, operation) {
  const categorized = categorizeError(error);
  const enhancedError = new Error(categorized.message);

  enhancedError.category = categorized.category;
  enhancedError.statusCode = categorized.statusCode;
  enhancedError.isRetryable = categorized.isRetryable;
  enhancedError.operation = operation;
  enhancedError.originalError = error;

  if (error.response) {
    const status = error.response.status;
    const errorData = error.response.data;

    if (status === 400) {
      const errorMessage = errorData?.message || errorData?.error || error.message;
      enhancedError.message = `${operation} failed - Invalid request: ${errorMessage}`;
    } else if (status === 404) {
      // Distinguish between endpoint not found vs order not found
      const errorMessage = errorData?.message || errorData?.error || error.message;
      if (errorMessage && errorMessage.toLowerCase().includes('page not found')) {
        enhancedError.message = `${operation} failed - API endpoint not found. Check endpoint configuration.`;
        enhancedError.category = 'api_configuration_error';
      } else {
        enhancedError.message = `${operation} failed - Order not found: ${errorMessage}`;
        enhancedError.category = 'order_not_found';
      }
    } else if (status === 503 || status === 502) {
      enhancedError.message = `${operation} failed - ETG API temporarily unavailable (${status})`;
    } else if (status === 429) {
      enhancedError.message = `${operation} failed - rate limit exceeded`;
    } else {
      enhancedError.message = `${operation} failed with status ${status}: ${errorData?.message || error.message}`;
    }
  }

  return enhancedError;
}

/**
 * Prebook a rate (lock rate & validate availability)
 * @param {string} book_hash - Match hash (m-...) from search results, book hash (h-...) from hotel page, or prebooked hash (p-...)
 * @param {Array} guests - Guests array [{ adults: 2, children: [] }]
 * @param {string} residency - Residency code (uppercase, e.g., 'US')
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<Object>} - Prebook response with booking_hash
 */
export async function prebookRate(book_hash, guests, residency = 'US', language = 'en') {
  const endpoint = '/hotel/prebook/';

  try {
    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    // Validate hash format (accepts match_hash m-..., book_hash h-..., or prebooked hash p-...)
    // ETG API /hotel/prebook/ accepts match_hash and returns book_hash
    if (!book_hash || (!book_hash.startsWith('m-') && !book_hash.startsWith('h-') && !book_hash.startsWith('p-'))) {
      throw new Error(`Invalid hash format for prebook. Expected match_hash (m-...), book_hash (h-...), or prebooked hash (p-...), got: ${book_hash}`);
    }

    // Validate guests format
    if (!Array.isArray(guests) || guests.length === 0) {
      throw new Error('Guests must be a non-empty array');
    }

    // Ensure residency is uppercase for prebook
    const normalizedResidency = (residency || 'US').toUpperCase();

    // Build request body with correct parameter names (ETG API expects 'hash' not 'book_hash')
    const requestBody = {
      hash: book_hash,  // ✅ Use 'hash' not 'book_hash'
      guests: guests,   // ✅ Required
      residency: normalizedResidency,  // ✅ Uppercase
      language: language || 'en'  // ✅ Required
    };
    
    console.log(`🔒 ETG prebookRate: hash=${book_hash?.substring(0, 20)}... (${rateLimitCheck.remaining || '?'} requests remaining)`);
    console.log(`📤 Sending to ETG API ${endpoint}:`);
    console.log(`   Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await apiClient.post(endpoint, requestBody, {
      timeout: TIMEOUTS.prebook
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const prebookedHash = response.data.data?.hotels?.[0]?.rates?.[0]?.book_hash;
      const priceChanged = response.data.data?.changes?.price_changed;
      
      console.log(`✅ Prebook successful: prebooked_hash=${prebookedHash?.substring(0, 20)}...`);
      if (priceChanged) {
        console.warn(`⚠️ Price changed during prebook!`);
      }
      
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Prebook failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Prebook rate');
    console.error('❌ ETG prebookRate error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw formattedError;
  }
}

/**
 * Get booking form fields (required guest information)
 * Creates booking process and returns form fields + order information
 * Per ETG API: "Create booking process" endpoint
 * Correct flow: Takes partner_order_id + book_hash, Returns order_id + item_id
 * @param {string} book_hash - Book hash from prebook response
 * @param {string} partner_order_id - Partner's unique order ID (required)
 * @param {string} language - Language code (default: en)
 * @param {string} user_ip - User IP address
 * @returns {Promise<Object>} - Booking form with required fields, order_id, and item_id
 */
export async function getOrderForm(book_hash, partner_order_id, language = 'en', user_ip = '127.0.0.1') {
  const endpoint = '/hotel/order/booking/form/';

  try {
    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📋 ETG getOrderForm (Create booking process): book_hash=${book_hash?.substring(0, 20)}... (${rateLimitCheck.remaining || '?'} requests remaining)`);

    // Validate required parameters
    if (!book_hash) {
      throw new Error('book_hash is required (from prebook response)');
    }

    if (!partner_order_id) {
      throw new Error('partner_order_id is required');
    }

    const payload = {
      book_hash,    
      partner_order_id,
      language,
      user_ip
    };

    console.log('📤 Sending payload to ETG API:');
    console.log(JSON.stringify(payload, null, 2));

    const response = await apiClient.post(endpoint, payload, {
      timeout: TIMEOUTS.orderForm
    });

    // Record successful request
    recordRequest(endpoint);

    // ✅ Log the full response for debugging
    console.log('📥 ETG API response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status === 'ok') {
      const formData = response.data.data;
      console.log(`✅ Order form retrieved successfully`);
      
      if (formData.order_id) {
        console.log(`   Order ID: ${formData.order_id}`);
      }
      if (formData.item_id) {
        console.log(`   Item ID: ${formData.item_id}`);
      }
      
      return formData;
    }

    // ✅ Better error message with actual response
    const errorMsg = response.data?.error || response.data?.message || 'Get order form failed';
    console.error('⚠️ ETG returned non-ok status:', JSON.stringify(response.data, null, 2));
    throw new Error(errorMsg);

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order form');
    console.error('❌ ETG getOrderForm error:', formattedError.message);
    
    // ✅ Log full error details
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Full response data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Request payload was:', JSON.stringify(payload, null, 2));
    } else if (error.message) {
      console.error('   Error message:', error.message);
    }
    
    throw formattedError;
  }
}

/**
 * Finish/complete the booking
 * Per ETG API: "Start booking process" endpoint
 * Correct flow: Uses order_id and item_id from booking/form step
 * @param {string} order_id - Order ID from booking/form response
 * @param {string} item_id - Item ID from booking/form response
 * @param {Array} guests - Guest information array
 * @param {string} payment_type - Payment type (e.g., 'deposit', 'hotel', 'now')
 * @param {string} partner_order_id - Partner's unique order ID (required)
 * @param {string} language - Language code (default: en)
 * @param {Array} upsell_data - Optional upsells (early check-in, late checkout, etc.)
 * @param {string} email - Optional contact email
 * @param {string} phone - Optional contact phone
 * @param {string} user_ip - Optional user IP address
 * @returns {Promise<Object>} - Order completion response with order_id
 */
export async function finishOrder(order_id, item_id, guests, payment_type, partner_order_id, language = 'en', upsell_data = null, email = null, phone = null, user_ip = null) {
  const endpoint = '/hotel/order/booking/finish/';

  try {
    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`✅ ETG finishOrder (Finish booking): order_id=${order_id}, item_id=${item_id} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    // Validate required parameters
    if (!order_id || !item_id) {
      throw new Error('order_id and item_id are required (from booking/form response)');
    }

    if (!partner_order_id) {
      throw new Error('partner_order_id is required');
    }

    // Build payload per ETG API specification
    // ETG API returns order_id and item_id as numbers, so send as numbers
    // Convert strings to numbers if needed
    const orderIdNum = typeof order_id === 'string' ? parseInt(order_id, 10) : Number(order_id);
    const itemIdNum = typeof item_id === 'string' ? parseInt(item_id, 10) : Number(item_id);
    
    if (isNaN(orderIdNum) || isNaN(itemIdNum)) {
      throw new Error(`Invalid order_id or item_id: order_id=${order_id}, item_id=${item_id}`);
    }
    
    // Validate and normalize payment_type
    // ETG API expects specific PaymentType enum values: "deposit", "now", "hotel"
    // IMPORTANT: The payment_type must match one of the "type" values from the 
    // payment_types array returned by the /hotel/order/booking/form/ endpoint.
    // Even if a payment type appears in the order form response, it may not be valid
    // for the specific order (e.g., test hotels may only support "now").
    // Normalize to lowercase and validate
    const normalizedPaymentType = (payment_type || '').toLowerCase().trim();
    const validPaymentTypes = ['deposit', 'now', 'hotel'];
    
    if (!validPaymentTypes.includes(normalizedPaymentType)) {
      throw new Error(`Invalid payment_type: "${payment_type}". Must be one of: ${validPaymentTypes.join(', ')}`);
    }
    
    const payload = {
      order_id: orderIdNum,  // Send as number (matching ETG API response format)
      item_id: itemIdNum,    // Send as number (matching ETG API response format)
      guests,
      payment_type: normalizedPaymentType,  // Use normalized payment type
      partner_order_id,
      language
    };

    // Note: email, phone, and user_ip might not be accepted at top level
    // They may need to be in guests array or not included at all
    // Try without them first, add back if needed
    // if (email) {
    //   payload.email = email;
    // }
    // if (phone) {
    //   payload.phone = phone;
    // }
    // if (user_ip) {
    //   payload.user_ip = user_ip;
    // }

    // Add upsells if provided
    if (upsell_data && Array.isArray(upsell_data) && upsell_data.length > 0) {
      payload.upsell_data = upsell_data;
      console.log(`   Upsells: ${upsell_data.length} items`);
    }

    console.log('📤 Sending payload to ETG API:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('📤 Payment type details:');
    console.log(`   - Value: "${payload.payment_type}"`);
    console.log(`   - Type: ${typeof payload.payment_type}`);
    console.log(`   - Original: "${payment_type}"`);

    // Use correct endpoint per ETG API: /hotel/order/booking/finish/
    const response = await apiClient.post(endpoint, payload, {
      timeout: TIMEOUTS.orderFinish
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const orderData = response.data.data;
      console.log(`✅ Order finished successfully: order_id=${orderData?.order_id || 'pending'}`);
      return orderData;
    }

    throw new Error(response.data?.error?.message || 'Finish order failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Finish order');
    console.error('❌ ETG finishOrder error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Full Error Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Request URL:', error.config?.url);
      console.error('   Request Method:', error.config?.method);
      console.error('   Request Payload:', JSON.stringify(error.config?.data || payload, null, 2));
    } else if (error.request) {
      console.error('   No response received from ETG API');
      console.error('   Request config:', JSON.stringify(error.config, null, 2));
    } else {
      console.error('   Error setting up request:', error.message);
    }
    throw formattedError;
  }
}

/**
 * Get order status (poll for booking confirmation)
 * @param {string} order_id - Order ID from finish order
 * @returns {Promise<Object>} - Order status information
 */
export async function getOrderStatus(order_id) {
  const endpoint = '/hotel/order/booking/finish/status/';

  try {
    // Check for fake order IDs (frontend simulation) - log warning but don't mock
    if (isFakeOrderId(order_id)) {
      console.warn(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
      if (!ENABLE_MOCK_BOOKINGS) {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID. Use a real order ID from finishOrder() response.`);
      } else {
        console.log(`🎭 [MOCK MODE ENABLED] Returning mock response for testing only`);
        return generateMockOrderStatus(order_id);
      }
    }

    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📊 ETG getOrderStatus: order_id=${order_id} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    // Use correct ETG API v3 endpoint per certification checklist
    // Certification checklist specifies: api/b2b/v3/hotel/order/booking/finish/status/
    const response = await apiClient.post(endpoint, {
      order_id
    }, {
      timeout: TIMEOUTS.orderStatus
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Order status retrieved successfully`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Get order status failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order status');
    console.error('❌ ETG getOrderStatus error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
      console.error('   Endpoint attempted:', error.config?.url || 'unknown');
    }
    throw formattedError;
  }
}

/**
 * Get full order information
 * @param {string} order_id - Order ID
 * @returns {Promise<Object>} - Complete order details
 */
export async function getOrderInfo(order_id) {
  const endpoint = '/hotel/order/info/';

  try {
    // Check for fake order IDs (frontend simulation) - log warning but don't mock
    if (isFakeOrderId(order_id)) {
      console.warn(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
      if (!ENABLE_MOCK_BOOKINGS) {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID. Use a real order ID from finishOrder() response.`);
      } else {
        console.log(`🎭 [MOCK MODE ENABLED] Returning mock response for testing only`);
        return generateMockOrderInfo(order_id);
      }
    }

    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📄 ETG getOrderInfo: order_id=${order_id} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    // Use correct ETG API v3 endpoint
    // Based on certification checklist, order info endpoint is typically /hotel/order/info/
    const response = await apiClient.post(endpoint, {
      order_id
    }, {
      timeout: TIMEOUTS.orderInfo
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Order info retrieved successfully`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Get order info failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order info');
    console.error('❌ ETG getOrderInfo error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
      console.error('   Endpoint attempted:', error.config?.url || 'unknown');
    }
    throw formattedError;
  }
}

/**
 * Retrieve bookings (post-booking endpoint)
 * Per ETG API: "Retrieve bookings" endpoint
 * Can retrieve a list of bookings or a specific booking by order_id
 * @param {string} order_id - Optional: Specific order ID to retrieve
 * @param {Object} filters - Optional: Filters for booking list (date_from, date_to, status, etc.)
 * @returns {Promise<Object>} - Booking(s) information
 */
export async function retrieveBookings(order_id = null, filters = {}) {
  const endpoint = '/hotel/order/info/'; // Use order/info endpoint for rate limiting

  try {
    // Check for fake order IDs
    if (order_id && isFakeOrderId(order_id)) {
      console.warn(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
      if (!ENABLE_MOCK_BOOKINGS) {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID. Use a real order ID from finishOrder() response.`);
      } else {
        console.log(`🎭 [MOCK MODE ENABLED] Returning mock response for testing only`);
        // Return mock booking data
        return {
          bookings: [generateMockOrderInfo(order_id)],
          total: 1
        };
      }
    }

    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📋 ETG retrieveBookings: ${order_id ? `order_id=${order_id}` : 'list all bookings'} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    const payload = {};
    
    if (order_id) {
      payload.order_id = order_id;
    }
    
    // Add filters if provided
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
    if (filters.status) payload.status = filters.status;

    // Use ETG API endpoint for retrieving bookings
    // Based on ETG API structure, this is typically /hotel/order/bookings/ or /hotel/order/retrieve/
    const response = await apiClient.post('/hotel/order/bookings/', payload, {
      timeout: TIMEOUTS.orderInfo
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Bookings retrieved successfully`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Retrieve bookings failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Retrieve bookings');
    console.error('❌ ETG retrieveBookings error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw formattedError;
  }
}

/**
 * Get booking documents (voucher, confirmation, etc.)
 * @param {string} order_id - Order ID
 * @returns {Promise<Object>} - Booking documents
 */
export async function getOrderDocuments(order_id) {
  const endpoint = '/hotel/order/document/voucher/download/'; // Using voucher download endpoint

  try {
    // Check for fake order IDs (frontend simulation) - log warning but don't mock
    if (isFakeOrderId(order_id)) {
      console.warn(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
      if (!ENABLE_MOCK_BOOKINGS) {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID. Use a real order ID from finishOrder() response.`);
      } else {
        console.log(`🎭 [MOCK MODE ENABLED] Returning mock response for testing only`);
        return generateMockOrderDocuments(order_id);
      }
    }

    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`📑 ETG getOrderDocuments: order_id=${order_id} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    // Use correct ETG API v3 endpoint
    // Based on certification checklist, documents may use /voucher/ endpoint
    // Try /hotel/order/documents/ first, then fallback to /voucher/
    let response;
    try {
      response = await apiClient.post('/hotel/order/documents/', {
        order_id
      }, {
        timeout: TIMEOUTS.orderDocuments
      });
    } catch (firstError) {
      // Fallback: Try /voucher/ endpoint if documents endpoint doesn't exist
      if (firstError.response?.status === 404) {
        console.log(`⚠️ /hotel/order/documents/ returned 404, trying /voucher/`);
        response = await apiClient.post('/voucher/', {
          order_id
        }, {
          timeout: TIMEOUTS.orderDocuments
        });
      } else {
        throw firstError;
      }
    }

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Order documents retrieved successfully`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Get order documents failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order documents');
    console.error('❌ ETG getOrderDocuments error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
      console.error('   Endpoint attempted:', error.config?.url || 'unknown');
    }
    throw formattedError;
  }
}

export default {
  prebookRate,
  getOrderForm,
  finishOrder,
  getOrderStatus,
  getOrderInfo,
  getOrderDocuments,
  retrieveBookings
};

