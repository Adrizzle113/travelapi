// ================================
// RATEHAWK SEARCH SERVICE
// Main search orchestrator with multiple strategies
// ================================

const { executeAPISearch, testAPIConnectivity } = require('./search/apiSearchStrategy');
const { executeBrowserSearch, testBrowserConnectivity } = require('./browserSearchStrategy');
const { pollWithRetry } = require('./search/pollingService');
const {
  transformHotelData,
  validateSearchParams,
  validateUserSession,
  handleAPIError,
  createSuccessResponse
} = require('../utils');

/**
 * Main hotel search function with real RateHawk API integration
 */
async function searchHotels({ userSession, destination, checkin, checkout, guests, residency = 'en-us', currency = 'USD' }) {
  console.log('🔍 === STARTING RATEHAWK HOTEL SEARCH ===');
  console.log('📋 Search parameters:', JSON.stringify({
    destination,
    checkin,
    checkout,
    guests,
    residency,
    currency
  }, null, 2));
  
  const startTime = Date.now();
  
  try {
    // Validate user session
    if (!userSession || !userSession.cookies || !Array.isArray(userSession.cookies)) {
      console.log('❌ Invalid user session');
      return {
        success: false,
        error: 'Invalid user session. Please login again.',
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    // Format guest data for RateHawk API
    const formattedGuests = formatGuestsForRateHawk(guests);
    console.log('👥 Formatted guests:', formattedGuests);
    
    // Get destination information
    const destinationInfo = getDestinationInfo(destination);
    console.log('🗺️ Destination info:', destinationInfo);
    
    // Extract important cookies
    const cookieString = formatCookiesForRequest(userSession.cookies);
    const csrfToken = extractCSRFToken(userSession.cookies);
    
    console.log('🍪 Using cookies:', cookieString.substring(0, 100) + '...');
    console.log('🔑 CSRF Token:', csrfToken ? 'Found' : 'Not found');
    
    // Prepare search payload for RateHawk API
    const searchPayload = {
      region_id: destinationInfo.id,
      checkin: checkin,
      checkout: checkout,
      guests: formattedGuests,
      residency: residency,
      currency: currency,
      language: 'en'
    };
    
    console.log('📡 Sending search request to RateHawk API...');
    console.log('🎯 Payload:', JSON.stringify(searchPayload, null, 2));
    
    // Make the initial search request to RateHawk
    const searchResponse = await fetch('https://www.ratehawk.com/hotel/search/v2/b2bsite/serp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.ratehawk.com/',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.ratehawk.com',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken,
        'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      },
      body: JSON.stringify(searchPayload)
    });
    
    console.log('📨 Search response status:', searchResponse.status);
    
    if (!searchResponse.ok) {
      throw new Error(`RateHawk API returned ${searchResponse.status}: ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    console.log('📊 Initial search response:', JSON.stringify(searchData, null, 2));
    
    // Handle API errors
    if (searchData.error) {
      console.log('❌ RateHawk API error:', searchData.error);
      return {
        success: false,
        error: `RateHawk API error: ${searchData.error}`,
        hotels: [],
        totalHotels: 0,
        availableHotels: 0
      };
    }
    
    // Extract search session ID for polling
    let searchSessionId = null;
    let initialHotels = [];
    let totalHotels = 0;
    let availableHotels = 0;
    
    if (searchData.data) {
      searchSessionId = searchData.data.search_session_id;
      initialHotels = searchData.data.hotels || [];
      totalHotels = searchData.data.total_hotels || 0;
      availableHotels = searchData.data.available_hotels || 0;
      
      console.log('🔗 Search session ID:', searchSessionId);
      console.log('🏨 Initial hotels received:', initialHotels.length);
      console.log('📊 Total hotels:', totalHotels);
      console.log('📊 Available hotels:', availableHotels);
    }
    
    // If no search session ID, return what we have
    if (!searchSessionId) {
      console.log('⚠️ No search session ID received');
      return {
        success: true,
        hotels: transformHotelData(initialHotels),
        totalHotels: totalHotels,
        availableHotels: availableHotels,
        searchSessionId: `fallback_${Date.now()}`,
        message: 'Search completed without session polling'
      };
    }
    
    // If search is already finished, return initial results
    if (searchData.data.search_finished) {
      console.log('✅ Search already finished, returning results');
      return {
        success: true,
        hotels: transformHotelData(initialHotels),
        totalHotels: totalHotels,
        availableHotels: availableHotels,
        searchSessionId: searchSessionId
      };
    }
    
    // Start polling for more results
    console.log('🔄 Starting result polling...');
    const pollingResults = await pollSearchResults(searchSessionId, userSession.cookies);
    
    // Combine initial and polled results
    const allHotels = [...initialHotels, ...(pollingResults.hotels || [])];
    const finalTotalHotels = pollingResults.totalHotels || totalHotels;
    const finalAvailableHotels = pollingResults.availableHotels || availableHotels;
    
    const duration = Date.now() - startTime;
    console.log(`✅ Search completed in ${duration}ms`);
    console.log(`🏨 Final results: ${allHotels.length} hotels`);
    
    return {
      success: true,
      hotels: transformHotelData(allHotels),
      totalHotels: finalTotalHotels,
      availableHotels: finalAvailableHotels,
      searchSessionId: searchSessionId,
      searchDuration: `${duration}ms`,
      metadata: {
        initialHotels: initialHotels.length,
        polledHotels: pollingResults.hotels?.length || 0,
        pollingCompleted: true
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
        destination,
        checkin,
        checkout,
        errorType: error.name || 'Unknown'
      }
    };
  } finally {
    const duration = Date.now() - startTime;
    console.log(`🏁 Search service completed in ${duration}ms`);
    console.log('=== END RATEHAWK HOTEL SEARCH ===');
  }
}

/**
 * Poll search results from RateHawk API
 */
async function pollSearchResults(searchSessionId, cookies, maxAttempts = 15) {
  console.log('🔄 Starting search result polling...');
  console.log('🔗 Session ID:', searchSessionId);
  
  let allHotels = [];
  let totalHotels = 0;
  let availableHotels = 0;
  
  const cookieString = formatCookiesForRequest(cookies);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`📡 Polling attempt ${attempt}/${maxAttempts}...`);
      
      const pollUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/serp?session=${searchSessionId}`;
      
      const response = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://www.ratehawk.com/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      console.log(`📨 Polling response ${attempt}: ${response.status}`);
      
      if (!response.ok) {
        console.log(`⚠️ Non-OK response: ${response.status} ${response.statusText}`);
        await delay(2000);
        continue;
      }
      
      const data = await response.json();
      console.log(`📊 Polling response ${attempt}:`, JSON.stringify(data, null, 2));
      
      // Handle polling errors
      if (data.error) {
        if (data.error === 'EOF') {
          console.log('✅ Search completed - EOF reached');
          break;
        }
        console.log(`⚠️ Polling error: ${data.error}`);
        await delay(2000);
        continue;
      }
      
      // Process successful response
      if (data.data) {
        const responseData = data.data;
        
        // Update counters
        if (typeof responseData.total_hotels === 'number') {
          totalHotels = responseData.total_hotels;
        }
        if (typeof responseData.available_hotels === 'number') {
          availableHotels = responseData.available_hotels;
        }
        
        // Collect new hotels
        if (responseData.hotels && Array.isArray(responseData.hotels)) {
          const newHotels = responseData.hotels;
          console.log(`📨 Received ${newHotels.length} new hotels`);
          
          // Add new hotels (avoid duplicates)
          newHotels.forEach(hotel => {
            const hotelId = hotel.id || hotel.hotel_id;
            const existingHotel = allHotels.find(h => (h.id || h.hotel_id) === hotelId);
            if (!existingHotel) {
              allHotels.push(hotel);
            }
          });
          
          console.log(`🏨 Total unique hotels: ${allHotels.length}`);
        }
        
        // Check if search is complete
        if (responseData.search_finished === true || responseData.finished === true) {
          console.log('✅ Search marked as finished');
          break;
        }
      }
      
      // Wait before next attempt
      await delay(2000);
      
    } catch (fetchError) {
      console.error(`💥 Polling attempt ${attempt} failed:`, fetchError.message);
      await delay(3000);
    }
  }
  
  console.log(`📊 Polling completed: ${allHotels.length} hotels collected`);
  
  return {
    hotels: allHotels,
    totalHotels: totalHotels,
    availableHotels: availableHotels
  };
}

/**
 * Format guest data for RateHawk API
 */
function formatGuestsForRateHawk(guests) {
  console.log('🏨 Raw guest data:', guests);
  
  if (Array.isArray(guests) && guests.length > 0 && guests[0].adults) {
    return guests;
  }
  
  if (Array.isArray(guests) && guests.length > 0 && typeof guests[0] === 'number') {
    return guests.map(adults => ({ adults: Math.max(1, adults) }));
  }
  
  if (typeof guests === 'number') {
    return [{ adults: Math.max(1, guests) }];
  }
  
  return [{ adults: 2 }];
}

/**
 * Get destination information
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
  };
  
  return destinationMapping[destination] || { id: destination, name: destination };
}

/**
 * Format cookies for HTTP requests
 */
function formatCookiesForRequest(cookies) {
  if (!Array.isArray(cookies)) return '';
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
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
  
  return csrfCookie ? csrfCookie.value : '';
}

/**
 * Transform hotel data to consistent format (FIXED for RateHawk structure)
 */
function transformHotelData(hotels) {
  if (!Array.isArray(hotels)) {
    console.log('⚠️ Hotels data is not an array:', typeof hotels);
    return [];
  }
  
  console.log(`🔄 Transforming ${hotels.length} hotels...`);
  console.log(`🔍 Sample hotel structure:`, hotels[0] ? Object.keys(hotels[0]) : 'No hotels');
  
  // Log full structure of first hotel for debugging
  if (hotels[0]) {
    console.log('🔍 First hotel full data:', JSON.stringify(hotels[0], null, 2));
  }
  
  return hotels.map((hotel, index) => {
    try {
      // RateHawk specific data extraction
      const hotelId = hotel.ota_hotel_id || hotel.requested_hotel_id || hotel.id || `hotel_${index}`;
      
      // Name from static_vm or fallback
      const hotelName = hotel.static_vm?.name || 
                       hotel.name || 
                       hotel.hotel_name || 
                       hotel.ota_hotel_id?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) ||
                       `Hotel ${index + 1}`;
      
      // ✅ FIXED: Correct price extraction from RateHawk structure
      const rates = hotel.rates || [];
      let price = 0;
      let currency = 'USD';
      
      if (rates.length > 0) {
        const firstRate = rates[0];
        
        // RateHawk stores price in payment_options.payment_types[0].amount
        if (firstRate.payment_options?.payment_types?.[0]) {
          const paymentType = firstRate.payment_options.payment_types[0];
          price = parseFloat(paymentType.amount || paymentType.show_amount || 0);
          currency = paymentType.currency_code || paymentType.show_currency_code || 'USD';
        }
        
        // Fallback to other possible price fields
        if (price === 0) {
          price = firstRate.total_price || 
                  firstRate.daily_prices || 
                  firstRate.price || 
                  firstRate.amount ||
                  firstRate.net_price ||
                  firstRate.gross_price || 0;
          currency = firstRate.currency || 'USD';
        }
        
        // Log price extraction for debugging
        if (index < 3) {
          console.log(`💰 Hotel ${index} price extraction:`, {
            ratesLength: rates.length,
            paymentAmount: firstRate.payment_options?.payment_types?.[0]?.amount,
            extractedPrice: price,
            currency: currency
          });
        }
      }
      
      // ✅ FIXED: Correct star rating extraction (RateHawk uses 50 = 5 stars)
      let stars = 0;
      if (hotel.static_vm?.star_rating) {
        stars = Math.round(hotel.static_vm.star_rating / 10); // Convert 50 -> 5 stars
      } else {
        stars = hotel.static_vm?.stars || 
               hotel.stars || 
               hotel.rating || 
               hotel.star_rating || 0;
      }
      
      // ✅ FIXED: Correct review data extraction from ta_rating
      let reviewScore = 0;
      let reviewCount = 0;
      
      if (hotel.static_vm?.ta_rating) {
        reviewScore = hotel.static_vm.ta_rating.rating || 0;
        reviewCount = hotel.static_vm.ta_rating.num_reviews || 0;
      } else if (hotel.static_vm?.rating_total) {
        reviewScore = hotel.static_vm.rating_total || 0;
        reviewCount = hotel.static_vm.rating?.count || 0;
      } else {
        reviewScore = hotel.static_vm?.review_score || 
                     hotel.static_vm?.guest_rating ||
                     hotel.review_score || 
                     hotel.guest_rating || 0;
        
        reviewCount = hotel.static_vm?.review_count || 
                     hotel.static_vm?.reviews_count ||
                     hotel.review_count || 
                     hotel.reviews_count || 0;
      }
      
      // ✅ FIXED: Better location extraction
      const location = hotel.static_vm?.address || 
                     hotel.static_vm?.full_address ||
                     hotel.static_vm?.city || 
                     hotel.static_vm?.region ||
                     hotel.location || 
                     hotel.address || 
                     hotel.city ||
                     "Rio de Janeiro, Brazil";
      
      // ✅ FIXED: Better amenities extraction from serp_filters and room amenities
      let mappedAmenities = [];
      
      // Extract from serp_filters (hotel-level amenities)
      const serpFilters = hotel.static_vm?.serp_filters || [];
      const roomAmenities = hotel.rates?.[0]?.rooms?.[0]?.amenities_data || 
                          hotel.rates?.[0]?.amenities_data || [];
      
      // Combine both sources
      const allAmenities = [...serpFilters, ...roomAmenities];
      
      if (allAmenities.length > 0) {
        const amenityMap = {
          'has_wifi': 'Free WiFi',
          'has_internet': 'Free WiFi', 
          'has_parking': 'Free Parking',
          'has_pool': 'Swimming Pool',
          'has_fitness': 'Fitness Center',
          'has_spa': 'Spa & Wellness',
          'has_meal': 'Restaurant',
          'has_busyness': 'Business Center',
          'has_disabled_support': 'Accessible',
          'has_smoking': 'Smoking Allowed',
          'has_kids': 'Kid Friendly',
          'has_pets': 'Pet Friendly',
          'air-conditioning': 'Air Conditioning',
          'private-bathroom': 'Private Bathroom',
          'non-smoking': 'Non-Smoking',
          'has_bathroom': 'Private Bathroom',
          'with-view': 'Great Views'
        };
        
        mappedAmenities = allAmenities.map(a => {
          if (typeof a === 'string') {
            return amenityMap[a] || a.replace(/^has_/, '').replace(/_/g, ' ');
          }
          return 'Amenity';
        }).filter(Boolean).slice(0, 5);
      }
      
      // Fallback to static_vm amenities if available
      if (mappedAmenities.length === 0) {
        const rawAmenities = hotel.static_vm?.amenities || 
                            hotel.static_vm?.facilities ||
                            hotel.amenities || 
                            hotel.facilities || [];
        
        mappedAmenities = Array.isArray(rawAmenities) ? 
          rawAmenities.slice(0, 5).map(a => {
            if (typeof a === 'string') return a;
            if (a && a.name) return a.name;
            if (a && a.title) return a.title;
            return 'Amenity';
          }) : [];
      }
      
      // ✅ FIXED: Better image extraction with URL template processing
      let image = "/placeholder-hotel.jpg";
      
      if (hotel.static_vm?.images && hotel.static_vm.images.length > 0) {
        const firstImage = hotel.static_vm.images[0];
        if (firstImage.tmpl) {
          // RateHawk uses template URLs like: https://cdn.worldota.net/t/{size}/content/...
          // Replace {size} with a specific size
          image = firstImage.tmpl.replace('{size}', '640x400');
        } else if (firstImage.url) {
          image = firstImage.url;
        }
      } else {
        // Fallback to other possible image sources
        image = hotel.static_vm?.main_photo_url || 
               hotel.static_vm?.image_url ||
               hotel.static_vm?.photos?.[0]?.url ||
               hotel.static_vm?.photos?.[0]?.src ||
               hotel.main_photo_url || 
               hotel.image_url ||
               hotel.photos?.[0]?.url ||
               hotel.photos?.[0]?.src ||
               "/placeholder-hotel.jpg";
      }
      
      // ✅ FIXED: Better description extraction
      const description = hotel.static_vm?.description || 
                         hotel.static_vm?.summary ||
                         hotel.description || 
                         hotel.summary ||
                         "";

      const transformedHotel = {
        id: hotelId,
        name: hotelName,
        location: location,
        rating: Math.min(5, Math.max(0, parseInt(stars) || 0)),
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
        ratehawk_data: hotel
      };
      
      // Enhanced logging for first few transformations
      if (index < 3) {
        console.log(`🏨 DETAILED hotel ${index} transformation:`, {
          originalId: hotel.ota_hotel_id,
          transformedName: transformedHotel.name,
          transformedPrice: transformedHotel.price.amount,
          transformedLocation: transformedHotel.location,
          transformedRating: transformedHotel.rating,
          transformedReviews: `${transformedHotel.reviewScore}/10 (${transformedHotel.reviewCount} reviews)`,
          hasImage: transformedHotel.image !== "/placeholder-hotel.jpg",
          imageUrl: transformedHotel.image.substring(0, 80) + '...',
          amenitiesCount: transformedHotel.amenities.length,
          amenitiesList: transformedHotel.amenities,
          hasDescription: transformedHotel.description.length > 0,
          rawStatic_vm: hotel.static_vm ? 'Present' : 'Missing',
          rawRatesCount: (hotel.rates || []).length,
          rawStarRating: hotel.static_vm?.star_rating,
          rawTaRating: hotel.static_vm?.ta_rating,
          rawSerpFilters: hotel.static_vm?.serp_filters
        });
      }
      
      return transformedHotel;
    } catch (error) {
      console.error(`💥 Error transforming hotel ${index}:`, error);
      console.log(`📋 Hotel data that failed:`, JSON.stringify(hotel, null, 2));
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