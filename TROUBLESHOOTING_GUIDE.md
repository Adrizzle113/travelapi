# Troubleshooting Guide

Solutions to common issues when integrating with the Travel Booking API.

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Authentication Problems](#authentication-problems)
3. [Search Issues](#search-issues)
4. [Data Issues](#data-issues)
5. [CORS Errors](#cors-errors)
6. [Performance Issues](#performance-issues)
7. [Debugging Tools](#debugging-tools)

---

## Connection Issues

### ❌ API Not Responding

**Symptoms:**
- Requests timeout
- "Failed to fetch" errors
- No response from server

**Solutions:**

1. **Check API is Running:**
```bash
curl http://localhost:3001/api/health
```

2. **Verify API URL:**
```javascript
// Make sure URL is correct
const API_BASE = 'http://localhost:3001/api'; // Local
// or
const API_BASE = 'https://your-api.render.com/api'; // Production
```

3. **Check Network Tab:**
- Open browser DevTools (F12)
- Go to Network tab
- Look for failed requests
- Check request URL is correct

4. **Verify Port:**
```bash
# Check if port 3001 is in use
netstat -an | grep 3001
# or
lsof -i :3001
```

---

### ❌ Cannot Connect to API

**Symptoms:**
- ERR_CONNECTION_REFUSED
- net::ERR_CONNECTION_RESET

**Solutions:**

1. **Check Firewall:**
   - Ensure port 3001 is not blocked
   - Disable firewall temporarily to test

2. **Check Server Logs:**
```bash
# Look for startup errors
# Server should show:
# "Server running on port 3001"
```

3. **Verify Environment:**
```bash
# Check .env file exists
cat .env

# Should contain:
# DATABASE_URL=...
# ETG_PARTNER_ID=...
# ETG_KEY=...
```

---

## Authentication Problems

### ❌ 401 Unauthorized Error

**Symptoms:**
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

**Solutions:**

1. **Check Token Exists:**
```javascript
const token = localStorage.getItem('auth_token');
console.log('Token:', token); // Should not be null
```

2. **Verify Token Format:**
```javascript
// Token should start with "Bearer "
headers: {
  'Authorization': `Bearer ${token}` // Note the space after Bearer
}
```

3. **Login Again:**
```javascript
// Token may have expired (24h validity)
// Login to get new token
await api.login(email, password);
```

4. **Check Token in Request:**
```javascript
// In browser DevTools > Network tab
// Click request > Headers tab
// Verify Authorization header is present
```

---

### ❌ Login Fails with Correct Credentials

**Symptoms:**
- "Invalid email or password"
- User exists but can't login

**Solutions:**

1. **Check Email Format:**
```javascript
const email = 'user@example.com'; // No spaces, correct format
```

2. **Verify User Status:**
```javascript
// Check if user is active
const response = await fetch(`${API_BASE}/users/status/${email}`);
const data = await response.json();
console.log('User status:', data.status);
// Should be 'approved', not 'pending' or 'rejected'
```

3. **Check Password:**
   - Minimum 6 characters
   - No leading/trailing spaces
   - Case-sensitive

4. **Try Registration:**
```javascript
// If account doesn't exist, register first
await api.register(email, password);
```

---

### ❌ Token Not Saving

**Symptoms:**
- localStorage.getItem('auth_token') returns null
- User logged out after page refresh

**Solutions:**

1. **Check localStorage Available:**
```javascript
if (typeof localStorage !== 'undefined') {
  console.log('localStorage is available');
} else {
  console.error('localStorage not available');
}
```

2. **Check Private/Incognito Mode:**
   - localStorage may be disabled in private browsing
   - Test in normal browser window

3. **Manual Save:**
```javascript
const response = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();

if (data.success && data.token) {
  localStorage.setItem('auth_token', data.token);
  console.log('Token saved:', localStorage.getItem('auth_token'));
}
```

---

## Search Issues

### ❌ No Hotels Found

**Symptoms:**
```json
{
  "success": true,
  "hotels": [],
  "totalHotels": 0
}
```

**Solutions:**

1. **Try Popular Destinations:**
```javascript
// Test with known destinations
const testDestinations = ['paris', 'london', 'new york', 'dubai'];
```

2. **Check Date Format:**
```javascript
// Must be YYYY-MM-DD
const checkin = '2024-02-01'; // Correct
const checkin = '02/01/2024'; // Wrong
const checkin = '2024-2-1';   // Wrong

// Use helper:
const formatDate = (date) => date.toISOString().split('T')[0];
```

3. **Verify Dates Are Valid:**
```javascript
const checkin = new Date('2024-02-01');
const checkout = new Date('2024-02-05');
const today = new Date();

// Check-in must be >= today
if (checkin < today) {
  console.error('Check-in date is in the past');
}

// Check-out must be > check-in
if (checkout <= checkin) {
  console.error('Check-out must be after check-in');
}
```

4. **Check Destination ID:**
```javascript
// Make sure you're using the ID, not the name
const destinationId = '1234'; // Correct (from autocomplete)
const destinationId = 'Paris'; // Wrong
```

---

### ❌ Autocomplete Not Working

**Symptoms:**
- No suggestions appear
- Empty results array

**Solutions:**

1. **Check Query Length:**
```javascript
// Minimum 2 characters required
if (query.length >= 2) {
  // Make API call
}
```

2. **Add Debouncing:**
```javascript
let timeout;
const handleSearch = (query) => {
  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    const results = await api.autocomplete(query);
    setDestinations(results);
  }, 300); // Wait 300ms after user stops typing
};
```

3. **Check Response:**
```javascript
const response = await fetch(
  `${API_BASE}/destinations/autocomplete?query=paris`
);
const data = await response.json();
console.log('Autocomplete results:', data);
// Should have results array
```

4. **Test Direct:**
```bash
# Test in terminal
curl "http://localhost:3001/api/destinations/autocomplete?query=paris"
```

---

### ❌ Search Takes Too Long

**Symptoms:**
- Search hangs for 10+ seconds
- Timeout errors

**Solutions:**

1. **Check Network:**
```javascript
// Add timeout to fetch
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

fetch(url, { signal: controller.signal })
  .then(response => {
    clearTimeout(timeoutId);
    return response.json();
  })
  .catch(error => {
    if (error.name === 'AbortError') {
      console.error('Request timeout');
    }
  });
```

2. **Use Cached Results:**
```javascript
// Check if response is from cache
const data = await searchHotels(...);
if (data.from_cache) {
  console.log('✅ Fast - from cache');
} else {
  console.log('⏳ Slow - fresh API call');
}
```

3. **Check API Diagnostics:**
```javascript
const stats = await fetch(`${API_BASE}/diagnostics`);
const data = await stats.json();
console.log('API status:', data);
// Check memory usage and response times
```

---

## Data Issues

### ❌ Missing Hotel Images

**Symptoms:**
- hotel.images is undefined or empty
- Broken image links

**Solutions:**

1. **Check Array:**
```javascript
const imageUrl = hotel.images?.[0] || '/placeholder.jpg';
```

2. **Validate URL:**
```javascript
const isValidImage = (url) => {
  return url && url.startsWith('http');
};

const images = hotel.images?.filter(isValidImage) || [];
```

3. **Use Fallback:**
```javascript
<img
  src={hotel.images?.[0] || 'https://via.placeholder.com/400x300'}
  alt={hotel.name}
  onError={(e) => {
    e.target.src = '/fallback-image.jpg';
  }}
/>
```

---

### ❌ Price Not Showing

**Symptoms:**
- Price is undefined or 0
- "N/A" or "$0.00" displayed

**Solutions:**

1. **Check Data Structure:**
```javascript
// Price location varies
const price = hotel.price?.amount ||
              hotel.rates?.[0]?.payment_options?.payment_types?.[0]?.show_amount ||
              0;
```

2. **Handle Missing Price:**
```javascript
const formatPrice = (hotel) => {
  const amount = hotel.price?.amount;
  const currency = hotel.price?.currency || 'USD';

  if (!amount || amount === 0) {
    return 'Price on request';
  }

  return `${currency} ${amount.toFixed(2)}`;
};
```

---

### ❌ Guest Configuration Error

**Symptoms:**
- "Invalid guests format"
- 400 Bad Request

**Solutions:**

1. **Correct Format:**
```javascript
// Correct
const guests = [
  { adults: 2, children: [] }
];

// Wrong
const guests = { adults: 2, children: [] }; // Should be array
const guests = [{ adults: 2 }]; // Missing children array
```

2. **Validate Before Send:**
```javascript
const validateGuests = (guests) => {
  if (!Array.isArray(guests)) return false;

  return guests.every(room =>
    room.adults &&
    room.adults > 0 &&
    Array.isArray(room.children)
  );
};

if (!validateGuests(guests)) {
  console.error('Invalid guests format');
}
```

3. **URL Encode:**
```javascript
// For GET requests
const guestsStr = JSON.stringify(guests);
const encoded = encodeURIComponent(guestsStr);
const url = `${API_BASE}/search?guests=${encoded}`;
```

---

## CORS Errors

### ❌ CORS Policy Error

**Symptoms:**
```
Access to fetch at 'http://localhost:3001/api/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solutions:**

1. **Check Origin:**
```javascript
console.log('Current origin:', window.location.origin);
// Should be in allowed list: localhost:*, bookja.vercel.app, etc.
```

2. **Contact Backend Team:**
   - Ask them to add your domain to allowed origins
   - Provide your exact origin (e.g., 'http://localhost:3000')

3. **Use Proxy (Development Only):**
```javascript
// In package.json (React)
{
  "proxy": "http://localhost:3001"
}

// Then use relative URLs
fetch('/api/health'); // Instead of full URL
```

4. **Verify Request Method:**
```javascript
// CORS requires correct method
fetch(url, {
  method: 'POST', // Must match endpoint method
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

---

### ❌ Preflight Request Failed

**Symptoms:**
- OPTIONS request returns error
- Actual request never sent

**Solutions:**

1. **Check Headers:**
```javascript
// Only use standard headers
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer token' // If needed
}

// Don't add custom headers without backend support
```

2. **Verify Method:**
```javascript
// Make sure method is allowed
// Server allows: GET, POST, PUT, DELETE, OPTIONS
```

---

## Performance Issues

### ❌ Slow Page Load

**Solutions:**

1. **Lazy Load Images:**
```javascript
<img
  src={hotel.images[0]}
  loading="lazy"
  alt={hotel.name}
/>
```

2. **Paginate Results:**
```javascript
// Don't load all hotels at once
const [page, setPage] = useState(1);
const hotelsPerPage = 20;

const displayedHotels = hotels.slice(
  (page - 1) * hotelsPerPage,
  page * hotelsPerPage
);
```

3. **Cache API Responses:**
```javascript
const cache = new Map();

const fetchWithCache = async (url, ttl = 60000) => {
  const cached = cache.get(url);

  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }

  const response = await fetch(url);
  const data = await response.json();

  cache.set(url, { data, time: Date.now() });
  return data;
};
```

4. **Optimize Bundle Size:**
```javascript
// Use dynamic imports
const HotelDetails = lazy(() => import('./HotelDetails'));
```

---

### ❌ Memory Leaks

**Symptoms:**
- Browser slows down over time
- Increasing memory usage

**Solutions:**

1. **Cancel Pending Requests:**
```javascript
useEffect(() => {
  const controller = new AbortController();

  fetch(url, { signal: controller.signal })
    .then(response => response.json())
    .then(data => setHotels(data.hotels));

  return () => {
    controller.abort(); // Cancel on unmount
  };
}, [url]);
```

2. **Clear Event Listeners:**
```javascript
useEffect(() => {
  const handleResize = () => { /* ... */ };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

3. **Limit State Updates:**
```javascript
// Debounce state updates
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);

useEffect(() => {
  if (debouncedQuery.length >= 2) {
    searchDestinations(debouncedQuery);
  }
}, [debouncedQuery]);
```

---

## Debugging Tools

### Console Logging

```javascript
// Enable detailed logging
const DEBUG = true;

const api = {
  async request(url, options) {
    if (DEBUG) {
      console.group(`API Request: ${options.method || 'GET'} ${url}`);
      console.log('Headers:', options.headers);
      console.log('Body:', options.body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (DEBUG) {
      console.log('Response:', data);
      console.log('Status:', response.status);
      console.groupEnd();
    }

    return data;
  }
};
```

---

### Network Inspection

```javascript
// Log all fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('Fetch:', args[0], args[1]);
  return originalFetch.apply(this, args);
};
```

---

### Response Timing

```javascript
const measureTime = async (name, fn) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`${name}: ${duration.toFixed(2)}ms`);
  return result;
};

// Usage
const hotels = await measureTime('Search Hotels', () =>
  api.searchHotels(params)
);
```

---

### API Health Check

```javascript
const checkAPIHealth = async () => {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    console.log('✅ API Status:', data.status);
    console.log('📊 Database:', data.database);
    console.log('🔧 ETG API:', data.etg_api);

    return data.status === 'healthy';
  } catch (error) {
    console.error('❌ API is down:', error);
    return false;
  }
};

// Run on app start
checkAPIHealth();
```

---

### Detailed Diagnostics

```javascript
const getAPIDiagnostics = async () => {
  const diagnostics = await fetch(`${API_BASE}/diagnostics`)
    .then(r => r.json());

  console.table({
    'Uptime': `${(diagnostics.uptime / 3600).toFixed(1)} hours`,
    'Memory Used': `${diagnostics.memory.heapUsed}MB`,
    'Memory Total': `${diagnostics.memory.heapTotal}MB`,
    'Memory %': `${diagnostics.memory.percentUsed}%`,
    'Database': diagnostics.database.connected ? '✅' : '❌',
    'Cache Size': `${diagnostics.cache.entries} entries`
  });
};
```

---

## Quick Diagnostic Checklist

Run through this checklist to identify issues:

```javascript
const runDiagnostics = async () => {
  console.log('🔍 Running Diagnostics...\n');

  // 1. Check API connection
  try {
    const health = await fetch(`${API_BASE}/health`);
    console.log('✅ API is reachable');
  } catch (e) {
    console.error('❌ Cannot reach API:', e.message);
    return;
  }

  // 2. Check authentication
  const token = localStorage.getItem('auth_token');
  console.log(token ? '✅ Token exists' : '❌ No token found');

  // 3. Test autocomplete
  try {
    const dest = await fetch(`${API_BASE}/destinations/autocomplete?query=paris`);
    const data = await dest.json();
    console.log(`✅ Autocomplete works (${data.results?.length || 0} results)`);
  } catch (e) {
    console.error('❌ Autocomplete failed:', e.message);
  }

  // 4. Test search
  try {
    const guests = encodeURIComponent(JSON.stringify([{adults:2,children:[]}]));
    const search = await fetch(
      `${API_BASE}/ratehawk/search?destination=1234&checkin=2024-02-01&checkout=2024-02-05&guests=${guests}`
    );
    const data = await search.json();
    console.log(`✅ Search works (${data.hotels?.length || 0} hotels)`);
  } catch (e) {
    console.error('❌ Search failed:', e.message);
  }

  console.log('\n✅ Diagnostics complete');
};

// Run it
runDiagnostics();
```

---

## Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Missing required fields" | Request missing parameters | Check all required params are sent |
| "Invalid email or password" | Wrong credentials | Verify email/password, check user status |
| "Invalid or expired token" | Auth token invalid | Login again to get new token |
| "No hotels found" | Search returned no results | Try different destination/dates |
| "Invalid guests format" | Wrong guest data structure | Use `[{adults: 2, children: []}]` |
| "Failed to fetch" | Network/connection error | Check API is running, verify URL |
| "CORS policy" | Origin not allowed | Contact backend to add your domain |
| "Rate limit exceeded" | Too many requests | Wait and retry, implement rate limiting |

---

## Getting Help

If you're still stuck after trying these solutions:

1. **Check API Status:**
   ```bash
   curl http://localhost:3001/api/diagnostics
   ```

2. **Collect Information:**
   - Error message
   - Request URL
   - Request body
   - Response status code
   - Browser console logs
   - Network tab screenshots

3. **Check Documentation:**
   - [API Quick Reference](API_QUICK_REFERENCE.md)
   - [Full Documentation](FRONTEND_API_DOCUMENTATION.md)
   - [Integration Examples](INTEGRATION_EXAMPLES.md)

4. **Contact Support:**
   - Include error details
   - Provide `requestId` from error response
   - Share relevant code snippet

---

**Last Updated:** January 2024
