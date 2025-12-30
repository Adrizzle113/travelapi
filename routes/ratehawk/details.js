/**
 * RateHawk Hotel Details Routes
 * Uses ETG API for hotel information
 */

import express from "express";
import { getHotelInformation } from "../../services/hotel/hotelInfoService.js";
import { getHotelWithRates } from "../../services/etg/etgClient.js";
import { normalizeResidency } from "../../utils/residencyNormalizer.js";

const router = express.Router();

// ================================
// HOTEL DETAILS WITH RATES
// ================================

router.post("/hotel/details", async (req, res) => {
  const startTime = Date.now();
  const {
    hotelId,
    hotel_id,
    searchContext,
    checkin,
    checkout,
    guests,
    currency = "USD",
    language = "en",
    residency = "us"
  } = req.body;

  const finalHotelId = hotelId || hotel_id;
  const finalCheckin = checkin || searchContext?.checkin;
  const finalCheckout = checkout || searchContext?.checkout;
  const finalGuests = guests || searchContext?.guests || [{ adults: 2, children: [] }];

  // Normalize residency parameter (e.g., "en-us" → "us")
  const normalizedResidency = normalizeResidency(residency);

  console.log("🏨 === HOTEL DETAILS REQUEST ===");
  console.log(`Hotel ID: ${finalHotelId}`);
  console.log(`Check-in: ${finalCheckin}`);
  console.log(`Check-out: ${finalCheckout}`);
  console.log(`🌍 Residency: ${residency} → ${normalizedResidency} (normalized)`);

  // Validation
  if (!finalHotelId) {
    return res.status(400).json({
      success: false,
      error: "hotel_id or hotelId is required"
    });
  }

  try {
    // Get static hotel info (cached for 7 days)
    const hotelInfo = await getHotelInformation(finalHotelId, language);

    // Get current rates if search params provided
    let rates = [];
    let room_groups = [];
    let bookingOptions = [];
    
    if (finalCheckin && finalCheckout) {
      // ✅ Convert residency to uppercase for /search/hp/ endpoint
      const hotel = await getHotelWithRates(finalHotelId, {
        checkin: finalCheckin,
        checkout: finalCheckout,
        guests: finalGuests,
        currency,
        language,
        residency: normalizedResidency.toUpperCase()  // ✅ Uppercase for /search/hp/
      });
      
      // Extract data from hotel object
      // ✅ /search/hp/ endpoint returns hotel with rates and room_groups
      // getHotelWithRates returns a single hotel object directly
      rates = hotel.rates || [];
      room_groups = hotel.room_groups || [];
      
      // Verify book_hash is present in rates (for debugging)
      if (rates.length > 0 && !rates[0].book_hash) {
        console.warn('⚠️ Warning: Rate object missing book_hash field. Expected from /search/hp/ endpoint.');
        console.warn('⚠️ First rate object keys:', Object.keys(rates[0] || {}));
      } else if (rates.length > 0) {
        console.log(`✅ Found ${rates.length} rates with book_hash from /search/hp/ endpoint`);
      }
      
      // Build booking options
      bookingOptions = rates.map((rate, index) => ({
        rateIndex: index,
        rateId: rate.id || `rate_${index}`,
        roomName: rate.room_name || 'Room',
        price: rate.payment_options?.payment_types?.[0]?.show_amount || 0,
        currency: rate.currency || currency,
        cancellationPolicy: rate.cancellation_info || {},
        mealPlan: rate.meal_data?.meal || 'Room only',
        bedding: rate.room_data_trans?.bedding_type || 'Standard'
      }));
    }

    const duration = Date.now() - startTime;

    // Format response to match frontend expectations
    res.json({
      success: true,
      data: {
        data: {
          hotels: [{
            id: finalHotelId,
            name: hotelInfo.name,
            address: hotelInfo.address,
            city: hotelInfo.city,
            country: hotelInfo.country,
            star_rating: hotelInfo.star_rating,
            images: hotelInfo.images || [],
            amenities: hotelInfo.amenities || [],
            description: hotelInfo.description,
            coordinates: hotelInfo.coordinates,
            rates: rates,
            room_groups: room_groups
          }]
        }
      },
      from_cache: hotelInfo.from_cache || false,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel details error:", error);
    console.error("   Error details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method
    });

    // Check if it's a 404 from ETG API
    if (error.response?.status === 404 || error.statusCode === 404) {
      const isEndpointIssue = error.message?.includes('hotelpage') || error.config?.url?.includes('hotelpage');
      return res.status(404).json({
        success: false,
        error: isEndpointIssue ? "ETG API endpoint not found" : "Hotel not found",
        message: isEndpointIssue 
          ? "The ETG API endpoint path may be incorrect. Please verify the endpoint configuration."
          : (error.response?.data?.error?.message || "The hotel may not be available in the ETG inventory, or the hotel ID is invalid."),
        hotelId: finalHotelId,
        etgError: error.response?.data?.error || error.message || "not found",
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

    // Check if it's an authentication error
    if (error.response?.status === 401 || error.response?.status === 403 || error.statusCode === 401 || error.statusCode === 403) {
      return res.status(401).json({
        success: false,
        error: "API authentication failed",
        message: "Invalid ETG API credentials or insufficient permissions",
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: `Failed to get hotel details: ${error.message}`,
      hotelId: finalHotelId,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// SIMPLE HOTEL INFO (No Rates)
// ================================

router.get("/hotel/details-t", async (req, res) => {
  const { hotel_id } = req.query;

  if (!hotel_id) {
    return res.status(400).json({
      error: "Hotel ID is required"
    });
  }

  try {
    const hotelInfo = await getHotelInformation(hotel_id);

    res.json({
      error: "",
      data: {
        hotel: {
          id: hotel_id,
          name: hotelInfo.name,
          address: hotelInfo.address,
          city: hotelInfo.city,
          images: hotelInfo.images,
          amenities: hotelInfo.amenities,
          description: hotelInfo.description
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: `Hotel details failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// ENHANCED DETAILS (Alias for /hotel/details)
// ================================

router.post("/hotel-details", async (req, res) => {
  // Forward to /hotel/details
  req.url = '/hotel/details';
  return router.handle(req, res);
});

export default router;