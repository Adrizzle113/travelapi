/**
 * RateHawk Order Management Routes
 * Handles booking flow: prebook, order form, finish, status, info, documents
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  prebookRate,
  getOrderForm,
  finishOrder,
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
    guests = [{ adults: 2, children: [] }],  // ✅ Extract guests (required)
    residency = "US",  // ✅ Default to uppercase for prebook
    language = "en",  // ✅ Extract language (required)
    currency = "USD"  // Not used in prebook but keep for logging
  } = req.body;

  // Normalize residency first (handles "en-us" → "us"), then convert to uppercase for prebook
  const normalizedResidency = normalizeResidency(residency);
  const prebookResidency = normalizedResidency.toUpperCase();  // Prebook requires uppercase

  console.log("🔒 === PREBOOK REQUEST ===");
  console.log(`Book hash: ${book_hash?.substring(0, 20)}...`);
  console.log(`🌍 Residency: ${residency} → ${normalizedResidency} → ${prebookResidency} (normalized then uppercase for prebook)`);
  console.log(`👥 Guests: ${JSON.stringify(guests)}`);
  console.log(`🌐 Language: ${language}`);
  console.log(`Currency: ${currency}`);

  // Validation
  if (!book_hash) {
    return res.status(400).json({
      success: false,
      error: {
        message: "book_hash is required",
        code: "MISSING_BOOK_HASH"
      },
      timestamp: new Date().toISOString()
    });
  }

  // Validate hash format - must be book_hash (h-...) or prebooked hash (p-...)
  // NOT match_hash (m-...) from search results
  if (book_hash.startsWith('m-')) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Invalid hash format. Use book_hash (h-...) from hotel page, not match_hash (m-...) from search results.",
        code: "INVALID_HASH_FORMAT",
        received: book_hash,
        hint: "Call /api/ratehawk/hotel/details first to get book_hash, then use that for prebook."
      },
      timestamp: new Date().toISOString()
    });
  }

  // Validate hash format - should be h-... or p-...
  if (!book_hash.startsWith('h-') && !book_hash.startsWith('p-')) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Invalid book_hash format. Expected hash starting with 'h-' (book_hash) or 'p-' (prebooked hash).",
        code: "INVALID_BOOK_HASH_FORMAT",
        received: book_hash,
        hint: "The book_hash should come from the rate object in the hotel details response."
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
    // ✅ Pass guests and language to prebookRate (uppercase residency for prebook)
    const result = await prebookRate(book_hash, guests, prebookResidency, language);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Prebook error:", error);
    console.error("   Error details:", {
      message: error.message,
      status: error.response?.status,
      statusCode: error.statusCode,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method || req.method,
      path: req.path
    });

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
        code: error.category || "PREBOOK_ERROR"
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
  // Accept both book_hash and booking_hash for backward compatibility
  // Prefer book_hash (correct flow), fallback to booking_hash
  const { userId, book_hash, booking_hash, language = "en", partner_order_id } = req.body;

  console.log("📋 === ORDER FORM REQUEST (Create booking process) ===");
  
  // Use book_hash if provided, otherwise fallback to booking_hash for backward compatibility
  const hash = book_hash || booking_hash;
  console.log(`Book hash: ${hash?.substring(0, 20)}...`);
  console.log(`Partner Order ID: ${partner_order_id}`);

  // Validation
  if (!hash) {
    return res.status(400).json({
      success: false,
      error: {
        message: "book_hash is required (from prebook response)",
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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/18f147b6-d8cd-4952-ab0d-c17062dbaa8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'orders.js:245',message:'getOrderForm response before sending to client',data:{order_id:result.order_id,order_id_type:typeof result.order_id,item_id:result.item_id,item_id_type:typeof result.item_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

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

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to get order form",
        code: error.category || "ORDER_FORM_ERROR"
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
    order_id,
    item_id,
    guests, 
    payment_type, 
    partner_order_id,
    language = "en",
    upsell_data,
    email,
    phone,
    user_ip
  } = req.body;

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/18f147b6-d8cd-4952-ab0d-c17062dbaa8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'orders.js:276',message:'order/finish route handler entry',data:{order_id,order_id_type:typeof order_id,item_id,item_id_type:typeof item_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  console.log("✅ === ORDER FINISH REQUEST ===");
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
        message: "order_id and item_id are required (from booking/form response)",
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/18f147b6-d8cd-4952-ab0d-c17062dbaa8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'orders.js:345',message:'calling finishOrder service',data:{order_id,order_id_type:typeof order_id,item_id,item_id_type:typeof item_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
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
    
    // Include detailed error information in response for debugging
    const errorResponse = {
      success: false,
      error: {
        message: error.message || "Failed to finish order",
        code: error.category || "ORDER_FINISH_ERROR"
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

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to get order status",
        code: error.category || "ORDER_STATUS_ERROR"
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

