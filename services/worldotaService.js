// WorldOTA API Service - Direct API integration
import fetch from "node-fetch";

// #region agent log
if (typeof fetch !== 'undefined') {
  fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worldotaService.js:4',message:'ES module loaded successfully',data:{moduleType:'ESM',fetchImported:typeof fetch},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
}
// #endregion

class WorldOTAService {
  constructor() {
    // #region agent log
    if (typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worldotaService.js:9',message:'WorldOTAService constructor called',data:{keyId:process.env.WORLDOTA_KEY_ID||'11606',hasApiKey:!!process.env.WORLDOTA_API_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    // Add your WorldOTA API credentials here
    this.keyId = process.env.WORLDOTA_KEY_ID || "11606";
    this.apiKey = process.env.WORLDOTA_API_KEY || "ff9702bb-ba93-4996-a31e-547983c51530";
    this.baseUrl = "https://api.worldota.net/api/b2b/v3";
  }

  /**
   * Search hotels using WorldOTA API - This gives us multiple room rates!
   */
  async searchHotels({
    checkin,
    checkout,
    regionId,
    guests = [{ adults: 2, children: [] }],
    residency = "gb",
    language = "en",
    currency = "EUR",
  }) {
    try {
      console.log("🌍 === WORLDOTA API SEARCH ===");
      console.log(`📅 ${checkin} → ${checkout}`);
      console.log(`🗺️ Region ID: ${regionId}`);
      console.log(`👥 Guests:`, guests);

      const searchData = {
        checkin,
        checkout,
        residency,
        language,
        guests,
        region_id: parseInt(regionId),
        currency,
      };

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/search/serp/region/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(
        `✅ WorldOTA API Success: ${
          data.data?.hotels?.length || 0
        } hotels found`
      );

      // Process the response to extract multiple room rates
      return this.processWorldOTAResponse(data);
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Search hotels by hotel IDs using WorldOTA API
   * @param {Object} params - Search parameters
   * @param {Array<number>|Array<string>} params.ids - Hotel IDs (alternative to hids)
   * @param {Array<number>|Array<string>} params.hids - Hotel IDs (alternative to ids)
   * @param {string} params.checkin - Check-in date (YYYY-MM-DD)
   * @param {string} params.checkout - Check-out date (YYYY-MM-DD)
   * @param {Array} params.guests - Guest configuration (default: [{ adults: 2, children: [] }])
   * @param {string} params.residency - Residency country code (default: "gb")
   * @param {string} params.language - Language code (default: "en")
   * @param {string} params.currency - Currency code (default: "EUR")
   */
  async searchHotelsByIds({
    ids,
    hids,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    residency = "gb",
    language = "en",
    currency = "EUR",
  }) {
    try {
      if (!ids && !hids) {
        throw new Error("Either 'ids' or 'hids' must be provided");
      }

      console.log("🌍 === WORLDOTA API SEARCH BY HOTEL IDS ===");
      console.log(`📅 ${checkin} → ${checkout}`);
      console.log(`🏨 Hotel IDs:`, ids || hids);
      console.log(`👥 Guests:`, guests);

      const searchData = {
        checkin,
        checkout,
        residency,
        language,
        guests,
        currency,
      };

      // Use ids or hids (both seem to work the same way)
      // Note: IDs must be strings, not numbers
      if (ids) {
        const idsArray = Array.isArray(ids) ? ids : [ids];
        searchData.ids = idsArray.map(id => String(id));
      } else {
        const hidsArray = Array.isArray(hids) ? hids : [hids];
        searchData.hids = hidsArray.map(id => String(id));
      }

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/search/serp/hotels/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      console.log(
        `✅ WorldOTA API Success: ${
          data.data?.hotels?.length || 0
        } hotels found`
      );

      // Process the response to extract multiple room rates
      return this.processWorldOTAResponse(data);
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Search hotels by point of interest name (geocodes POI first, then searches)
   * @param {Object} params - Search parameters
   * @param {string} params.poiName - Point of interest name (e.g., "The Forum in Inglewood")
   * @param {number} params.radius - Search radius in meters (default: 5000)
   * @param {string} params.checkin - Check-in date (YYYY-MM-DD)
   * @param {string} params.checkout - Check-out date (YYYY-MM-DD)
   * @param {Array} params.guests - Guest configuration (default: [{ adults: 2, children: [] }])
   * @param {string} params.residency - Residency country code (default: "gb")
   * @param {string} params.language - Language code (default: "en")
   * @param {string} params.currency - Currency code (default: "EUR")
   */
  async searchHotelsByPOI({
    poiName,
    radius = 5000,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    residency = "gb",
    language = "en",
    currency = "EUR",
  }) {
    try {
      // Step 1: Geocode POI name to coordinates using Mapbox
      if (!process.env.MAPBOX_TOKEN) {
        throw new Error("MAPBOX_TOKEN environment variable is required for POI search");
      }

      console.log(`🔍 Geocoding POI: "${poiName}"`);
      const geocodeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(poiName)}.json?access_token=${process.env.MAPBOX_TOKEN}&limit=1`
      );

      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding failed: ${geocodeResponse.statusText}`);
      }

      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData.features || geocodeData.features.length === 0) {
        throw new Error(`POI "${poiName}" not found`);
      }

      const [longitude, latitude] = geocodeData.features[0].center;
      const placeName = geocodeData.features[0].place_name;
      
      console.log(`📍 Found: ${placeName} at ${latitude}, ${longitude}`);

      // Step 2: Use coordinates for geo search
      return this.searchHotelsByGeo({
        latitude,
        longitude,
        radius,
        checkin,
        checkout,
        guests,
        residency,
        language,
        currency,
      });
    } catch (error) {
      console.error("💥 POI search error:", error);
      throw error;
    }
  }

  /**
   * Search hotels by geo coordinates using WorldOTA API
   * @param {Object} params - Search parameters
   * @param {number} params.latitude - Latitude coordinate
   * @param {number} params.longitude - Longitude coordinate
   * @param {number} params.radius - Search radius in meters (1-70000)
   * @param {string} params.checkin - Check-in date (YYYY-MM-DD)
   * @param {string} params.checkout - Check-out date (YYYY-MM-DD)
   * @param {Array} params.guests - Guest configuration (default: [{ adults: 2, children: [] }])
   * @param {string} params.residency - Residency country code (default: "gb")
   * @param {string} params.language - Language code (default: "en")
   * @param {string} params.currency - Currency code (default: "EUR")
   */
  async searchHotelsByGeo({
    latitude,
    longitude,
    radius = 5000,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    residency = "gb",
    language = "en",
    currency = "EUR",
  }) {
    try {
      if (!latitude || !longitude) {
        throw new Error("Latitude and longitude are required");
      }

      if (radius < 1 || radius > 70000) {
        throw new Error("Radius must be between 1 and 70000 meters");
      }

      console.log("🌍 === WORLDOTA API GEO SEARCH ===");
      console.log(`📅 ${checkin} → ${checkout}`);
      console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
      console.log(`📏 Radius: ${radius}m`);
      console.log(`👥 Guests:`, guests);

      const searchData = {
        checkin,
        checkout,
        residency,
        language,
        guests,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseInt(radius),
        currency,
      };

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/search/serp/geo/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      console.log(
        `✅ WorldOTA API Success: ${
          data.data?.hotels?.length || 0
        } hotels found`
      );

      // Process the response to extract multiple room rates
      return this.processWorldOTAResponse(data);
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Autocomplete/suggest hotels and regions using partial name search
   * @param {Object} params - Search parameters
   * @param {string} params.query - Partial name fragment to search for (e.g., "Ber" for Berlin)
   * @param {string} params.language - Language code (default: "en")
   * @returns {Object} Object containing arrays of matching hotels and regions
   */
  async multicomplete({
    query,
    language = "en",
  }) {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error("Query parameter is required");
      }

      console.log("🔍 === WORLDOTA API MULTICOMPLETE ===");
      console.log(`📝 Query: "${query}"`);
      console.log(`🌐 Language: ${language}`);

      const searchData = {
        query: query.trim(),
        language,
      };

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/search/multicomplete/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      
      const hotelsCount = data.data?.hotels?.length || 0;
      const regionsCount = data.data?.regions?.length || 0;
      
      console.log(
        `✅ WorldOTA API Success: ${hotelsCount} hotels, ${regionsCount} regions found`
      );

      return {
        success: true,
        hotels: data.data?.hotels || [],
        regions: data.data?.regions || [],
        totalHotels: hotelsCount,
        totalRegions: regionsCount,
        query: query.trim(),
        language,
        source: "worldota_api",
      };
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Get hotel page details with rates and room groups
   * @param {Object} params - Search parameters
   * @param {string} params.hotelId - Hotel ID
   * @param {string} params.checkin - Check-in date (YYYY-MM-DD)
   * @param {string} params.checkout - Check-out date (YYYY-MM-DD)
   * @param {Array} params.guests - Guest configuration (default: [{ adults: 2, children: [] }])
   * @param {string} params.residency - Residency country code (default: "gb")
   * @param {string} params.language - Language code (default: "en")
   * @param {string} params.currency - Currency code (default: "EUR")
   * @returns {Object} Hotel page data with rates and room groups
   */
  async getHotelPage({
    hotelId,
    checkin,
    checkout,
    guests = [{ adults: 2, children: [] }],
    residency = "gb",
    language = "en",
    currency = "EUR",
  }) {
    try {
      if (!hotelId) {
        throw new Error("Hotel ID is required");
      }

      if (!checkin || !checkout) {
        throw new Error("Check-in and check-out dates are required");
      }

      // Validate dates
      const checkinDate = new Date(checkin);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkinDate.setHours(0, 0, 0, 0);
      
      const daysUntilCheckin = Math.floor((checkinDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilCheckin < 1) {
        throw new Error("Check-in date must be at least tomorrow");
      }

      console.log("🏨 === WORLDOTA API HOTEL PAGE ===");
      console.log(`🏨 Hotel ID: ${hotelId}`);
      console.log(`📅 ${checkin} → ${checkout}`);
      console.log(`👥 Guests:`, guests);
      console.log(`🌍 Residency: ${residency}`);
      console.log(`💰 Currency: ${currency}`);

      // Normalize residency (convert "en-us" to "us")
      const normalizedResidency = residency?.replace(/^en-/, '') || residency;

      const requestData = {
        checkin,
        checkout,
        residency: normalizedResidency,
        language,
        guests,
        id: hotelId,
        currency,
      };

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/search/hp/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error cases
        if (errorData.error === 'invalid_params') {
          throw new Error(
            `Invalid parameters: ${errorData.debug?.validation_error || 'Check dates, hotel ID, and guest configuration'}`
          );
        }
        
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      
      console.log(`✅ WorldOTA API Success: Hotel page retrieved`);
      
      // Handle response structure - API returns data.hotels (array)
      const hotels = data.data?.hotels || [];
      if (hotels.length > 0) {
        const hotel = hotels[0]; // Get first hotel (should be the requested one)
        console.log(`🏨 Hotel: ${hotel.id || 'Unknown'}`);
        console.log(`📦 Hotel ID (hid): ${hotel.hid || 'N/A'}`);
        console.log(`💰 Rates: ${hotel.rates?.length || 0}`);
        
        if (hotel.rates && hotel.rates.length > 0) {
          const firstRate = hotel.rates[0];
          const price = firstRate.payment_options?.payment_types?.[0]?.show_amount || 'N/A';
          const currency = firstRate.payment_options?.payment_types?.[0]?.show_currency_code || 'N/A';
          console.log(`💵 Sample rate: ${price} ${currency}`);
        }
      }

      return {
        success: true,
        data: data.data || {},
        hotels: hotels,
        hotel: hotels[0] || null, // Convenience: first hotel
        status: data.status,
        error: data.error,
        source: "worldota_api",
      };
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Create booking form/process (Step 1 of booking)
   * @param {Object} params - Booking parameters
   * @param {string} params.bookHash - Book hash from search results
   * @param {string} params.partnerOrderId - Unique partner order ID
   * @param {string} params.language - Language code (default: "en")
   * @param {string} params.userIp - User IP address (default: "127.0.0.1")
   * @returns {Object} Booking form data with order_id and payment info
   */
  async createBookingForm({
    bookHash,
    partnerOrderId,
    language = "en",
    userIp = "127.0.0.1",
  }) {
    try {
      if (!bookHash) {
        throw new Error("Book hash is required");
      }

      if (!partnerOrderId) {
        throw new Error("Partner order ID is required");
      }

      console.log("📝 === WORLDOTA API CREATE BOOKING FORM ===");
      console.log(`🔑 Book Hash: ${bookHash}`);
      console.log(`🆔 Partner Order ID: ${partnerOrderId}`);

      const requestData = {
        book_hash: bookHash,
        partner_order_id: partnerOrderId,
        language,
        user_ip: userIp,
      };

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/hotel/order/booking/form/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      
      console.log(`✅ Booking form created successfully`);
      if (data.data) {
        console.log(`📋 Order ID: ${data.data.order_id || 'N/A'}`);
        console.log(`💳 Payment types: ${data.data.payment_types?.length || 0}`);
      }

      return {
        success: true,
        data: data.data || {},
        status: data.status,
        error: data.error,
        source: "worldota_api",
      };
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Create credit card token (Step 2 - only if payment type is "now")
   * Uses PayOTA API for PCI DSS compliant credit card processing
   * @param {Object} params - Credit card parameters
   * @param {string} params.objectId - Order ID from createBookingForm (object_id)
   * @param {string} params.payUuid - Payment UUID (required)
   * @param {string} params.initUuid - Initialization UUID (required)
   * @param {string} params.userFirstName - User first name (required)
   * @param {string} params.userLastName - User last name (required)
   * @param {string} params.cardNumber - Credit card number
   * @param {string} params.cardHolder - Card holder name
   * @param {string} params.expiryMonth - Expiry month (MM format, e.g., "01")
   * @param {string} params.expiryYear - Expiry year (2 digits, e.g., "25" for 2025)
   * @param {string} params.cvc - CVC code (optional)
   * @param {boolean} params.isCvcRequired - Whether CVC is required (default: true)
   * @returns {Object} Token creation status
   */
  async createCreditCardToken({
    objectId,
    payUuid,
    initUuid,
    userFirstName,
    userLastName,
    cardNumber,
    cardHolder,
    expiryMonth,
    expiryYear,
    cvc,
    isCvcRequired = true,
  }) {
    try {
      // Validate required fields
      if (!objectId || !payUuid || !initUuid || !userFirstName || !userLastName) {
        throw new Error("objectId, payUuid, initUuid, userFirstName, and userLastName are required");
      }

      if (!cardNumber || !cardHolder || !expiryMonth || !expiryYear) {
        throw new Error("Card number, holder, month, and year are required");
      }

      // Validate month format (MM)
      if (expiryMonth.length !== 2 || parseInt(expiryMonth) < 1 || parseInt(expiryMonth) > 12) {
        throw new Error("Expiry month must be in MM format (01-12)");
      }

      // Validate year format (2 digits)
      if (expiryYear.length !== 2) {
        throw new Error("Expiry year must be in 2-digit format (e.g., '25' for 2025)");
      }

      console.log("💳 === PAYOTA API CREATE CREDIT CARD TOKEN ===");
      console.log(`📋 Object ID: ${objectId}`);
      console.log(`👤 User: ${userFirstName} ${userLastName}`);
      console.log(`💳 Card: ****${cardNumber.slice(-4)}`);

      const requestData = {
        object_id: objectId,
        pay_uuid: payUuid,
        init_uuid: initUuid,
        user_first_name: userFirstName,
        user_last_name: userLastName,
        is_cvc_required: isCvcRequired,
        credit_card_data_core: {
          year: expiryYear,
          card_number: cardNumber,
          card_holder: cardHolder,
          month: expiryMonth,
        },
      };

      // Add CVC if provided
      if (cvc) {
        requestData.cvc = cvc;
      }

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      // Note: This uses PayOTA API, not WorldOTA API
      const payotaBaseUrl = "https://api.payota.net/api/public/v1";
      const response = await fetch(`${payotaBaseUrl}/manage/init_partners`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `PayOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      
      console.log(`✅ Credit card token created successfully`);
      console.log(`📊 Status: ${data.status || 'N/A'}`);

      return {
        success: true,
        data: data.data || {},
        status: data.status,
        error: data.error,
        source: "payota_api",
      };
    } catch (error) {
      console.error("💥 PayOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Start booking process (Step 3 - after creating form and token if needed)
   * @param {Object} params - Booking start parameters
   * @param {number} params.orderId - Order ID from createBookingForm
   * @param {string} params.token - Credit card token (if payment type is "now")
   * @param {Object} params.guestData - Guest information
   * @param {string} params.language - Language code (default: "en")
   * @returns {Object} Booking process data
   */
  async startBookingProcess({
    orderId,
    token,
    guestData,
    language = "en",
  }) {
    try {
      if (!orderId) {
        throw new Error("Order ID is required");
      }

      console.log("🚀 === WORLDOTA API START BOOKING PROCESS ===");
      console.log(`📋 Order ID: ${orderId}`);
      console.log(`👤 Guest: ${guestData?.first_name || 'N/A'} ${guestData?.last_name || 'N/A'}`);

      const requestData = {
        order_id: orderId,
        language,
      };

      // Add token if provided (for "now" payment type)
      if (token) {
        requestData.token = token;
      }

      // Add guest data if provided
      if (guestData) {
        requestData.guest = guestData;
      }

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/hotel/order/booking/finish/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      
      console.log(`✅ Booking process started`);
      if (data.data) {
        console.log(`📊 Status: ${data.data.status || 'processing'}`);
      }

      return {
        success: true,
        data: data.data || {},
        status: data.status,
        error: data.error,
        source: "worldota_api",
      };
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Check booking process status (Step 4 - polling)
   * @param {Object} params - Check parameters
   * @param {number} params.orderId - Order ID from createBookingForm
   * @param {string} params.partnerOrderId - Partner order ID (optional)
   * @returns {Object} Booking status data
   */
  async checkBookingProcess({
    orderId,
    partnerOrderId,
  }) {
    try {
      if (!orderId && !partnerOrderId) {
        throw new Error("Either order ID or partner order ID is required");
      }

      console.log("🔍 === WORLDOTA API CHECK BOOKING PROCESS ===");
      console.log(`📋 Order ID: ${orderId || 'N/A'}`);
      console.log(`🆔 Partner Order ID: ${partnerOrderId || 'N/A'}`);

      const requestData = {};
      if (orderId) {
        requestData.order_id = orderId;
      }
      if (partnerOrderId) {
        requestData.partner_order_id = partnerOrderId;
      }

      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString(
        "base64"
      );

      const response = await fetch(`${this.baseUrl}/hotel/order/booking/finish/status/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      
      const bookingStatus = data.data?.status || 'unknown';
      console.log(`✅ Booking status: ${bookingStatus}`);

      return {
        success: true,
        data: data.data || {},
        status: data.status,
        bookingStatus: bookingStatus,
        error: data.error,
        source: "worldota_api",
      };
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      throw error;
    }
  }

  /**
   * Process WorldOTA response to extract multiple room rates per hotel
   */
  processWorldOTAResponse(data) {
    if (!data.data?.hotels) {
      return { hotels: [], totalHotels: 0 };
    }

    const processedHotels = data.data.hotels.map((hotel) => {
      console.log(`\n🏨 Processing Hotel: ${hotel.id}`);
      console.log(`💰 Room Rates: ${hotel.rates?.length || 0}`);

      // Extract different room types and prices
      const roomGroups = [];
      const processedRates = new Set();

      if (hotel.rates && Array.isArray(hotel.rates)) {
        hotel.rates.forEach((rate, index) => {
          const paymentType = rate.payment_options?.payment_types?.[0];
          const price = parseFloat(paymentType?.show_amount || 0);
          const currency = paymentType?.show_currency_code || "EUR";
          const roomName = rate.room_name || `Room ${index + 1}`;

          // Create unique key to avoid exact duplicates
          const uniqueKey = `${roomName}_${price}`;

          if (!processedRates.has(uniqueKey) && price > 0) {
            processedRates.add(uniqueKey);

            roomGroups.push({
              groupId: rate.match_hash || `room_${index}`,
              roomType: roomName,
              groupName: roomName,
              price: price,
              currency: currency,
              rates: [
                {
                  rateId: rate.match_hash,
                  roomName: roomName,
                  amount: price,
                  currency: currency,
                  meal: rate.meal || "nomeal",
                  mealPlan: rate.meal || "nomeal",
                  dailyPrices: rate.daily_prices || [],
                  cancellation:
                    rate.payment_options?.payment_types?.[0]
                      ?.cancellation_penalties,
                },
              ],
              hasPricing: true,
              originalRate: rate,
            });

            console.log(`  💳 ${roomName} - €${price} ${currency}`);
          }
        });
      }

      // Sort room groups by price (lowest first)
      roomGroups.sort((a, b) => a.price - b.price);

      console.log(`📊 Processed ${roomGroups.length} unique room types`);
      if (roomGroups.length > 1) {
        const prices = roomGroups.map((r) => r.price);
        console.log(
          `💰 Price Range: €${Math.min(...prices)} - €${Math.max(...prices)}`
        );
      }

      console.log(`📦 Hotel hid for ${hotel.id}: ${hotel.hid}`);

      return {
        id: hotel.id,
        hid: hotel.hid,
        name: hotel.id
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        location: hotel.region?.name || "Unknown",
        rating: 3, // Extract from static data if available
        reviewScore: 0,
        reviewCount: 0,
        price: {
          amount: roomGroups[0]?.price || 0,
          currency: roomGroups[0]?.currency || "EUR",
          period: "night",
        },
        image: "/placeholder-hotel.jpg",
        amenities: [],
        description: `Hotel with ${roomGroups.length} room types available`,
        // ✅ MULTIPLE ROOM GROUPS WITH DIFFERENT PRICES
        roomGroupsWithPricing: roomGroups,
        uniqueRoomCount: roomGroups.length,
        hasBookingData: true,
        ratehawk_data: {
          roomGroupsWithPricing: roomGroups,
          originalData: hotel,
          hid: hotel.hid,
        },
      };
    });

    return {
      success: true,
      hotels: processedHotels,
      totalHotels: data.data.total_hotels || processedHotels.length,
      source: "worldota_api",
      metadata: {
        hotelsWithMultipleRates: processedHotels.filter(
          (h) => h.roomGroupsWithPricing.length > 1
        ).length,
        totalRoomTypes: processedHotels.reduce(
          (sum, h) => sum + h.roomGroupsWithPricing.length,
          0
        ),
      },
    };
  }

  /**
   * Map destination name to WorldOTA region ID
   */
  getRegionId(destination) {
    const regionMapping = {
      "Rio de Janeiro": 965849721,
      "New York": 2008, // Example - you'll need actual region IDs
      "Las Vegas": 2998,
      London: 76876,
      Paris: 69474,
      // Add more mappings as needed
    };

    return regionMapping[destination] || regionMapping["Rio de Janeiro"];
  }

  /**
   * Get filter values from WorldOTA Content API
   * Returns available filter options (languages, countries, amenities, star ratings, etc.)
   * @returns {Object} Filter values including languages, countries, amenities, star ratings, hotel types
   */
  async getFilterValues() {
    try {
      console.log("🔍 === WORLDOTA API GET FILTER VALUES ===");
      
      const auth = Buffer.from(`${this.keyId}:${this.apiKey}`).toString("base64");
      
      const response = await fetch("https://api.worldota.net/api/content/v1/filter_values", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || "";
        
        // #region agent log
        if (typeof fetch !== 'undefined') {
          fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worldotaService.js:1004',message:'Filter values API error',data:{status:response.status,statusText:response.statusText,error:errorMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        }
        // #endregion
        
        // Handle 403 Forbidden - likely means API key doesn't have access to Content API
        if (response.status === 403) {
          console.warn("⚠️ Filter values endpoint returned 403 - API key may not have access to Content API");
          // Return default filter values structure instead of failing
          return {
            success: true,
            data: {
              languages: ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"],
              countries: [],
              amenities: [],
              star_ratings: [1, 2, 3, 4, 5],
              hotel_types: [],
              note: "Using default values - Content API access not available"
            },
            status: "default",
            warning: "Content API returned 403 - using default filter values"
          };
        }
        
        throw new Error(
          `WorldOTA API failed: ${response.status} ${response.statusText} - ${errorMessage}`
        );
      }

      const data = await response.json();
      console.log(`✅ WorldOTA API Success: Filter values retrieved`);
      
      // #region agent log
      if (typeof fetch !== 'undefined') {
        fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worldotaService.js:1025',message:'Filter values retrieved successfully',data:{hasData:!!data.data,status:data.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      }
      // #endregion
      
      return {
        success: true,
        data: data.data || data,
        status: data.status || "ok",
      };
    } catch (error) {
      console.error("💥 WorldOTA API Error:", error);
      // #region agent log
      if (typeof fetch !== 'undefined') {
        fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'worldotaService.js:1035',message:'Filter values exception',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      }
      // #endregion
      throw error;
    }
  }
}

export { WorldOTAService };
