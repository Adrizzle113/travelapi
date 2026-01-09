/**
 * RateHawk Static Info Routes
 * Handles fetching hotel descriptions, amenities, policies
 */

import express from "express";
import axios from "axios";
import fetch from "node-fetch";
import { 
  extractDescription, 
  extractAmenities, 
  extractPolicies 
} from "../../utils/ratehawk-helpers.js";

const router = express.Router();

// RateHawk API Credentials
const RATEHAWK_CREDENTIALS = {
  username: process.env.RATEHAWK_API_KEY_ID || process.env.WORLDOTA_KEY_ID || "11606",
  password: process.env.RATEHAWK_API_KEY || process.env.WORLDOTA_API_KEY || "ff9702bb-ba93-4996-a31e-547983c51530",
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
    // Check if hotelId is numeric (hid) or string slug (id)
    // Numeric IDs should use 'hid', string slugs should use 'id'
    const isNumericId = /^\d+$/.test(String(hotelId));
    const requestBody = isNumericId 
      ? { hid: parseInt(hotelId), language: language }
      : { id: hotelId, language: language };

    console.log("🔍 Calling RateHawk API: https://api.worldota.net/api/b2b/v3/hotel/info/");
    console.log(`   Using ${isNumericId ? 'hid' : 'id'}: ${hotelId}`);
    
    const result = await axios.post(
      "https://api.worldota.net/api/b2b/v3/hotel/info/",
      requestBody,
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
      // Hotel Identifiers
      hid: hotelData.hid || null,
      id: hotelData.id || null,
      
      // Basic Information
      name: hotelData.name || null,
      kind: hotelData.kind || null,
      starRating: hotelData.star_rating || null,
      
      // Location Information
      region: hotelData.region || null, // Full region object with name, country_code, country_name
      address: hotelData.address || null,
      postal_code: hotelData.postal_code || null,
      coordinates: {
        latitude: hotelData.latitude || null,
        longitude: hotelData.longitude || null,
      },
      
      // Contact Information
      email: hotelData.email || null,
      phone: hotelData.phone || null,
      website: hotelData.website || null,
      
      // Check-in/Check-out
      check_in_time: hotelData.check_in_time || null,
      check_out_time: hotelData.check_out_time || null,
      checkInTime: hotelData.check_in_time || null, // Keep for backward compatibility
      checkOutTime: hotelData.check_out_time || null, // Keep for backward compatibility
      
      // Description (both flattened and structured)
      description: extractDescription(hotelData.description_struct),
      description_struct: hotelData.description_struct || null, // Keep raw structured data
      
      // Amenities (both flattened and grouped)
      amenities: extractAmenities(hotelData.amenity_groups),
      amenity_groups: hotelData.amenity_groups || null, // Keep grouped structure
      
      // Policies (both parsed and structured)
      policies: extractPolicies(hotelData.policy_struct),
      policy_struct: hotelData.policy_struct || null, // Keep structured data
      
      // Images and Media
      images: hotelData.images || [],
      
      // Room Information
      roomGroups: hotelData.room_groups || [],
      
      // Additional Data
      facts: hotelData.facts || {},
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

// ================================
// GET HOTEL STATIC INFO BY HID
// ================================

/**
 * GET /api/ratehawk/hotel/static-info/:hid
 * Get hotel static information by numeric hid (hotel ID)
 * This endpoint accepts hid as a URL parameter for easier frontend integration
 */
router.get('/hotel/static-info/:hid', async (req, res) => {
  const startTime = Date.now();
  const { hid } = req.params;
  const language = req.query.language || 'en';

  console.log("📚 === GET HOTEL STATIC INFO BY HID ===");
  console.log(`🏨 Hotel HID: ${hid}`);
  console.log(`🌍 Language: ${language}`);

  if (!hid) {
    return res.status(400).json({
      success: false,
      error: "Hotel HID is required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const keyId = process.env.RATEHAWK_API_KEY_ID || process.env.WORLDOTA_KEY_ID || "11606";
    const apiKey = process.env.RATEHAWK_API_KEY || process.env.WORLDOTA_API_KEY || "ff9702bb-ba93-4996-a31e-547983c51530";
    
    const auth = Buffer.from(`${keyId}:${apiKey}`).toString('base64');

    console.log("🔍 Calling WorldOTA API: https://api.worldota.net/api/b2b/v3/hotel/info/");
    
    const response = await fetch('https://api.worldota.net/api/b2b/v3/hotel/info/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({ hid: String(hid), language: language })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ WorldOTA API error: ${response.status} ${response.statusText}`);
      
      if (response.status === 404 || errorData.error === 'hotel_not_found') {
        return res.status(404).json({
          success: false,
          error: "Hotel not found",
          message: "This hotel may not be available in the inventory yet.",
          hid: hid,
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`,
        });
      }

      return res.status(response.status).json({
        success: false,
        error: errorData.error || `API request failed: ${response.statusText}`,
        hid: hid,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      });
    }

    const data = await response.json();

    if (data.status === 'ok' && data.data) {
      const hotelData = data.data;
      
      console.log("✅ Received hotel data from API");
      console.log(`   Hotel name: ${hotelData.name || 'Unknown'}`);
      console.log(`   City: ${hotelData.region?.name || 'N/A'}`);
      console.log(`   Country: ${hotelData.region?.country_code || 'N/A'}`);
      console.log(`   Images: ${hotelData.images?.length || 0}`);

      res.json({
        success: true,
        hotel: {
          // Hotel Identifiers
          hid: hotelData.hid || parseInt(hid),
          id: hotelData.id || null,
          
          // Basic Information
          name: hotelData.name || null,
          star_rating: hotelData.star_rating || null,
          kind: hotelData.kind || null,
          
          // Location Information
          region: hotelData.region || null, // Full region object
          city: hotelData.region?.name || null, // Convenience field
          country: hotelData.region?.country_code || null, // Convenience field
          country_name: hotelData.region?.country_name || null,
          address: hotelData.address || null,
          postal_code: hotelData.postal_code || null,
          latitude: hotelData.latitude || null,
          longitude: hotelData.longitude || null,
          
          // Contact Information
          email: hotelData.email || null,
          phone: hotelData.phone || null,
          website: hotelData.website || null,
          
          // Check-in/Check-out Times
          check_in_time: hotelData.check_in_time || null,
          check_out_time: hotelData.check_out_time || null,
          
          // Images
          images: hotelData.images || [],
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      });
    } else {
      console.log(`⚠️ Unexpected API response format`);
      res.status(404).json({
        success: false,
        error: data.error || 'Hotel not found',
        hid: hid,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel static-info error:", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      hid: hid,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

export default router;
