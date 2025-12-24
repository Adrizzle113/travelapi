/**
 * Mapbox POI Routes
 * Uses Mapbox Geocoding API to fetch nearby places
 * Free tier: 100,000 requests/month
 */

import express from "express";
import axios from "axios";

const router = express.Router();

// ================================
// MAPBOX POI ENDPOINT
// ================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

/**
 * Format distance for display
 */
function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Fetch places from Mapbox by category
 */
async function fetchMapboxPlaces(lat, lon, query, limit = 10) {
  try {
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
      {
        params: {
          proximity: `${lon},${lat}`, // Mapbox uses lon,lat order
          limit: limit,
          access_token: process.env.MAPBOX_TOKEN,
          types: 'poi', // Point of interest
        }
      }
    );

    return response.data.features || [];
  } catch (error) {
    console.error(`❌ Mapbox fetch error for ${query}:`, error.message);
    return [];
  }
}

/**
 * Fetch specific place types from Mapbox
 */
async function fetchMapboxByType(lat, lon, types, limit = 10) {
  try {
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json`,
      {
        params: {
          limit: limit,
          access_token: process.env.MAPBOX_TOKEN,
          types: types, // e.g., 'poi.airport', 'poi'
        }
      }
    );

    return response.data.features || [];
  } catch (error) {
    console.error(`❌ Mapbox fetch error for type ${types}:`, error.message);
    return [];
  }
}

/**
 * Transform Mapbox result to our format
 */
function transformMapboxResult(feature, hotelLat, hotelLon) {
  const [placeLon, placeLat] = feature.center;
  const distance = calculateDistance(hotelLat, hotelLon, placeLat, placeLon);
  
  return {
    name: feature.text || feature.place_name,
    distance: formatDistance(distance),
    type: feature.place_type?.[0] || 'poi',
    subtype: feature.properties?.category || 'general',
    distanceKm: distance, // For sorting
  };
}

/**
 * Categorize place based on Mapbox data
 */
function categorizePlaceType(feature) {
  const categories = feature.properties?.category?.split(',').map(c => c.trim().toLowerCase()) || [];
  const placeType = feature.place_type?.[0]?.toLowerCase() || '';
  const name = (feature.text || '').toLowerCase();
  
  // Airport
  if (categories.includes('airport') || placeType.includes('airport') || name.includes('airport')) {
    return 'airport';
  }
  
  // Subway/Metro
  if (
    categories.includes('subway') || 
    categories.includes('metro') || 
    categories.includes('train station') ||
    name.includes('subway') ||
    name.includes('metro') ||
    name.includes('station')
  ) {
    return 'subway';
  }
  
  // Places of Interest (museums, landmarks, attractions)
  if (
    categories.includes('museum') ||
    categories.includes('landmark') ||
    categories.includes('monument') ||
    categories.includes('park') ||
    categories.includes('gallery') ||
    categories.includes('attraction') ||
    categories.includes('historic') ||
    categories.includes('theater') ||
    categories.includes('art')
  ) {
    return 'placesOfInterest';
  }
  
  // Everything else goes to "nearby"
  return 'nearby';
}

/**
 * GET /api/ratehawk/hotel/:hotelId/poi
 * Fetch POI data using Mapbox
 */
router.get("/hotel/:hotelId/poi", async (req, res) => {
  const startTime = Date.now();
  const { hotelId } = req.params;

  console.log("📍 === MAPBOX POI REQUEST ===");
  console.log(`🏨 Hotel ID: ${hotelId}`);

  try {
    // Check for Mapbox token
    if (!process.env.MAPBOX_TOKEN) {
      return res.status(500).json({
        success: false,
        error: "Mapbox token not configured",
        timestamp: new Date().toISOString(),
      });
    }

    // Get hotel coordinates from static info endpoint
    // You'll need to implement this or get coordinates from your hotel data
    const hotelResponse = await axios.post(
      `http://localhost:${process.env.PORT || 3001}/api/ratehawk/hotel/static-info`,
      { hotelId }
    );

    if (!hotelResponse.data?.success || !hotelResponse.data?.data?.coordinates) {
      return res.status(404).json({
        success: false,
        error: "Hotel coordinates not found",
        timestamp: new Date().toISOString(),
      });
    }

    const { latitude, longitude } = hotelResponse.data.data.coordinates;
    console.log(`📍 Hotel coordinates: ${latitude}, ${longitude}`);

    // Fetch different categories in parallel
    const [
      generalResults,
      restaurantResults,
      attractionResults,
      airportResults,
      transitResults,
    ] = await Promise.all([
      fetchMapboxPlaces(latitude, longitude, "shopping", 10),
      fetchMapboxPlaces(latitude, longitude, "restaurant", 10),
      fetchMapboxPlaces(latitude, longitude, "museum", 10),
      fetchMapboxPlaces(latitude, longitude, "airport", 5),
      fetchMapboxPlaces(latitude, longitude, "subway station", 10),
    ]);

    console.log(`📊 Fetched results:`);
    console.log(`   General: ${generalResults.length}`);
    console.log(`   Restaurants: ${restaurantResults.length}`);
    console.log(`   Attractions: ${attractionResults.length}`);
    console.log(`   Airports: ${airportResults.length}`);
    console.log(`   Transit: ${transitResults.length}`);

    // Combine and transform all results
    const allResults = [
      ...generalResults,
      ...restaurantResults,
      ...attractionResults,
      ...airportResults,
      ...transitResults,
    ];

    // Remove duplicates (same coordinates)
    const uniqueResults = [];
    const seenCoordinates = new Set();
    
    for (const result of allResults) {
      const coordKey = `${result.center[0]},${result.center[1]}`;
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        uniqueResults.push(result);
      }
    }

    console.log(`📊 Unique places: ${uniqueResults.length}`);

    // Transform and categorize
    const categorized = {
      nearby: [],
      placesOfInterest: [],
      airports: [],
      subways: [],
    };

    for (const feature of uniqueResults) {
      const place = transformMapboxResult(feature, latitude, longitude);
      const category = categorizePlaceType(feature);
      
      if (category === 'airport') {
        categorized.airports.push(place);
      } else if (category === 'subway') {
        categorized.subways.push(place);
      } else if (category === 'placesOfInterest') {
        categorized.placesOfInterest.push(place);
      } else {
        categorized.nearby.push(place);
      }
    }

    // Sort by distance and limit
    categorized.nearby.sort((a, b) => a.distanceKm - b.distanceKm);
    categorized.placesOfInterest.sort((a, b) => a.distanceKm - b.distanceKm);
    categorized.airports.sort((a, b) => a.distanceKm - b.distanceKm);
    categorized.subways.sort((a, b) => a.distanceKm - b.distanceKm);

    categorized.nearby = categorized.nearby.slice(0, 10);
    categorized.placesOfInterest = categorized.placesOfInterest.slice(0, 10);
    categorized.airports = categorized.airports.slice(0, 5);
    categorized.subways = categorized.subways.slice(0, 10);

    // Remove distanceKm (used for sorting only)
    const cleanCategories = {};
    for (const [key, places] of Object.entries(categorized)) {
      cleanCategories[key] = places.map(({ distanceKm, ...rest }) => rest);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ POI data retrieved in ${duration}ms`);
    console.log(`   Nearby: ${cleanCategories.nearby.length}`);
    console.log(`   Places of Interest: ${cleanCategories.placesOfInterest.length}`);
    console.log(`   Airports: ${cleanCategories.airports.length}`);
    console.log(`   Subways: ${cleanCategories.subways.length}`);

    res.json({
      success: true,
      data: cleanCategories,
      metadata: {
        hotelId,
        poisFound: uniqueResults.length,
        source: "Mapbox Geocoding API",
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 POI fetch error:", error.message);

    res.status(500).json({
      success: false,
      error: `Failed to fetch POI data: ${error.message}`,
      hotelId,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

export default router;