export const STATIC_DESTINATION_MAP = {
  'new york': { region_id: 2621, region_name: 'New York City', country: 'US' },
  'new york city': { region_id: 2621, region_name: 'New York City', country: 'US' },
  'nyc': { region_id: 2621, region_name: 'New York City', country: 'US' },
  'los angeles': { region_id: 1555, region_name: 'Los Angeles', country: 'US' },
  'la': { region_id: 1555, region_name: 'Los Angeles', country: 'US' },
  'chicago': { region_id: 2996, region_name: 'Chicago', country: 'US' },
  'miami': { region_id: 2701, region_name: 'Miami', country: 'US' },
  'san francisco': { region_id: 1556, region_name: 'San Francisco', country: 'US' },
  'sf': { region_id: 1556, region_name: 'San Francisco', country: 'US' },
  'london': { region_id: 2114, region_name: 'London', country: 'GB' },
  'paris': { region_id: 2138, region_name: 'Paris', country: 'FR' },
  'rome': { region_id: 2274, region_name: 'Rome', country: 'IT' },
  'tokyo': { region_id: 1852, region_name: 'Tokyo', country: 'JP' },
  'dubai': { region_id: 1124, region_name: 'Dubai', country: 'AE' },
};

export function normalizeDestination(destination) {
  if (!destination || typeof destination !== 'string') return '';
  return destination.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

export function getStaticRegion(destination) {
  const normalized = normalizeDestination(destination);
  return STATIC_DESTINATION_MAP[normalized] || null;
}

export function getAllDestinations() {
  return Object.keys(STATIC_DESTINATION_MAP);
}
