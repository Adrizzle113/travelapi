/**
 * RateHawk Order Management Routes
 * Handles booking flow: prebook, order form, finish, status, info, documents
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  prebookRate,
  prebookMultipleRooms,
  getOrderForm,
  getOrderFormsForMultipleRooms,
  finishOrder,
  finishMultipleRoomOrder,
  getOrderStatus,
  getOrderInfo,
  getOrderDocuments,
  retrieveBookings
} from "../../services/booking/bookingService.js";
import {
  validatePrebook,
  validateOrderForm,
  validateOrderFinish,
  validateOrderId
} from "../../middleware/validation.js";
import { normalizeResidency } from "../../utils/residencyNormalizer.js";

const router = express.Router();

/**
 * Extract user ID from request
 * Supports both Authorization header and userId in body
 */
function getUserId(req) {
  // Try to get from Authorization header (JWT token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In a real implementation, decode JWT to get userId
    // For now, we'll use userId from body if available
  }
  
  // Get from request body (frontend sends userId)
  return req.body.userId || req.body.user_id || null;
}

/**
 * Get user IP address from request
 */
function getUserIp(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         '127.0.0.1';
}

// ================================
// PREBOOK - Lock rate & validate
// ================================

router.post("/prebook", validatePrebook, async (req, res) => {
  const startTime = Date.now();
  const { 
    userId, 
    book_hash, 
    guests = [{ adults: 2, children: [] }],  // ✅ Extract guests (required) - single room format
    residency = "US",  // ✅ Default to uppercase for prebook
    language = "en",  // ✅ Extract language (required)
    currency = "USD",  // Not used in prebook but keep for logging
    price_increase_percent = 0,  // ✅ ADD: Price increase tolerance (0-100, default: 0 = no increase allowed)
    rooms  // ✅ NEW: Multiroom format - array of room objects
  } = req.body;

  console.log("🔒 === PREBOOK REQUEST ===");

  // ✅ DETECT FORMAT: Check if multiroom format (rooms array) or single room format (book_hash)
  const isMultiroom = rooms && Array.isArray(rooms) && rooms.length > 0;

  if (isMultiroom) {
    // ✅ MULTIROOM FORMAT
    console.log(`🏨 Multiroom prebook: ${rooms.length} room(s)`);

    // Validate rooms array (1-6 rooms per RateHawk API v3 limit)
    if (rooms.length > 6) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Rooms array must contain 1-6 rooms (RateHawk API limit). Received: ${rooms.length}`,
          code: "TOO_MANY_ROOMS",
          max_rooms: 6,
          received: rooms.length
        },
        timestamp: new Date().toISOString()
      });
    }

    try {
      // Call multiroom prebook function
      const result = await prebookMultipleRooms(rooms, language);

      // ✅ VALIDATION: Ensure all successful prebooks have booking_hash
      const roomsWithHash = result.successful.filter(r => r.booking_hash);
      if (roomsWithHash.length !== result.successful.length) {
        console.error('⚠️ Some prebooked rooms missing booking_hash:', 
          result.successful.map(r => ({ roomIndex: r.roomIndex, hasHash: !!r.booking_hash }))
        );
        // Log the actual prebook results for debugging
        console.error('Prebook results:', JSON.stringify(result.successful, null, 2));
        
        // Filter out rooms without booking_hash and treat them as failed
        const missingHashRooms = result.successful.filter(r => !r.booking_hash);
        missingHashRooms.forEach(room => {
          if (!result.failed) result.failed = [];
          result.failed.push({
            roomIndex: room.roomIndex,
            error: 'booking_hash not found in prebook response',
            code: 'MISSING_BOOKING_HASH'
          });
        });
        // Update successful to only include rooms with booking_hash
        result.successful = roomsWithHash;
      }

      const duration = Date.now() - startTime;

      // Return multiroom format response
      res.json({
        status: "ok",
        success: result.failed ? result.failed.length === 0 : true,
        data: {
          rooms: result.successful.map(room => ({
            roomIndex: room.roomIndex,
            booking_hash: room.booking_hash,
            book_hash: room.booking_hash,  // Alias for consistency
            price_changed: room.price_changed || false,
            new_price: room.new_price ? parseFloat(room.new_price) : undefined,
            original_price: room.original_price ? parseFloat(room.original_price) : undefined,
            currency: room.new_price_currency || "USD"
          })),
          failed: result.failed,
          total_rooms: rooms.length,
          successful_rooms: result.successful.length,
          failed_rooms: result.failed?.length || 0
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("💥 Multiroom prebook error:", error);

      return res.status(error.statusCode || 500).json({
        success: false,
        error: {
          message: error.message || "Failed to prebook multiple rooms",
          code: error.code || "MULTIROOM_PREBOOK_ERROR"
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    return;  // Exit early for multiroom flow
  }

  // ✅ SINGLE ROOM FORMAT (existing logic)
  if (!book_hash) {
    return res.status(400).json({
      success: false,
      error: {
        message: "book_hash is required for single room, or rooms array for multiroom",
        code: "MISSING_BOOK_HASH"
      },
      timestamp: new Date().toISOString()
    });
  }

  // ✅ Validate price_increase_percent (0-100)
  const validPriceIncrease = Math.max(0, Math.min(100, price_increase_percent || 0));

  // Normalize residency first (handles "en-us" → "us"), then convert to uppercase for prebook
  const normalizedResidency = normalizeResidency(residency);
  const prebookResidency = normalizedResidency.toUpperCase();  // Prebook requires uppercase

  console.log(`Book hash: ${book_hash?.substring(0, 20)}...`);
  console.log(`🌍 Residency: ${residency} → ${normalizedResidency} → ${prebookResidency} (normalized then uppercase for prebook)`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌐 Language: ${language}`);
  console.log(`Currency: ${currency}`);
  if (validPriceIncrease > 0) {
    console.log(`💰 Price increase tolerance: ${validPriceIncrease}%`);
  }

  // Validate hash format - accepts match_hash (m-...), book_hash (h-...), or prebooked hash (p-...)
  // ETG API /hotel/prebook/ accepts match_hash and returns book_hash
  if (!book_hash.startsWith('m-') && !book_hash.startsWith('h-') && !book_hash.startsWith('p-')) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Invalid hash format. Expected match_hash (m-...), book_hash (h-...), or prebooked hash (p-...).",
        code: "INVALID_BOOK_HASH_FORMAT",
        received: book_hash,
        hint: "The hash can be match_hash from /search/hp/ endpoint, book_hash from hotel details, or prebooked hash from previous prebook."
      },
      timestamp: new Date().toISOString()
    });
  }

  // Validate guests format
  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: "guests must be a non-empty array",
        code: "INVALID_GUESTS_FORMAT",
        received: guests,
        expected: "[{ adults: 2, children: [] }]"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    // ✅ Pass price_increase_percent to prebookRate
    const result = await prebookRate(
      book_hash, 
      guests, 
      prebookResidency, 
      language,
      validPriceIncrease  // ✅ ADD: Pass price increase tolerance
    );

    // ✅ EXTRACT booking_hash (could be at top level or nested)
    const booking_hash = result.booking_hash || result?.hotels?.[0]?.rates?.[0]?.book_hash;
    
    if (!booking_hash) {
      console.error('⚠️ No booking_hash in prebook response:', JSON.stringify(result, null, 2).substring(0, 500));
      return res.status(500).json({
        success: false,
        error: {
          message: 'Prebook succeeded but no booking_hash was returned',
          code: 'MISSING_BOOKING_HASH'
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ Prebook successful: booking_hash=${booking_hash.substring(0, 30)}...`);
    
    // ✅ EXTRACT PRICE INFORMATION
    const priceChanged = result.price_changed || false;
    const originalPrice = result.original_price;
    const newPrice = result.new_price;
    const newPriceCurrency = result.new_price_currency || currency;

    const duration = Date.now() - startTime;

    // ✅ CRITICAL: Ensure prebook response matches frontend expected format
    res.json({
      status: "ok",
      success: true,
      data: {
        book_hash: booking_hash,  // ✅ Use book_hash for consistency (frontend expects this)
        booking_hash: booking_hash,  // ✅ Keep both for backward compatibility
        price_changed: priceChanged,
        new_price: newPrice ? parseFloat(newPrice) : undefined,  // ✅ Number format
        original_price: originalPrice ? parseFloat(originalPrice) : undefined,  // ✅ Number format
        currency: newPriceCurrency,  // ✅ Currency code
        price_increase_percent: validPriceIncrease,  // ✅ Return what was used
        hotels: result.hotels,
        changes: result.changes || {},
        room_data: result.hotels?.[0]?.rates?.[0]?.room_name || null,  // ✅ ADD room info
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Prebook error:", error);
    console.error("   Error details:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusCode: error.statusCode,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method || req.method,
      path: req.path
    });

    // ✅ HANDLE NO_AVAILABLE_RATES ERROR (CRITICAL for certification)
    if (error.code === 'NO_AVAILABLE_RATES' || 
        error.message?.includes('NO_AVAILABLE_RATES') ||
        error.response?.data?.error === 'no_available_rates') {
      return res.status(400).json({
        success: false,
        error: {
          message: "Rate not available",
          code: "NO_AVAILABLE_RATES",
          details: "The selected rate is no longer available and cannot be booked within the specified price increase limit."
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    // Check if it's a 404 from ETG API
    if (error.response?.status === 404 || error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Prebook endpoint not found or not accessible",
          code: "PREBOOK_ENDPOINT_NOT_FOUND",
          details: "The ETG API prebook endpoint returned 404. This may indicate: 1) The endpoint is not available with your API credentials, 2) The endpoint path has changed, or 3) Your API key doesn't have access to booking endpoints.",
          etgError: error.response?.data?.error || "page not found",
          hint: "Contact ETG support to verify your API credentials have access to booking endpoints."
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    // Check if it's an authentication error
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(401).json({
        success: false,
        error: {
          message: "API authentication failed",
          code: "PREBOOK_AUTH_ERROR",
          details: "Invalid ETG API credentials or insufficient permissions for prebook endpoint."
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to prebook rate",
        code: error.code || error.category || "PREBOOK_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ================================
// ORDER FORM - Get required fields
// ================================

router.post("/order/form", validateOrderForm, async (req, res) => {
  const startTime = Date.now();
  // Accept both book_hash and booking_hash for backward compatibility (single room)
  // Also support multiroom format: prebooked_rooms or booking_hashes array
  const { 
    userId, 
    book_hash, 
    booking_hash,  // Single room - backward compatibility
    language = "en", 
    partner_order_id,
    prebooked_rooms,  // ✅ NEW: Multiroom format - array of prebook results with booking_hash
    booking_hashes  // ✅ NEW: Alternative multiroom format - array of booking hashes
  } = req.body;

  console.log("📋 === ORDER FORM REQUEST (Create booking process) ===");
  
  // ✅ DETECT FORMAT: Check if multiroom format (prebooked_rooms or booking_hashes array) or single room format
  const isMultiroom = (prebooked_rooms && Array.isArray(prebooked_rooms) && prebooked_rooms.length > 0) ||
                      (booking_hashes && Array.isArray(booking_hashes) && booking_hashes.length > 0);

  if (isMultiroom) {
    // ✅ MULTIROOM FORMAT
    const rooms = prebooked_rooms || booking_hashes.map((hash, index) => ({ booking_hash: hash, roomIndex: index }));
    
    console.log(`🏨 Multiroom order form: ${rooms.length} room(s)`);
    console.log(`Partner Order ID: ${partner_order_id}`);

    if (!partner_order_id) {
      return res.status(400).json({
        success: false,
        error: {
          message: "partner_order_id is required for multiroom order",
          code: "MISSING_PARTNER_ORDER_ID"
        },
        timestamp: new Date().toISOString()
      });
    }

    // Validate all rooms have booking_hash
    const invalidRooms = rooms.filter((room, index) => {
      const hash = room.booking_hash || room.book_hash;
      return !hash || (typeof hash !== 'string' || hash.trim() === '');
    });

    if (invalidRooms.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Some rooms are missing booking_hash: rooms at indices ${invalidRooms.map(r => r.roomIndex || rooms.indexOf(r)).join(', ')}`,
          code: "MISSING_BOOKING_HASH_MULTIROOM"
        },
        timestamp: new Date().toISOString()
      });
    }

    try {
      const userIp = getUserIp(req);

      // Call multiroom order form function
      const result = await getOrderFormsForMultipleRooms(rooms, partner_order_id, language, userIp);

      const duration = Date.now() - startTime;

      res.json({
        success: result.failed ? result.failed.length === 0 : true,
        data: {
          rooms: result.successful.map(room => ({
            roomIndex: room.roomIndex,
            order_id: room.order_id,
            item_id: room.item_id,
            booking_hash: room.booking_hash,
            payment_types: room.payment_types || [],
            form_fields: room.form_fields || [],
            // Include other fields from order form response
            ...room
          })),
          failed: result.failed,
          total_rooms: rooms.length,
          successful_rooms: result.successful.length,
          failed_rooms: result.failed?.length || 0
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("💥 Multiroom order form error:", error);

      const errorCode = error.code || 
                       error.ratehawkError?.code || 
                       error.category || 
                       "MULTIROOM_ORDER_FORM_ERROR";

      res.status(error.statusCode || 500).json({
        status: "error",
        success: false,
        error: {
          code: errorCode,
          message: error.ratehawkError?.message || error.message || "Failed to get multiroom order forms"
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    return;  // Exit early for multiroom flow
  }

  // ✅ SINGLE ROOM FORMAT (existing logic)
  // Use book_hash if provided, otherwise fallback to booking_hash for backward compatibility
  const hash = book_hash || booking_hash;
  console.log(`Book hash: ${hash?.substring(0, 20)}...`);
  console.log(`Partner Order ID: ${partner_order_id}`);

  // Validation
  if (!hash) {
    return res.status(400).json({
      success: false,
      error: {
        message: "book_hash is required for single room, or prebooked_rooms/booking_hashes array for multiroom",
        code: "MISSING_BOOK_HASH"
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!partner_order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: "partner_order_id is required",
        code: "MISSING_PARTNER_ORDER_ID"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const userIp = getUserIp(req);

    const result = await getOrderForm(hash, partner_order_id, language, userIp);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order form error:", error);

    // ✅ CRITICAL: Return exact RateHawk error code if available
    const errorCode = error.code || 
                     error.ratehawkError?.code || 
                     error.category || 
                     "ORDER_FORM_ERROR";

    res.status(error.statusCode || 500).json({
      status: "error",
      success: false,
      error: {
        code: errorCode,  // ✅ MUST include exact RateHawk error code
        message: error.ratehawkError?.message || error.message || "Failed to get order form"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ================================
// ORDER FINISH - Complete booking
// ================================

router.post("/order/finish", validateOrderFinish, async (req, res) => {
  const startTime = Date.now();
  const { 
    userId, 
    order_id,  // Single room format
    item_id,   // Single room format
    guests,    // Single room format
    payment_type, 
    partner_order_id,
    language = "en",
    upsell_data,
    email,
    phone,
    user_ip,
    rooms,      // ✅ NEW: Multiroom format - array of { order_id, item_id, guests }
    order_forms // ✅ NEW: Alternative multiroom format - array of order form results
  } = req.body;

  console.log("✅ === ORDER FINISH REQUEST ===");

  // ✅ DETECT FORMAT: Check if multiroom format (rooms or order_forms array) or single room format
  const isMultiroom = (rooms && Array.isArray(rooms) && rooms.length > 0) ||
                      (order_forms && Array.isArray(order_forms) && order_forms.length > 0);

  if (isMultiroom) {
    // ✅ MULTIROOM FORMAT
    const orderForms = rooms || order_forms;
    
    console.log(`🏨 Multiroom order finish: ${orderForms.length} room(s)`);
    console.log(`Partner Order ID: ${partner_order_id}`);
    console.log(`Payment type: ${payment_type}`);

    if (!partner_order_id) {
      return res.status(400).json({
        success: false,
        error: {
          message: "partner_order_id is required for multiroom order",
          code: "MISSING_PARTNER_ORDER_ID"
        },
        timestamp: new Date().toISOString()
      });
    }

    if (!payment_type) {
      return res.status(400).json({
        success: false,
        error: {
          message: "payment_type is required for multiroom order",
          code: "MISSING_PAYMENT_TYPE"
        },
        timestamp: new Date().toISOString()
      });
    }

    // Extract guests array from rooms (each room should have its guests)
    // Format: rooms = [{ order_id, item_id, guests: [{ adults: 2, children: [] }] }, ...]
    // Or: order_forms = [{ order_id, item_id, ... }, ...] and guests array is separate
    let multiroomGuests;
    
    if (rooms && rooms[0]?.guests) {
      // Rooms format with guests embedded
      multiroomGuests = rooms.map(room => room.guests);
    } else if (req.body.guests && Array.isArray(req.body.guests)) {
      // Separate guests array (one per room)
      multiroomGuests = req.body.guests;
    } else {
      return res.status(400).json({
        success: false,
        error: {
          message: "guests array is required for multiroom (one element per room). Provide either: 1) rooms array with guests embedded, or 2) separate guests array",
          code: "MISSING_MULTIROOM_GUESTS"
        },
        timestamp: new Date().toISOString()
      });
    }

    // Validate orderForms and guests arrays match length
    if (orderForms.length !== multiroomGuests.length) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Order forms (${orderForms.length}) and guests (${multiroomGuests.length}) arrays must have same length`,
          code: "MISMATCHED_ARRAYS"
        },
        timestamp: new Date().toISOString()
      });
    }

    // Validate each room has order_id and item_id
    const invalidRooms = orderForms.filter((form, index) => !form.order_id || !form.item_id);
    if (invalidRooms.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Some rooms are missing order_id or item_id: rooms at indices ${invalidRooms.map((_, i) => orderForms.indexOf(invalidRooms[i])).join(', ')}`,
          code: "MISSING_ORDER_IDS_MULTIROOM"
        },
        timestamp: new Date().toISOString()
      });
    }

    try {
      // Call multiroom finish function
      const result = await finishMultipleRoomOrder(
        orderForms,
        multiroomGuests,
        payment_type,
        partner_order_id,
        language,
        upsell_data  // Same upsells for all rooms (if applicable)
      );

      const duration = Date.now() - startTime;

      res.json({
        success: result.success,
        data: {
          rooms: result.rooms.map(room => ({
            roomIndex: room.roomIndex,
            order_id: room.order_id,
            status: room.status,
            // Include other fields from finish response
            ...room
          })),
          failed: result.failed,
          partner_order_id: result.partner_order_id,
          order_ids: result.order_ids,
          total_rooms: orderForms.length,
          successful_rooms: result.rooms.length,
          failed_rooms: result.failed?.length || 0
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("💥 Multiroom order finish error:", error);

      const errorCode = error.code || 
                       error.ratehawkError?.code || 
                       error.category || 
                       "MULTIROOM_ORDER_FINISH_ERROR";

      res.status(error.statusCode || 500).json({
        status: "error",
        success: false,
        error: {
          code: errorCode,
          message: error.ratehawkError?.message || error.message || "Failed to finish multiroom order"
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }

    return;  // Exit early for multiroom flow
  }

  // ✅ SINGLE ROOM FORMAT (existing logic)
  console.log(`Order ID: ${order_id}`);
  console.log(`Item ID: ${item_id}`);
  console.log(`Partner Order ID: ${partner_order_id}`);
  console.log(`Payment type: ${payment_type}`);
  console.log(`Guests: ${guests?.length || 0}`);
  if (upsell_data && Array.isArray(upsell_data)) {
    console.log(`Upsells: ${upsell_data.length} items`);
  }

  // Validation - order_id and item_id are required (from booking/form step)
  if (!order_id || !item_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: "order_id and item_id are required for single room, or rooms array for multiroom",
        code: "MISSING_ORDER_IDS"
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!partner_order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: "partner_order_id is required",
        code: "MISSING_PARTNER_ORDER_ID"
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!guests || !Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: "guests array is required and must not be empty",
        code: "MISSING_GUESTS"
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!payment_type) {
    return res.status(400).json({
      success: false,
      error: {
        message: "payment_type is required",
        code: "MISSING_PAYMENT_TYPE"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await finishOrder(
      order_id,
      item_id,
      guests, 
      payment_type, 
      partner_order_id,
      language,
      upsell_data,
      email,
      phone,
      user_ip || getUserIp(req)
    );

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order finish error:", error);
    
    // ✅ CRITICAL: Return exact RateHawk error code if available
    const errorCode = error.code || 
                     error.ratehawkError?.code || 
                     error.category || 
                     "ORDER_FINISH_ERROR";
    
    // Include detailed error information in response for debugging
    const errorResponse = {
      status: "error",
      success: false,
      error: {
        code: errorCode,  // ✅ MUST include exact RateHawk error code
        message: error.ratehawkError?.message || error.message || "Failed to finish order"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    };
    
    // Add debug info if available (only in development)
    if (process.env.NODE_ENV === 'development' && error.originalError?.response) {
      errorResponse.debug = {
        etg_status: error.originalError.response.status,
        etg_error_data: error.originalError.response.data,
        request_payload: {
          order_id: order_id,
          item_id: item_id,
          guests_count: guests?.length,
          payment_type: payment_type
        }
      };
    }

    res.status(error.statusCode || 500).json(errorResponse);
  }
});

// ================================
// ORDER STATUS - Poll booking status
// ================================

router.post("/order/status", validateOrderId, async (req, res) => {
  const startTime = Date.now();
  const { userId, order_id } = req.body;

  console.log("📊 === ORDER STATUS REQUEST ===");
  console.log(`Order ID: ${order_id}`);
  
  // Check if this is a fake order ID
  const isFakeId = /^ORD-\d+$/.test(order_id);
  if (isFakeId) {
    console.log(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
  }

  // Validation
  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: "order_id is required",
        code: "MISSING_ORDER_ID"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await getOrderStatus(order_id);

    const duration = Date.now() - startTime;
    
    if (isFakeId) {
      console.log(`🎭 [MOCK RESPONSE] Returning mock data for fake order ID`);
    } else {
      console.log(`✅ [REAL API CALL] Order status retrieved from ETG API`);
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order status error:", error);
    
    if (isFakeId && error.statusCode === 404) {
      console.error(`⚠️ Fake order ID ${order_id} returned 404. Enable ENABLE_MOCK_BOOKINGS=true for mock responses.`);
    }

    // ✅ CRITICAL: Return exact RateHawk error code if available
    const errorCode = error.code || 
                     error.ratehawkError?.code || 
                     error.category || 
                     "ORDER_STATUS_ERROR";

    res.status(error.statusCode || 500).json({
      status: "error",
      success: false,
      error: {
        code: errorCode,  // ✅ MUST include exact RateHawk error code
        message: error.ratehawkError?.message || error.message || "Failed to get order status"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ================================
// ORDER INFO - Get order details
// ================================

router.post("/order/info", validateOrderId, async (req, res) => {
  const startTime = Date.now();
  const { userId, order_id } = req.body;

  console.log("📄 === ORDER INFO REQUEST ===");
  console.log(`Order ID: ${order_id}`);
  
  // Check if this is a fake order ID
  const isFakeId = /^ORD-\d+$/.test(order_id);
  if (isFakeId) {
    console.log(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
  }

  // Validation
  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: "order_id is required",
        code: "MISSING_ORDER_ID"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await getOrderInfo(order_id);

    const duration = Date.now() - startTime;
    
    if (isFakeId) {
      console.log(`🎭 [MOCK RESPONSE] Returning mock data for fake order ID`);
    } else {
      console.log(`✅ [REAL API CALL] Order info retrieved from ETG API`);
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order info error:", error);
    
    if (isFakeId && error.statusCode === 404) {
      console.error(`⚠️ Fake order ID ${order_id} returned 404. Enable ENABLE_MOCK_BOOKINGS=true for mock responses.`);
    }

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to get order info",
        code: error.category || "ORDER_INFO_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ================================
// ORDER DOCUMENTS - Get booking documents
// ================================

router.post("/order/documents", validateOrderId, async (req, res) => {
  const startTime = Date.now();
  const { userId, order_id } = req.body;

  console.log("📑 === ORDER DOCUMENTS REQUEST ===");
  console.log(`Order ID: ${order_id}`);
  
  // Check if this is a fake order ID
  const isFakeId = /^ORD-\d+$/.test(order_id);
  if (isFakeId) {
    console.log(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
  }

  // Validation
  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: "order_id is required",
        code: "MISSING_ORDER_ID"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await getOrderDocuments(order_id);

    const duration = Date.now() - startTime;
    
    if (isFakeId) {
      console.log(`🎭 [MOCK RESPONSE] Returning mock data for fake order ID`);
    } else {
      console.log(`✅ [REAL API CALL] Order documents retrieved from ETG API`);
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order documents error:", error);
    
    if (isFakeId && error.statusCode === 404) {
      console.error(`⚠️ Fake order ID ${order_id} returned 404. Enable ENABLE_MOCK_BOOKINGS=true for mock responses.`);
    }

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to get order documents",
        code: error.category || "ORDER_DOCUMENTS_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ================================
// RETRIEVE BOOKINGS - Post-booking retrieval
// ================================

router.post("/order/bookings", async (req, res) => {
  const startTime = Date.now();
  const { userId, order_id, date_from, date_to, status } = req.body;

  console.log("📋 === RETRIEVE BOOKINGS REQUEST ===");
  if (order_id) {
    console.log(`Order ID: ${order_id}`);
  } else {
    console.log("Retrieving booking list");
    if (date_from) console.log(`Date from: ${date_from}`);
    if (date_to) console.log(`Date to: ${date_to}`);
    if (status) console.log(`Status: ${status}`);
  }

  // Check if this is a fake order ID
  if (order_id) {
    const isFakeId = /^ORD-\d+$/.test(order_id);
    if (isFakeId) {
      console.log(`⚠️ [FAKE ID DETECTED] Order ID format suggests frontend simulation: ${order_id}`);
    }
  }

  try {
    const filters = {};
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (status) filters.status = status;

    const result = await retrieveBookings(order_id || null, filters);

    const duration = Date.now() - startTime;

    if (order_id && /^ORD-\d+$/.test(order_id)) {
      console.log(`🎭 [MOCK RESPONSE] Returning mock data for fake order ID`);
    } else {
      console.log(`✅ [REAL API CALL] Bookings retrieved from ETG API`);
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Retrieve bookings error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to retrieve bookings",
        code: error.category || "RETRIEVE_BOOKINGS_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

export default router;

