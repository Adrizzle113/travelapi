# How to Test Test Hotel Mapping

This guide shows you multiple ways to verify that test hotels are properly mapped and working.

## Quick Test Options

### Option 1: Run the Automated Test Script (Recommended)

The easiest way to test everything:

```bash
# Make sure your server is running first
npm start

# In another terminal, run the test script
node scripts/test-hotel-mapping.js
```

This script will:
- ✅ Check if test hotels exist in database
- ✅ Test `/api/ratehawk/hotel/static-info` endpoint
- ✅ Test `/api/ratehawk/hotel/details` endpoint (with rates)
- ✅ Test `/api/ratehawk/prebook` endpoint (if rates available)
- ✅ Provide a comprehensive summary

### Option 2: Manual Database Check

Check if test hotels are in your database:

```bash
# Using the verification script
node scripts/verify-test-hotel-mapping.js
```

Or directly with SQL:

```sql
SELECT hotel_id, name, city, country, star_rating
FROM hotel_dump_data 
WHERE hotel_id IN ('8473727', 'test_hotel_do_not_book');
```

### Option 3: Test via API Endpoints

#### Test Static Info Endpoint

```bash
curl -X POST http://localhost:3000/api/ratehawk/hotel/static-info \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "8473727",
    "language": "en"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "hotel": {
    "id": "8473727",
    "name": "Test Hotel Name",
    ...
  }
}
```

#### Test Hotel Details with Rates

```bash
curl -X POST http://localhost:3000/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "8473727",
    "checkin": "2026-02-15",
    "checkout": "2026-02-17",
    "guests": [{"adults": 2, "children": []}],
    "residency": "US",
    "language": "en",
    "currency": "USD"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "hotel": {
    "id": "8473727",
    "name": "Test Hotel Name",
    "rates": [...]
  }
}
```

#### Test Prebook (if rates available)

First, get a `book_hash` from the hotel details response, then:

```bash
curl -X POST http://localhost:3000/api/ratehawk/prebook \
  -H "Content-Type: application/json" \
  -d '{
    "hash": "h-abc123...",
    "guests": [{"adults": 2, "children": []}],
    "residency": "US",
    "language": "en"
  }'
```

**Note:** You may get `sandbox_restriction` error if using test API keys - this is expected and means the endpoint is accessible.

### Option 4: Test via Browser/Postman

1. **Start your server:**
   ```bash
   npm start
   ```

2. **Open Postman or browser:**
   - URL: `http://localhost:3000/api/ratehawk/hotel/details`
   - Method: POST
   - Body (JSON):
     ```json
     {
       "hotelId": "8473727",
       "checkin": "2026-02-15",
       "checkout": "2026-02-17",
       "guests": [{"adults": 2, "children": []}],
       "residency": "US",
       "language": "en"
     }
     ```

## What to Look For

### ✅ Success Indicators

1. **Database Check:**
   - Test hotels appear in `hotel_dump_data` table
   - Have name, city, country populated

2. **Static Info Endpoint:**
   - Returns `200 OK`
   - Response has `success: true`
   - Hotel data includes name, address, amenities

3. **Hotel Details Endpoint:**
   - Returns `200 OK`
   - Response has `success: true`
   - May or may not have rates (depends on test hotel availability)

4. **Prebook Endpoint:**
   - Returns `200 OK` OR `sandbox_restriction` error
   - `sandbox_restriction` is OK - it means endpoint is accessible but test API key has restrictions

### ❌ Failure Indicators

1. **Database:**
   - Test hotels not found
   - **Fix:** Run `node scripts/map-test-hotel.js`

2. **API Endpoints:**
   - `404 Not Found` - Hotel not in database
   - `500 Internal Server Error` - Check server logs
   - `Hotel not found` - Hotel ID incorrect or not in ETG system

3. **No Rates:**
   - Hotel details returns but `rates: []`
   - **This is normal** for test hotels - they may not have availability for all dates

## Troubleshooting

### Server Not Running
```bash
# Start the server
npm start

# Or in development mode
npm run dev
```

### Dependencies Not Installed
```bash
npm install
npx prisma generate
```

### Database Connection Issues
- Check `.env` file has correct `DATABASE_URL`
- Verify database is accessible
- Run `npx prisma generate` if Prisma client errors

### API Credentials
- Verify `.env` has `RATEHAWK_USERNAME` and `RATEHAWK_PASSWORD`
- Test credentials work with ETG API

### Test Hotel Not Found
- Verify hotel ID is correct: `8473727` or `test_hotel_do_not_book`
- Check if hotel exists in ETG test environment
- Run mapping script: `node scripts/map-test-hotel.js`

## Expected Test Results

### Ideal Result:
```
✅ Database: 2/2 hotels found
✅ Static Info: ✅
✅ Hotel Details: ✅ (may have 0 rates - this is OK)
✅ Prebook: ✅ (or sandbox_restriction - also OK)
```

### Acceptable Result:
```
✅ Database: 2/2 hotels found
✅ Static Info: ✅
✅ Hotel Details: ✅ (0 rates - test hotel may not have availability)
⏭️  Prebook: Skipped (no rates)
```

This is still acceptable for certification - ETG just needs to verify you can access the test hotels.

## Certification Checklist

When ETG verifies your integration, they will:

1. ✅ Check test hotels are in your database
2. ✅ Access test hotels via `/search/hp/` endpoint
3. ✅ Verify test hotels can go through prebook flow
4. ✅ Confirm you can access booking form (even if it fails with sandbox_restriction)

**You're ready for certification if:**
- Test hotels are in database ✅
- `/hotel/details` endpoint works ✅
- `/prebook` endpoint is accessible ✅ (even if it returns sandbox_restriction)

## Quick Reference

```bash
# 1. Verify database
node scripts/verify-test-hotel-mapping.js

# 2. Map missing hotels
node scripts/map-test-hotel.js

# 3. Test everything
node scripts/test-hotel-mapping.js

# 4. Test via API
curl -X POST http://localhost:3000/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{"hotelId": "8473727", "checkin": "2026-02-15", "checkout": "2026-02-17", "guests": [{"adults": 2}], "residency": "US"}'
```

