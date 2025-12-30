import express from 'express';
import { 
  getHotelInformation,
  prebookHotel, 
  getBookingForm, 
  finishBooking, 
  getBookingStatus 
} from '../../services/etg/etgClient.js';

const router = express.Router();

// GET /api/ratehawk/hotel/info - Get static hotel data
router.post('/hotel/info', async (req, res) => {
  try {
    const { hotelId } = req.body;
    
    if (!hotelId) {
      return res.status(400).json({ 
        error: 'hotelId is required' 
      });
    }

    const result = await getHotelInformation(hotelId);
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Hotel info error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/ratehawk/prebook - Already working ✅

// POST /api/ratehawk/order/form - Get booking form
router.post('/order/form', async (req, res) => {
  try {
    const { book_hash, partner_order_id } = req.body;
    
    if (!book_hash) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'book_hash is required and must be a non-empty string (from prebook response)',
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

    const result = await getBookingForm(book_hash, partner_order_id);
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Booking form error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/ratehawk/order/finish - Complete booking
router.post('/order/finish', async (req, res) => {
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
    
    // Validation - order_id and item_id are required (from booking/form step)
    if (!order_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'order_id is required (from booking/form response)',
          code: 'MISSING_ORDER_ID'
        }
      });
    }

    if (!item_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'item_id is required (from booking/form response)',
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
          message: 'payment_type is required',
          code: 'MISSING_PAYMENT_TYPE'
        }
      });
    }

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
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Booking finish error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/ratehawk/order/status - Poll booking status
router.post('/order/status', async (req, res) => {
  try {
    const { order_id } = req.body;
    
    if (!order_id) {
      return res.status(400).json({ 
        success: false,
        error: {
          message: 'order_id is required and must be a non-empty string',
          code: 'MISSING_ORDER_ID'
        }
      });
    }

    const result = await getBookingStatus(order_id);
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Booking status error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;