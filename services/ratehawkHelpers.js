// ================================
// RATEHAWK UTILITIES
// FIXED: Preserve original RateHawk hotel IDs for API calls
// ================================

/**
 * Format guest data for RateHawk API
 */
function formatGuestsForRateHawk(guests) {
  console.log('🏨 Raw guest data received:', guests);
  
  let fixedGuests;
  
  if (Array.isArray(guests)) {
    // Already in correct format: [{"adults": 2}]
    if (guests.length > 0 && typeof guests[0] === 'object' && guests[0].adults) {
      fixedGuests = guests;
    }
    // Nested array format: [[2]]
    else if (guests.length > 0 && Array.isArray(guests[0])) {
      fixedGuests = guests.map(room => ({
        adults: Array.isArray(room) ? Math.max(1, room[0]) : Math.max(1, room)
      }));
    }
    // Simple array format: [2]
    else if (guests.length > 0 && typeof guests[0] === 'number') {
      fixedGuests = guests.map(adults => ({
        adults: Math.max(1, adults)
      }));
    }
    // Unknown format
    else {
      fixedGuests = [{ adults: 2 }];
    }
  } 
  // Number format
  else if (typeof guests === 'number') {
    fixedGuests = [{ adults: Math.max(1, guests) }];
  } 
  // Default fallback
  else {
    fixedGuests = [{ adults: 2 }];
  }

  // Ensure all rooms have at least 1 adult
  fixedGuests = fixedGuests.map(room => ({
    adults: Math.max(1, room.adults || 2)
  }));

  console.log('✅ Final guest format for RateHawk:', fixedGuests);
  return fixedGuests;
}

/**
 * Get destination information with region ID mapping
 */
function getDestinationInfo(destination) {
  const destinationMapping = {
    "965847972": { id: "965847972", slug: "brazil/rio_de_janeiro", name: "Rio de Janeiro, Brazil" },
    "70308": { id: "70308", slug: "usa/new_york", name: "New York, USA" },
    "76876": { id: "76876", slug: "uk/london", name: "London, UK" },
    "82139