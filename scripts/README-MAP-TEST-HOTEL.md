# Map Test Hotel for ETG Certification

This script maps the mandatory test hotels required for ETG/RateHawk API certification.

## Test Hotel IDs

- `hid = 8473727`
- `id = "test_hotel_do_not_book"`

## Prerequisites

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Ensure your `.env` file has ETG API credentials**:
   ```
   RATEHAWK_USERNAME=your_username
   RATEHAWK_PASSWORD=your_password
   ```

3. **Database connection** must be configured in `.env`:
   ```
   DATABASE_URL=your_database_url
   ```

## Usage

### Option 1: Run the mapping script directly

```bash
node scripts/map-test-hotel.js
```

This will:
1. Check if test hotels exist in your database
2. Fetch them from ETG API if missing
3. Store them in the `hotel_dump_data` table
4. Verify they can be accessed via `/search/hp/` endpoint

### Option 2: Use via API endpoint (if server is running)

You can also test the mapping by calling your hotel details endpoint:

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

## What "Mapping" Means

"Mapping" the test hotel means:

1. **Database Storage**: The test hotel exists in your `hotel_dump_data` table
2. **API Access**: The test hotel can be retrieved via `/hotel/info/` endpoint
3. **Search Access**: The test hotel can be accessed via `/search/hp/` endpoint
4. **Booking Flow**: The test hotel can go through prebook (but NOT complete booking)

## Verification

After running the script, verify the mapping:

```sql
-- Check if test hotels exist in database
SELECT hotel_id, name, city, country 
FROM hotel_dump_data 
WHERE hotel_id IN ('8473727', 'test_hotel_do_not_book');
```

## Important Notes

⚠️ **DO NOT complete actual bookings with test hotels!**

- Test hotels are for **certification verification only**
- Use them to test the booking **flow**, not to create real bookings
- ETG will verify that you can access and process test hotels during certification

## Troubleshooting

### Error: "Cannot find package 'axios'"
- Run `npm install` to install dependencies

### Error: "Hotel not found in ETG API"
- Verify your API credentials in `.env`
- Check that you're using the correct test environment credentials
- The test hotel might only be available in certain environments

### Error: "Database connection failed"
- Verify your `DATABASE_URL` in `.env`
- Ensure your database is accessible
- Run `npx prisma generate` if Prisma client is not generated

## Next Steps

After mapping test hotels:

1. ✅ Test hotels are stored in your database
2. ✅ Test hotels can be accessed via API endpoints
3. 📋 Document in your certification checklist that test hotels are mapped
4. 📧 Inform ETG during certification that test hotels are available

