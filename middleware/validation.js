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

  const checkinDate = new Date(checkin);
  const checkoutDate = new Date(checkout);

  if (isNaN(checkinDate.getTime())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkin date format',
      field: 'checkin',
      received: checkin,
      format: 'YYYY-MM-DD',
      code: 'INVALID_CHECKIN_DATE'
    });
  }

  if (isNaN(checkoutDate.getTime())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid checkout date format',
      field: 'checkout',
      received: checkout,
      format: 'YYYY-MM-DD',
      code: 'INVALID_CHECKOUT_DATE'
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

  if (!Array.isArray(guests) || guests.length === 0) {
    req.body.guests = [{ adults: 2, children: [] }];
    console.log('ℹ️ No guests specified, using default: 2 adults');
  }

  next();
}

export default {
  validateRegionId,
  validateSearchParams
};
