/**
 * Residency Parameter Normalization
 * 
 * Normalizes residency parameters to ETG API format (2-letter country code, lowercase).
 * Handles various input formats:
 * - Locale codes: "en-us" → "us"
 * - Country codes: "us" → "us", "US" → "us"
 * - Invalid values → defaults to "us"
 */

/**
 * Normalize residency parameter to ETG API format
 * Converts locale codes (e.g., "en-us") to country codes (e.g., "us")
 * @param {string} residency - Residency value from request
 * @returns {string} - Normalized 2-letter country code (lowercase)
 */
export function normalizeResidency(residency) {
  if (!residency || typeof residency !== 'string') {
    return 'us'; // Default
  }

  // Remove whitespace and convert to lowercase
  const normalized = residency.trim().toLowerCase();

  // If it's already a 2-letter code, return it
  if (/^[a-z]{2}$/.test(normalized)) {
    return normalized;
  }

  // Extract country code from locale format (e.g., "en-us" → "us")
  const localeMatch = normalized.match(/^[a-z]{2}-([a-z]{2})$/);
  if (localeMatch) {
    return localeMatch[1];
  }

  // If format is unknown, try to extract last 2 letters
  const lastTwo = normalized.slice(-2);
  if (/^[a-z]{2}$/.test(lastTwo)) {
    return lastTwo;
  }

  // Default fallback
  return 'us';
}

export default {
  normalizeResidency
};

