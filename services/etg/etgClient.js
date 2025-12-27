/**
 * ETG (Emerging Travel Group) API Client
 * Handles all communication with WorldOTA/ETG API
 */

import axios from 'axios';

// ETG API Configuration
const ETG_BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const ETG_PARTNER_ID = process.env.ETG_PARTNER_ID || '11606';
const ETG_API_KEY = process.env.ETG_API_KEY;

if (!ETG_API_KEY) {
  console.warn('⚠️ ETG_API_KEY not set - API calls will fail');
}

// Create axios instance with auth
const apiClient = axios.create({
  baseURL: ETG_BASE_URL,
  auth: {
    username: ETG_PARTNER_ID,
    password: ETG_API_KEY
  },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 25000
});

function formatAxiosError(error, operation) {
  if (error.code === 'ECONNABORTED') {
    return new Error(`${operation} timed out after 25s - ETG API is responding slowly`);
  }
  if (error.code === 'ETIMEDOUT') {
    return new Error(`${operation} connection timeout - network issue`);
  }
  if (error.response) {
    const status = error.response.status;
    const errorData = error.response.data;

    // Handle 400 Bad Request - often date validation issues
    if (status === 400) {
      const errorMessage = errorData?.message || errorData?.error || error.message;

      // Check for date-related errors
      if (errorMessage && (
        errorMessage.toLowerCase().includes('date') ||
        errorMessage.toLowerCase().includes('checkin') ||
        errorMessage.toLowerCase().includes('checkout')
      )) {
        return new Error(`${operation} failed - Invalid date: ${errorMessage}. Dates must be in the future (format: YYYY-MM-DD)`);
      }

      return new Error(`${operation} failed - Invalid request: ${errorMessage}`);
    }

    if (status === 503 || status === 502) {
      return new Error(`${operation} failed - ETG API temporarily unavailable (${status})`);
    }
    if (status === 429) {
      return new Error(`${operation} failed - rate limit exceeded`);
    }
    return new Error(`${operation} failed with status ${status}: ${errorData?.message || error.message}`);
  }
  if (error.request) {
    return new Error(`${operation} failed - no response from ETG API (network issue)`);
  }
  return new Error(`${operation} failed: ${error.message}`);
}

/**
 * Search hotels by region
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with hotels
 */
export async function searchHotels(params) {
  const { region_id, checkin, checkout, guests, currency = 'USD', residency = 'us' } = params;

  try {
    console.log(`🔍 ETG searchHotels: region_id=${region_id}, ${checkin} → ${checkout}`);

    const response = await apiClient.post('/search/serp/region/', {
      region_id,
      checkin,
      checkout,
      residency,
      language: 'en',
      guests,
      currency
    });

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
  try {
    console.log(`🏨 ETG getHotelInfo: ${hotelId}`);

    const response = await apiClient.post('/hotel/info/static/', {
      hotel_id: hotelId,
      language
    });

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
  const { checkin, checkout, guests, currency = 'USD', residency = 'us', language = 'en' } = params;

  try {
    console.log(`🏨 ETG getHotelPage: ${hotelId}`);

    const response = await apiClient.post('/hotel/info/hotelpage/', {
      hotel_id: hotelId,
      checkin,
      checkout,
      residency,
      language,
      guests,
      currency
    });

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
  try {
    console.log(`🔍 ETG searchRegions: "${query}"`);

    const response = await apiClient.post('/search/serp/suggest/', {
      query: query,
      language: 'en'
    });

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