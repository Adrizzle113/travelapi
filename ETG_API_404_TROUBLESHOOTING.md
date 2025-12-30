# ETG API 404 Errors - Troubleshooting Guide

## 🔴 Current Issues

### Issue 1: Hotel Page Endpoint - 404
**Endpoint:** `POST /api/b2b/v3/hotel/info/hotelpage/`
**Error:** `{"error":"page not found"}`

### Issue 2: Prebook Endpoint - 404
**Endpoint:** `POST /api/b2b/v3/hotel/order/prebook/`
**Error:** `{"error":"page not found"}`
**Additional Issue:** Frontend sending invalid `book_hash: "rate_0"` instead of actual hash

## 🔍 Root Causes

### 1. API Credentials Permissions
The 404 errors suggest your ETG API credentials may not have access to:
- Hotel page endpoint (`/hotel/info/hotelpage/`)
- Prebook endpoint (`/hotel/order/prebook/`)

**Solution:** Contact ETG support to verify:
- Your API key has access to booking endpoints
- Your account is certified/approved for booking operations
- The endpoints are enabled for your partner ID

### 2. Invalid book_hash Format
The frontend is sending `book_hash: "rate_0"` which is a rate index, not a hash.

**Correct Format:** `book_hash` should be like `"h-48eb6527-778e-5f64-91c9-b03065f9cc1e"`

**Where to get it:** From the `book_hash` field in the rate object from hotel details response:
```json
{
  "rates": [
    {
      "id": "rate_0",
      "book_hash": "h-48eb6527-778e-5f64-91c9-b03065f9cc1e",  // ← Use this
      "room_name": "Deluxe Room",
      ...
    }
  ]
}
```

## ✅ Fixes Applied

### 1. Improved Error Handling
- Added specific 404 error messages
- Added authentication error detection
- Added validation for `book_hash` format

### 2. book_hash Validation
The backend now validates that `book_hash` doesn't start with `"rate_"` and provides helpful error message.

## 🔧 Frontend Fixes Required

### Fix 1: Use Correct book_hash
**File:** Component that calls prebook endpoint

**Before (WRONG):**
```typescript
// ❌ Using rate index
const bookHash = `rate_${rateIndex}`;
await prebook({ book_hash: bookHash });
```

**After (CORRECT):**
```typescript
// ✅ Use book_hash from rate object
const selectedRate = hotelDetails.rates[rateIndex];
const bookHash = selectedRate.book_hash;  // e.g., "h-48eb6527-..."
await prebook({ book_hash: bookHash });
```

### Fix 2: Handle 404 Errors Gracefully
```typescript
try {
  const response = await prebook({ book_hash, residency, currency });
  // Handle success
} catch (error) {
  if (error.response?.status === 404) {
    // ETG API endpoint not available
    setError("Booking is temporarily unavailable. Please contact support.");
  } else {
    // Other errors
    setError(error.message);
  }
}
```

## 📋 Verification Steps

1. **Check ETG API Credentials:**
   - Verify API key is correct
   - Verify partner ID matches
   - Contact ETG support to confirm endpoint access

2. **Test Endpoints Directly:**
   ```bash
   # Test hotel page (should return 200 or 404 with details)
   curl -X POST https://api.worldota.net/api/b2b/v3/hotel/info/hotelpage/ \
     -u "PARTNER_ID:API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"hotel_id":"the_west_hollywood_edition","checkin":"2025-12-31","checkout":"2026-01-02","guests":[{"adults":2,"children":[]}],"residency":"us","language":"en","currency":"USD"}'

   # Test prebook (should return 200 or 404 with details)
   curl -X POST https://api.worldota.net/api/b2b/v3/hotel/order/prebook/ \
     -u "PARTNER_ID:API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"book_hash":"h-48eb6527-778e-5f64-91c9-b03065f9cc1e","residency":"us","currency":"USD"}'
   ```

3. **Check ETG API Documentation:**
   - Verify endpoint paths are correct
   - Check if endpoints require special permissions
   - Look for alternative endpoint names

## 🚨 Next Steps

1. **Contact ETG Support:**
   - Request access to booking endpoints
   - Verify your account certification status
   - Confirm endpoint paths are correct

2. **Update Frontend:**
   - Fix `book_hash` to use actual hash from rate object
   - Add proper error handling for 404s
   - Show user-friendly error messages

3. **Monitor Logs:**
   - Check if 404s persist after fixes
   - Verify book_hash format in requests
   - Confirm API credentials are valid

## 📝 Notes

- The 404 errors are coming from ETG API, not our backend
- Backend now provides better error messages
- Frontend must use correct `book_hash` format
- API credentials may need to be updated/enabled by ETG

