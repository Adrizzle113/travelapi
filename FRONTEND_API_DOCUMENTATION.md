# Travel Booking API - Frontend Integration Guide

Complete API documentation for integrating the Travel Booking API with your frontend application.

## Base URL

```
Production: https://your-api-url.com/api
Development: http://localhost:3001/api
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Destination & Autocomplete](#destination--autocomplete)
3. [Hotel Search](#hotel-search)
4. [Hotel Details](#hotel-details)
5. [Booking Management](#booking-management)
6. [User Management](#user-management)
7. [System Health](#system-health)
8. [Error Handling](#error-handling)

---

## Authentication Endpoints

### Register User

Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "ratehawkEmail": "user@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "ratehawkEmail": "user@example.com"
  }
}
```

**Validation Rules:**
- Email must be valid format
- Password must be at least 6 characters
- Email must be unique

---

### Login

Authenticate and receive a JWT token.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "ratehawkEmail": "user@example.com",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

### Verify Token

Check if a token is valid.

**Endpoint:** `GET /auth/verify`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "ratehawkEmail": "user@example.com",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

---

### Get User Profile

Retrieve detailed user profile information.

**Endpoint:** `GET /auth/profile`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "ratehawkEmail": "user@example.com",
    "lastLogin": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "loginAttempts": 25,
    "successfulLogins": 24
  }
}
```

---

## Destination & Autocomplete

### Autocomplete Destinations

Search for destinations as the user types.

**Endpoint:** `GET /destinations/autocomplete`

**Query Parameters:**
- `query` (required): Search term (minimum 2 characters)
- `language` (optional): Language code (default: 'en')

**Example Request:**
```javascript
const response = await fetch(
  `${API_BASE}/destinations/autocomplete?query=paris&language=en`
);
```

**Response (200):**
```json
{
  "success": true,
  "results": [
    {
      "id": "1234",
      "name": "Paris",
      "type": "city",
      "country": "France",
      "region": "Île-de-France",
      "display_name": "Paris, France"
    },
    {
      "id": "5678",
      "name": "Paris",
      "type": "city",
      "country": "USA",
      "region": "Texas",
      "display_name": "Paris, Texas, USA"
    }
  ],
  "query": "paris",
  "from_cache": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Usage Notes:**
- Cached for 24 hours for faster responses
- Returns up to 10 suggestions
- Supports cities, hotels, and regions

---

### Get Destination Details

Retrieve detailed information about a specific destination.

**Endpoint:** `POST /destinations/`

**Request Body:**
```json
{
  "destination_id": "1234",
  "language": "en"
}
```

**Response (200):**
```json
{
  "success": true,
  "destination": {
    "id": "1234",
    "name": "Paris",
    "type": "city",
    "country": "France",
    "coordinates": {
      "latitude": 48.8566,
      "longitude": 2.3522
    },
    "description": "The capital of France...",
    "timezone": "Europe/Paris"
  }
}
```

---

## Hotel Search

### Search Hotels (GET)

Search for hotels using query parameters (recommended for frontend).

**Endpoint:** `GET /ratehawk/search`

**Query Parameters:**
- `destination` (required): Destination ID from autocomplete
- `checkin` (required): Check-in date (YYYY-MM-DD)
- `checkout` (required): Check-out date (YYYY-MM-DD)
- `guests` (optional): JSON string of guest configuration
- `currency` (optional): Currency code (default: USD)
- `residency` (optional): Residency country code (default: us)

**Guest Format:**
```javascript
// Single room with 2 adults
const guests = [{ adults: 2, children: [] }];

// Single room with 2 adults and 1 child
const guests = [{ adults: 2, children: [8] }]; // Child age: 8

// Multiple rooms
const guests = [
  { adults: 2, children: [] },
  { adults: 1, children: [5, 10] }
];
```

**Example Request:**
```javascript
const guests = JSON.stringify([{ adults: 2, children: [] }]);
const url = `${API_BASE}/ratehawk/search?` +
  `destination=1234&` +
  `checkin=2024-02-01&` +
  `checkout=2024-02-05&` +
  `guests=${encodeURIComponent(guests)}&` +
  `currency=USD&` +
  `residency=us`;

const response = await fetch(url);
```

**Response (200):**
```json
{
  "success": true,
  "hotels": [
    {
      "id": "hotel_123",
      "name": "Grand Hotel Paris",
      "star_rating": 5,
      "address": "123 Rue de Rivoli, Paris",
      "coordinates": {
        "latitude": 48.8606,
        "longitude": 2.3376
      },
      "images": [
        "https://image-url.com/hotel1.jpg"
      ],
      "price": {
        "amount": 250.00,
        "currency": "USD"
      },
      "amenities": ["WiFi", "Pool", "Restaurant"],
      "rating": {
        "score": 8.5,
        "reviews": 1250
      }
    }
  ],
  "totalHotels": 150,
  "returnedHotels": 50,
  "from_cache": false,
  "search_signature": "sig_abc123",
  "searchDuration": "1250ms",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Search Hotels (POST)

Advanced search with more options and pagination support.

**Endpoint:** `POST /ratehawk/search`

**Request Body:**
```json
{
  "userId": 1,
  "region_id": "1234",
  "destination_label": "Paris, France",
  "checkin": "2024-02-01",
  "checkout": "2024-02-05",
  "guests": [
    {
      "adults": 2,
      "children": []
    }
  ],
  "currency": "USD",
  "residency": "us",
  "page": 1,
  "filters": {
    "min_price": 100,
    "max_price": 500,
    "star_rating": [4, 5]
  }
}
```

**Response:** Same as GET request

**Pagination:**
- Use `search_signature` from first response
- Set `page` parameter for subsequent requests
- Each page returns up to 20 hotels

---

## Hotel Details

### Get Hotel Details with Rates

Retrieve complete hotel information including current rates.

**Endpoint:** `POST /ratehawk/hotel/details`

**Request Body:**
```json
{
  "hotelId": "hotel_123",
  "checkin": "2024-02-01",
  "checkout": "2024-02-05",
  "guests": [
    {
      "adults": 2,
      "children": []
    }
  ],
  "currency": "USD",
  "language": "en",
  "residency": "us"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Hotel details fetched successfully",
  "data": {
    "hotel": {
      "id": "hotel_123",
      "name": "Grand Hotel Paris",
      "address": "123 Rue de Rivoli, 75001 Paris, France",
      "city": "Paris",
      "country": "France",
      "star_rating": 5,
      "images": [
        "https://image-url.com/hotel1.jpg",
        "https://image-url.com/hotel2.jpg"
      ],
      "amenities": [
        "Free WiFi",
        "Swimming Pool",
        "Restaurant",
        "Spa",
        "Gym"
      ],
      "description": "Luxury hotel in the heart of Paris...",
      "coordinates": {
        "latitude": 48.8606,
        "longitude": 2.3376
      },
      "rates": [
        {
          "id": "rate_1",
          "room_name": "Deluxe Double Room",
          "payment_options": {
            "payment_types": [
              {
                "show_amount": 250.00,
                "currency": "USD"
              }
            ]
          },
          "cancellation_info": {
            "free_cancellation_before": "2024-01-25T23:59:59Z"
          },
          "meal_data": {
            "meal": "Breakfast included"
          },
          "room_data_trans": {
            "bedding_type": "King Bed"
          }
        }
      ],
      "room_groups": [
        {
          "room_group_id": "rg_1",
          "name": "Deluxe Double Room",
          "name_struct": {
            "main_name": "Deluxe Double Room"
          }
        }
      ]
    }
  },
  "hotelDetails": {
    "hotelId": "hotel_123",
    "rates": [...],
    "roomTypes": [
      {
        "id": "rg_1",
        "name": "Deluxe Double Room"
      }
    ],
    "bookingOptions": [
      {
        "rateIndex": 0,
        "rateId": "rate_1",
        "roomName": "Deluxe Double Room",
        "price": 250.00,
        "currency": "USD",
        "cancellationPolicy": {...},
        "mealPlan": "Breakfast included",
        "bedding": "King Bed"
      }
    ]
  },
  "from_cache": true,
  "duration": "450ms",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Get Hotel Info (Simple)

Get basic hotel information without rates (faster).

**Endpoint:** `GET /ratehawk/hotel/details-t`

**Query Parameters:**
- `hotel_id` (required): Hotel ID

**Example:**
```javascript
const response = await fetch(
  `${API_BASE}/ratehawk/hotel/details-t?hotel_id=hotel_123`
);
```

**Response (200):**
```json
{
  "error": "",
  "data": {
    "hotel": {
      "id": "hotel_123",
      "name": "Grand Hotel Paris",
      "address": "123 Rue de Rivoli, Paris",
      "city": "Paris",
      "images": ["https://image-url.com/hotel1.jpg"],
      "amenities": ["WiFi", "Pool"],
      "description": "Luxury hotel..."
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Booking Management

### Create Booking Form

Generate a booking form for a selected hotel rate.

**Endpoint:** `POST /booking-form/create-booking-form`

**Request Body:**
```json
{
  "book_hashs": "hash_abc123",
  "hotelData": {
    "hotelId": "hotel_123",
    "hotelName": "Grand Hotel Paris",
    "checkin": "2024-02-01",
    "checkout": "2024-02-05",
    "rateId": "rate_1",
    "price": 250.00,
    "currency": "USD"
  }
}
```

**Response (200):**
```json
{
  "message": "✅ Booking form created successfully",
  "data": {
    "hotelDetails": {
      "hotelId": "hotel_123",
      "hotelName": "Grand Hotel Paris",
      "checkin": "2024-02-01",
      "checkout": "2024-02-05"
    },
    "bookingForm": {
      "partner_order_id": "partner-uuid-123",
      "book_hash": "hash_abc123",
      "fields": [
        {
          "name": "guest_first_name",
          "type": "text",
          "required": true,
          "label": "First Name"
        },
        {
          "name": "guest_last_name",
          "type": "text",
          "required": true,
          "label": "Last Name"
        },
        {
          "name": "guest_email",
          "type": "email",
          "required": true,
          "label": "Email"
        }
      ]
    }
  }
}
```

---

### Get Countries List

Retrieve list of countries for booking forms.

**Endpoint:** `GET /booking-form/countries`

**Response (200):**
```json
{
  "countries": [
    {
      "code": "US",
      "name": "United States"
    },
    {
      "code": "GB",
      "name": "United Kingdom"
    }
  ]
}
```

---

## User Management

### Create User with Logo Upload

Register a user with company logo (multipart/form-data).

**Endpoint:** `POST /users/users`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `name` (required): User/Company name
- `email` (required): Email address
- `password` (required): Password
- `logo` (optional): Logo image file (max 5MB)

**Example (JavaScript):**
```javascript
const formData = new FormData();
formData.append('name', 'Company Name');
formData.append('email', 'company@example.com');
formData.append('password', 'securePassword123');
formData.append('logo', logoFile); // File object

const response = await fetch(`${API_BASE}/users/users`, {
  method: 'POST',
  body: formData
  // Don't set Content-Type header - browser will set it automatically
});
```

**Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "Company Name",
    "email": "company@example.com",
    "logo_url": "https://storage-url.com/logos/uuid.jpg",
    "status": "pending"
  },
  "otp_sent": true
}
```

**File Upload Notes:**
- Maximum file size: 5MB
- Supported formats: JPG, PNG, GIF, WebP
- Files are validated for type and size

---

### Email Verification

Verify user email with OTP code.

**Endpoint:** `POST /users/email-verification`

**Request Body:**
```json
{
  "email": "company@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "user": {
    "email": "company@example.com",
    "verified": true
  }
}
```

---

### Get User Status

Check user approval status.

**Endpoint:** `GET /users/status/{email}`

**Example:**
```javascript
const response = await fetch(
  `${API_BASE}/users/status/company@example.com`
);
```

**Response (200):**
```json
{
  "success": true,
  "status": "approved",
  "user": {
    "email": "company@example.com",
    "name": "Company Name",
    "verified": true,
    "approved": true
  }
}
```

**Possible Statuses:**
- `pending`: Awaiting admin approval
- `approved`: User can access the system
- `rejected`: User was rejected

---

### Get All Users

Retrieve list of all users (admin only).

**Endpoint:** `GET /users/users`

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "Company Name",
      "email": "company@example.com",
      "status": "approved",
      "logo_url": "https://storage-url.com/logos/uuid.jpg",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

### Approve User

Approve a pending user (admin only).

**Endpoint:** `PUT /users/approve/{email}`

**Example:**
```javascript
const response = await fetch(
  `${API_BASE}/users/approve/company@example.com`,
  { method: 'PUT' }
);
```

**Response (200):**
```json
{
  "success": true,
  "message": "User approved successfully",
  "user": {
    "email": "company@example.com",
    "status": "approved"
  }
}
```

---

## System Health

### Health Check

Check if the API is running and healthy.

**Endpoint:** `GET /health`

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "database": "connected",
  "etg_api": "configured"
}
```

---

### Detailed Diagnostics

Get detailed system diagnostics.

**Endpoint:** `GET /diagnostics`

**Response (200):**
```json
{
  "status": "healthy",
  "uptime": 86400,
  "memory": {
    "heapUsed": 150,
    "heapTotal": 256,
    "rss": 300,
    "percentUsed": 58
  },
  "database": {
    "connected": true,
    "tables": 15
  },
  "cache": {
    "size": 250,
    "entries": 150
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Request Statistics

View API request statistics.

**Endpoint:** `GET /diagnostics/requests`

**Response (200):**
```json
{
  "stats": {
    "total": 1500,
    "successful": 1425,
    "failed": 75,
    "averageResponseTime": "250ms"
  },
  "recentRequests": [
    {
      "method": "GET",
      "path": "/ratehawk/search",
      "status": 200,
      "duration": "1200ms",
      "timestamp": "2024-01-15T10:29:00Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | API temporarily unavailable |

### Common Error Examples

**Missing Parameters (400):**
```json
{
  "success": false,
  "error": "Missing required fields: destination, checkin, checkout"
}
```

**Authentication Error (401):**
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

**Rate Limit Error (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retry_after": 60
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Search failed: External API timeout",
  "requestId": "req_abc123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch blocks:

```javascript
try {
  const response = await fetch(`${API_BASE}/ratehawk/search?...`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
} catch (error) {
  console.error('Search failed:', error);
  // Show user-friendly error message
}
```

### 2. Token Management

Store and refresh tokens securely:

```javascript
// Store token
localStorage.setItem('auth_token', token);

// Add to requests
const headers = {
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
  'Content-Type': 'application/json'
};

// Handle expired tokens
if (response.status === 401) {
  // Clear token and redirect to login
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
```

### 3. Loading States

Show loading indicators during API calls:

```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const searchHotels = async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(searchUrl);
    const data = await response.json();
    return data;
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### 4. Caching

Respect cache indicators in responses:

```javascript
if (response.from_cache) {
  console.log('✅ Using cached data');
} else {
  console.log('🔄 Fresh data from API');
}
```

### 5. Date Formatting

Always use YYYY-MM-DD format for dates:

```javascript
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const checkin = formatDate(new Date('2024-02-01'));
// Result: '2024-02-01'
```

---

## Rate Limits

Current rate limits:
- **Search endpoints**: 60 requests per minute
- **Authentication**: 10 requests per minute
- **Other endpoints**: 120 requests per minute

Rate limit headers in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705320600
```

---

## Support

For API issues or questions:
- Check diagnostic endpoints: `/api/diagnostics`
- Review error responses for `requestId` to include in support tickets
- Monitor system health: `/api/health`

---

## Changelog

### Version 2.0.0 (Current)
- Integrated ETG API for hotel search and details
- Added autocomplete with caching
- Improved error handling and diagnostics
- Added user management with file uploads
- Enhanced security with JWT authentication

---

## Quick Start Example

Complete example of searching and booking a hotel:

```javascript
const API_BASE = 'https://your-api-url.com/api';

// 1. Login
const login = async () => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'password123'
    })
  });
  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  return data.token;
};

// 2. Search destinations
const searchDestination = async (query) => {
  const response = await fetch(
    `${API_BASE}/destinations/autocomplete?query=${query}`
  );
  return await response.json();
};

// 3. Search hotels
const searchHotels = async (destinationId, checkin, checkout) => {
  const guests = JSON.stringify([{ adults: 2, children: [] }]);
  const url = `${API_BASE}/ratehawk/search?` +
    `destination=${destinationId}&` +
    `checkin=${checkin}&` +
    `checkout=${checkout}&` +
    `guests=${encodeURIComponent(guests)}`;

  const response = await fetch(url);
  return await response.json();
};

// 4. Get hotel details
const getHotelDetails = async (hotelId, checkin, checkout) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}/ratehawk/hotel/details`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hotelId,
      checkin,
      checkout,
      guests: [{ adults: 2, children: [] }]
    })
  });
  return await response.json();
};

// Usage
const bookHotel = async () => {
  try {
    // 1. Login
    await login();

    // 2. Find destination
    const destinations = await searchDestination('paris');
    const destinationId = destinations.results[0].id;

    // 3. Search hotels
    const hotels = await searchHotels(
      destinationId,
      '2024-02-01',
      '2024-02-05'
    );

    // 4. Get hotel details
    const hotelId = hotels.hotels[0].id;
    const details = await getHotelDetails(
      hotelId,
      '2024-02-01',
      '2024-02-05'
    );

    console.log('Hotel details:', details);
  } catch (error) {
    console.error('Booking flow failed:', error);
  }
};
```

---

**Last Updated:** January 2024
**API Version:** 2.0.0
