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

    const response = await apiClient.post('/hotel/order/status/', {
      order_id
    }, {
      timeout: TIMEOUTS.orderStatus
    });

    if (response.data && response.data.status === 'ok') {
      return response.data.data;
    }

    throw new Error(response.data?.error?.message || 'Get order status failed');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get order status');
    console.error('❌ ETG getOrderStatus error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
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

    const response = await apiClient.post('/hotel/order/info/', {
      order_id
    }, {
      timeout: TIMEOUTS.orderInfo
    });

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

    const response = await apiClient.post('/hotel/order/documents/', {
      order_id
    }, {
      timeout: TIMEOUTS.orderDocuments
    });

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

