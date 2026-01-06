# Frontend Review Checklist

> **Repository:** https://github.com/Adrizzle113/website-makeover  
> **Last Updated:** December 30, 2025  
> **Backend Changes:** Rate limiting implementation, ETG API integration

## 🔴 Critical Issues to Fix

### 1. Rate Limiting Error Handling

**Status:** ⚠️ **REQUIRED** - Backend now implements ETG API rate limiting

**Issue:** Frontend may receive 429 (Rate Limit Exceeded) errors or experience delays when backend waits for rate limits.

**Required Changes:**

```typescript
// Add rate limit error handling to all API calls
async function apiCall(endpoint: string, options: RequestInit) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Handle rate limit errors
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      const waitTime = parseInt(retryAfter);
      
      // Show user-friendly message
      showNotification({
        type: 'warning',
        message: `Rate limit reached. Please wait ${waitTime} seconds before trying again.`,
        duration: waitTime * 1000
      });
      
      // Optionally: Auto-retry after wait time
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return apiCall(endpoint, options); // Retry
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

**Files to Update:**
- API service/utility files
- All components making API calls (search, booking, hotel details)

**Endpoints Affected:**
- `/api/ratehawk/search` - 10 requests per 60 seconds
- `/api/ratehawk/hotel/details` - 30 requests per 60 seconds  
- `/api/ratehawk/prebook` - 30 requests per 60 seconds
- `/api/ratehawk/order/*` - 30 requests per 60 seconds
- `/api/destinations/autocomplete` - 30 requests per 60 seconds

---

### 2. Remove Fake Order ID Generation

**Status:** 🔴 **CRITICAL** - Backend rejects fake order IDs

**Issue:** Frontend may still generate fake order IDs (`ORD-{timestamp}`) when booking fails.

**Required Fix:**

```typescript
// ❌ WRONG - Don't do this
catch (error) {
  const simulatedOrderId = `ORD-${Date.now()}`;
  navigate(`/processing/${simulatedOrderId}`);
}

// ✅ CORRECT - Handle errors properly
try {
  const response = await bookingApi.finishBooking(bookingData);
  
  if (response.success && response.data?.order_id) {
    // Use REAL order_id from backend
    navigate(`/processing/${response.data.order_id}`);
  } else {
    setError("Booking failed. Please try again.");
    // Don't navigate, show error instead
  }
} catch (error) {
  const errorMessage = error.response?.data?.error?.message || 
                      error.message || 
                      "Failed to complete booking. Please try again.";
  setError(errorMessage);
  // Show error UI, don't create fake IDs
}
```

**Files to Check:**
- `PaymentPage.tsx` or similar booking completion component
- `ProcessingPage.tsx` or order status component
- Any component handling booking completion

---

### 3. Hotel Reviews - Use Backend Proxy

**Status:** 🔴 **CRITICAL** - Direct Supabase calls cause 401 errors

**Issue:** Frontend calls Supabase directly without API key.

**Required Fix:**

```typescript
// ❌ WRONG - Direct Supabase call
const response = await fetch(
  `https://vewsxruqjeoehsjtgqyh.supabase.co/rest/v1/hotel_reviews?hotel_id=eq.${hotelId}`
);

// ✅ CORRECT - Use backend proxy
const response = await fetch(
  `${API_BASE}/api/ratehawk/hotel/${hotelId}/reviews?limit=20&offset=0&order=desc`
);

const data = await response.json();
if (data.success) {
  const reviews = data.data;
  // Use reviews...
}
```

**Files to Check:**
- Hotel details page component
- Reviews section component
- Any component fetching hotel reviews

---

### 4. Error Response Format Handling

**Status:** ⚠️ **REQUIRED** - Backend returns structured error format

**Issue:** Frontend may not handle new error response format correctly.

**Required Fix:**

```typescript
// ✅ Handle backend error format
try {
  const response = await fetch(endpoint, options);
  const data = await response.json();
  
  if (!response.ok || !data.success) {
    // Backend error format:
    // { success: false, error: { message: "...", code: "..." } }
    const errorMessage = data.error?.message || 
                        data.error || 
                        'An error occurred';
    throw new Error(errorMessage);
  }
  
  return data;
} catch (error) {
  // Handle network errors vs API errors
  if (error.response) {
    // API returned error
    const errorData = error.response.data;
    showError(errorData.error?.message || errorData.error || 'Request failed');
  } else {
    // Network error
    showError('Network error. Please check your connection.');
  }
  throw error;
}
```

**Files to Update:**
- All API service files
- Error handling utilities
- Components with error states

---

## ⚠️ Important Updates

### 5. API Endpoint Verification

**Check these endpoints are correct:**

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/ratehawk/prebook` | POST | ✅ Must be POST |
| `/api/ratehawk/hotel/details` | POST | ✅ Must be POST |
| `/api/ratehawk/order/finish` | POST | ✅ Must be POST |
| `/api/ratehawk/order/status` | POST | ✅ Must be POST |
| `/api/ratehawk/hotel/{id}/reviews` | GET | ✅ Must be GET |
| `/api/destinations/autocomplete` | GET | ✅ Must be GET |
| `/api/ratehawk/search` | GET/POST | ✅ Both supported |

**Common Mistakes:**
- Using GET for booking endpoints (should be POST)
- Missing `Content-Type: application/json` header
- Not encoding hotel IDs in URLs

---

### 6. Request Headers

**Ensure all requests include proper headers:**

```typescript
// For authenticated endpoints
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// For unauthenticated endpoints
const headers = {
  'Content-Type': 'application/json'
};
```

**Files to Check:**
- API service/utility files
- All fetch/axios calls

---

### 7. Loading States During Rate Limiting

**Status:** ⚠️ **RECOMMENDED** - Better UX

**Issue:** Backend may wait for rate limits, causing longer response times.

**Recommended Fix:**

```typescript
// Show loading state with timeout handling
const [loading, setLoading] = useState(false);
const [rateLimitWarning, setRateLimitWarning] = useState(false);

const searchHotels = async () => {
  setLoading(true);
  setRateLimitWarning(false);
  
  // Show warning if request takes too long (might be rate limited)
  const timeoutId = setTimeout(() => {
    setRateLimitWarning(true);
  }, 5000); // 5 seconds
  
  try {
    const response = await apiCall('/ratehawk/search', { ... });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  } finally {
    setLoading(false);
    setRateLimitWarning(false);
  }
};
```

---

## 📋 Code Review Checklist

### API Integration
- [ ] All endpoints use correct HTTP methods (GET vs POST)
- [ ] Request headers include `Content-Type: application/json`
- [ ] Authentication tokens are included for protected endpoints
- [ ] Error responses are handled consistently
- [ ] Rate limit errors (429) are handled gracefully
- [ ] Network errors are distinguished from API errors

### Booking Flow
- [ ] No fake order IDs are generated
- [ ] Real `order_id` from `finishOrder()` response is used
- [ ] Order status polling handles invalid order IDs
- [ ] Error messages are user-friendly
- [ ] Failed bookings show proper error UI (not fake success)

### Hotel Reviews
- [ ] Reviews are fetched via backend proxy (`/api/ratehawk/hotel/{id}/reviews`)
- [ ] No direct Supabase calls
- [ ] Reviews handle pagination correctly
- [ ] Empty states are shown when no reviews

### Error Handling
- [ ] All API calls are wrapped in try-catch
- [ ] Error messages are displayed to users
- [ ] Error format matches backend structure
- [ ] Invalid order ID errors are handled specifically
- [ ] Rate limit errors show retry information

### Performance
- [ ] Debouncing for autocomplete/search inputs
- [ ] Loading states during API calls
- [ ] Caching where appropriate
- [ ] Request cancellation on component unmount

---

## 🔍 Specific Files to Review

Based on typical React/TypeScript structure, check these files:

### API Layer
- `src/api/index.ts` or `src/services/api.ts`
- `src/api/booking.ts` or `src/services/booking.ts`
- `src/api/hotels.ts` or `src/services/hotels.ts`
- `src/api/destinations.ts` or `src/services/destinations.ts`

### Components
- `src/components/PaymentPage.tsx` or `src/pages/Payment.tsx`
- `src/components/ProcessingPage.tsx` or `src/pages/Processing.tsx`
- `src/components/HotelDetails.tsx` or `src/pages/HotelDetails.tsx`
- `src/components/HotelSearch.tsx` or `src/pages/Search.tsx`
- `src/components/BookingForm.tsx`

### Utilities
- `src/utils/errorHandler.ts`
- `src/utils/apiClient.ts`
- `src/hooks/useApi.ts` or similar

---

## 🧪 Testing Checklist

After implementing fixes, test:

- [ ] **Search Flow:**
  - [ ] Autocomplete works without errors
  - [ ] Hotel search returns results
  - [ ] Rate limit errors are handled gracefully
  - [ ] Loading states work correctly

- [ ] **Booking Flow:**
  - [ ] Prebook endpoint works (POST method)
  - [ ] Booking form creation works
  - [ ] Finish booking returns real order_id
  - [ ] No fake order IDs are created
  - [ ] Error handling works for failed bookings

- [ ] **Hotel Details:**
  - [ ] Hotel details load correctly
  - [ ] Reviews load via backend proxy
  - [ ] No 401 errors from Supabase
  - [ ] Error handling for missing hotels

- [ ] **Order Status:**
  - [ ] Status polling works with real order IDs
  - [ ] Invalid order IDs show proper errors
  - [ ] Polling stops on errors
  - [ ] Status updates correctly

- [ ] **Rate Limiting:**
  - [ ] Multiple rapid requests show rate limit warnings
  - [ ] 429 errors are handled gracefully
  - [ ] Retry logic works (if implemented)
  - [ ] User sees appropriate wait messages

---

## 📝 Implementation Priority

1. **🔴 Critical (Fix Immediately):**
   - Remove fake order ID generation
   - Fix hotel reviews to use backend proxy
   - Add rate limit error handling

2. **⚠️ Important (Fix Soon):**
   - Update error handling for new format
   - Verify all endpoints use correct HTTP methods
   - Add loading states for rate-limited requests

3. **💡 Recommended (Improve UX):**
   - Add rate limit warnings
   - Improve error messages
   - Add request retry logic

---

## 🔗 Related Documentation

- [Frontend API Documentation](./FRONTEND_API_DOCUMENTATION.md)
- [Frontend Error Fixes](./FRONTEND_ERROR_FIXES.md)
- [Frontend Fixes Required](./FRONTEND_FIXES_REQUIRED.md)
- [Frontend Booking Flow Update](./FRONTEND_BOOKING_FLOW_UPDATE.md)

---

## 📞 Support

If you encounter issues:

1. Check backend logs for specific error messages
2. Verify API endpoints match documentation
3. Test endpoints directly with curl/Postman
4. Check browser console for detailed error messages
5. Review network tab for request/response details

---

**Last Updated:** December 30, 2025  
**Backend Version:** 2.0.0 (with rate limiting)

