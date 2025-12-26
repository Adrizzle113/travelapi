/**
 * ETG API Client - Corrected Version
 * Uses actual ETG API v3 endpoints
 * Base URL: https://api.worldota.net
 * Authentication: HTTP Basic Auth
 */

import axios from 'axios';

// ETG API Configuration
const ETG_BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const ETG_KEY_ID = process.env.ETG_PARTNER_ID || '11606';
const ETG_API_KEY = process.env.ETG_API_KEY || 'ff9702bb-ba93-4996-a31e-547983c51530';

// Create axios instance with Basic Auth
const etgClient = axios.create({
  baseURL: ETG_BASE_URL,
  auth: {
    username: ETG_KEY_ID,
    password: ETG_API_KEY
  },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

/**
 * Search for hotels by region
 * @param {Object} searchParams
 * @returns {Promise<Object>} - Search results
 */
export async function searchHotels(searchParams) {
  const {
    region_id,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    currency = 'USD',
    language = 'en',
    residency = 'us'
  } = searchParams;

  console.log(`🔍 ETG Search: region_id=${region_id}, ${checkin} → ${checkout}`);

  try {
    const response = await etgClient.post('/search/serp/region/', {
      checkin,
      checkout,
      residency,
      language,
      guests,
      region_id,
      currency
    });

    const hotels = response.data.data?.hotels || [];
    
    console.log(`✅ ETG Search complete: ${hotels.length} hotels found`);

    return {
      search_id: response.data.data?.search_id,
      hotels: hotels,
      region_id,
      total_hotels: response.data.data?.total_hotels || hotels.length,
      currency,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ ETG Search failed:', error.response?.data || error.message);
    
    throw new Error(`ETG Search failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get detailed hotel static information
 * @param {string} hotel_id - ETG hotel ID
 * @param {string} language - Language code
 * @returns {Promise<Object>} - Hotel details
 */
export async function getHotelInfo(hotel_id, language = 'en') {
  console.log(`🏨 Fetching hotel info: ${hotel_id} (${language})`);

  try {
    const response = await etgClient.post('/hotel/info/static/', {
      ids: [hotel_id],
      language
    });

    const hotelData = response.data.data?.[hotel_id];

    if (!hotelData) {
      throw new Error(`Hotel ${hotel_id} not found`);
    }

    console.log(`✅ Hotel info retrieved: ${hotelData.name || hotel_id}`);

    return {
      hotel_id,
      name: hotelData.name,
      address: hotelData.address,
      city: hotelData.city?.name,
      country: hotelData.country?.name,
      star_rating: hotelData.star_rating,
      images: hotelData.images || [],
      amenities: hotelData.amenity_groups || [],
      description: hotelData.description_struct,
      coordinates: hotelData.coordinates,
      ...hotelData
    };

  } catch (error) {
    console.error(`❌ Failed to get hotel info for ${hotel_id}:`, error.response?.data || error.message);
    throw new Error(`Hotel info fetch failed: ${error.message}`);
  }
}

/**
 * Get hotel page with rates
 * @param {string} hotel_id - Hotel ID
 * @param {Object} searchParams - Search parameters
 * @returns {Promise<Object>} - Hotel page with rates
 */
export async function getHotelPage(hotel_id, searchParams) {
  const {
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    currency = 'USD',
    language = 'en',
    residency = 'us'
  } = searchParams;

  console.log(`💰 Fetching hotel page: ${hotel_id}`);

  try {
    const response = await etgClient.post('/hotel/info/hotelpage/', {
      id: hotel_id,
      checkin,
      checkout,
      residency,
      language,
      guests,
      currency
    });

    console.log(`✅ Hotel page retrieved for ${hotel_id}`);

    return response.data.data;

  } catch (error) {
    console.error(`❌ Failed to get hotel page for ${hotel_id}:`, error.response?.data || error.message);
    throw new Error(`Hotel page fetch failed: ${error.message}`);
  }
}

export default {
  searchHotels,
  getHotelInfo,
  getHotelPage
};