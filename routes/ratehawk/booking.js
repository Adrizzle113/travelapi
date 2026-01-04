import express from 'express';
import { 
  getHotelInformation,
  prebookHotel, 
  getBookingForm, 
  finishBooking, 
  getBookingStatus 
} from '../../services/etg/etgClient.js';

const router = express.Router();

// ============================================================================
// HOTEL INFORMATION
// ============================================================================

/**
 * GET /api/ratehawk/hotel/info
 * Get static hotel data (images, amenities, policies, etc.)
 * Rate Limit: 30/min
 */
router.post('/hotel/info', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { hotelId } = req.body;
    
    if (!hotelId) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'hotelId is required',
          code: 'MISSING_HOTEL_ID'
        }
      });
    }

    console.log(`📤 [Hotel Info] Fetching: ${hotelId}`);

    const result = await getHotelInformation(hotelId);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Hotel Info] Success (${duration}ms)`);
    
    res.json({ 
      success: true, 
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Hotel Info] Error (${duration}ms):`, error.message);
    
    res.status(error.status || 500).json({ 
      success: false, 
      error: {
        message: error.message || 'Failed to fetch hotel information',
        code: error.code || 'HOTEL_INFO_ERROR'
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ============================================================================
// PREBOOK (Step 1: Validate Availability & Lock Rate)
// ============================================================================

/**
 * POST /api/ratehawk/prebook
 * Validate availability and lock the rate
 * Input: book_hash (h-...) from search results
 * Output: booking_hash (for order/form step)
 * Rate Limit: 30/min
 */
router.post('/prebook', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { book_hash, residency, currency, userId, originalPrice } = req.body;
    
    // Validation
    if (!book_hash) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'book_hash is required (format: h-... from search results)',
          code: 'MISSING_BOOK_HASH'
        }
      });
    }

    // Validate book_hash format
    if (!book_hash.startsWith('h-') && !book_hash.startsWith('p-')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid book_hash format. Must start with "h-" or "p-"',
          code: 'INVALID_BOOK_HASH_FORMAT',
          received: book_hash
        }
      });
    }

    console.log(`📤 [Prebook] Request:`, { 
      book_hash: book_hash.substring(0, 30) + '...', 
      residency, 
      currency 
    });

    // Call ETG API
    const result = await prebookHotel(book_hash, residency || 'US');
    
    console.log(`📥 [Prebook] Raw response received`);

    // Extract hotel data
    const hotels = result.hotels || [];
    
    if (hotels.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No hotel data returned from prebook',
          code: 'NO_HOTEL_DATA'
        }
      });
    }

    const hotel = hotels[0];
    const rates = hotel.rates || [];
    
    if (rates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No rates available for this booking',
          code: 'NO_RATES_AVAILABLE'
        }
      });
    }

    // Get booking_hash from first rate (this is what we need for order/form)
    const booking_hash = rates[0].book_hash;
    
    if (!booking_hash) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No booking_hash returned from prebook',
          code: 'MISSING_BOOKING_HASH'
        }
      });
    }

    // Check for price changes
    let price_changed = false;
    let new_price = undefined;
    
    if (originalPrice) {
      const paymentType = rates[0].payment_options?.payment_types?.[0];
      const currentPrice = parseFloat(paymentType?.amount || paymentType?.show_amount || 0);
      const originalPriceNum = parseFloat(originalPrice);
      
      if (currentPrice > 0 && originalPriceNum > 0) {
        const priceDiff = Math.abs(currentPrice - originalPriceNum);
        price_changed = priceDiff > 0.01; // More than 1 cent difference
        
        if (price_changed) {
          new_price = currentPrice;
          console.log(`⚠️ [Prebook] Price changed: ${originalPriceNum} → ${currentPrice}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [Prebook] Success (${duration}ms) - booking_hash: ${booking_hash.substring(0, 30)}...`);
    
    res.json({ 
      success: true, 
      data: {
        booking_hash,
        price_changed,
        new_price,
        hotels,
        changes: result.changes || {}
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Prebook] Error (${duration}ms):`, error.message);
    
    res.status(error.status || 500).json({ 
      success: false, 
      error: {
        message: error.message || 'Prebook failed',
        code: error.code || 'PREBOOK_ERROR',
        data: error.data
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ============================================================================
// ORDER FORM (Step 2: Get Required Fields)
// ============================================================================

/**
 * POST /api/ratehawk/order/form
 * Get booking form requirements
 * Input: booking_hash (from prebook), partner_order_id
 * Output: order_id, item_id, required fields
 * Rate Limit: 30/min
 */
router.post('/order/form', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { book_hash, partner_order_id } = req.body;
    
    // Validation
    if (!book_hash) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'book_hash is required (from prebook response)',
          code: 'MISSING_BOOK_HASH'
        }
      });
    }

    if (!partner_order_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'partner_order_id is required',
          code: 'MISSING_PARTNER_ORDER_ID'
        }
      });
    }

    console.log(`📤 [Order Form] Request:`, { 
      book_hash: book_hash.substring(0, 30) + '...', 
      partner_order_id 
    });

    const result = await getBookingForm(book_hash, partner_order_id);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Order Form] Success (${duration}ms) - order_id: ${result.order_id}`);
    
    res.json({ 
      success: true, 
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Order Form] Error (${duration}ms):`, error.message);
    
    res.status(error.status || 500).json({ 
      success: false, 
      error: {
        message: error.message || 'Failed to get booking form',
        code: error.code || 'ORDER_FORM_ERROR'
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ============================================================================
// ORDER FINISH (Step 3: Complete Booking)
// ============================================================================

/**
 * POST /api/ratehawk/order/finish
 * Complete the booking
 * Input: order_id, item_id, guests, payment_type
 * Output: order_id, status (processing/confirmed/failed)
 * Rate Limit: 30/min
 * Note: This is ASYNC - must poll /order/status until confirmed
 */
router.post('/order/finish', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      order_id, 
      item_id, 
      partner_order_id,
      payment_type,
      guests,
      email,
      phone,
      user_ip,
      language = 'en',
      upsell_data
    } = req.body;
    
    // Validation
    if (!order_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'order_id is required (from order/form response)',
          code: 'MISSING_ORDER_ID'
        }
      });
    }

    if (!item_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'item_id is required (from order/form response)',
          code: 'MISSING_ITEM_ID'
        }
      });
    }

    if (!partner_order_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'partner_order_id is required',
          code: 'MISSING_PARTNER_ORDER_ID'
        }
      });
    }

    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'guests array is required and must not be empty',
          code: 'MISSING_GUESTS'
        }
      });
    }

    if (!payment_type) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'payment_type is required (deposit, now, or hotel)',
          code: 'MISSING_PAYMENT_TYPE'
        }
      });
    }

    console.log(`📤 [Order Finish] Request:`, { 
      order_id, 
      item_id, 
      partner_order_id,
      payment_type,
      guests_count: guests.length
    });

    const result = await finishBooking({
      order_id,
      item_id,
      partner_order_id,
      payment_type,
      guests,
      email,
      phone,
      user_ip,
      language,
      upsell_data
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Order Finish] Success (${duration}ms) - status: ${result.status}`);
    
    res.json({ 
      success: true, 
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Order Finish] Error (${duration}ms):`, error.message);
    
    res.status(error.status || 500).json({ 
      success: false, 
      error: {
        message: error.message || 'Booking failed',
        code: error.code || 'ORDER_FINISH_ERROR'
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

// ============================================================================
// ORDER STATUS (Step 4: Poll Until Confirmed)
// ============================================================================

/**
 * POST /api/ratehawk/order/status
 * Poll booking status until confirmed or failed
 * Input: order_id
 * Output: status (processing/confirmed/failed)
 * Rate Limit: 30/min
 * Note: Poll every 2-5 seconds until status is final
 */
router.post('/order/status', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { order_id } = req.body;
    
    if (!order_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'order_id is required',
          code: 'MISSING_ORDER_ID'
        }
      });
    }

    console.log(`📤 [Order Status] Checking: ${order_id}`);

    const result = await getBookingStatus(order_id);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Order Status] Success (${duration}ms) - status: ${result.status}`);
    
    res.json({ 
      success: true, 
      data: result,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Order Status] Error (${duration}ms):`, error.message);
    
    res.status(error.status || 500).json({ 
      success: false, 
      error: {
        message: error.message || 'Failed to get booking status',
        code: error.code || 'ORDER_STATUS_ERROR'
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

export default router;