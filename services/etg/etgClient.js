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
  timeout: 120000 // 2 minutes for hotel searches
});

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
    console.error('❌ ETG searchHotels error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw new Error(`ETG search failed: ${error.message}`);
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
    console.error('❌ ETG getHotelInfo error:', error.message);
    throw error;
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
    console.error('❌ ETG getHotelPage error:', error.message);
    throw error;
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