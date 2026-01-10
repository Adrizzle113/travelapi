export function validateRegionId(req, res, next) {
  const { region_id, destination } = req.body;

  if (!region_id && !destination) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'region_id is required',
      field: 'region_id',
      suggestion: 'Use /api/destinations/autocomplete to find the correct region_id for your destination',
      code: 'MISSING_REGION_ID'
    });
  }

  if (region_id !== undefined) {
    const parsed = parseInt(region_id, 10);

    if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'region_id must be a positive integer',
        field: 'region_id',
        received: region_id,
        received_type: typeof region_id,
        suggestion: 'Use /api/destinations/autocomplete to get valid region_id values',
        code: 'INVALID_REGION_ID'
      });
    }

    req.body.region_id = parsed;
  }

  if (destination && !region_id) {
    console.warn(`⚠️ Deprecated: Request using 'destination' parameter instead of 'region_id'`);
    req.deprecated_params = {
      destination: true,
      message: 'The destination parameter is deprecated. Use region_id instead.'
    };
  }

  next();
}

export function validateSearchParams(req, res, next) {
  const { checkin, checkout, guests } = req.body;

  if (!checkin) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkin date is required',
      field: 'checkin',
      format: 'YYYY-MM-DD',
      code: 'MISSING_CHECKIN'
    });
  }

  if (!checkout) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkout date is required',
      field: 'checkout',
      format: 'YYYY-MM-DD',
      code: 'MISSING_CHECKOUT'
    });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(checkin)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkin date format. Expected YYYY-MM-DD',
      field: 'checkin',
      received: checkin,
      format: 'YYYY-MM-DD',
      example: '2024-01-15',
      code: 'INVALID_CHECKIN_FORMAT'
    });
  }

  if (!dateRegex.test(checkout)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkout date format. Expected YYYY-MM-DD',
      field: 'checkout',
      received: checkout,
      format: 'YYYY-MM-DD',
      example: '2024-01-20',
      code: 'INVALID_CHECKOUT_FORMAT'
    });
  }

  const checkinDate = new Date(checkin + 'T00:00:00Z');
  const checkoutDate = new Date(checkout + 'T00:00:00Z');

  if (isNaN(checkinDate.getTime())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkin date. Date does not exist',
      field: 'checkin',
      received: checkin,
      format: 'YYYY-MM-DD',
      example: '2024-01-15',
      code: 'INVALID_CHECKIN_DATE'
    });
  }

  if (isNaN(checkoutDate.getTime())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkout date. Date does not exist',
      field: 'checkout',
      received: checkout,
      format: 'YYYY-MM-DD',
      example: '2024-01-20',
      code: 'INVALID_CHECKOUT_DATE'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  if (checkinDate < todayUTC) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkin date cannot be in the past',
      field: 'checkin',
      received: checkin,
      today: todayUTC.toISOString().split('T')[0],
      code: 'CHECKIN_IN_PAST'
    });
  }

  if (checkoutDate <= checkinDate) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkout date must be after checkin date',
      fields: ['checkin', 'checkout'],
      received: { checkin, checkout },
      code: 'INVALID_DATE_RANGE'
    });
  }

  const daysDiff = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Maximum stay duration is 30 nights',
      fields: ['checkin', 'checkout'],
      received: { checkin, checkout },
      duration_nights: daysDiff,
      max_nights: 30,
      code: 'STAY_TOO_LONG'
    });
  }

  if (!Array.isArray(guests) || guests.length === 0) {
    req.body.guests = [{ adults: 2, children: [] }];
    console.log('ℹ️ No guests specified, using default: 2 adults');
  }

  next();
}

export function validateDateRange(req, res, next) {
  const { checkin, checkout } = req.body;

  if (!checkin) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkin date is required',
      field: 'checkin',
      format: 'YYYY-MM-DD',
      code: 'MISSING_CHECKIN'
    });
  }

  if (!checkout) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkout date is required',
      field: 'checkout',
      format: 'YYYY-MM-DD',
      code: 'MISSING_CHECKOUT'
    });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(checkin)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkin date format. Expected YYYY-MM-DD',
      field: 'checkin',
      received: checkin,
      format: 'YYYY-MM-DD',
      example: '2024-01-15',
      code: 'INVALID_CHECKIN_FORMAT'
    });
  }

  if (!dateRegex.test(checkout)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkout date format. Expected YYYY-MM-DD',
      field: 'checkout',
      received: checkout,
      format: 'YYYY-MM-DD',
      example: '2024-01-20',
      code: 'INVALID_CHECKOUT_FORMAT'
    });
  }

  const checkinDate = new Date(checkin + 'T00:00:00Z');
  const checkoutDate = new Date(checkout + 'T00:00:00Z');

  if (isNaN(checkinDate.getTime())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkin date. Date does not exist',
      field: 'checkin',
      received: checkin,
      format: 'YYYY-MM-DD',
      example: '2024-01-15',
      code: 'INVALID_CHECKIN_DATE'
    });
  }

  if (isNaN(checkoutDate.getTime())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkout date. Date does not exist',
      field: 'checkout',
      received: checkout,
      format: 'YYYY-MM-DD',
      example: '2024-01-20',
      code: 'INVALID_CHECKOUT_DATE'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  if (checkinDate < todayUTC) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkin date cannot be in the past',
      field: 'checkin',
      received: checkin,
      today: todayUTC.toISOString().split('T')[0],
      code: 'CHECKIN_IN_PAST'
    });
  }

  if (checkoutDate <= checkinDate) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'checkout date must be after checkin date',
      fields: ['checkin', 'checkout'],
      received: { checkin, checkout },
      code: 'INVALID_DATE_RANGE'
    });
  }

  const daysDiff = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Maximum stay duration is 30 nights',
      fields: ['checkin', 'checkout'],
      received: { checkin, checkout },
      duration_nights: daysDiff,
      max_nights: 30,
      code: 'STAY_TOO_LONG'
    });
  }

  next();
}

export function validateBookingForm(req, res, next) {
  const { book_hashs, hotelData } = req.body;

  if (!book_hashs || (Array.isArray(book_hashs) && book_hashs.length === 0)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'book_hashs is required',
      field: 'book_hashs',
      code: 'MISSING_BOOK_HASHS'
    });
  }

  if (!hotelData) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'hotelData is required',
      field: 'hotelData',
      code: 'MISSING_HOTEL_DATA'
    });
  }

  next();
}

export function validatePrebook(req, res, next) {
  const { book_hash, residency, currency, rooms } = req.body;

  // ✅ Support both single room (book_hash) and multiroom (rooms array) formats
  const isMultiroom = rooms && Array.isArray(rooms) && rooms.length > 0;

  if (isMultiroom) {
    // ✅ MULTIROOM FORMAT VALIDATION
    if (rooms.length === 0 || rooms.length > 6) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Rooms array must contain 1-6 rooms (RateHawk API limit)',
          code: 'INVALID_ROOMS_COUNT',
          min_rooms: 1,
          max_rooms: 6,
          received: rooms.length
        },
        timestamp: new Date().toISOString()
      });
    }

    // Validate each room - use for loop to allow early return
    for (let index = 0; index < rooms.length; index++) {
      const room = rooms[index];
      
      // Validate book_hash or match_hash
      const hash = room.book_hash || room.match_hash;
      if (!hash || typeof hash !== 'string' || hash.trim() === '') {
        return res.status(400).json({
          success: false,
          error: {
            message: `Room ${index + 1}: book_hash or match_hash is required and must be a non-empty string`,
            code: 'MISSING_ROOM_BOOK_HASH',
            roomIndex: index
          },
          timestamp: new Date().toISOString()
        });
      }

      // Validate hash format
      if (!hash.startsWith('m-') && !hash.startsWith('h-') && !hash.startsWith('p-')) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Room ${index + 1}: Invalid hash format. Expected match_hash (m-...), book_hash (h-...), or prebooked hash (p-...)`,
            code: 'INVALID_ROOM_BOOK_HASH_FORMAT',
            roomIndex: index,
            received: hash
          },
          timestamp: new Date().toISOString()
        });
      }

      // Validate guests array
      if (!room.guests || !Array.isArray(room.guests) || room.guests.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Room ${index + 1}: guests array is required and must not be empty`,
            code: 'MISSING_ROOM_GUESTS',
            roomIndex: index
          },
          timestamp: new Date().toISOString()
        });
      }

      // Validate children ages (0-17)
      for (let guestIndex = 0; guestIndex < room.guests.length; guestIndex++) {
        const guest = room.guests[guestIndex];
        if (guest.children && Array.isArray(guest.children)) {
          for (let childIndex = 0; childIndex < guest.children.length; childIndex++) {
            const child = guest.children[childIndex];
            const age = typeof child === 'number' ? child : child.age;
            if (age !== undefined && (typeof age !== 'number' || age < 0 || age > 17)) {
              return res.status(400).json({
                success: false,
                error: {
                  message: `Room ${index + 1}, Guest ${guestIndex + 1}, Child ${childIndex + 1}: age must be a number between 0 and 17`,
                  code: 'INVALID_CHILD_AGE',
                  roomIndex: index,
                  guestIndex,
                  childIndex,
                  received: age
                },
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      // Validate residency if provided
      if (room.residency && typeof room.residency !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            message: `Room ${index + 1}: residency must be a string`,
            code: 'INVALID_ROOM_RESIDENCY',
            roomIndex: index
          },
          timestamp: new Date().toISOString()
        });
      }

      // Validate price_increase_percent if provided
      if (room.price_increase_percent !== undefined && 
          (typeof room.price_increase_percent !== 'number' || 
           room.price_increase_percent < 0 || 
           room.price_increase_percent > 100)) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Room ${index + 1}: price_increase_percent must be a number between 0 and 100`,
            code: 'INVALID_PRICE_INCREASE_PERCENT',
            roomIndex: index,
            received: room.price_increase_percent
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // If multiroom validation passes, continue
    next();
    return;
  }

  // ✅ SINGLE ROOM FORMAT VALIDATION (existing logic)
  if (!book_hash || typeof book_hash !== 'string' || book_hash.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'book_hash is required and must be a non-empty string (for single room)',
        code: 'MISSING_BOOK_HASH'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (residency && typeof residency !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'residency must be a string',
        code: 'INVALID_RESIDENCY'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (currency && typeof currency !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'currency must be a string',
        code: 'INVALID_CURRENCY'
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
}

export function validateOrderForm(req, res, next) {
  // Accept both book_hash and booking_hash for backward compatibility
  const { book_hash, booking_hash, partner_order_id, language } = req.body;
  const hash = book_hash || booking_hash;

  if (!hash || typeof hash !== 'string' || hash.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'book_hash is required and must be a non-empty string (from prebook response)',
        code: 'MISSING_BOOK_HASH'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!partner_order_id || typeof partner_order_id !== 'string' || partner_order_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'partner_order_id is required and must be a non-empty string',
        code: 'MISSING_PARTNER_ORDER_ID'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (language && typeof language !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'language must be a string',
        code: 'INVALID_LANGUAGE'
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
}

export function validateOrderFinish(req, res, next) {
  const { order_id, item_id, guests, payment_type, partner_order_id } = req.body;

  // Correct flow: order_id and item_id are required (from booking/form step)
  // ETG API returns these as numbers, but we need strings for consistency
  // Accept both numbers and strings, convert numbers to strings
  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'order_id is required and must be a non-empty string (from booking/form response)',
        code: 'MISSING_ORDER_ID'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Convert number to string if needed (ETG API returns numbers)
  if (typeof order_id === 'number') {
    req.body.order_id = String(order_id);
  } else if (typeof order_id !== 'string' || order_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'order_id must be a non-empty string or number (from booking/form response)',
        code: 'INVALID_ORDER_ID_TYPE'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!item_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'item_id is required and must be a non-empty string (from booking/form response)',
        code: 'MISSING_ITEM_ID'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Convert number to string if needed (ETG API returns numbers)
  if (typeof item_id === 'number') {
    req.body.item_id = String(item_id);
  } else if (typeof item_id !== 'string' || item_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'item_id must be a non-empty string or number (from booking/form response)',
        code: 'INVALID_ITEM_ID_TYPE'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!partner_order_id || typeof partner_order_id !== 'string' || partner_order_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'partner_order_id is required and must be a non-empty string',
        code: 'MISSING_PARTNER_ORDER_ID'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!guests || !Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'guests is required and must be a non-empty array',
        code: 'MISSING_GUESTS'
      },
      timestamp: new Date().toISOString()
    });
  }

  // ✅ CERTIFICATION REQUIREMENT: Validate guests structure including children age
  // ETG requires: children age specified in booking finish request
  // Format: [{ adults: 2, children: [{ age: 5 }] }]
  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    if (!guest || typeof guest !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          message: `guest at index ${i} must be an object`,
          code: 'INVALID_GUEST_FORMAT'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Validate adults field
    if (guest.adults !== undefined && (typeof guest.adults !== 'number' || guest.adults < 1)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `guest at index ${i}: adults must be a positive number`,
          code: 'INVALID_ADULTS_COUNT'
        },
        timestamp: new Date().toISOString()
      });
    }

    // ✅ CERTIFICATION: Validate children structure and age
    if (guest.children && Array.isArray(guest.children)) {
      for (let j = 0; j < guest.children.length; j++) {
        const child = guest.children[j];
        // Children can be objects with age, or just numbers (age), or empty objects
        if (child && typeof child === 'object') {
          // If child is an object, it should have an age field for booking finish
          if (child.age !== undefined && (typeof child.age !== 'number' || child.age < 0 || child.age > 17)) {
            return res.status(400).json({
              success: false,
              error: {
                message: `guest at index ${i}, child at index ${j}: age must be a number between 0 and 17`,
                code: 'INVALID_CHILD_AGE',
                received: child.age
              },
              timestamp: new Date().toISOString()
            });
          }
        } else if (typeof child === 'number') {
          // Allow simple number format (age), will be normalized in service layer
          if (child < 0 || child > 17) {
            return res.status(400).json({
              success: false,
              error: {
                message: `guest at index ${i}, child at index ${j}: age must be between 0 and 17`,
                code: 'INVALID_CHILD_AGE',
                received: child
              },
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
  }

  if (!payment_type || typeof payment_type !== 'string' || payment_type.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'payment_type is required and must be a non-empty string',
        code: 'MISSING_PAYMENT_TYPE'
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
}

export function validateOrderId(req, res, next) {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'order_id is required and must be a non-empty string',
        code: 'MISSING_ORDER_ID'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Convert number to string if needed (ETG API returns numbers)
  if (typeof order_id === 'number') {
    req.body.order_id = String(order_id);
  } else if (typeof order_id !== 'string' || order_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'order_id must be a non-empty string or number',
        code: 'INVALID_ORDER_ID_TYPE'
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
}

export default {
  validateRegionId,
  validateSearchParams,
  validateDateRange,
  validateBookingForm,
  validatePrebook,
  validateOrderForm,
  validateOrderFinish,
  validateOrderId
};
