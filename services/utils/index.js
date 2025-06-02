// ================================
// RATEHAWK UTILITIES
// Updated utility functions for RateHawk integration
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
    "82139": { id: "82139", slug: "japan/tokyo", name: "Tokyo, Japan" },
    "69474": { id: "69474", slug: "france/paris", name: "Paris, France" },
    "74107": { id: "74107", slug: "thailand/bangkok", name: "Bangkok, Thailand" },
    "74108": { id: "74108", slug: "singapore/singapore", name: "Singapore" },
    "2998": { id: "2998", slug: "usa/las_vegas", name: "Las Vegas, USA" },
    "74109": { id: "74109", slug: "uae/dubai", name: "Dubai, UAE" },
    "74110": { id: "74110", slug: "italy/rome", name: "Rome, Italy" },
    "2011": { id: "2011", slug: "usa/los_angeles", name: "Los Angeles, USA" }
  };

  const info = destinationMapping[destination];
  if (!info) {
    console.log(`⚠️ Unknown destination: ${destination}, using as-is`);
    return { id: destination, slug: "unknown/destination", name: destination };
  }

  console.log(`🗺️ Mapped destination ${destination} → region_id: ${info.id}`);
  return info;
}

/**
 * Extract CSRF token from cookies
 */
function extractCSRFToken(cookies) {
  if (!Array.isArray(cookies)) return '';
  
  const csrfCookie = cookies.find(cookie => 
    cookie.name === 'csrftoken' || 
    cookie.name === 'csrf_token' ||
    cookie.name === '_token'
  );
  
  const token = csrfCookie ? csrfCookie.value : '';
  console.log('🔐 CSRF Token:', token ? 'Found' : 'Not found');
  return token;
}

/**
 * Extract single page ID from cookies
 */
function extractSinglePageId(cookies) {
  if (!Array.isArray(cookies)) return '//f.worldota.net/partner/sp/branch/32fe378-e6b120f-mbd1lfd7-curhcp';
  
  const singlePageCookie = cookies.find(cookie => 
    cookie.name === 'singlepage_id' || 
    cookie.name === 'sp_id' ||
    cookie.name === 'page_id'
  );
  
  const pageId = singlePageCookie ? singlePageCookie.value : '//f.worldota.net/partner/sp/branch/32fe378-e6b120f-mbd1lfd7-curhcp';
  console.log('📄 Single Page ID:', pageId ? 'Found' : 'Using default');
  return pageId;
}

/**
 * Format cookies for HTTP requests
 */
function formatCookiesForRequest(cookies) {
  if (!Array.isArray(cookies)) return '';
  const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  console.log('🍪 Cookie string length:', cookieString.length);
  return cookieString;
}

/**
 * Transform RateHawk hotel data to consistent format
 */
function transformHotelData(hotels) {
  if (!Array.isArray(hotels)) {
    return [];
  }
  
  return hotels.map((hotel, index) => {
    // Extract basic info
    const hotelId = hotel.id || hotel.hotel_id || index.toString();
    const hotelName = hotel.name || hotel.hotel_name || `Hotel ${index + 1}`;
    
    // Extract pricing info
    const pricing = hotel.rates?.[0] || hotel.price_info || {};
    const price = pricing.price || hotel.min_price || 0;
    
    // Extract rating info
    const stars = hotel.stars || hotel.rating || 0;
    const reviewScore = hotel.review_score || hotel.guest_rating || 0;
    const reviewCount = hotel.review_count || hotel.reviews_count || 0;
    
    // Extract location
    const location = hotel.location || 
                   hotel.address || 
                   hotel.region_name || 
                   hotel.city || 
                   "Location not specified";
    
    // Extract amenities
    const rawAmenities = hotel.amenities || hotel.facilities || [];
    const mappedAmenities = mapAmenities(rawAmenities);
    
    // Extract image
    const image = hotel.main_photo_url || 
                 hotel.image_url || 
                 hotel.photos?.[0]?.url ||
                 "/placeholder-hotel.jpg";

    return {
      id: hotelId,
      name: hotelName,
      location: location,
      rating: stars,
      reviewScore: reviewScore,
      reviewCount: reviewCount,
      price: {
        amount: Math.round(price),
        currency: pricing.currency || hotel.currency || 'USD',
        period: 'night'
      },
      image: image,
      amenities: mappedAmenities,
      description: hotel.description || "",
      ratehawk_data: hotel // Keep original data
    };
  });
}

/**
 * Map amenity codes to readable names
 */
function mapAmenities(amenities) {
  const amenityMap = {
    'wifi': 'Free WiFi',
    'parking': 'Free Parking',
    'pool': 'Swimming Pool',
    'gym': 'Fitness Center',
    'spa': 'Spa & Wellness',
    'restaurant': 'Restaurant',
    'bar': 'Bar/Lounge',
    'room_service': 'Room Service',
    'laundry': 'Laundry Service',
    'concierge': 'Concierge',
    'business_center': 'Business Center',
    'meeting_rooms': 'Meeting Rooms',
    'airport_shuttle': 'Airport Shuttle',
    'air_conditioning': 'Air Conditioning',
    'heating': 'Heating',
    'elevator': 'Elevator',
    'balcony': 'Balcony',
    'kitchen': 'Kitchen',
    'minibar': 'Minibar',
    'safe': 'Safe',
    'tv': 'Television',
    'phone': 'Phone'
  };

  if (!Array.isArray(amenities)) {
    return [];
  }

  const mapped = amenities.map(amenity => {
    if (typeof amenity === 'string') {
      return amenityMap[amenity.toLowerCase()] || amenity;
    } else if (amenity && amenity.name) {
      return amenityMap[amenity.name.toLowerCase()] || amenity.name;
    }
    return 'Available';
  }).filter(Boolean);

  // Add "+X more" if we have many amenities
  if (mapped.length > 4) {
    return [...mapped.slice(0, 4), `+${mapped.length - 4} more`];
  }

  return mapped;
}

/**
 * Validate search parameters
 */
function validateSearchParams(params) {
  const errors = [];
  
  if (!params.destination) {
    errors.push('Destination is required');
  }
  
  if (!params.checkin) {
    errors.push('Check-in date is required');
  }
  
  if (!params.checkout) {
    errors.push('Check-out date is required');
  }
  
  if (!params.guests || (!Array.isArray(params.guests) && typeof params.guests !== 'number')) {
    errors.push('Guest information is required');
  }
  
  // Validate date order
  if (params.checkin && params.checkout) {
    const checkinDate = new Date(params.checkin);
    const checkoutDate = new Date(params.checkout);
    
    if (checkinDate >= checkoutDate) {
      errors.push('Check-out date must be after check-in date');
    }
    
    if (checkinDate < new Date().setHours(0, 0, 0, 0)) {
      errors.push('Check-in date cannot be in the past');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user session
 */
function validateUserSession(userSession) {
  if (!userSession) {
    return { isValid: false, error: 'User session is required' };
  }
  
  if (!userSession.cookies || !Array.isArray(userSession.cookies)) {
    return { isValid: false, error: 'User session cookies are required' };
  }
  
  if (!userSession.email) {
    return { isValid: false, error: 'User email is required' };
  }
  
  // Check if session is expired (24 hours)
  if (userSession.loginTime) {
    const sessionAge = Date.now() - new Date(userSession.loginTime);
    const hoursOld = sessionAge / (1000 * 60 * 60);
    
    if (hoursOld > 24) {
      return { isValid: false, error: 'User session has expired' };
    }
  }
  
  return { isValid: true };
}

/**
 * Handle API errors with user-friendly messages
 */
function handleAPIError(error, context = '') {
  console.error(`💥 API Error ${context}:`, error);
  
  let userMessage = 'An unexpected error occurred';
  
  if (error.message) {
    if (error.message.includes('fetch')) {
      userMessage = 'Unable to connect to RateHawk. Please check your connection.';
    } else if (error.message.includes('timeout')) {
      userMessage = 'Request timed out. Please try again.';
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      userMessage = 'Session expired. Please login again.';
    } else if (error.message.includes('400') || error.message.includes('bad request')) {
      userMessage = 'Invalid search parameters. Please check your input.';
    } else if (error.message.includes('500')) {
      userMessage = 'RateHawk service is temporarily unavailable. Please try again later.';
    } else {
      userMessage = error.message;
    }
  }
  
  return {
    success: false,
    error: userMessage,
    details: error.message,
    context: context,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create success response
 */
function createSuccessResponse(data, message = 'Operation completed successfully') {
  return {
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  formatGuestsForRateHawk,
  getDestinationInfo,
  extractCSRFToken,
  extractSinglePageId,
  formatCookiesForRequest,
  transformHotelData,
  mapAmenities,
  validateSearchParams,
  validateUserSession,
  handleAPIError,
  createSuccessResponse
};