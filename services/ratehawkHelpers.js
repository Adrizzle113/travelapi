// ================================
// RATEHAWK UTILITIES - FIXED COMPLETE VERSION
// CRITICAL FIX: Preserve original RateHawk hotel IDs for API calls
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
 * Format cookies for HTTP requests
 */
function formatCookiesForRequest(cookies) {
  if (!Array.isArray(cookies)) return '';
  const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  console.log('🍪 Cookie string length:', cookieString.length);
  return cookieString;
}

/**
 * CRITICAL FIX: Transform hotel data while preserving RateHawk IDs
 */
function transformHotelData(hotels) {
  if (!Array.isArray(hotels)) {
    return [];
  }
  
  console.log(`🔄 Transforming ${hotels.length} hotels...`);
  
  return hotels.map((hotel, index) => {
    // CRITICAL: Log the original hotel structure to understand what we have
    console.log(`📊 Hotel ${index + 1} original keys:`, Object.keys(hotel));
    console.log(`🆔 Hotel ${index + 1} IDs:`, {
      id: hotel.id,
      ota_hotel_id: hotel.ota_hotel_id,
      requested_hotel_id: hotel.requested_hotel_id,
      hotel_id: hotel.hotel_id
    });
    
    // CRITICAL: Preserve ALL RateHawk identifiers
    const ratehawkData = {
      // Store ALL possible hotel identifiers from RateHawk
      ota_hotel_id: hotel.ota_hotel_id || hotel.requested_hotel_id || hotel.hotel_id || hotel.id,
      requested_hotel_id: hotel.requested_hotel_id || hotel.ota_hotel_id || hotel.hotel_id || hotel.id,
      hotel_id: hotel.hotel_id || hotel.id,
      original_id: hotel.id,
      
      // Store complete original hotel data
      ...hotel,
      
      // Preserve search session data
      static_vm: hotel.static_vm || {},
      serp_filters: hotel.serp_filters || [],
      
      // Store rates and room data if available
      rates: hotel.rates || [],
      room_groups: hotel.room_groups || []
    };

    // Create a user-friendly ID for the frontend URL
    const frontendId = createFriendlyHotelId(hotel);
    
    // Extract basic info with fallbacks
    const hotelName = hotel.static_vm?.main_name || 
                     hotel.name || 
                     hotel.hotel_name || 
                     `Hotel ${index + 1}`;
    
    // Extract pricing info
    const pricing = hotel.rates?.[0] || hotel.price_info || {};
    const price = pricing.price || hotel.min_price || hotel.price || 0;
    
    // Extract rating info
    const stars = hotel.stars || hotel.star_rating || hotel.rating || 0;
    const reviewScore = hotel.review_score || hotel.guest_rating || hotel.rating_value || 0;
    const reviewCount = hotel.review_count || hotel.reviews_count || hotel.total_reviews || 0;
    
    // Extract location with better fallbacks
    const location = hotel.static_vm?.location?.name ||
                    hotel.static_vm?.city_name ||
                    hotel.location || 
                    hotel.address || 
                    hotel.region_name || 
                    hotel.city || 
                    "Location not specified";
    
    // Extract amenities from multiple sources
    const amenitiesFromSerp = hotel.serp_filters || [];
    const amenitiesFromStatic = hotel.static_vm?.amenities || [];
    const amenitiesFromMain = hotel.amenities || hotel.facilities || [];
    const allAmenities = [...amenitiesFromSerp, ...amenitiesFromStatic, ...amenitiesFromMain];
    const mappedAmenities = mapAmenities([...new Set(allAmenities)]);
    
    // Extract main image with better fallbacks
    const image = hotel.static_vm?.main_photo_url || 
                 hotel.static_vm?.images?.[0]?.tmpl?.replace('{size}', '640x480') ||
                 hotel.main_photo_url || 
                 hotel.image_url || 
                 hotel.photos?.[0]?.url ||
                 hotel.image ||
                 "/placeholder-hotel.jpg";

    console.log(`🏨 Transformed hotel ${index + 1}:`, {
      frontendId: frontendId,
      ratehawkId: ratehawkData.ota_hotel_id,
      name: hotelName,
      hasOriginalData: !!hotel.ota_hotel_id
    });

    return {
      // Frontend-friendly ID for URL
      id: frontendId,
      
      // Hotel information
      name: hotelName,
      location: location,
      rating: stars,
      reviewScore: reviewScore,
      reviewCount: reviewCount,
      
      // Pricing
      price: {
        amount: Math.round(price) || 100,
        currency: pricing.currency || hotel.currency || 'USD',
        period: 'night'
      },
      
      // Media
      image: image,
      
      // Features
      amenities: mappedAmenities,
      description: hotel.static_vm?.description || hotel.description || "",
      
      // CRITICAL: Store complete RateHawk data for API calls
      ratehawk_data: ratehawkData
    };
  });
}

/**
 * Create a user-friendly hotel ID for frontend URLs
 */
function createFriendlyHotelId(hotel) {
  // Try to create a friendly ID from hotel name
  let friendlyId = '';
  
  const hotelName = hotel.static_vm?.main_name || hotel.name || hotel.hotel_name;
  if (hotelName) {
    friendlyId = hotelName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_')         // Replace spaces with underscores
      .replace(/_+/g, '_')          // Replace multiple underscores with single
      .replace(/^_|_$/g, '');       // Remove leading/trailing underscores
  }
  
  // Fallback to RateHawk ID if name processing fails
  if (!friendlyId || friendlyId.length < 3) {
    const ratehawkId = hotel.ota_hotel_id || hotel.hotel_id || hotel.id;
    friendlyId = `hotel_${ratehawkId}`;
  }
  
  return friendlyId;
}

/**
 * FIXED: Perform basic search with correct RateHawk API format
 */
async function performBasicSearch({ userSession, destination, checkin, checkout, guests, residency, currency, page, filters }) {
  console.log('🔍 === STARTING BASIC RATEHAWK SEARCH ===');
  
  try {
    // Validate inputs
    if (!userSession || !userSession.cookies) {
      throw new Error('Invalid user session');
    }
    
    // Format search parameters
    const formattedGuests = formatGuestsForRateHawk(guests);
    const destinationInfo = getDestinationInfo(destination);
    
    // FIXED: Use the correct RateHawk API endpoint format
    const searchPayload = {
      region_id: parseInt(destinationInfo.id), // Make sure it's a number
      checkin: checkin,
      checkout: checkout,
      guests: formattedGuests,
      residency: residency || 'en-us',
      currency: currency || 'USD',
      language: 'en'
    };
    
    console.log('📡 RateHawk search payload:', JSON.stringify(searchPayload, null, 2));
    
    // Build headers
    const cookieString = formatCookiesForRequest(userSession.cookies);
    const csrfToken = extractCSRFToken(userSession.cookies);
    
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'cookie': cookieString,
      'origin': 'https://www.ratehawk.com',
      'referer': 'https://www.ratehawk.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest'
    };
    
    if (csrfToken) {
      headers['x-csrftoken'] = csrfToken;
    }
    
    console.log('📡 Request headers prepared, making search request...');
    
    // Make the search request to the correct endpoint
    const response = await fetch('https://www.ratehawk.com/hotel/search/v2/b2bsite/serp', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(searchPayload)
    });
    
    console.log(`📨 RateHawk search response: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ RateHawk API error response: ${errorText}`);
      throw new Error(`RateHawk API returned ${response.status}: ${response.statusText}`);
    }
    
    const searchData = await response.json();
    console.log('📊 Search response keys:', Object.keys(searchData));
    
    // Handle search errors
    if (searchData.error) {
      console.log('❌ RateHawk search error:', searchData.error);
      return {
        success: false,
        error: `RateHawk search error: ${searchData.error}`,
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    // Extract search results
    const searchResults = searchData.data || {};
    const rawHotels = searchResults.hotels || [];
    const searchSessionId = searchResults.search_session_id;
    
    console.log(`📊 Raw hotels received: ${rawHotels.length}`);
    console.log(`🔗 Search session ID: ${searchSessionId}`);
    
    // Log first hotel structure for debugging
    if (rawHotels.length > 0) {
      console.log('🔍 First hotel sample structure:', {
        keys: Object.keys(rawHotels[0]),
        id: rawHotels[0].id,
        ota_hotel_id: rawHotels[0].ota_hotel_id,
        name: rawHotels[0].static_vm?.main_name || rawHotels[0].name
      });
    }
    
    // CRITICAL: Transform hotels with preserved RateHawk IDs
    const transformedHotels = transformHotelData(rawHotels);
    
    console.log(`✅ Hotels transformed: ${transformedHotels.length}`);
    
    // Log sample hotel ID mapping for debugging
    if (transformedHotels.length > 0) {
      console.log('🔍 Sample hotel ID mapping:', transformedHotels.slice(0, 3).map(h => ({
        frontendId: h.id,
        ratehawkId: h.ratehawk_data?.ota_hotel_id,
        name: h.name
      })));
    }
    
    return {
      success: true,
      hotels: transformedHotels,
      totalHotels: searchResults.total_hotels || transformedHotels.length,
      availableHotels: searchResults.available_hotels || transformedHotels.length,
      searchSessionId: searchSessionId,
      hasMorePages: transformedHotels.length >= 20,
      currentPage: page || 1,
      metadata: {
        strategy: 'basic_search',
        sessionCreated: !!searchSessionId,
        destinationId: destinationInfo.id
      }
    };
    
  } catch (error) {
    console.error('💥 Basic search failed:', error);
    return {
      success: false,
      error: `Search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0
    };
  }
}

/**
 * Map amenity codes to readable names
 */
function mapAmenities(amenities) {
  const amenityMap = {
    'has_wifi': 'Free WiFi',
    'has_internet': 'Internet Access',
    'has_parking': 'Free Parking',
    'has_pool': 'Swimming Pool',
    'has_fitness': 'Fitness Center',
    'has_spa': 'Spa & Wellness',
    'has_meal': 'Restaurant',
    'has_bar': 'Bar/Lounge',
    'has_laundry': 'Laundry Service',
    'has_concierge': 'Concierge',
    'has_busyness': 'Business Center',
    'has_meeting': 'Meeting Rooms',
    'has_airport_transfer': 'Airport Shuttle',
    'air-conditioning': 'Air Conditioning',
    'has_heating': 'Heating',
    'has_elevator': 'Elevator',
    'has_safe': 'Safe',
    'has_tv': 'Television',
    'has_phone': 'Phone',
    'has_disabled_support': 'Wheelchair Accessible',
    'has_kids': 'Family Friendly',
    'has_pets': 'Pet Friendly',
    'has_smoking': 'Smoking Allowed',
    'has_jacuzzi': 'Jacuzzi',
    'non-smoking': 'Non-Smoking Rooms'
  };

  if (!Array.isArray(amenities)) {
    return [];
  }

  const mapped = amenities.map(amenity => {
    if (typeof amenity === 'string') {
      const lowerAmenity = amenity.toLowerCase().trim();
      return amenityMap[lowerAmenity] || 
             amenityMap[lowerAmenity.replace(/_/g, '-')] ||
             amenity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } else if (amenity && amenity.name) {
      return amenityMap[amenity.name.toLowerCase()] || amenity.name;
    }
    return 'Available';
  }).filter(Boolean);

  // Remove duplicates and limit to reasonable number
  const uniqueMapped = [...new Set(mapped)];
  
  // Add "+X more" if we have many amenities
  if (uniqueMapped.length > 6) {
    return [...uniqueMapped.slice(0, 6), `+${uniqueMapped.length - 6} more`];
  }

  return uniqueMapped;
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
  formatCookiesForRequest,
  transformHotelData,
  performBasicSearch,
  mapAmenities,
  validateSearchParams,
  validateUserSession,
  handleAPIError,
  createSuccessResponse,
  createFriendlyHotelId
};