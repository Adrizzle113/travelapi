# Frontend Developer Guide

Welcome! This guide will help you integrate your frontend with the Travel Booking API.

## 📚 Documentation

We have comprehensive documentation for different use cases:

### For Quick Start
👉 **[API Quick Reference](API_QUICK_REFERENCE.md)** - Essential endpoints and examples

### For Complete Details
👉 **[Full API Documentation](FRONTEND_API_DOCUMENTATION.md)** - Complete endpoint reference with examples

### For API Testing
👉 **[Postman Guide](POSTMAN_GUIDE.md)** - Testing the API with Postman collection

### For Code Integration
👉 **[Integration Examples](INTEGRATION_EXAMPLES.md)** - React, Vue, Next.js examples

---

## 🚀 Quick Start (5 Minutes)

### 1. Set Your API URL

```javascript
const API_BASE = 'https://your-api-url.com/api';
// or for local development:
// const API_BASE = 'http://localhost:3001/api';
```

### 2. Login to Get Token

```javascript
const response = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'your@email.com',
    password: 'yourpassword'
  })
});

const { token, user } = await response.json();
localStorage.setItem('auth_token', token);
```

### 3. Search Hotels

```javascript
const guests = JSON.stringify([{ adults: 2, children: [] }]);
const response = await fetch(
  `${API_BASE}/ratehawk/search?` +
  `destination=1234&` +
  `checkin=2024-02-01&` +
  `checkout=2024-02-05&` +
  `guests=${encodeURIComponent(guests)}`
);

const { hotels } = await response.json();
```

### 4. Get Hotel Details

```javascript
const token = localStorage.getItem('auth_token');
const response = await fetch(`${API_BASE}/ratehawk/hotel/details`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    hotelId: 'hotel_123',
    checkin: '2024-02-01',
    checkout: '2024-02-05',
    guests: [{ adults: 2, children: [] }]
  })
});

const hotelDetails = await response.json();
```

---

## 🎯 Common Use Cases

### Search Flow

1. **Autocomplete** → Get destination suggestions as user types
2. **Search** → Find hotels for selected destination and dates
3. **Details** → Get full hotel information with rates
4. **Book** → Create booking form

```javascript
// 1. Autocomplete
GET /destinations/autocomplete?query=paris

// 2. Search
GET /ratehawk/search?destination=1234&checkin=2024-02-01&checkout=2024-02-05&guests=[...]

// 3. Details
POST /ratehawk/hotel/details
{ "hotelId": "hotel_123", "checkin": "...", "checkout": "...", "guests": [...] }

// 4. Booking
POST /booking-form/create-booking-form
{ "book_hashs": "...", "hotelData": {...} }
```

---

## 📦 Ready-to-Use Code

### React Hook

```javascript
import { useState, useCallback } from 'react';

export function useHotelSearch() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchHotels = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      const guests = encodeURIComponent(JSON.stringify(params.guests));
      const url = `${API_BASE}/ratehawk/search?` +
        `destination=${params.destination}&` +
        `checkin=${params.checkin}&` +
        `checkout=${params.checkout}&` +
        `guests=${guests}`;

      const response = await fetch(url);
      const data = await response.json();

      setHotels(data.hotels);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { hotels, loading, error, searchHotels };
}
```

### Vanilla JavaScript

```javascript
class TravelAPI {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    return await response.json();
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async searchHotels(destination, checkin, checkout, guests) {
    const guestsStr = encodeURIComponent(JSON.stringify(guests));
    return this.request(
      `/ratehawk/search?destination=${destination}&checkin=${checkin}&checkout=${checkout}&guests=${guestsStr}`
    );
  }

  async getHotelDetails(hotelId, checkin, checkout, guests) {
    return this.request('/ratehawk/hotel/details', {
      method: 'POST',
      body: JSON.stringify({ hotelId, checkin, checkout, guests })
    });
  }
}

// Usage
const api = new TravelAPI('https://your-api.com/api');
await api.login('user@email.com', 'password');
const hotels = await api.searchHotels('1234', '2024-02-01', '2024-02-05', [{ adults: 2, children: [] }]);
```

---

## 🔑 Essential Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/auth/login` | POST | Get authentication token | No |
| `/destinations/autocomplete` | GET | Search destinations | No |
| `/ratehawk/search` | GET | Search hotels | No |
| `/ratehawk/hotel/details` | POST | Get hotel details | Yes |
| `/booking-form/create-booking-form` | POST | Create booking | Yes |

---

## ⚠️ Important Notes

### Date Format
Always use `YYYY-MM-DD` format:
```javascript
const date = new Date('2024-02-01');
const formatted = date.toISOString().split('T')[0]; // '2024-02-01'
```

### Guest Format
```javascript
// Single room with 2 adults
[{ adults: 2, children: [] }]

// With children (specify ages)
[{ adults: 2, children: [8, 10] }]

// Multiple rooms
[
  { adults: 2, children: [] },
  { adults: 1, children: [5] }
]
```

### Authentication
Include token in headers for protected endpoints:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Error Handling
Always handle errors:
```javascript
try {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
} catch (error) {
  console.error('API Error:', error.message);
  // Show user-friendly error message
}
```

---

## 🧪 Testing the API

### Option 1: Use Postman

1. Import `Travel-API.postman_collection.json`
2. Follow the [Postman Guide](POSTMAN_GUIDE.md)
3. Test all endpoints interactively

### Option 2: Browser Console

```javascript
// Test in browser console
const API = 'http://localhost:3001/api';

// Health check
fetch(`${API}/health`).then(r => r.json()).then(console.log);

// Login
fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@test.com', password: 'test123' })
}).then(r => r.json()).then(console.log);
```

---

## 📊 API Status

Check if the API is running:

```bash
# Health check
curl http://localhost:3001/api/health

# Detailed diagnostics
curl http://localhost:3001/api/diagnostics
```

---

## 🆘 Troubleshooting

### ❌ CORS Error

**Solution:** Make sure your domain is in the allowed origins list. Contact the backend team to add your domain.

### ❌ 401 Unauthorized

**Solution:**
1. Check token exists: `localStorage.getItem('auth_token')`
2. Login again to get fresh token
3. Verify Authorization header format: `Bearer YOUR_TOKEN`

### ❌ No Hotels Found

**Solution:**
1. Use popular destination (e.g., "paris", "london")
2. Check dates are in future
3. Verify checkout date is after checkin
4. Try different destination

### ❌ 500 Server Error

**Solution:**
1. Check `/api/health` endpoint
2. View `/api/diagnostics` for system status
3. Contact backend team with error details

---

## 📞 Support

### API Diagnostics

```javascript
// Check API health
GET /api/health

// View system diagnostics
GET /api/diagnostics

// Request statistics
GET /api/diagnostics/requests
```

### Getting Help

1. Check documentation first (links at top)
2. Review integration examples
3. Test with Postman collection
4. Check server logs for errors
5. Include `requestId` from error responses when asking for help

---

## 📝 Example Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── index.js           # API service
│   │   ├── auth.js            # Authentication
│   │   ├── hotels.js          # Hotel endpoints
│   │   └── destinations.js    # Destination endpoints
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useHotelSearch.js
│   │   └── useAutocomplete.js
│   ├── components/
│   │   ├── HotelSearch.jsx
│   │   ├── HotelCard.jsx
│   │   └── DestinationSearch.jsx
│   └── utils/
│       ├── dates.js
│       ├── guests.js
│       └── storage.js
└── .env
    REACT_APP_API_URL=http://localhost:3001/api
```

---

## 🎓 Learning Path

1. **Start Here** → [Quick Reference](API_QUICK_REFERENCE.md)
2. **Test API** → [Postman Guide](POSTMAN_GUIDE.md)
3. **Understand Details** → [Full Documentation](FRONTEND_API_DOCUMENTATION.md)
4. **Code Examples** → [Integration Examples](INTEGRATION_EXAMPLES.md)
5. **Build Your App** → Start integrating!

---

## 📄 Available Documentation

| Document | Description | Best For |
|----------|-------------|----------|
| **API_QUICK_REFERENCE.md** | Essential endpoints and examples | Quick lookup |
| **FRONTEND_API_DOCUMENTATION.md** | Complete API reference | Detailed info |
| **POSTMAN_GUIDE.md** | Testing with Postman | API testing |
| **INTEGRATION_EXAMPLES.md** | Framework-specific code | Implementation |
| **This File** | Overview and quick start | Getting started |

---

## ✅ Checklist for Frontend Integration

- [ ] Read Quick Reference
- [ ] Test API with Postman
- [ ] Setup authentication flow
- [ ] Implement destination autocomplete
- [ ] Add hotel search functionality
- [ ] Create hotel details page
- [ ] Implement booking flow
- [ ] Add error handling
- [ ] Test with real data
- [ ] Handle loading states
- [ ] Add user feedback

---

## 🚀 Next Steps

1. Choose your framework (React, Vue, Next.js, etc.)
2. Review integration examples for your framework
3. Copy the API service code
4. Start with authentication
5. Add search functionality
6. Build hotel details view
7. Implement booking flow

---

**Ready to start?** Open [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) for essential endpoints!

**Need examples?** Check [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md) for your framework!

**Want to test first?** Follow the [POSTMAN_GUIDE.md](POSTMAN_GUIDE.md)!

---

**API Version:** 2.0.0
**Last Updated:** January 2024
