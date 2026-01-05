# Quick Fix: Test Hotel Issues

Based on your test results, here's what needs to be fixed:

## Issues Found

1. ❌ **Hotel `8473727` is missing** from database
2. ❌ **Server is not running** - API endpoints can't be tested
3. ✅ **Hotel `test_hotel_do_not_book` is in database** - Good!

## Step-by-Step Fix

### Step 1: Start Your Server

Open a terminal and start your server:

```bash
npm start
```

Or in development mode:

```bash
npm run dev
```

Keep this terminal running - the server needs to stay up.

### Step 2: Map Missing Hotel

In a **new terminal** (keep server running), run:

```bash
node scripts/map-test-hotel.js
```

This will:
- Fetch hotel `8473727` from ETG API
- Store it in your database
- Verify it's accessible

**Note:** Make sure your `.env` file has:
- `DATABASE_URL` - Your database connection string
- `RATEHAWK_USERNAME` - Your ETG API username
- `RATEHAWK_PASSWORD` - Your ETG API password

### Step 3: Re-run Tests

Once the server is running and hotel is mapped:

```bash
# In a new terminal
node scripts/test-hotel-mapping.js
```

## Expected Results After Fix

You should see:

```
✅ Database: 2/2 hotels found
✅ Static Info: ✅
✅ Hotel Details: ✅
✅ Prebook: ✅ (or sandbox_restriction - both OK)
```

## Troubleshooting

### "Server not responding"
- Make sure `npm start` is running
- Check if port 3000 is already in use
- Verify server started without errors

### "Environment variable not found: DATABASE_URL"
- Check your `.env` file exists
- Verify `DATABASE_URL` is set correctly
- Make sure `.env` file is readable

### "Hotel not found in ETG API"
- Verify your API credentials in `.env`
- Check you're using test environment credentials
- Hotel might only be available in certain ETG environments

## Quick Commands Reference

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Map missing hotel
node scripts/map-test-hotel.js

# Terminal 3: Run tests
node scripts/test-hotel-mapping.js
```

## What Success Looks Like

```
✅ Database: 2/2 hotels found
   - 8473727: Found
   - test_hotel_do_not_book: Found

✅ Static Info: ✅
✅ Hotel Details: ✅
✅ Prebook: ✅ (or sandbox_restriction)
```

You're ready for certification! 🎉

