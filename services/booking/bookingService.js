/**
 * Booking Service
 * Handles RateHawk API v3 booking and order management operations
 */

import { createAxiosWithRetry } from '../../middleware/retryHandler.js';
import { categorizeError } from '../../utils/errorHandler.js';

// ETG API Configuration
const ETG_BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const ETG_PARTNER_ID = process.env.ETG_PARTNER_ID || '11606';
const ETG_API_KEY = process.env.ETG_API_KEY;

if (!ETG_API_KEY) {
  console.warn('⚠️ ETG_API_KEY not set - Booking API calls will fail');
}

// Development mode configuration
const ENABLE_MOCK_BOOKINGS = process.env.ENABLE_MOCK_BOOKINGS === 'true' || process.env.NODE_ENV === 'development';

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
 * @param {string} book_hash - Rate hash from hotel details
 * @param {string} residency - Residency code (e.g., 'us', 'en-us')
 * @param {string} currency - Currency code (e.g., 'USD')
 * @returns {Promise<Object>} - Prebook response with booking_hash
 */
export async function prebookRate(book_hash, residency = 'us', currency = 'USD') {
  try {
    console.log(`🔒 ETG prebookRate: book_hash=${book_hash?.substring(0, 20)}...`);

    const response = await apiClient.post('/hotel/order/prebook/', {
      book_hash,
      residency,
      currency
    }, {
      timeout: TIMEOUTS.prebook
    });

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Prebook successful: booking_hash=${response.data.data?.booking_hash?.substring(0, 20)}...`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Prebook failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Prebook rate');
    console.error('❌ ETG prebookRate error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw formattedError;
  }
}

/**
 * Get booking form fields (required guest information)
 * @param {string} booking_hash - Booking hash from prebook
 * @param {string} language - Language code (default: en)
 * @param {string} user_ip - User IP address
 * @param {string} partner_order_id - Partner's unique order ID
 * @returns {Promise<Object>} - Booking form with required fields
 */
export async function getOrderForm(booking_hash, language = 'en', user_ip = '127.0.0.1', partner_order_id = null) {
  try {
    console.log(`📋 ETG getOrderForm: booking_hash=${booking_hash?.substring(0, 20)}...`);

    const payload = {
      booking_hash,
      language,
      user_ip
    };

    if (partner_order_id) {
      payload.partner_order_id = partner_order_id;
    }

    const response = await apiClient.post('/hotel/order/booking/form/', payload, {
      timeout: TIMEOUTS.orderForm
    });

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Order form retrieved successfully`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Get order form failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order form');
    console.error('❌ ETG getOrderForm error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw formattedError;
  }
}

/**
 * Finish/complete the booking
 * @param {string} booking_hash - Booking hash from prebook
 * @param {Array} guests - Guest information array
 * @param {string} payment_type - Payment type (e.g., 'card', 'pay_at_hotel')
 * @param {string} partner_order_id - Partner's unique order ID
 * @param {string} language - Language code (default: en)
 * @returns {Promise<Object>} - Order completion response with order_id
 */
export async function finishOrder(booking_hash, guests, payment_type, partner_order_id, language = 'en') {
  try {
    console.log(`✅ ETG finishOrder: booking_hash=${booking_hash?.substring(0, 20)}...`);

    const response = await apiClient.post('/hotel/order/finish/', {
      booking_hash,
      guests,
      payment_type,
      partner_order_id,
      language
    }, {
      timeout: TIMEOUTS.orderFinish
    });

    if (response.data && response.data.status === 'ok') {
      console.log(`✅ Order finished successfully: order_id=${response.data.data?.order_id}`);
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Finish order failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Finish order');
    console.error('❌ ETG finishOrder error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
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
  try {
    console.log(`📊 ETG getOrderStatus: order_id=${order_id}`);

    // Check for fake order IDs (frontend simulation)
    if (isFakeOrderId(order_id)) {
      if (ENABLE_MOCK_BOOKINGS) {
        console.log(`🎭 [MOCK MODE] Detected fake order ID: ${order_id} - Returning mock response`);
        return generateMockOrderStatus(order_id);
      } else {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID.`);
      }
    }

    // Try the correct ETG API endpoint based on documentation structure
    // ETG API v3 uses /bookings/ endpoint for post-booking operations
    let response;
    try {
      // First try: /bookings/ endpoint (POST with order_id in body)
      response = await apiClient.post('/bookings/', {
        order_id
      }, {
        timeout: TIMEOUTS.orderStatus
      });
    } catch (firstError) {
      // Fallback: Try /hotel/order/status without trailing slash
      if (firstError.response?.status === 404) {
        console.log(`⚠️ /bookings/ endpoint returned 404, trying /hotel/order/status`);
        response = await apiClient.post('/hotel/order/status', {
          order_id
        }, {
          timeout: TIMEOUTS.orderStatus
        });
      } else {
        throw firstError;
      }
    }

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
  try {
    console.log(`📄 ETG getOrderInfo: order_id=${order_id}`);

    // Check for fake order IDs (frontend simulation)
    if (isFakeOrderId(order_id)) {
      if (ENABLE_MOCK_BOOKINGS) {
        console.log(`🎭 [MOCK MODE] Detected fake order ID: ${order_id} - Returning mock response`);
        return generateMockOrderInfo(order_id);
      } else {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID.`);
      }
    }

    // Try the correct ETG API endpoint
    let response;
    try {
      // First try: /bookings/ endpoint with order_id
      response = await apiClient.post('/bookings/', {
        order_id
      }, {
        timeout: TIMEOUTS.orderInfo
      });
    } catch (firstError) {
      // Fallback: Try /hotel/order/info without trailing slash
      if (firstError.response?.status === 404) {
        console.log(`⚠️ /bookings/ endpoint returned 404, trying /hotel/order/info`);
        response = await apiClient.post('/hotel/order/info', {
          order_id
        }, {
          timeout: TIMEOUTS.orderInfo
        });
      } else {
        throw firstError;
      }
    }

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
 * Get booking documents (voucher, confirmation, etc.)
 * @param {string} order_id - Order ID
 * @returns {Promise<Object>} - Booking documents
 */
export async function getOrderDocuments(order_id) {
  try {
    console.log(`📑 ETG getOrderDocuments: order_id=${order_id}`);

    // Check for fake order IDs (frontend simulation)
    if (isFakeOrderId(order_id)) {
      if (ENABLE_MOCK_BOOKINGS) {
        console.log(`🎭 [MOCK MODE] Detected fake order ID: ${order_id} - Returning mock response`);
        return generateMockOrderDocuments(order_id);
      } else {
        throw new Error(`Invalid order ID format: ${order_id}. This appears to be a simulated/test order ID.`);
      }
    }

    // Try the correct ETG API endpoint
    // Documents may use /voucher/ or /invoice/ endpoints
    let response;
    try {
      // First try: /bookings/ endpoint
      response = await apiClient.post('/bookings/', {
        order_id
      }, {
        timeout: TIMEOUTS.orderDocuments
      });
    } catch (firstError) {
      // Fallback 1: Try /hotel/order/documents without trailing slash
      if (firstError.response?.status === 404) {
        try {
          console.log(`⚠️ /bookings/ endpoint returned 404, trying /hotel/order/documents`);
          response = await apiClient.post('/hotel/order/documents', {
            order_id
          }, {
            timeout: TIMEOUTS.orderDocuments
          });
        } catch (secondError) {
          // Fallback 2: Try /voucher/ endpoint
          if (secondError.response?.status === 404) {
            console.log(`⚠️ /hotel/order/documents returned 404, trying /voucher/`);
            response = await apiClient.post('/voucher/', {
              order_id
            }, {
              timeout: TIMEOUTS.orderDocuments
            });
          } else {
            throw secondError;
          }
        }
      } else {
        throw firstError;
      }
    }

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
  getOrderDocuments
};

