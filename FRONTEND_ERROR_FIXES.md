# Frontend Error Fixes

This document addresses the specific errors you're seeing in the frontend.

## 🔴 Error 1: `/api/ratehawk/prebook` - 404 Not Found

**Error:** `Failed to load resource: the server responded with a status of 404 ()`

**Cause:** The endpoint exists but might be called with wrong method or path.

**Fix:** Ensure you're using **POST** method:

```typescript
// ✅ CORRECT
const response = await fetch(`${API_BASE}/api/ratehawk/prebook`, {
  method: 'POST',  // Must be POST
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    book_hash: rateHash,  // From hotel details rate
    residency: 'us',
    currency: 'USD'
  })
});

// ❌ WRONG - GET method
const response = await fetch(`${API_BASE}/api/ratehawk/prebook?book_hash=...`);
```

**Request Format:**
```json
{
  "book_hash": "h-48eb6527-778e-5f64-91c9-b03065f9cc1e",
  "residency": "us",
  "currency": "USD"
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "book_hash": "h-48eb6527-778e-5f64-91c9-b03065f9cc1e",
    "expires_at": "2025-01-01T12:00:00Z"
  }
}
```

---

## 🔴 Error 2: `/api/ratehawk/hotel/details` - 500 Internal Server Error

**Error:** `Failed to load resource: the server responded with a status of 500 ()`

**Possible Causes:**
1. Missing or invalid `hotelId`/`hotel_id` in request
2. ETG API error (hotel not found, API credentials issue)
3. Service function throwing unhandled error

**Fix:** Add proper error handling and validation:

```typescript
// ✅ CORRECT - With error handling
try {
  const response = await fetch(`${API_BASE}/api/ratehawk/hotel/details`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hotelId: hotelId,  // or hotel_id
      checkin: checkinDate,
      checkout: checkoutDate,
      guests: guestsArray,
      currency: 'USD',
      language: 'en',
      residency: 'us'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Hotel details error:', errorData);
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.success) {
    // Use data.data.data.hotels[0]
    return data.data.data.hotels[0];
  } else {
    throw new Error(data.error || 'Failed to get hotel details');
  }
} catch (error) {
  console.error('Failed to fetch hotel details:', error);
  // Show user-friendly error message
  setError('Unable to load hotel details. Please try again.');
  throw error;
}
```

**Request Format:**
```json
{
  "hotelId": "the_west_hollywood_edition",
  "checkin": "2025-02-01",
  "checkout": "2025-02-05",
  "guests": [
    { "adults": 2, "children": [] }
  ],
  "currency": "USD",
  "language": "en",
  "residency": "us"
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "data": {
      "hotels": [{
        "id": "the_west_hollywood_edition",
        "name": "Hotel Name",
        "rates": [...],
        "room_groups": [...]
      }]
    }
  },
  "from_cache": false,
  "duration": "1234ms",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

**Debug Steps:**
1. Check browser console for detailed error message
2. Verify `hotelId` is valid (not null/undefined)
3. Check backend logs for specific error
4. Verify ETG API credentials are set

---

## 🔴 Error 3: Supabase Hotel Reviews - 401 Unauthorized

**Error:** `Failed to load resource: the server responded with a status of 401 ()`

**Cause:** Frontend is calling Supabase directly without API key.

**Fix:** Use the backend proxy endpoint instead:

```typescript
// ❌ WRONG - Direct Supabase call
const response = await fetch(
  `https://vewsxruqjeoehsjtgqyh.supabase.co/rest/v1/hotel_reviews?select=*&hotel_id=eq.${hotelId}&order=review_date.desc&limit=20`
);
```

```typescript
// ✅ CORRECT - Use backend proxy
const response = await fetch(
  `${API_BASE}/api/ratehawk/hotel/${hotelId}/reviews?limit=20&offset=0&order=desc`
);

if (!response.ok) {
  throw new Error(`Failed to fetch reviews: ${response.status}`);
}

const data = await response.json();
if (data.success) {
  const reviews = data.data;
  // Use reviews...
} else {
  console.error('Reviews error:', data.error);
}
```

**Backend Endpoint:**
```
GET /api/ratehawk/hotel/:hotelId/reviews
```

**Query Parameters:**
- `limit` (optional, default: 20) - Number of reviews to return
- `offset` (optional, default: 0) - Pagination offset
- `order` (optional, default: "desc") - Sort order: "asc" or "desc"

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "hotel_id": "the_west_hollywood_edition",
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

**Complete Example:**
```typescript
async function fetchHotelReviews(hotelId: string, limit = 20, offset = 0) {
  try {
    const response = await fetch(
      `${API_BASE}/api/ratehawk/hotel/${encodeURIComponent(hotelId)}/reviews?limit=${limit}&offset=${offset}&order=desc`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      return {
        reviews: data.data,
        meta: data.meta,
        hasMore: data.meta?.has_more || false
      };
    } else {
      throw new Error(data.error?.message || 'Failed to fetch reviews');
    }
  } catch (error) {
    console.error('Error fetching reviews:', error);
    // Return empty array on error, or show error message
    return {
      reviews: [],
      meta: { total: 0, limit, offset, has_more: false },
      hasMore: false
    };
  }
}

// Usage
const { reviews, hasMore } = await fetchHotelReviews('the_west_hollywood_edition');
```

---

## 📋 Quick Fix Checklist

- [ ] **Prebook:** Change to POST method with JSON body
- [ ] **Hotel Details:** Add error handling, verify hotelId is provided
- [ ] **Reviews:** Replace Supabase direct call with backend proxy endpoint
- [ ] **Error Handling:** Add try-catch blocks and user-friendly error messages
- [ ] **Response Parsing:** Verify response structure matches expectations

---

## 🔍 Debugging Tips

1. **Check Network Tab:**
   - Look at the actual request URL and method
   - Check request payload
   - Check response body for error details

2. **Check Backend Logs:**
   - Look for specific error messages
   - Check if ETG API credentials are valid
   - Verify database connections

3. **Test Endpoints Directly:**
   ```bash
   # Test prebook
   curl -X POST https://travelapi-bg6t.onrender.com/api/ratehawk/prebook \
     -H "Content-Type: application/json" \
     -d '{"book_hash":"h-48eb6527-778e-5f64-91c9-b03065f9cc1e","residency":"us","currency":"USD"}'

   # Test hotel details
   curl -X POST https://travelapi-bg6t.onrender.com/api/ratehawk/hotel/details \
     -H "Content-Type: application/json" \
     -d '{"hotelId":"the_west_hollywood_edition","checkin":"2025-02-01","checkout":"2025-02-05","guests":[{"adults":2,"children":[]}]}'

   # Test reviews
   curl "https://travelapi-bg6t.onrender.com/api/ratehawk/hotel/the_west_hollywood_edition/reviews?limit=20"
   ```

4. **Common Issues:**
   - Missing `Content-Type: application/json` header
   - Using GET instead of POST for prebook
   - Invalid hotel ID format
   - Missing required fields in request body

---

## 📝 Notes

- All booking-related endpoints require POST method
- Hotel reviews endpoint uses GET method
- Always check `response.ok` before parsing JSON
- Use `encodeURIComponent()` for hotel IDs in URLs
- Backend proxy for reviews eliminates need for Supabase API key in frontend

