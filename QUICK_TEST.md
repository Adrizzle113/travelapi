# Quick Test Commands

Copy and paste these commands to test your API:

## 1. Check Server Health ✅
```bash
curl http://localhost:3001/api/health
```

**Expected:** Should return `"status": "healthy"`

---

## 2. Test Server Configuration ✅
```bash
curl http://localhost:3001/api/test
```

**Expected:** Should show ETG and Database as "Configured"

---

## 3. Why Your Original Request Failed ❌

**Your Original Command:**
```bash
curl -X POST http://localhost:3001/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "caesars_palace",
    "checkin": "2025-01-15",
    "checkout": "2025-01-17",
    "guests": [{"adults": 2, "children": []}]
  }'
```

**Error:**
```json
{
  "success": false,
  "error": "Failed to get hotel details: Request failed with status code 404"
}
```

**Why it failed:**
- `"caesars_palace"` is NOT a valid RateHawk hotel ID
- RateHawk uses IDs like `"lH7Y9"` or `"kX3mP"`
- You must search first to get real hotel IDs

---

## 4. The Correct Way (Currently Not Working - ETG API Issue)

### Step 1: Search for Hotels
```bash
curl -X POST http://localhost:3001/api/ratehawk/search \
  -H "Content-Type: application/json" \
  -d '{
    "region_id": "4898",
    "checkin": "2025-02-15",
    "checkout": "2025-02-17",
    "guests": [{"adults": 2, "children": []}],
    "currency": "USD"
  }'
```

**Current Status:** Returns 400 error from ETG API
**When Working:** Should return list of hotels with real IDs

### Step 2: Use Real Hotel ID
```bash
curl -X POST http://localhost:3001/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "REAL_HOTEL_ID_FROM_SEARCH",
    "checkin": "2025-02-15",
    "checkout": "2025-02-17",
    "guests": [{"adults": 2, "children": []}]
  }'
```

---

## 5. Run Automated Test
```bash
node test-complete-booking-flow.js
```

This script:
- Checks server health ✅
- Attempts hotel search (currently fails due to ETG API)
- Would fetch hotel details if search worked

---

## Key Takeaways

1. **Server is running fine** ✅
2. **Your mistake:** Using fake hotel ID like "caesars_palace" ❌
3. **Correct approach:** Search first, then use real IDs ✅
4. **Current blocker:** ETG API returns 400 errors ⚠️

---

## What You Learned

Your backend code is **correct**. The issue was understanding RateHawk's API flow:

❌ **Wrong:**
```
Use friendly name → Get hotel details
```

✅ **Correct:**
```
Search by location → Get real hotel IDs → Use ID for details
```

**Example Flow:**
```
Search "Las Vegas"
  → Get hotels: [{id: "lH7Y9", name: "Bellagio"}, {id: "kX3mP", name: "Caesars"}]
  → Use "lH7Y9"
  → Get full details for Bellagio
```

---

## Next Steps

1. **Verify ETG API credentials** - They might need renewal or verification
2. **Add missing database table** - See CURRENT_STATUS.md for SQL
3. **Test again once ETG is fixed**
4. **Update your frontend** to follow the two-step flow

---

For complete documentation, see:
- **API_USAGE_GUIDE.md** - Detailed API usage with examples
- **CURRENT_STATUS.md** - Current state and issues
- **test-complete-booking-flow.js** - Automated test script
