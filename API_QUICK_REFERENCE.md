# API Quick Reference

Fast reference guide for the Travel Booking API.

## Base URL
```
Production: https://your-api-url.com/api
Local: http://localhost:3001/api
```

## Authentication

All authenticated requests need:
```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN_HERE',
  'Content-Type': 'application/json'
}
```

---

## Essential Endpoints

### 🔐 Authentication

```javascript
// Register
POST /auth/register
{ "email": "user@email.com", "password": "pass123" }

// Login
POST /auth/login
{ "email": "user@email.com", "password": "pass123" }
// Returns: { token, user }

// Verify Token
GET /auth/verify
Headers: Authorization: Bearer TOKEN
```

---

### 🌍 Search Destinations

```javascript
// Autocomplete (as user types)
GET /destinations/autocomplete?query=paris
// Returns: List of matching destinations
```

---

### 🏨 Search Hotels

```javascript
// Simple search (recommended)
GET /ratehawk/search?destination=1234&checkin=2024-02-01&checkout=2024-02-05&guests=[{"adults":2,"children":[]}]

// Advanced search
POST /ratehawk/search
{
  "region_id": "1234",
  "checkin": "2024-02-01",
  "checkout": "2024-02-05",
  "guests": [{ "adults": 2, "children": [] }],
  "currency": "USD"
}
```

---

### 🏨 Hotel Details

```javascript
// With rates
POST /ratehawk/hotel/details
{
  "hotelId": "hotel_123",
  "checkin": "2024-02-01",
  "checkout": "2024-02-05",
  "guests": [{ "adults": 2, "children": [] }]
}

// Basic info (faster)
GET /ratehawk/hotel/details-t?hotel_id=hotel_123
```

---

### 📝 Booking

```javascript
// Create booking form
POST /booking-form/create-booking-form
{
  "book_hashs": "hash_abc",
  "hotelData": { ... }
}

// Get countries list
GET /booking-form/countries
```

---

### 👤 User Management

```javascript
// Create user with logo (multipart/form-data)
POST /users/users
FormData: { name, email, password, logo }

// Email verification
POST /users/email-verification
{ "email": "user@email.com", "otp": "123456" }

// Check status
GET /users/status/user@email.com

// Get all users
GET /users/users

// Approve user
PUT /users/approve/user@email.com
```

---

### 🏥 Health & Diagnostics

```javascript
// Health check
GET /health

// Detailed diagnostics
GET /diagnostics

// Request stats
GET /diagnostics/requests

// Memory usage
GET /diagnostics/memory
```

---

## Common Patterns

### Login Flow

```javascript
const login = async (email, password) => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.success) {
    localStorage.setItem('token', data.token);
    return data.user;
  }

  throw new Error(data.error);
};
```

---

### Search Flow

```javascript
// 1. Get destination
const dest = await fetch(
  `${API}/destinations/autocomplete?query=paris`
).then(r => r.json());

const destinationId = dest.results[0].id;

// 2. Search hotels
const guests = JSON.stringify([{ adults: 2, children: [] }]);
const hotels = await fetch(
  `${API}/ratehawk/search?` +
  `destination=${destinationId}&` +
  `checkin=2024-02-01&` +
  `checkout=2024-02-05&` +
  `guests=${encodeURIComponent(guests)}`
).then(r => r.json());

// 3. Get hotel details
const token = localStorage.getItem('token');
const details = await fetch(`${API}/ratehawk/hotel/details`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    hotelId: hotels.hotels[0].id,
    checkin: '2024-02-01',
    checkout: '2024-02-05',
    guests: [{ adults: 2, children: [] }]
  })
}).then(r => r.json());
```

---

### File Upload (Logo)

```javascript
const uploadLogo = async (name, email, password, logoFile) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('email', email);
  formData.append('password', password);
  formData.append('logo', logoFile);

  const res = await fetch(`${API}/users/users`, {
    method: 'POST',
    body: formData
    // Don't set Content-Type - browser handles it
  });

  return await res.json();
};
```

---

## Guest Format

```javascript
// Single room, 2 adults
[{ adults: 2, children: [] }]

// Single room, 2 adults + 1 child (age 8)
[{ adults: 2, children: [8] }]

// Two rooms
[
  { adults: 2, children: [] },
  { adults: 1, children: [5, 10] }
]
```

---

## Date Format

Always use: `YYYY-MM-DD`

```javascript
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

formatDate(new Date('2024-02-01')); // '2024-02-01'
```

---

## Error Handling

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
  // Show error to user
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (check parameters) |
| 401 | Unauthorized (login required) |
| 404 | Not found |
| 500 | Server error |

---

## Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Caching

API responses include cache info:

```javascript
{
  "from_cache": true,  // Data served from cache
  "hotels": [...],
  "timestamp": "..."
}
```

Cache durations:
- Autocomplete: 24 hours
- Hotel static info: 7 days
- Search results: 15 minutes

---

## Rate Limits

- Search: 60/minute
- Auth: 10/minute
- Other: 120/minute

---

## Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Search
curl "http://localhost:3001/api/ratehawk/search?destination=1234&checkin=2024-02-01&checkout=2024-02-05&guests=%5B%7B%22adults%22%3A2%2C%22children%22%3A%5B%5D%7D%5D"
```

---

## Environment Variables

Required for deployment:

```bash
# Server
PORT=3001

# Database
DATABASE_URL=your_database_url

# JWT Secret
JWT_SECRET=your_secret_key

# ETG API
ETG_PARTNER_ID=your_partner_id
ETG_KEY=your_api_key

# File Upload (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

---

## CORS

Allowed origins are configured server-side. Contact admin to add new domains.

Current allowed:
- `http://localhost:*`
- `https://bookja.vercel.app`
- `https://*.lovable.app`

---

## Support

- Diagnostics: `GET /api/diagnostics`
- Health: `GET /api/health`
- Stats: `GET /api/diagnostics/requests`

Include `requestId` from error responses when reporting issues.
