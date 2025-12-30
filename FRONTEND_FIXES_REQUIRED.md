# Frontend Fixes Required

> **⚠️ IMPORTANT:** See [FRONTEND_BOOKING_FLOW_UPDATE.md](./FRONTEND_BOOKING_FLOW_UPDATE.md) for the **latest booking flow changes** (partner_order_id, order_id, item_id requirements).

This document outlines the frontend changes needed to work with the updated backend that supports real bookings and proper error handling.

## Critical Changes

### 1. Remove Fake Order ID Generation

**File:** `PaymentPage.tsx` (or similar booking completion component)

**Problem:** Frontend generates fake order IDs when `finishBooking()` fails, which the backend now rejects.

**Current Code (WRONG):**
```typescript
catch (error) {
  console.log("⚠️ Using simulated order finish for certification testing");
  const simulatedOrderId = `ORD-${Date.now()}`;
  navigate(`/processing/${simulatedOrderId}`);
}
```

**Fixed Code (CORRECT):**
```typescript
try {
  const response = await bookingApi.finishBooking(bookingData);
  
  if (response.success && response.data?.order_id) {
    // ✅ Use REAL order_id from backend response
    navigate(`/processing/${response.data.order_id}`);
  } else {
    // Show error, don't create fake ID
    setError("Booking failed. Please try again.");
    // Optionally: show retry button or navigate back
  }
} catch (error) {
  // ✅ Show error message, don't navigate with fake ID
  const errorMessage = error.response?.data?.error?.message || 
                      error.message || 
                      "Failed to complete booking. Please try again.";
  setError(errorMessage);
  
  // Don't navigate to processing page
  // Optionally: navigate back to payment page or show retry button
}
```

### 2. Use Backend Proxy for Hotel Reviews

**File:** Component that fetches hotel reviews (likely hotel details page)

**Problem:** Frontend calls Supabase directly without API key, causing 401 errors.

**Current Code (WRONG):**
```typescript
// Direct Supabase call without API key
const response = await fetch(
  `https://vewsxruqjeoehsjtgqyh.supabase.co/rest/v1/hotel_reviews?hotel_id=eq.${hotelId}`
);
```

**Fixed Code (CORRECT - Option 1: Use Backend Proxy):**
```typescript
// ✅ Call backend endpoint (no API key needed)
const response = await fetch(
  `${API_BASE_URL}/api/ratehawk/hotel/${hotelId}/reviews?limit=20&offset=0&order=desc`
);

const data = await response.json();
if (data.success) {
  const reviews = data.data;
  // Use reviews...
}
```

**Alternative (Option 2: Add API Key to Supabase Calls):**
```typescript
// ✅ Include API key in headers
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const response = await fetch(
  `${SUPABASE_URL}/rest/v1/hotel_reviews?hotel_id=eq.${hotelId}&select=*&order=review_date.desc&limit=20`,
  {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Recommended:** Use Option 1 (backend proxy) - it's simpler and doesn't expose Supabase credentials to frontend.

### 3. Handle Backend Error Responses

**File:** `ProcessingPage.tsx` (or order status polling component)

**Problem:** Backend now returns specific error messages for invalid order IDs that need proper handling.

**Current Code (WRONG):**
```typescript
// May not handle backend error format properly
try {
  const response = await bookingApi.getOrderStatus(orderId);
  // Handle success
} catch (error) {
  // Generic error handling
  setError("Failed to check status");
}
```

**Fixed Code (CORRECT):**
```typescript
try {
  const response = await bookingApi.getOrderStatus(orderId);
  
  if (response.success && response.data) {
    // Handle successful status check
    setOrderStatus(response.data.status);
    if (response.data.status === 'confirmed') {
      // Booking confirmed
    }
  }
} catch (error) {
  const errorMessage = error.response?.data?.error?.message || error.message;
  
  // ✅ Check for invalid order ID errors
  if (errorMessage?.includes('simulated/test order ID') || 
      errorMessage?.includes('Invalid order ID format')) {
    setError("Invalid booking reference. Please contact support with your booking details.");
    // Don't retry polling
    stopPolling();
  } else if (errorMessage?.includes('Order not found')) {
    setError("Booking not found. Please verify your booking reference.");
    stopPolling();
  } else {
    // Network or other errors - may retry
    setError("Unable to check booking status. Please try again.");
    // Optionally: retry with exponential backoff
  }
}
```

## Backend Endpoints Available

### Hotel Reviews (NEW)
```
GET /api/ratehawk/hotel/:hotelId/reviews
Query params:
  - limit: number (default: 20)
  - offset: number (default: 0)
  - order: "asc" | "desc" (default: "desc")

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "hotel_id": "hotel_123",
      "reviewer_name": "John Doe",
      "rating": 4.5,
      "review_text": "Great hotel!",
      "review_date": "2024-01-15T10:00:00Z",
      "helpful_count": 5,
      "language": "en"
    }
  ],
  "meta": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

### Booking Endpoints (Updated)
All booking endpoints now reject fake order IDs and return clear error messages:

- `POST /api/ratehawk/prebook` - Lock rate
- `POST /api/ratehawk/order/form` - Get booking form
- `POST /api/ratehawk/order/finish` - Complete booking (returns real order_id)
- `POST /api/ratehawk/order/status` - Check status (rejects fake IDs)
- `POST /api/ratehawk/order/info` - Get order info (rejects fake IDs)
- `POST /api/ratehawk/order/documents` - Get documents (rejects fake IDs)

## Error Response Format

Backend now returns consistent error format:

```json
{
  "success": false,
  "error": {
    "message": "Invalid order ID format: ORD-1767062835773. This appears to be a simulated/test order ID. Use a real order ID from finishOrder() response.",
    "code": "ORDER_STATUS_ERROR"
  },
  "timestamp": "2025-12-30T03:00:00.000Z",
  "duration": "5ms"
}
```

## Testing Checklist

After implementing fixes:

- [ ] Test booking flow with real ETG API
- [ ] Verify order_id comes from `finishOrder()` response
- [ ] Verify status polling works with real order_id
- [ ] Test error handling when booking fails
- [ ] Verify no fake order IDs are created
- [ ] Test hotel reviews load via backend proxy
- [ ] Verify no 401 errors from Supabase
- [ ] Test invalid order ID error handling

## Migration Steps

1. **Update booking completion handler:**
   - Remove fake order ID generation
   - Use real order_id from backend response
   - Add proper error handling

2. **Update hotel reviews fetching:**
   - Replace direct Supabase calls with backend proxy
   - Or add API key to Supabase calls
   - Update response parsing

3. **Update order status polling:**
   - Handle backend error format
   - Check for invalid order ID errors
   - Stop polling on invalid IDs

4. **Test thoroughly:**
   - Test successful booking flow
   - Test booking failure scenarios
   - Test with real ETG order IDs
   - Verify error messages are user-friendly

## Notes

- Backend mock responses are **disabled by default** (only for explicit testing with `ENABLE_MOCK_BOOKINGS=true`)
- Backend uses correct ETG API endpoints per certification checklist
- All fake order IDs (`ORD-{timestamp}`) are rejected with clear errors
- Frontend must use real order IDs from `finishOrder()` response

