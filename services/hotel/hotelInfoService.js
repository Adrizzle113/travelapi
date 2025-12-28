/**
 * Hotel Info Service with Caching
 * Manages hotel static data with 7-day cache TTL
 */

import { PrismaClient } from '@prisma/client';
import { getHotelInformation as fetchHotelInfoFromETG } from '../etg/etgClient.js';

const prisma = new PrismaClient();

// Cache TTL: 7 days for static hotel info
const HOTEL_INFO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Get hotel information with caching
 * @param {string} hotel_id - ETG hotel ID
 * @param {string} language - Language code
 * @returns {Promise<Object>} - Hotel information
 */
export async function getHotelInformation(hotel_id, language = 'en') {
  const startTime = Date.now();

  try {
    // Check cache first
    const cached = await getFromCache(hotel_id, language);
    if (cached) {
      console.log(`✅ Hotel cache HIT: ${hotel_id} (${language}) - ${Date.now() - startTime}ms`);
      return {
        ...cached,
        from_cache: true,
        cache_age_days: Math.floor((Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60 * 24))
      };
    }

    console.log(`⚠️ Hotel cache MISS: ${hotel_id} - calling ETG API`);

    // Fetch from ETG API (note: using the aliased import)
    const hotelData = await fetchHotelInfoFromETG(hotel_id, language);

    // Cache the result
    await saveToCache(hotel_id, language, hotelData);

    console.log(`✅ Hotel info retrieved: ${hotelData.name || hotel_id} (${Date.now() - startTime}ms)`);

    return {
      ...hotelData,
      from_cache: false
    };

  } catch (error) {
    console.error(`❌ Failed to get hotel info for ${hotel_id}:`, error);
    throw error;
  }
}

/**
 * Get hotel info from cache
 */
async function getFromCache(hotel_id, language) {
  try {
    const cached = await prisma.hotelStaticCache.findUnique({
      where: {
        hotel_id_language: {
          hotel_id,
          language
        }
      }
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date(cached.expires_at) < new Date()) {
      console.log(`🗑️ Hotel cache expired: ${hotel_id}`);
      await prisma.hotelStaticCache.delete({
        where: { id: cached.id }
      });
      return null;
    }

    return {
      hotel_id: cached.hotel_id,
      name: cached.name,
      address: cached.address,
      city: cached.city,
      country: cached.country,
      star_rating: cached.star_rating,
      images: cached.images,
      amenities: cached.amenities,
      description: cached.description,
      coordinates: cached.coordinates,
      cached_at: cached.cached_at
    };

  } catch (error) {
    console.error('Hotel cache read error:', error);
    return null;
  }
}

/**
 * Save hotel info to cache
 */
async function saveToCache(hotel_id, language, hotelData) {
  try {
    await prisma.hotelStaticCache.upsert({
      where: {
        hotel_id_language: {
          hotel_id,
          language
        }
      },
      update: {
        name: hotelData.name,
        address: hotelData.address,
        city: hotelData.city,
        country: hotelData.country,
        star_rating: hotelData.star_rating,
        images: hotelData.images || [],
        amenities: hotelData.amenities || [],
        description: hotelData.description,
        coordinates: hotelData.coordinates,
        raw_data: hotelData,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + HOTEL_INFO_CACHE_TTL)
      },
      create: {
        hotel_id,
        language,
        name: hotelData.name,
        address: hotelData.address,
        city: hotelData.city,
        country: hotelData.country,
        star_rating: hotelData.star_rating,
        images: hotelData.images || [],
        amenities: hotelData.amenities || [],
        description: hotelData.description,
        coordinates: hotelData.coordinates,
        raw_data: hotelData,
        expires_at: new Date(Date.now() + HOTEL_INFO_CACHE_TTL)
      }
    });

    console.log(`💾 Cached hotel: ${hotel_id} (${language}, TTL: 7 days)`);

  } catch (error) {
    console.error('Hotel cache write error:', error);
  }
}

export default {
  getHotelInformation
};