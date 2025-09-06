// WorldOTA API Service - Direct API integration
const fetch = require("node-fetch");

class WorldOTAService {
  constructor() {
    // Add your WorldOTA API credentials here
    this.keyId = process.env.WORLDOTA_KEY_ID || "<KEY_ID>";
    this.apiKey = process.env.WORLDOTA_API_KEY || "<API_KEY>";
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

      return {
        id: hotel.id,
        name: hotel.id
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        location: "Location from API", // Extract from static data if available
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
}

module.exports = { WorldOTAService };
