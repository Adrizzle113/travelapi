/**
 * RateHawk Helper Functions
 * Shared utilities for parsing and transforming RateHawk API responses
 */

import axios from "axios";

// ================================
// STATIC INFO HELPERS
// ================================

/**
 * Extract description from RateHawk's description_struct format
 * Combines all paragraphs into a single text
 */
export function extractDescription(descriptionStruct) {
  if (!descriptionStruct || !Array.isArray(descriptionStruct)) {
    return null;
  }
  
  const sections = descriptionStruct
    .map(section => {
      if (section.paragraphs && Array.isArray(section.paragraphs)) {
        return section.paragraphs.join(' ');
      }
      return '';
    })
    .filter(Boolean);
  
  return sections.length > 0 ? sections.join(' ') : null;
}

/**
 * Extract amenities from amenity_groups format
 * Returns flat array of all amenity names
 */
export function extractAmenities(amenityGroups) {
  if (!amenityGroups || !Array.isArray(amenityGroups)) {
    return [];
  }
  
  const allAmenities = [];
  amenityGroups.forEach(group => {
    if (group.amenities && Array.isArray(group.amenities)) {
      allAmenities.push(...group.amenities);
    }
  });
  
  return allAmenities;
}

/**
 * Extract policies from policy_struct format
 * Returns array of policy objects with title and content
 */
export function extractPolicies(policyStruct) {
  if (!policyStruct || !Array.isArray(policyStruct)) {
    return [];
  }
  
  const policies = policyStruct.map(policy => {
    if (policy.title && policy.paragraphs) {
      return {
        title: policy.title,
        content: Array.isArray(policy.paragraphs) 
          ? policy.paragraphs.join(' ') 
          : String(policy.paragraphs)
      };
    }
    return null;
  }).filter(Boolean);
  
  return policies;
}

// ================================
// POI HELPERS
// ================================

// POI cache (shared across all POI requests)
let poiCache = null;
let poiCacheTime = null;
const POI_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get POI cache
 */
export function getPOICache() {
  return { data: poiCache, time: poiCacheTime };
}

/**
 * Check if POI cache needs refresh
 */
export function needsPOIRefresh() {
  const now = Date.now();
  return !poiCache || !poiCacheTime || (now - poiCacheTime) > POI_CACHE_DURATION;
}

/**
 * Refresh POI cache from RateHawk API
 */
export async function refreshPOICache(credentials) {
  try {
    console.log("🔍 Fetching POI dump from RateHawk...");
    
    // Call RateHawk POI dump endpoint
    const response = await axios.post(
      "https://api.worldota.net/api/b2b/v3/hotel/poi/dump/",
      {
        language: "en"
      },
      {
        auth: credentials,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data || !response.data.data || !response.data.data.url) {
      throw new Error("POI dump URL not returned from API");
    }

    const dumpUrl = response.data.data.url;
    console.log(`📥 Downloading POI dump from: ${dumpUrl}`);

    // Download the dump file
    const dumpResponse = await axios.get(dumpUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout for large file
    });

    // Try parsing as JSON
    let poiData;
    try {
      const textData = Buffer.from(dumpResponse.data).toString('utf-8');
      poiData = JSON.parse(textData);
    } catch (parseError) {
      console.log("⚠️ POI dump appears to be compressed");
      console.log("📝 Note: For compressed dumps, install 'zstd' package:");
      console.log("   npm install @mongodb-js/zstd");
      
      // For now, return empty cache
      poiCache = [];
      poiCacheTime = Date.now();
      return;
    }

    // Store in cache
    poiCache = Array.isArray(poiData) ? poiData : [];
    poiCacheTime = Date.now();
    
    console.log(`✅ POI cache refreshed with ${poiCache.length} hotels`);

  } catch (error) {
    console.error("💥 Error refreshing POI cache:", error.message);
    
    // If we have no cache, initialize empty
    if (!poiCache) {
      poiCache = [];
      poiCacheTime = Date.now();
    }
    
    throw error;
  }
}

/**
 * Transform POI data into categorized format
 */
export function transformPOIData(pois) {
  const result = {
    nearby: [],
    airports: [],
    subways: [],
    placesOfInterest: [],
  };

  pois.forEach(poi => {
    const distanceKm = (poi.distance / 1000).toFixed(1);
    const distanceM = poi.distance;
    
    const item = {
      name: poi.poi_name_en || poi.poi_name,
      distance: poi.distance < 1000 ? `${distanceM} m` : `${distanceKm} km`,
      type: poi.poi_type,
      subtype: poi.poi_subtype,
    };

    // Categorize POIs
    if (poi.poi_type === 'Airport') {
      result.airports.push(item);
    } 
    else if (poi.poi_type === 'Subway (Entrace)') {
      result.subways.push(item);
    }
    else if (poi.poi_type === 'Point of Interest') {
      const specialSubtypes = ['museum', 'historical_poi', 'park', 'theater', 'beach', 'shopping'];
      if (specialSubtypes.includes(poi.poi_subtype)) {
        result.placesOfInterest.push(item);
      } else {
        result.nearby.push(item);
      }
    }
    else {
      result.nearby.push(item);
    }
  });

  // Sort by distance
  const sortByDistance = (a, b) => {
    const distA = parseFloat(a.distance);
    const distB = parseFloat(b.distance);
    return distA - distB;
  };

  result.nearby.sort(sortByDistance);
  result.airports.sort(sortByDistance);
  result.subways.sort(sortByDistance);
  result.placesOfInterest.sort(sortByDistance);

  // Limit results
  result.nearby = result.nearby.slice(0, 10);
  result.airports = result.airports.slice(0, 5);
  result.subways = result.subways.slice(0, 10);
  result.placesOfInterest = result.placesOfInterest.slice(0, 10);

  return result;
}