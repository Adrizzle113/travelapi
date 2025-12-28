/**
 * Application Constants
 * Centralized configuration for pagination, limits, and other constants
 */

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 100,      // Prevent users from requesting too many results
  MIN_LIMIT: 10,       // Minimum reasonable page size
};

export const CACHE = {
  SEARCH_TTL: 3600,    // 1 hour in seconds
  MAX_CACHE_SIZE: 1000,
};

export const RATE_LIMITS = {
  WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
  MAX_REQUESTS: 100,
};

export default {
  PAGINATION,
  CACHE,
  RATE_LIMITS,
};
