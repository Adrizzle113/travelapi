# RateHawk API Usage Guide

## Overview
This API integrates with RateHawk (WorldOTA/ETG) to provide hotel search and booking functionality. Understanding the proper flow is critical for successful integration.

---

## 🔑 **CRITICAL: How Hotel IDs Work**

RateHawk does **NOT** accept friendly names like "caesars_palace" or "hilton_miami". You MUST use the actual hotel IDs returned by the search API.

### ❌ WRONG
```bash
# This will return 404 - "caesars_palace" is not a valid RateHawk hotel ID
curl -X POST http://localhost:3001/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{"hotelId": "caesars_palace"}'
```

### ✅ CORRECT
```bash
# 1. Search first to get real hotel IDs
# 2. Use those real IDs for details
curl -X POST http://localhost:3001/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{"hotelId": "lH7Y9"}'  # Real ID from search results
```

---

## 📋 Complete Booking Flow

### Step 1: Autocomplete Destination Search

Get destination suggestions as users type:

```bash
curl -X GET "http://localhost:3001/api/destinations/autocomplete?query=Las%20Vegas"
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "4898",
      "name": "Las Vegas",
      "type": "city",
      "country": "United States"
    }
  ]
}
```

**Extract the `id` field** - this is the `region_id` you'll use for searching.

---

### Step 2: Search Hotels by Region

Use the region_id from autocomplete:

```bash
curl -X GET "http://localhost:3001/api/ratehawk/search?destination=4898&checkin=2025-02-15&checkout=2025-02-17&guests=%5B%7B%22adults%22%3A2%2C%22children%22%3A%5B%5D%7D%5D"
```

Or using POST:

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

**Response:**
```json
{
  "success": true,
  "hotels": [
    {
      "id": "lH7Y9",  // ← SAVE THIS!
      "name": "Bellagio",
      "star_rating": 5,
      "price": {
        "amount": 299.00,
        "currency": "USD"
      }
    },
    {
      "id": "kX3mP",  // ← These are real hotel IDs
      "name": "Caesars Palace",
      "star_rating": 4.5,
      "price": {
        "amount": 249.00,
        "currency": "USD"
      }
    }
  ],
  "totalHotels": 150
}
```

**Important:** Save these hotel IDs (`"lH7Y9"`, `"kX3mP"`, etc.) - you need them for the next step!

---

### Step 3: Get Hotel Details & Rates

Use a real hotel ID from the search results:

```bash
curl -X POST http://localhost:3001/api/ratehawk/hotel/details \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "lH7Y9",
    "checkin": "2025-02-15",
    "checkout": "2025-02-17",
    "guests": [{"adults": 2, "children": []}]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hotel": {
      "id": "lH7Y9",
      "name": "Bellagio",
      "address": "3600 Las Vegas Blvd South",
      "images": ["url1", "url2"],
      "amenities": ["WiFi", "Pool", "Spa"],
      "rates": [
        {
          "id": "rate_123",
          "room_name": "Deluxe King",
          "price": 299.00,
          "currency": "USD",
          "cancellation_policy": {...}
        }
      ]
    }
  }
}
```

---

## 🌍 Common Region IDs

| City | Region ID |
|------|-----------|
| Las Vegas | 4898 |
| New York | 2114 |
| Miami | 6053 |
| Los Angeles | 1706 |
| San Francisco | 1633 |
| Orlando | 5992 |

To find other regions, use the autocomplete endpoint.

---

## 🎯 Frontend Integration Guide

### React/JavaScript Example

```javascript
// 1. AUTOCOMPLETE: Get destination suggestions
async function searchDestinations(query) {
  const response = await fetch(
    `${API_BASE}/api/destinations/autocomplete?query=${encodeURIComponent(query)}`
  );
  const data = await response.json();
  return data.results; // Array of {id, name, type, country}
}

// 2. SEARCH: Get hotels for selected destination
async function searchHotels(regionId, checkin, checkout, guests) {
  const response = await fetch(
    `${API_BASE}/api/ratehawk/search`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        region_id: regionId,
        checkin,
        checkout,
        guests,
        currency: 'USD'
      })
    }
  );
  const data = await response.json();
  return data.hotels; // Array with hotel IDs
}

// 3. DETAILS: Get full info for selected hotel
async function getHotelDetails(hotelId, checkin, checkout, guests) {
  const response = await fetch(
    `${API_BASE}/api/ratehawk/hotel/details`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        hotelId,  // Use ID from search results!
        checkin,
        checkout,
        guests
      })
    }
  );
  return await response.json();
}

// Example usage:
const results = await searchDestinations('Las Vegas');
const regionId = results[0].id; // "4898"

const hotels = await searchHotels(regionId, '2025-02-15', '2025-02-17', [{adults: 2, children: []}]);
const firstHotel = hotels[0];

const details = await getHotelDetails(firstHotel.id, '2025-02-15', '2025-02-17', [{adults: 2, children: []}]);
console.log(details);
```

---

## 🔧 Testing & Troubleshooting

### Check Server Health
```bash
curl http://localhost:3001/api/health
```

### Check Environment Configuration
```bash
curl http://localhost:3001/api/test
```

Should show:
```json
{
  "message": "Backend server is running!",
  "etgConfigured": "Configured",
  "databaseConfigured": "Configured"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `404 from RateHawk` | Invalid hotel ID | Use real IDs from search results |
| `Invalid region_id` | Wrong destination format | Use numeric region_id from autocomplete |
| `Connection refused` | Server not running | Start server with `npm start` |
| `ETG_API_KEY not set` | Missing credentials | Check `.env` file |

---

## 🚀 Quick Start Commands

```bash
# Start the server
npm start

# Test basic connectivity
curl http://localhost:3001/api/test

# Run the complete flow test
node test-complete-booking-flow.js
```

---

## 📚 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/destinations/autocomplete` | GET | Search destinations |
| `/api/ratehawk/search` | GET/POST | Search hotels by region |
| `/api/ratehawk/hotel/details` | POST | Get hotel details & rates |
| `/api/health` | GET | Check server status |
| `/api/test` | GET | Check configuration |

---

## ⚠️ Important Notes

1. **Always search first** - You cannot directly request hotel details without getting the hotel ID from search results first
2. **Region IDs are numeric** - Not city names
3. **Hotel IDs are alphanumeric** - Like "lH7Y9", not "caesars_palace"
4. **Date format** - Always use YYYY-MM-DD format
5. **Guests format** - Must be an array of objects: `[{adults: 2, children: []}]`
6. **Caching** - Search results cached for 1 hour, hotel info cached for 7 days

---

For more details, see:
- `test-complete-booking-flow.js` - Working example
- `server.js` - API server configuration
- `services/etg/etgClient.js` - ETG API client
