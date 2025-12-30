/**
 * ETG API Rate Limit Configuration
 * Based on official ETG API endpoint rate limits
 */

export const ETG_RATE_LIMITS = {
  // Closing Documents
  'api/b2b/v3/general/document/closing_documents/download/': {
    requests_number: 100,
    seconds_number: 86400, // 24 hours
    is_limited: true
  },
  'api/b2b/v3/general/document/closing_documents/info/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Custom Dump
  'api/b2b/v3/hotel/custom/dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Incremental Reviews Dump
  'api/b2b/v3/hotel/incremental_reviews/dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Info (most restrictive - 30 per minute)
  'api/b2b/v3/hotel/info/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Info Dump
  'api/b2b/v3/hotel/info/dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Info Incremental Dump
  'api/b2b/v3/hotel/info/incremental_dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Order Booking Finish
  'api/b2b/v3/hotel/order/booking/finish/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Order Booking Finish Status
  'api/b2b/v3/hotel/order/booking/finish/status/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: false
  },

  // Hotel Order Booking Form
  'api/b2b/v3/hotel/order/booking/form/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Order Cancel
  'api/b2b/v3/hotel/order/cancel/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Order Documents
  'api/b2b/v3/hotel/order/document/info_invoice/download/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/hotel/order/document/single_act/download/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/hotel/order/document/voucher/download/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Order Info
  'api/b2b/v3/hotel/order/info/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Order Tickets
  'api/b2b/v3/hotel/order/tickets/create/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/hotel/order/tickets/list/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel POI Dump
  'api/b2b/v3/hotel/poi/dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Prebook
  'api/b2b/v3/hotel/prebook/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Hotel Region Dump
  'api/b2b/v3/hotel/region/dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Reviews Dump
  'api/b2b/v3/hotel/reviews/dump/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Hotel Static
  'api/b2b/v3/hotel/static/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Order Group Document Invoice Download
  'api/b2b/v3/ordergroup/document/invoice/download/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Overview
  'api/b2b/v3/overview/': {
    requests_number: 100,
    seconds_number: 86400,
    is_limited: true
  },

  // Profiles
  'api/b2b/v3/profiles/create/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/profiles/delete/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/profiles/disable/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/profiles/edit/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/profiles/list/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },
  'api/b2b/v3/profiles/restore/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Search HP
  'api/b2b/v3/search/hp/': {
    requests_number: 10,
    seconds_number: 60,
    is_limited: true
  },

  // Search Multicomplete
  'api/b2b/v3/search/multicomplete/': {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  },

  // Search SERP Geo
  'api/b2b/v3/search/serp/geo/': {
    requests_number: 10,
    seconds_number: 60,
    is_limited: true
  },

  // Search SERP Hotels (highest limit - 150 per minute)
  'api/b2b/v3/search/serp/hotels/': {
    requests_number: 150,
    seconds_number: 60,
    is_limited: true
  },

  // Search SERP Region (used by searchHotels)
  'api/b2b/v3/search/serp/region/': {
    requests_number: 10,
    seconds_number: 60,
    is_limited: true
  }
};

/**
 * Get rate limit config for an endpoint
 * @param {string} endpoint - Endpoint path (e.g., '/search/serp/region/')
 * @returns {Object|null} - Rate limit config or null if not found
 */
export function getRateLimitConfig(endpoint) {
  // Normalize endpoint - remove leading slash, add trailing slash if missing
  let normalized = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  if (!normalized.endsWith('/')) {
    normalized += '/';
  }
  
  // Try exact match first
  const fullPath = `api/b2b/v3/${normalized}`;
  if (ETG_RATE_LIMITS[fullPath]) {
    return ETG_RATE_LIMITS[fullPath];
  }

  // Try without api/b2b/v3 prefix
  if (ETG_RATE_LIMITS[normalized]) {
    return ETG_RATE_LIMITS[normalized];
  }

  // Try with just the normalized path
  const keys = Object.keys(ETG_RATE_LIMITS);
  const matchingKey = keys.find(key => key.endsWith(normalized));
  
  if (matchingKey) {
    return ETG_RATE_LIMITS[matchingKey];
  }

  // Default: return a conservative limit
  console.warn(`⚠️ No rate limit config found for endpoint: ${endpoint}, using default`);
  return {
    requests_number: 30,
    seconds_number: 60,
    is_limited: true
  };
}

