/**
 * ETG (Emerging Travel Group) API Client
 * Handles all communication with WorldOTA/ETG API
 * Enhanced with retry logic and optimized timeouts
 */

import { createAxiosWithRetry } from '../../middleware/retryHandler.js';
import { categorizeError } from '../../utils/errorHandler.js';
import { checkRateLimit, recordRequest, waitForRateLimit } from './etgRateLimiter.js';

// ETG API Configuration
const ETG_BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const ETG_PARTNER_ID = process.env.ETG_PARTNER_ID || '11606';
const ETG_API_KEY = process.env.ETG_API_KEY;

if (!ETG_API_KEY) {
  console.warn('⚠️ ETG_API_KEY not set - API calls will fail');
}

// Timeout configurations optimized for different operations
const TIMEOUTS = {
  search: 30000,
  hotelInfo: 15000,
  hotelPage: 20000,
  autocomplete: 8000,
  prebook: 20000,
  orderForm: 15000,
  orderFinish: 30000,
  orderStatus: 10000,
  orderInfo: 15000,
  orderDocuments: 15000,
  default: 25000
};

// Create axios instance with auth and retry logic
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
  maxRetries: 3
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

      if (errorMessage && (
        errorMessage.toLowerCase().includes('date') ||
        errorMessage.toLowerCase().includes('checkin') ||
        errorMessage.toLowerCase().includes('checkout')
      )) {
        enhancedError.message = `${operation} failed - Invalid date: ${errorMessage}. Dates must be in the future (format: YYYY-MM-DD)`;
        enhancedError.category = 'validation_error';
      } else {
        enhancedError.message = `${operation} failed - Invalid request: ${errorMessage}`;
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
 * Search hotels by region
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with hotels
 */
export async function searchHotels(params) {
  const { region_id, checkin, checkout, guests, currency = 'USD', residency = 'us' } = params;

  const endpoint = '/search/serp/region/';

  try {
    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`🔍 ETG searchHotels: region_id=${region_id}, ${checkin} → ${checkout} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    const response = await apiClient.post(endpoint, {
      region_id,
      checkin,
      checkout,
      residency,
      language: 'en',
      guests,
      currency
    }, {
      timeout: TIMEOUTS.search
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const hotels = response.data.data?.hotels || [];
      console.log(`✅ ETG Search complete: ${hotels.length} hotels found`);

      return {
        hotels,
        search_id: response.data.data?.search_id,
        total_hotels: hotels.length
      };
    }

    console.warn('⚠️ ETG returned non-ok status:', response.data?.status);
    return { hotels: [], total_hotels: 0 };

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Hotel search');
    console.error('❌ ETG searchHotels error:', formattedError.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw formattedError;
  }
}

/**
 * Get static hotel information
 * @param {string} hotelId - Hotel ID
 * @param {string} language - Language code (default: en)
 * @returns {Promise<Object>} - Hotel static data
 */
export async function getHotelInformation(hotelId, language = 'en') {
  const endpoint = '/hotel/static/';

  export async function getHotelInformation(hotelId, language = 'en') {
    const endpoint = '/hotel/static/';  // ✅ CORRECT!
  
    try {
      const rateLimitCheck = checkRateLimit(endpoint);
      if (!rateLimitCheck.allowed) {
        console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
        await waitForRateLimit(endpoint);
      }
  
      console.log(`🏨 ETG getHotelInfo: ${hotelId} (${rateLimitCheck.remaining || '?'} requests remaining)`);
  
      const response = await apiClient.post('/hotel/static/', {  // ✅ CORRECT!
        ids: [hotelId],  // ✅ CORRECT - plural "ids" and array format
        language
      }, {
        timeout: TIMEOUTS.hotelInfo
      });
  
      recordRequest(endpoint);
  
      if (response.data && response.data.status === 'ok') {
        return response.data.data;
      }
  
      throw new Error('Hotel info not found');
  
    } catch (error) {
      const formattedError = formatAxiosError(error, 'Get hotel info');
      console.error('❌ ETG getHotelInfo error:', formattedError.message);
      throw formattedError;
    }
  }

/**
 * Get hotel page with rates
 * @param {string} hotelId - Hotel ID
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Hotel page data with rates
 */
export async function getHotelPage(hotelId, params) {
  const { checkin, checkout, guests, currency = 'USD', residency = 'US', language = 'en' } = params;
  const endpoint = '/search/hp/'; // ✅ Changed from /hotel/info/ to /search/hp/ for bookable rates

  try {
    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`🏨 ETG getHotelPage: ${hotelId} (${rateLimitCheck.remaining || '?'} requests remaining)`);

    // ✅ Use /search/hp/ endpoint with correct parameters (id field, uppercase residency)
    const normalizedResidency = (residency || 'US').toUpperCase();
    const response = await apiClient.post('/search/hp/', {
      id: hotelId,        // ✅ Changed from hotel_id to id
      checkin,
      checkout,
      residency: normalizedResidency,  // ✅ Uppercase for /search/hp/
      language,
      guests,
      currency
    }, {
      timeout: TIMEOUTS.hotelPage
    });

    // Record successful request (using search/hp endpoint for rate limiting)
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      return response.data.data;
    }

    throw new Error('Hotel page not found');

  } catch (error) {
    const formattedError = formatAxiosError(error, 'Get hotel page');
    console.error('❌ ETG getHotelPage error:', formattedError.message);
    throw formattedError;
  }
}

/**
 * Search for regions/destinations (autocomplete)
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of matching regions
 */
export async function searchRegions(query) {
  const endpoint = '/search/multicomplete/'; // Using multicomplete endpoint based on rate limits

  try {
    // Check and wait for rate limit
    const rateLimitCheck = checkRateLimit(endpoint);
    if (!rateLimitCheck.allowed) {
      console.log(`⏳ Rate limit check: ${rateLimitCheck.remaining} remaining, waiting ${rateLimitCheck.waitTime}s...`);
      await waitForRateLimit(endpoint);
    }

    console.log(`🔍 ETG searchRegions: "${query}" (${rateLimitCheck.remaining || '?'} requests remaining)`);

    const response = await apiClient.post('/search/serp/suggest/', {
      query: query,
      language: 'en'
    }, {
      timeout: TIMEOUTS.autocomplete
    });

    // Record successful request
    recordRequest(endpoint);

    if (response.data && response.data.status === 'ok') {
      const regions = response.data.data?.regions || [];
      console.log(`✅ Found ${regions.length} regions for: ${query}`);
      return regions;
    }

    console.warn('⚠️ No regions found for:', query);
    return [];

  } catch (error) {
    console.error('❌ ETG searchRegions error:', error.message);
    return [];
  }
}

export default {
  searchHotels,
  getHotelInformation,
  getHotelPage,
  searchRegions
};