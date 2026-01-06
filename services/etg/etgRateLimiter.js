/**
 * ETG API Rate Limiter
 * Tracks and enforces rate limits per endpoint based on ETG API specifications
 */

import { getRateLimitConfig } from '../../config/etgRateLimits.js';

// In-memory store for tracking requests per endpoint
// Structure: Map<endpoint, { requests: Array<timestamp>, resetTime: number }>
const endpointStore = new Map();

/**
 * Clean up old request timestamps for an endpoint
 * @param {string} endpoint - Endpoint path
 * @param {number} windowMs - Time window in milliseconds
 */
function cleanupOldRequests(endpoint, windowMs) {
  const now = Date.now();
  const data = endpointStore.get(endpoint);
  
  if (!data) return;
  
  data.requests = data.requests.filter(timestamp => now - timestamp < windowMs);
  
  // Remove endpoint from store if no requests
  if (data.requests.length === 0 && now > data.resetTime) {
    endpointStore.delete(endpoint);
  }
}

/**
 * Check if a request can be made for an endpoint
 * @param {string} endpoint - Endpoint path (e.g., '/search/serp/region/')
 * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number, waitTime?: number }
 */
export function checkRateLimit(endpoint) {
  const config = getRateLimitConfig(endpoint);
  
  // If endpoint is not limited, allow the request
  if (!config.is_limited) {
    return {
      allowed: true,
      remaining: Infinity,
      resetTime: null,
      limit: null
    };
  }

  const windowMs = config.seconds_number * 1000;
  const maxRequests = config.requests_number;
  const now = Date.now();

  // Clean up old requests
  cleanupOldRequests(endpoint, windowMs);

  // Get or create endpoint data
  if (!endpointStore.has(endpoint)) {
    endpointStore.set(endpoint, {
      requests: [],
      resetTime: now + windowMs
    });
  }

  const endpointData = endpointStore.get(endpoint);
  const currentRequests = endpointData.requests.length;

  // Check if limit is exceeded
  if (currentRequests >= maxRequests) {
    // Calculate wait time until oldest request expires
    const oldestRequest = Math.min(...endpointData.requests);
    const waitTime = Math.ceil((oldestRequest + windowMs - now) / 1000); // in seconds

    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(oldestRequest + windowMs).toISOString(),
      waitTime,
      limit: maxRequests,
      windowSeconds: config.seconds_number
    };
  }

  // Request is allowed
  return {
    allowed: true,
    remaining: maxRequests - currentRequests - 1, // -1 because we're about to make the request
    resetTime: new Date(endpointData.resetTime).toISOString(),
    limit: maxRequests,
    windowSeconds: config.seconds_number
  };
}

/**
 * Record a request for an endpoint
 * @param {string} endpoint - Endpoint path
 */
export function recordRequest(endpoint) {
  const config = getRateLimitConfig(endpoint);
  
  if (!config.is_limited) {
    return; // Don't track unlimited endpoints
  }

  const windowMs = config.seconds_number * 1000;
  const now = Date.now();

  // Clean up old requests
  cleanupOldRequests(endpoint, windowMs);

  // Get or create endpoint data
  if (!endpointStore.has(endpoint)) {
    endpointStore.set(endpoint, {
      requests: [],
      resetTime: now + windowMs
    });
  }

  const endpointData = endpointStore.get(endpoint);
  
  // Add current request timestamp
  endpointData.requests.push(now);
  
  // Update reset time if needed
  if (now >= endpointData.resetTime) {
    endpointData.resetTime = now + windowMs;
  }
}

/**
 * Wait until rate limit allows a request
 * @param {string} endpoint - Endpoint path
 * @returns {Promise<void>}
 */
export async function waitForRateLimit(endpoint) {
  const check = checkRateLimit(endpoint);
  
  if (check.allowed) {
    return;
  }

  const waitTimeMs = check.waitTime * 1000;
  console.log(`⏳ Rate limit reached for ${endpoint}. Waiting ${check.waitTime}s...`);
  
  await new Promise(resolve => setTimeout(resolve, waitTimeMs + 100)); // Add 100ms buffer
}

/**
 * Get current rate limit status for an endpoint
 * @param {string} endpoint - Endpoint path
 * @returns {Object} - Rate limit status
 */
export function getRateLimitStatus(endpoint) {
  const config = getRateLimitConfig(endpoint);
  const check = checkRateLimit(endpoint);
  const endpointData = endpointStore.get(endpoint);
  
  return {
    endpoint,
    limit: config.requests_number,
    windowSeconds: config.seconds_number,
    isLimited: config.is_limited,
    current: endpointData ? endpointData.requests.length : 0,
    remaining: check.remaining,
    resetTime: check.resetTime,
    allowed: check.allowed
  };
}

/**
 * Get status for all tracked endpoints
 * @returns {Array} - Array of rate limit statuses
 */
export function getAllRateLimitStatuses() {
  const statuses = [];
  
  for (const endpoint of endpointStore.keys()) {
    statuses.push(getRateLimitStatus(endpoint));
  }
  
  return statuses;
}

/**
 * Clear rate limit tracking for an endpoint (useful for testing)
 * @param {string} endpoint - Endpoint path (optional, clears all if not provided)
 */
export function clearRateLimit(endpoint) {
  if (endpoint) {
    endpointStore.delete(endpoint);
  } else {
    endpointStore.clear();
  }
}

// Periodic cleanup of old entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [endpoint, data] of endpointStore.entries()) {
    const config = getRateLimitConfig(endpoint);
    const windowMs = config.seconds_number * 1000;
    
    // Clean up old requests
    data.requests = data.requests.filter(timestamp => now - timestamp < windowMs);
    
    // Remove if empty and reset time passed
    if (data.requests.length === 0 && now > data.resetTime) {
      endpointStore.delete(endpoint);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

