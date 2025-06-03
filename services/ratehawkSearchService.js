// ================================
// FIXED RATEHAWK SEARCH SERVICE
// Correct two-step API flow with fixed data transformation
// ================================

/**
 * Convert our filter format to RateHawk URL parameters
 */
function buildRateHawkFilters(filters) {
  const params = {};
  
  if (!filters) return params;
  
  // Star ratings: Convert ["3", "4", "5"] to "3.4.5"
  if (filters.starRating && filters.starRating.length > 0) {
    params.stars = filters.starRating.join('.');
  }
  
  // Price range: Convert [100, 500] to "100-500"
  if (filters.priceRange && filters.priceRange.length === 2) {
    const [min, max] = filters.priceRange;
    if (min > 1 || max < 1255) {
      params.price = `${min}-${max}`;
    }
  }
  
  // Meals: Convert ["breakfast", "halfBoard"] to "breakfast.halfBoard"
  if (filters.meals && filters.meals.length > 0) {
    params.meal_types = filters.meals.join('.');
  }
  
  // Payment options: Convert ["freecancellation", "site"] to "freecancellation.site"
  if (filters.payment && filters.payment.length > 0) {
    params.payment = filters.payment.join('.');
  }
  
  // Reviews rating: Convert ["8", "9"] to "8.9"
  if (filters.reviewsRating && filters.reviewsRating.length > 0) {
    params.reviews_rating = filters.reviewsRating.join('.');
  }
  
  // Amenities: Combine all facility types
  const allAmenities = [
    ...(filters.hotelFacilities || []),
    ...(filters.roomFacilities || []),
    ...(filters.accommodationFeatures || [])
  ];
  if (allAmenities.length > 0) {
    params.amenities = allAmenities.join('.');
  }
  
  // Green certification
  if (filters.green && filters.green.length > 0) {
    params.certificates = filters.green.join('.');
  }
  
  // Property types: Convert ["hotel", "apart"] to "hotel.apart"
  if (filters.propertyTypes && filters.propertyTypes.length > 0) {
    params.type_group = filters.propertyTypes.join('.');
  }
  
  console.log('🎯 Built RateHawk filter params:', params);
  return params;
}

/**
 * Generate UUID v4 for search requests
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate session ID for RateHawk
 */
function generateSessionId() {
  return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
  console.log('🔐 CSRF Token:', token ? `Found (${token.substring(0, 10)}...)` : 'Not found');
  return token;
}

/**
 * Extract single page ID from cookies
 */
function extractSinglePageId(cookies) {
  if (!Array.isArray(cookies)) return '//f.worldota.net/partner/sp/branch/32fe378-e6b120f-mbe3i9hb-kyjcu5';
  
  const singlePageCookie = cookies.find(cookie => 
    cookie.name === 'singlepage_id' || 
    cookie.name === 'sp_id' ||
    cookie.name === 'page_id'
  );
  
  const pageId = singlePageCookie ? singlePageCookie.value : '//f.worldota.net/partner/sp/branch/32fe378-e6b120f-mbe3i9hb-kyjcu5';
  console.log('📄 Single Page ID:', pageId ? `Found (${pageId.substring(0, 30)}...)` : 'Using default');
  return pageId;
}


/**
 * Extract partner slug from cookies
 */
function extractPartnerSlug(cookies) {
  if (Array.isArray(cookies)) {
    const partnerCookie = cookies.find(cookie => 
      cookie.name === 'prtnrContractSlug' ||
      cookie.name === 'partner_slug' ||
      cookie.name.includes('partner')
    );
    
    if (partnerCookie) {
      console.log('🏢 Partner slug from cookie:', partnerCookie.value);
      return partnerCookie.value;
    }
  }
  
  const defaultSlug = "211401.b2b.6346";
  console.log('🏢 Using default partner slug:', defaultSlug);
  return defaultSlug;
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
 * Format guest data for RateHawk API
 */
function formatGuestsForRateHawk(guests) {
  console.log('🏨 Raw guest data received:', guests);
  
  let formattedGuests;
  
  if (Array.isArray(guests)) {
    if (guests.length > 0 && typeof guests[0] === 'object' && guests[0].adults) {
      formattedGuests = guests;
    } else if (guests.length > 0 && typeof guests[0] === 'number') {
      formattedGuests = guests.map(adults => ({ adults: Math.max(1, adults) }));
    } else if (guests.length > 0 && Array.isArray(guests[0])) {
      formattedGuests = guests.map(room => ({
        adults: Array.isArray(room) ? Math.max(1, room[0]) : Math.max(1, room)
      }));
    } else {
      formattedGuests = [{ adults: 2 }];
    }
  } else if (typeof guests === 'number') {
    formattedGuests = [{ adults: Math.max(1, guests) }];
  } else {
    formattedGuests = [{ adults: 2 }];
  }

  formattedGuests = formattedGuests.map(room => ({
    adults: Math.max(1, room.adults || 2)
  }));

  console.log('✅ Final guest format for RateHawk:', formattedGuests);
  return formattedGuests;
}

/**
 * Get destination information with region ID mapping
 */
function getDestinationInfo(destination) {
  const destinationMapping = {
    "965847972": { id: "965847972", name: "Rio de Janeiro, Brazil" },
    "70308": { id: "70308", name: "New York, USA" },
    "76876": { id: "76876", name: "London, UK" },
    "82139": { id: "82139", name: "Tokyo, Japan" },
    "69474": { id: "69474", name: "Paris, France" },
    "74107": { id: "74107", name: "Bangkok, Thailand" },
    "74108": { id: "74108", name: "Singapore" },
    "2998": { id: "2998", name: "Las Vegas, USA" },
    "2008": { id: "2008", name: "Las Vegas, USA" }, // Alternative ID
    "74109": { id: "74109", name: "Dubai, UAE" },
    "74110": { id: "74110", name: "Rome, Italy" },
    "2011": { id: "2011", name: "Los Angeles, USA" }
  };

  const info = destinationMapping[destination];
  if (!info) {
    console.log(`⚠️ Unknown destination: ${destination}, using as-is`);
    return { id: destination, name: destination };
  }

  console.log(`🗺️ Mapped destination ${destination} → region_id: ${info.id}`);
  return info;
}

/**
 * UPDATED: Map RateHawk amenity codes to readable names
 */
function mapAmenities(amenities) {
  const amenityMap = {
    'has_internet': 'Free WiFi',
    'has_parking': 'Free Parking', 
    'has_pool': 'Swimming Pool',
    'has_fitness': 'Fitness Center',
    'has_spa': 'Spa & Wellness',
    'has_meal': 'Restaurant',
    'has_bar': 'Bar/Lounge',
    'room_service': 'Room Service',
    'has_laundry': 'Laundry Service',
    'has_concierge': 'Concierge',
    'has_busyness': 'Business Center',
    'has_meeting': 'Meeting Rooms',
    'has_airport_transfer': 'Airport Shuttle',
    'air-conditioning': 'Air Conditioning',
    'has_heating': 'Heating',
    'has_elevator': 'Elevator',
    'balcony': 'Balcony',
    'kitchen': 'Kitchen',
    'has_minibar': 'Minibar',
    'has_safe': 'Safe',
    'has_tv': 'Television',
    'has_phone': 'Phone',
    'has_kids': 'Family Friendly',
    'has_disabled_support': 'Wheelchair Accessible',
    'has_pets': 'Pet Friendly',
    'beach': 'Beach Access',
    'has_ski': 'Ski Access',
    'has_smoking': 'Smoking Allowed',
    'has_jacuzzi': 'Jacuzzi',
    'has_anticovid': 'Enhanced Cleaning',
    'private-room': 'Private Room',
    'private-bathroom': 'Private Bathroom',
    'window': 'Window',
    'with-view': 'Room with View'
  };

  if (!Array.isArray(amenities)) {
    return [];
  }

  const mapped = amenities.map(amenity => {
    if (typeof amenity === 'string') {
      return amenityMap[amenity.toLowerCase()] || 
             amenityMap[amenity] || 
             amenity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
 * FIXED: Transform RateHawk hotel data to consistent format
 * Based on actual RateHawk API response structure from debug output
 */
function transformHotelData(hotels) {
  if (!Array.isArray(hotels)) {
    console.log('⚠️ Hotels data is not an array:', typeof hotels);
    return [];
  }
  
  console.log(`🔄 FIXED: Transforming ${hotels.length} hotels with correct structure...`);
  
  return hotels.map((hotel, index) => {
    try {
      // ✅ FIXED: Extract hotel ID from correct location
      const hotelId = hotel.ota_hotel_id || 
                     hotel.requested_hotel_id || 
                     hotel.hotel_id || 
                     hotel.id || 
                     `hotel_${index}`;
      
      // ✅ FIXED: Extract hotel name from static_vm
      const hotelName = hotel.static_vm?.name || 
                       hotel.name || 
                       hotel.hotel_name || 
                       `Hotel ${index + 1}`;
      
      // ✅ FIXED: Extract price from rates[0].payment_options.payment_types[0]
      let price = 0;
      let currency = 'USD';
      
      if (hotel.rates && hotel.rates.length > 0) {
        const firstRate = hotel.rates[0];
        
        // Try payment_options first (most reliable)
        if (firstRate.payment_options?.payment_types?.length > 0) {
          const paymentType = firstRate.payment_options.payment_types[0];
          if (paymentType.show_amount) {
            price = parseFloat(paymentType.show_amount);
            currency = paymentType.show_currency_code || 'USD';
          } else if (paymentType.amount) {
            price = parseFloat(paymentType.amount);
            currency = paymentType.currency_code || 'USD';
          }
        }
        
        // Fallback to daily_prices or other fields
        if (price === 0) {
          price = parseFloat(firstRate.daily_prices || firstRate.price || firstRate.amount || 0);
          currency = firstRate.currency || firstRate.currency_code || 'USD';
        }
      }
      
      // ✅ FIXED: Extract stars from static_vm.star_rating (divide by 10 for actual stars)
      const starRating = hotel.static_vm?.star_rating || 0;
      const stars = Math.min(5, Math.max(0, Math.round(starRating / 10)));
      
      // ✅ FIXED: Extract review data from static_vm.ta_rating or static_vm.rating
      let reviewScore = 0;
      let reviewCount = 0;
      
      if (hotel.static_vm?.ta_rating) {
        reviewScore = parseFloat(hotel.static_vm.ta_rating.rating || 0);
        reviewCount = parseInt(hotel.static_vm.ta_rating.num_reviews || 0);
      } else if (hotel.static_vm?.rating) {
        reviewScore = parseFloat(hotel.static_vm.rating.total || 0);
        reviewCount = parseInt(hotel.static_vm.rating.count || 0);
      }
      
      // Convert RateHawk's rating scale (appears to be 0-10) to 0-10 scale
      if (reviewScore > 10) {
        reviewScore = reviewScore / 10; // In case it's on a 0-100 scale
      }
      
      // ✅ FIXED: Extract location from static_vm.address
      const location = hotel.static_vm?.address || 
                     hotel.static_vm?.city || 
                     hotel.location || 
                     hotel.address || 
                     "Location not specified";
      
      // ✅ FIXED: Extract image from static_vm.images[0].tmpl
      let image = "/placeholder-hotel.jpg";
      if (hotel.static_vm?.images && hotel.static_vm.images.length > 0) {
        const imageTemplate = hotel.static_vm.images[0].tmpl;
        if (imageTemplate) {
          // Replace {size} with a specific size like "1024x768"
          image = imageTemplate.replace('{size}', '1024x768');
        }
      }
      
      // ✅ FIXED: Extract amenities from static_vm.serp_filters
      const rawAmenities = hotel.static_vm?.serp_filters || [];
      const mappedAmenities = mapAmenities(rawAmenities);
      
      // ✅ FIXED: Extract description (RateHawk doesn't seem to provide descriptions in this endpoint)
      const description = hotel.static_vm?.description || 
                         hotel.description || 
                         `${hotelName} is located in ${hotel.static_vm?.city || location}.`;

      const transformedHotel = {
        id: hotelId,
        name: hotelName,
        location: location,
        rating: stars,
        reviewScore: Math.min(10, Math.max(0, parseFloat(reviewScore) || 0)),
        reviewCount: Math.max(0, parseInt(reviewCount) || 0),
        price: {
          amount: Math.round(Math.max(0, parseFloat(price) || 0)),
          currency: currency,
          period: 'night'
        },
        image: image,
        amenities: mappedAmenities,
        description: description,
        ratehawk_data: hotel // Keep original data for debugging
      };
      
      // Log first few transformations for debugging
      if (index < 3) {
        console.log(`🏨 FIXED Hotel ${index + 1}:`, {
          name: transformedHotel.name,
          price: `${transformedHotel.price.amount} ${transformedHotel.price.currency}`,
          stars: transformedHotel.rating,
          reviewScore: transformedHotel.reviewScore,
          reviewCount: transformedHotel.reviewCount,
          location: transformedHotel.location,
          hasImage: transformedHotel.image !== "/placeholder-hotel.jpg",
          amenityCount: transformedHotel.amenities.length
        });
      }
      
      return transformedHotel;
    } catch (error) {
      console.error(`💥 Error transforming hotel ${index}:`, error);
      return {
        id: `error_hotel_${index}`,
        name: `Hotel ${index + 1}`,
        location: "Unknown",
        rating: 0,
        reviewScore: 0,
        reviewCount: 0,
        price: { amount: 0, currency: 'USD', period: 'night' },
        image: "/placeholder-hotel.jpg",
        amenities: [],
        description: "Hotel data unavailable",
        ratehawk_data: hotel
      };
    }
  });
}

/**
 * Main hotel search function with correct two-step RateHawk API flow
 */
async function searchHotels({ userSession, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD', page = 1, filters = {} }) {
  console.log('🔍 === STARTING RATEHAWK HOTEL SEARCH ===');
  console.log('📋 Search parameters:', JSON.stringify({
    destination,
    checkin,
    checkout,
    guests,
    residency,
    currency,
    page // NEW: Log the page parameter
  }, null, 2));
  
  const startTime = Date.now();
  
  try {
    // Validate user session
    if (!userSession || !userSession.cookies || !Array.isArray(userSession.cookies)) {
      console.log('❌ Invalid user session - missing cookies');
      return {
        success: false,
        error: 'Invalid user session. Please login to RateHawk first.',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    console.log('✅ User session validated');
    console.log(`🍪 Session has ${userSession.cookies.length} cookies`);
    console.log(`👤 User email: ${userSession.email}`);
    console.log(`📄 Requesting page: ${page}`); // NEW: Log page number
    
    // Format and validate inputs
    const formattedGuests = formatGuestsForRateHawk(guests);
    const destinationInfo = getDestinationInfo(destination);
    
    // Extract session data from cookies
    const csrfToken = extractCSRFToken(userSession.cookies);
    const singlePageId = extractSinglePageId(userSession.cookies);
    const partnerSlug = extractPartnerSlug(userSession.cookies);
    const cookieString = formatCookiesForRequest(userSession.cookies);
    
    // Generate required UUIDs
    const searchUUID = generateUUID();
    const ourSessionId = generateSessionId();
    
    console.log('🎲 Generated session data:', {
      searchUUID: searchUUID,
      ourSessionId: ourSessionId,
      partnerSlug: partnerSlug
    });

    // Build RateHawk filter parameters from our filters
    const ratehawkFilters = buildRateHawkFilters(filters);
    console.log('🔧 RateHawk filters:', ratehawkFilters);
    
    // Build common headers
    const commonHeaders = {
      'accept': 'application/json',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.9,pt;q=0.8',
      'content-type': 'application/json',
      'origin': 'https://www.ratehawk.com',
      'referer': 'https://www.ratehawk.com',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': cookieString
    };
    
    if (csrfToken) commonHeaders['x-csrftoken'] = csrfToken;
    if (singlePageId) commonHeaders['x-singlepage-id'] = singlePageId;
    if (userSession.email) commonHeaders['x-user-mail'] = userSession.email;
    
    // STEP 1: Create search session
    console.log('📡 STEP 1: Creating search session...');
    
    const sessionPayload = {
      session_params: {
        currency: currency.toUpperCase(),
        language: "en",
        search_uuid: searchUUID,
        partner_slug_force: partnerSlug,
        arrival_date: checkin,
        departure_date: checkout,
        region_id: parseInt(destinationInfo.id),
        residency: residency,
        paxes: formattedGuests
      },
      page: page, // NEW: Use the page parameter here
      map_hotels: true,
      session_id: ourSessionId
    };
    
    console.log('🎯 Session creation payload:', JSON.stringify(sessionPayload, null, 2));
    
    // Build URL with filters
  let sessionUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/serp?session=${ourSessionId}`;

  // Add filter parameters to URL
  Object.entries(ratehawkFilters).forEach(([key, value]) => {
    if (value) {
      sessionUrl += `&${key}=${encodeURIComponent(value)}`;
    }
  });

console.log('🌐 Session creation URL with filters:', sessionUrl);
    console.log('🌐 Session creation URL:', sessionUrl);
    
    const sessionResponse = await fetch(sessionUrl, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(sessionPayload)
    });
    
    console.log('📨 Session creation response status:', sessionResponse.status);
    
    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('❌ Session creation failed:', sessionResponse.status, errorText);
      return {
        success: false,
        error: `Failed to create search session: ${sessionResponse.status} ${sessionResponse.statusText}`,
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    const sessionData = await sessionResponse.json();
    console.log('📊 Session creation response structure:', {
      hasSessionInfo: !!sessionData.session_info,
      hasSessionId: !!(sessionData.session_info?.session?.id),
      sessionId: sessionData.session_info?.session?.id
    });
    
    // Extract RateHawk's real session ID
    const realSessionId = sessionData.session_info?.session?.id;
    if (!realSessionId) {
      console.error('❌ No session ID returned from RateHawk');
      console.log('📄 Full session response:', JSON.stringify(sessionData, null, 2));
      return {
        success: false,
        error: 'RateHawk did not return a valid session ID',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    console.log('✅ Got RateHawk session ID:', realSessionId);
    
    // STEP 2: Get search results using RateHawk's session ID
    console.log('📡 STEP 2: Getting search results...');
    
    // Build search URL with filters
    let searchUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/serp?session=${realSessionId}`;

    // Add filter parameters to URL
    Object.entries(ratehawkFilters).forEach(([key, value]) => {
      if (value) {
        searchUrl += `&${key}=${encodeURIComponent(value)}`;
      }
    });

    console.log('🌐 Search URL with filters:', searchUrl);
    console.log('🌐 Search URL:', searchUrl);
    
    // For the search request, we might need a slightly different payload
    const searchPayload = {
      session_params: {
        currency: currency.toUpperCase(),
        language: "en",
        search_uuid: searchUUID,
        partner_slug_force: partnerSlug,
        arrival_date: checkin,
        departure_date: checkout,
        region_id: parseInt(destinationInfo.id),
        residency: residency,
        paxes: formattedGuests
      },
      page: page, // NEW: Use the page parameter here too
      map_hotels: true,
      session_id: realSessionId
    };
    
    console.log('🎯 Search payload:', JSON.stringify(searchPayload, null, 2));
    
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(searchPayload)
    });
    
    console.log('📨 Search response status:', searchResponse.status);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('❌ Search request failed:', searchResponse.status, errorText);
      return {
        success: false,
        error: `Search failed: ${searchResponse.status} ${searchResponse.statusText}`,
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    const searchResults = await searchResponse.json();
    console.log('📊 Search results structure:', {
      hasData: !!searchResults.data,
      hasHotels: !!(searchResults.data?.hotels || searchResults.hotels),
      hotelCount: (searchResults.data?.hotels || searchResults.hotels || []).length,
      hasDirectHotels: !!searchResults.hotels,
      topLevelKeys: Object.keys(searchResults)
    });
    
    // Extract hotels from the response (try multiple possible locations)
    let hotels = [];
    let totalHotels = 0;
    let availableHotels = 0;
    
    if (searchResults.data?.hotels) {
      hotels = searchResults.data.hotels;
      totalHotels = searchResults.data.total_hotels || hotels.length;
      availableHotels = searchResults.data.available_hotels || hotels.length;
    } else if (searchResults.hotels) {
      hotels = searchResults.hotels;
      totalHotels = searchResults.total_hotels || hotels.length;
      availableHotels = searchResults.available_hotels || hotels.length;
    } else if (searchResults.results?.hotels) {
      hotels = searchResults.results.hotels;
      totalHotels = searchResults.results.total_hotels || hotels.length;
      availableHotels = searchResults.results.available_hotels || hotels.length;
    }
    
    console.log('📊 Extracted search results:', {
      hotels: hotels.length,
      totalHotels: totalHotels,
      availableHotels: availableHotels
    });
    
    if (hotels.length === 0) {
      console.log('⚠️ No hotels found in response');
      console.log('📄 Full search response (first 1000 chars):', JSON.stringify(searchResults, null, 2).substring(0, 1000));
    }

    // Apply the FIXED transformation
    const transformedHotels = transformHotelData(hotels);
    const duration = Date.now() - startTime;
    
    // NEW: Calculate pagination info
    const hotelsPerPage = 20; // RateHawk default
    const currentPage = page;
    const totalPages = Math.ceil(totalHotels / hotelsPerPage);
    const hasNext = currentPage < totalPages && hotels.length === hotelsPerPage;
    const hasPrevious = currentPage > 1;
    
    console.log(`✅ Search completed in ${duration}ms with ${transformedHotels.length} hotels`);
    console.log(`📄 Pagination: Page ${currentPage} of ${totalPages}, hasNext: ${hasNext}, hasPrevious: ${hasPrevious}`);
    
    return {
      success: true,
      hotels: transformedHotels,
      totalHotels: totalHotels || transformedHotels.length,
      availableHotels: availableHotels || transformedHotels.length,
      searchSessionId: realSessionId,
      searchDuration: `${duration}ms`,
      // NEW: Simple pagination info for load more
      hasMorePages: hotels.length === 20, // If we got 20 hotels, there might be more
      currentPage: page,
      metadata: {
        strategy: 'two_step_api',
        sessionCreated: true,
        duration: duration,
        realSessionId: realSessionId,
        transformationFixed: true
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Hotel search failed:', error);
    
    return {
      success: false,
      error: `Search failed: ${error.message}`,
      hotels: [],
      totalHotels: 0,
      availableHotels: 0,
      searchDuration: `${duration}ms`,
      debug: {
        errorType: error.name || 'Unknown',
        errorMessage: error.message,
        stack: error.stack?.substring(0, 500)
      }
    };
  } finally {
    const duration = Date.now() - startTime;
    console.log(`🏁 Search service completed in ${duration}ms`);
    console.log('=== END RATEHAWK HOTEL SEARCH ===');
  }
}

module.exports = {
  searchHotels
};