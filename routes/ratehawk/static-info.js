/**
 * RateHawk Static Info Routes
 * Handles fetching hotel descriptions, amenities, policies
 */

import express from "express";
import axios from "axios";
import { 
  extractDescription, 
  extractAmenities, 
  extractPolicies 
} from "../../utils/ratehawk-helpers.js";

const router = express.Router();

// RateHawk API Credentials
const RATEHAWK_CREDENTIALS = {
  username: "11606",
  password: "ff9702bb-ba93-4996-a31e-547983c51530",
};

// ================================
// HOTEL STATIC INFO
// ================================

router.post("/hotel/static-info", async (req, res) => {
  const startTime = Date.now();
  const { hotelId, language = "en" } = req.body;

  console.log("📚 === HOTEL STATIC INFO REQUEST ===");
  console.log(`🏨 Hotel ID: ${hotelId}`);
  console.log(`🌍 Language: ${language}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  if (!hotelId) {
    return res.status(400).json({
      success: false,
      error: "Hotel ID is required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    console.log("🔍 Calling RateHawk API: https://api.worldota.net/api/b2b/v3/hotel/info/");
    
    const result = await axios.post(
      "https://api.worldota.net/api/b2b/v3/hotel/info/",
      {
        id: hotelId,
        language: language
      },
      {
        auth: RATEHAWK_CREDENTIALS,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BookjaAPI/1.0",
        },
      }
    );

    const duration = Date.now() - startTime;

    if (!result.data || !result.data.data) {
      console.log("⚠️ No data returned from hotel/info endpoint");
      return res.status(404).json({
        success: false,
        error: "Hotel static information not available",
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      });
    }

    const hotelData = result.data.data;
    console.log("✅ Received hotel data from API");
    console.log(`   Hotel name: ${hotelData.name || 'Unknown'}`);
    console.log(`   Has description_struct: ${!!hotelData.description_struct}`);
    console.log(`   Has amenity_groups: ${!!hotelData.amenity_groups}`);

    const extractedInfo = {
      description: extractDescription(hotelData.description_struct),
      check_in_time: hotelData.check_in_time || null,
      check_out_time: hotelData.check_out_time || null,
      checkInTime: hotelData.check_in_time || null, // Keep for backward compatibility
      checkOutTime: hotelData.check_out_time || null, // Keep for backward compatibility
      address: hotelData.address || null,
      email: hotelData.email || null,
      phone: hotelData.phone || null,
      name: hotelData.name || null,
      starRating: hotelData.star_rating || null,
      coordinates: {
        latitude: hotelData.latitude || null,
        longitude: hotelData.longitude || null,
      },
      amenities: extractAmenities(hotelData.amenity_groups),
      policies: extractPolicies(hotelData.policy_struct),
      images: hotelData.images || [],
      roomGroups: hotelData.room_groups || [],
      facts: hotelData.facts || {},
      kind: hotelData.kind || null,
      metapolicyExtraInfo: hotelData.metapolicy_extra_info || null,
    };

    console.log(`✅ Static info extraction completed in ${duration}ms`);
    console.log(`   Description: ${extractedInfo.description ? `${extractedInfo.description.length} chars` : 'Not found'}`);
    console.log(`   Check-in: ${extractedInfo.checkInTime || 'Not found'}`);
    console.log(`   Check-out: ${extractedInfo.checkOutTime || 'Not found'}`);
    console.log(`   Amenities: ${extractedInfo.amenities.length} items`);
    console.log(`   Policies: ${extractedInfo.policies.length} sections`);
    console.log(`   Images: ${extractedInfo.images.length} images`);

    res.json({
      success: true,
      data: extractedInfo,
      metadata: {
        source: "RateHawk API v3 - hotel/info",
        hotelId: hotelId,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        dataQuality: {
          hasDescription: !!extractedInfo.description,
          hasCheckInTime: !!extractedInfo.checkInTime,
          hasCheckOutTime: !!extractedInfo.checkOutTime,
          policiesCount: extractedInfo.policies.length,
          amenitiesCount: extractedInfo.amenities.length,
          hasCoordinates: !!(extractedInfo.coordinates.latitude && extractedInfo.coordinates.longitude),
          imagesCount: extractedInfo.images.length,
        }
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Static info fetch error:", error.message);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error:`, error.response.data?.error || 'Unknown');
      
      if (error.response.status === 404 || error.response.data?.error === 'hotel_not_found') {
        return res.status(404).json({
          success: false,
          error: "Hotel not found in RateHawk database",
          message: "This hotel may not be available in the ETG inventory yet.",
          hotelId: hotelId,
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`,
        });
      }
      
      if (error.response.status === 401 || error.response.status === 403) {
        return res.status(401).json({
          success: false,
          error: "Authentication failed",
          message: "Invalid API credentials",
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: `Failed to fetch static info: ${error.message}`,
      hotelId: hotelId,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

export default router;
