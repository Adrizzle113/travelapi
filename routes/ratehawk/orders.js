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
  getOrderDocuments
} from "../../services/booking/bookingService.js";
import {
  validatePrebook,
  validateOrderForm,
  validateOrderFinish,
  validateOrderId
} from "../../middleware/validation.js";

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
  const { userId, book_hash, residency = "us", currency = "USD" } = req.body;

  console.log("🔒 === PREBOOK REQUEST ===");
  console.log(`Book hash: ${book_hash?.substring(0, 20)}...`);
  console.log(`Residency: ${residency}`);
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

  try {
    const result = await prebookRate(book_hash, residency, currency);

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
  const { userId, booking_hash, language = "en", partner_order_id } = req.body;

  console.log("📋 === ORDER FORM REQUEST ===");
  console.log(`Booking hash: ${booking_hash?.substring(0, 20)}...`);

  // Validation
  if (!booking_hash) {
    return res.status(400).json({
      success: false,
      error: {
        message: "booking_hash is required",
        code: "MISSING_BOOKING_HASH"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const userIp = getUserIp(req);
    const orderId = partner_order_id || `partner-${uuidv4()}`;

    const result = await getOrderForm(booking_hash, language, userIp, orderId);

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
    booking_hash, 
    guests, 
    payment_type, 
    partner_order_id,
    language = "en"
  } = req.body;

  console.log("✅ === ORDER FINISH REQUEST ===");
  console.log(`Booking hash: ${booking_hash?.substring(0, 20)}...`);
  console.log(`Payment type: ${payment_type}`);
  console.log(`Guests: ${guests?.length || 0}`);

  // Validation
  if (!booking_hash) {
    return res.status(400).json({
      success: false,
      error: {
        message: "booking_hash is required",
        code: "MISSING_BOOKING_HASH"
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
    const orderId = partner_order_id || `partner-${uuidv4()}`;

    const result = await finishOrder(booking_hash, guests, payment_type, orderId, language);

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

    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message || "Failed to finish order",
        code: error.category || "ORDER_FINISH_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
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

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order status error:", error);

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

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order info error:", error);

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

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Order documents error:", error);

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

export default router;

