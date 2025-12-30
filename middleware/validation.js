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
  const { book_hash, residency, currency } = req.body;

  if (!book_hash || typeof book_hash !== 'string' || book_hash.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'book_hash is required and must be a non-empty string',
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
  const { booking_hash, language } = req.body;

  if (!booking_hash || typeof booking_hash !== 'string' || booking_hash.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'booking_hash is required and must be a non-empty string',
        code: 'MISSING_BOOKING_HASH'
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
  const { booking_hash, guests, payment_type } = req.body;

  if (!booking_hash || typeof booking_hash !== 'string' || booking_hash.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'booking_hash is required and must be a non-empty string',
        code: 'MISSING_BOOKING_HASH'
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

  // Validate each guest object
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

  if (!order_id || typeof order_id !== 'string' || order_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'order_id is required and must be a non-empty string',
        code: 'MISSING_ORDER_ID'
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
