# Test Hotel Mapping Guide for ETG Certification

## Overview

This guide explains how to map the mandatory test hotels required for ETG/RateHawk API certification.

## What is "Mapping"?

"Mapping" the test hotel means ensuring it's available in your system:

1. **Database Storage**: Test hotel exists in your `hotel_dump_data` table
2. **API Access**: Test hotel can be retrieved via ETG API endpoints
3. **Search Access**: Test hotel can be accessed via `/search/hp/` endpoint  
4. **Booking Flow**: Test hotel can go through prebook (but NOT complete booking)

## Test Hotel IDs

ETG requires these test hotels to be mapped:

- **hid = `8473727`**
- **id = `"test_hotel_do_not_book"`**

## Quick Start

### Step 1: Install Dependencies

```bash
npm install
npx prisma generate
```

### Step 2: Verify Current Status

Check if test hotels are already in your database:

```bash
node scripts/verify-test-hotel-mapping.js
```

### Step 3: Map Missing Test Hotels

If hotels are missing, fetch and store them:

```bash
node scripts/map-test-hotel.js
```

This script will:
- ✅ Check if test hotels exist in database
- ✅ Fetch them from ETG API if missing
- ✅ Store them in `hotel_dump_data` table
- ✅ Verify they can be accessed via `/search/hp/` endpoint

## Manual Verification

### Check Database

```sql
SELECT hotel_id, name, city, country 
FROM hotel_dump_data 
WHERE hotel_id IN ('8473727', 'test_hotel_do_not_book');
```

### Test via API

```bash
# Test hotel 8473727
curl -X POST http://localhost:3000/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "8473727",
    "checkin": "2026-02-15",
    "checkout": "2026-02-17",
    "guests": [{"adults": 2, "children": []}],
    "residency": "US",
    "language": "en"
  }'
```

## Files Created

1. **`scripts/map-test-hotel.js`** - Main script to fetch and store test hotels
2. **`scripts/verify-test-hotel-mapping.js`** - Quick verification script (database only)
3. **`scripts/README-MAP-TEST-HOTEL.md`** - Detailed documentation

## What ETG Will Verify

During certification, ETG will check:

1. ✅ Test hotel appears in search results (if searching by region/geo)
2. ✅ Test hotel can be accessed directly via `/search/hp/` with its ID
3. ✅ Test hotel returns rates and can go through prebook
4. ✅ Test hotel is clearly marked/identifiable as a test hotel

## Important Warnings

⚠️ **DO NOT complete actual bookings with test hotels!**

- Test hotels are for **certification verification only**
- Use them to test the booking **flow**, not to create real bookings
- The test hotel ID `test_hotel_do_not_book` is specifically named to prevent accidental bookings

## Troubleshooting

### "Cannot find package 'axios'"
```bash
npm install
```

### "PrismaClient did not initialize"
```bash
npx prisma generate
```

### "Hotel not found in ETG API"
- Verify your API credentials in `.env`
- Check that you're using test environment credentials (not production)
- Test hotel might only be available in certain ETG environments

### "Database connection failed"
- Verify `DATABASE_URL` in `.env`
- Ensure database is accessible
- Check Prisma schema matches your database

## Certification Checklist

When filling out the ETG Pre-Certification Checklist:

**Question: "Map Test Hotels"**

✅ **Answer**: "Yes, test hotels are mapped:
- hid = 8473727
- id = test_hotel_do_not_book

Both test hotels are stored in our database and accessible via `/search/hp/` endpoint. We can demonstrate access during certification."

## Next Steps

1. ✅ Run `node scripts/map-test-hotel.js` to ensure test hotels are mapped
2. ✅ Verify test hotels are accessible via your API endpoints
3. ✅ Document in certification checklist that test hotels are mapped
4. ✅ Inform ETG during certification that test hotels are available for verification

## Support

If you encounter issues:

1. Check the error messages - they usually indicate what's missing
2. Verify your `.env` file has correct credentials
3. Ensure database is accessible and Prisma client is generated
4. Contact ETG support at `apisupport@ratehawk.com` if test hotels are not available in your environment

