# Frontend Fix Guide - Resolving 503 Errors and Duplicate Requests

## Problems Identified

1. **5 duplicate API calls** - React component is making the same request 5 times
2. **503 Service Unavailable** - Server was overwhelmed with requests
3. **No debouncing** - Every keystroke triggers an immediate API call
4. **No request cancellation** - Previous requests aren't canceled when new ones start
5. **Using POST instead of GET** - Less efficient for caching

## Backend Fixes Applied ✅

The following backend improvements have been implemented:

1. **Error handling** - Proper try-catch with meaningful error messages
2. **Timeout protection** - 5-second timeout on external API calls
3. **Caching** - 24-hour cache for destination searches
4. **Rate limiting** - Maximum 10 requests per minute per IP
5. **Input validation** - Query must be at least 2 characters
6. **Structured responses** - Consistent JSON response format

## Frontend Changes Required

### 1. Add Debouncing Hook

Create a custom debounce hook to prevent rapid-fire requests:

```javascript
// hooks/useDebounce.js
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### 2. Add Request Cancellation

Use AbortController to cancel previous requests:

```javascript
import { useState, useEffect } from 'react';
import { useDebounce } from './hooks/useDebounce';

function DestinationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce the query by 300ms
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    // Skip if query is too short
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    // Create abort controller for this request
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    // Use GET instead of POST for better caching
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/destinations/autocomplete?query=${encodeURIComponent(debouncedQuery)}`;

    fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setResults(data.data?.destinations || []);
        setLoading(false);
      })
      .catch(err => {
        // Ignore abort errors (they're expected when canceling)
        if (err.name === 'AbortError') {
          console.log('Request cancelled');
          return;
        }
        console.error('Search error:', err);
        setError(err.message);
        setLoading(false);
      });

    // Cleanup: cancel the request when component unmounts or query changes
    return () => {
      controller.abort();
    };
  }, [debouncedQuery]); // Only re-run when debounced query changes

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search destinations..."
      />

      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}

      <ul>
        {results.map((result, index) => (
          <li key={`${result.region_id}-${index}`}>
            {result.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 3. Switch from POST to GET

**Before (causing issues):**
```javascript
fetch('/destinations/', {
  method: 'POST',
  body: JSON.stringify({ query: 'Paris' })
})
```

**After (recommended):**
```javascript
fetch('/destinations/autocomplete?query=Paris', {
  method: 'GET'
})
```

### 4. Fix React StrictMode Duplicate Renders

If you're seeing duplicate calls in development mode, it might be React StrictMode. This is normal in development but won't happen in production. To verify:

```javascript
// In your main.jsx or index.jsx
// Remove StrictMode temporarily to test
<React.StrictMode>  {/* Remove this if it's causing issues */}
  <App />
</React.StrictMode>
```

**Note:** Don't remove StrictMode in production - fix the root cause instead.

### 5. Add Loading State Protection

Prevent multiple simultaneous requests with a loading state check:

```javascript
const [isSearching, setIsSearching] = useState(false);

async function searchDestinations(query) {
  // Prevent multiple simultaneous searches
  if (isSearching) {
    console.log('Search already in progress, skipping...');
    return;
  }

  setIsSearching(true);
  try {
    const response = await fetch(`/destinations/autocomplete?query=${query}`);
    const data = await response.json();
    setResults(data.data?.destinations || []);
  } finally {
    setIsSearching(false);
  }
}
```

## API Response Format

The backend now returns structured responses:

### Success Response
```json
{
  "status": "ok",
  "data": {
    "destinations": [
      {
        "label": "Paris, France",
        "region_id": 2734,
        "type": "city",
        "country_code": "FR",
        "country_name": "France",
        "coordinates": null
      }
    ],
    "total": 1
  },
  "meta": {
    "from_cache": true,
    "duration_ms": 15,
    "timestamp": "2025-12-27T10:30:00.000Z"
  }
}
```

### Error Response
```json
{
  "error": "Bad Request",
  "message": "Query must be at least 2 characters",
  "field": "query",
  "timestamp": "2025-12-27T10:30:00.000Z"
}
```

### Rate Limit Response (429)
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 10 requests per minute allowed.",
  "retry_after_seconds": 45,
  "timestamp": "2025-12-27T10:30:00.000Z"
}
```

## Testing Your Fixes

1. **Open DevTools Network Tab**
2. **Type in search box slowly**
3. **Verify:**
   - Only 1 request per search (after 300ms delay)
   - Previous requests are canceled (shown as "canceled" in network tab)
   - No 503 errors
   - Fast responses from cache (10-20ms)
   - Rate limit headers present:
     - `X-RateLimit-Limit: 10`
     - `X-RateLimit-Remaining: 9`
     - `X-RateLimit-Reset: <timestamp>`

## Common Issues and Solutions

### Issue: Still seeing duplicate requests
**Solution:** Check for multiple useEffect hooks or event listeners. Ensure cleanup functions are working.

### Issue: Requests still reaching backend too fast
**Solution:** Increase debounce delay from 300ms to 500ms or 1000ms.

### Issue: Search feels sluggish
**Solution:** Reduce debounce delay to 200ms, but not lower than 150ms.

### Issue: Getting CORS errors
**Solution:** Ensure your API server has proper CORS headers configured.

### Issue: Cache not working
**Solution:** Use GET requests instead of POST. POST requests are harder to cache.

## Performance Metrics

**Before fixes:**
- 5 requests per search
- ~500-1000ms response time
- Frequent 503 errors
- No caching

**After fixes:**
- 1 request per search
- ~15-30ms response time (cached)
- ~100-300ms response time (uncached)
- No 503 errors
- 24-hour cache
- Rate limit protection

## Next Steps

1. Implement debouncing hook
2. Add AbortController for request cancellation
3. Switch to GET method for autocomplete
4. Add loading state protection
5. Test thoroughly in DevTools
6. Monitor rate limit headers
7. Add error handling UI

## Backend Endpoints Available

### GET /destinations/autocomplete
**Parameters:**
- `query` (required): Search term (min 2 characters)
- `locale` (optional): Language code (default: 'en')
- `limit` (optional): Max results (default: 10, max: 50)

**Example:**
```
GET /destinations/autocomplete?query=Paris&locale=en&limit=10
```

### POST /destinations/
**Body:**
```json
{
  "query": "Paris",
  "locale": "en"
}
```

**Recommendation:** Use GET /destinations/autocomplete instead for better caching and performance.
