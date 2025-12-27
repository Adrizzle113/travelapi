# Postman Collection Guide

Complete guide for using the Travel API Postman collection.

## Import Collection

1. Open Postman
2. Click **Import** button
3. Select `Travel-API.postman_collection.json`
4. Collection will appear in left sidebar

---

## Setup Environment Variables

Create a new environment in Postman with these variables:

### Required Variables

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3001/api` | API base URL |
| `token` | (auto-filled after login) | JWT authentication token |
| `destination_id` | `1234` | Destination ID from autocomplete |
| `hotel_id` | `hotel_123` | Hotel ID from search results |
| `checkin` | `2024-02-01` | Check-in date (YYYY-MM-DD) |
| `checkout` | `2024-02-05` | Check-out date (YYYY-MM-DD) |

### How to Set Variables

1. Click **Environments** in left sidebar
2. Click **+** to create new environment
3. Name it "Travel API - Local" or "Travel API - Production"
4. Add all variables from table above
5. Click **Save**
6. Select your environment from dropdown (top right)

---

## Testing Workflow

Follow this order to test the complete booking flow:

### 1️⃣ Health Check

**Endpoint:** `GET /health`

Test if API is running.

Expected response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

### 2️⃣ Authentication

#### Register (Optional)

**Endpoint:** `POST /auth/register`

Create a new account if you don't have one.

Request body:
```json
{
  "email": "test@example.com",
  "password": "test123456"
}
```

#### Login (Required)

**Endpoint:** `POST /auth/login`

Login to get authentication token.

Request body:
```json
{
  "email": "test@example.com",
  "password": "test123456"
}
```

**Important:** The token will be automatically saved to `{{token}}` variable.

Expected response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

#### Verify Token

**Endpoint:** `GET /auth/verify`

Test if your token is valid.

---

### 3️⃣ Search Destination

**Endpoint:** `GET /destinations/autocomplete`

Search for a destination (e.g., "paris", "london", "new york").

Query params:
- `query`: Search term (e.g., "paris")

Expected response:
```json
{
  "success": true,
  "results": [
    {
      "id": "1234",
      "name": "Paris",
      "display_name": "Paris, France",
      "type": "city"
    }
  ]
}
```

**Action:** Copy the `id` from results and save it to `destination_id` variable.

---

### 4️⃣ Search Hotels

**Endpoint:** `GET /ratehawk/search`

Search for hotels in your destination.

Query params (auto-filled from variables):
- `destination`: `{{destination_id}}`
- `checkin`: `{{checkin}}`
- `checkout`: `{{checkout}}`
- `guests`: `[{"adults":2,"children":[]}]`

Expected response:
```json
{
  "success": true,
  "hotels": [
    {
      "id": "hotel_123",
      "name": "Grand Hotel",
      "price": { "amount": 250.00, "currency": "USD" }
    }
  ],
  "totalHotels": 150
}
```

**Action:** Copy a hotel `id` from results and save it to `hotel_id` variable.

---

### 5️⃣ Get Hotel Details

**Endpoint:** `POST /ratehawk/hotel/details`

Get detailed information about a specific hotel.

Request body (uses variables):
```json
{
  "hotelId": "{{hotel_id}}",
  "checkin": "{{checkin}}",
  "checkout": "{{checkout}}",
  "guests": [{ "adults": 2, "children": [] }],
  "currency": "USD"
}
```

Expected response:
```json
{
  "success": true,
  "data": {
    "hotel": {
      "name": "Grand Hotel",
      "star_rating": 5,
      "images": [...],
      "rates": [...]
    }
  }
}
```

---

### 6️⃣ Create Booking Form

**Endpoint:** `POST /booking-form/create-booking-form`

Generate a booking form for selected rate.

Request body:
```json
{
  "book_hashs": "hash_from_rate",
  "hotelData": {
    "hotelId": "{{hotel_id}}",
    "checkin": "{{checkin}}",
    "checkout": "{{checkout}}"
  }
}
```

---

## Additional Endpoints

### User Management

#### Create User with Logo

**Endpoint:** `POST /users/users`

**Content-Type:** `multipart/form-data`

Form fields:
- `name`: Company name
- `email`: Email address
- `password`: Password
- `logo`: Image file

**In Postman:**
1. Select **Body** tab
2. Choose **form-data**
3. Add text fields for name, email, password
4. Add file field for logo
5. Click **Select Files** to choose logo image

#### Email Verification

**Endpoint:** `POST /users/email-verification`

Request body:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

#### Get User Status

**Endpoint:** `GET /users/status/{{email}}`

Check if user is approved.

---

### Diagnostics

#### System Diagnostics

**Endpoint:** `GET /diagnostics`

Get detailed system information.

#### Request Statistics

**Endpoint:** `GET /diagnostics/requests`

View API usage statistics.

#### Memory Usage

**Endpoint:** `GET /diagnostics/memory`

Check server memory usage.

---

## Common Issues & Solutions

### ❌ "CORS Error"

**Problem:** Cross-origin request blocked

**Solution:**
- Make sure API server is running
- Check that your origin is in allowed list
- In Postman, CORS doesn't apply (browser-only issue)

---

### ❌ "401 Unauthorized"

**Problem:** Missing or invalid token

**Solution:**
1. Login again using `/auth/login`
2. Token should be auto-saved to `{{token}}` variable
3. Check that Authorization header is set correctly:
   ```
   Authorization: Bearer {{token}}
   ```

---

### ❌ "400 Bad Request"

**Problem:** Invalid request parameters

**Solution:**
- Check date format: Must be `YYYY-MM-DD`
- Verify all required fields are present
- Check JSON syntax in request body

---

### ❌ "500 Internal Server Error"

**Problem:** Server-side error

**Solution:**
1. Check `/health` endpoint
2. View `/diagnostics` for details
3. Check server console logs
4. Verify environment variables are set

---

### ❌ "No hotels found"

**Problem:** Search returns empty results

**Solution:**
1. Try a popular destination (e.g., "paris", "london")
2. Check dates are in the future
3. Make sure checkout is after checkin
4. Verify destination_id is correct

---

## Advanced Usage

### Running Collections

Automate testing by running entire collection:

1. Click **Collections** in sidebar
2. Hover over "Travel API" collection
3. Click **▶ Run** button
4. Select requests to run
5. Click **Run Travel API**

### Test Scripts

Add automatic variable extraction to requests:

```javascript
// In "Tests" tab of Login request
if (pm.response.json().success) {
  pm.environment.set("token", pm.response.json().token);
  console.log("✅ Token saved automatically");
}

// In "Tests" tab of Autocomplete request
const results = pm.response.json().results;
if (results && results.length > 0) {
  pm.environment.set("destination_id", results[0].id);
  console.log("✅ Destination ID saved:", results[0].id);
}

// In "Tests" tab of Search request
const hotels = pm.response.json().hotels;
if (hotels && hotels.length > 0) {
  pm.environment.set("hotel_id", hotels[0].id);
  console.log("✅ Hotel ID saved:", hotels[0].id);
}
```

### Pre-request Scripts

Automatically set dates before requests:

```javascript
// Calculate dates dynamically
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const checkin = tomorrow.toISOString().split('T')[0];

const checkout = new Date(tomorrow);
checkout.setDate(checkout.getDate() + 4);
const checkoutDate = checkout.toISOString().split('T')[0];

pm.environment.set("checkin", checkin);
pm.environment.set("checkout", checkoutDate);

console.log("Check-in:", checkin);
console.log("Check-out:", checkoutDate);
```

---

## Environment Setup Examples

### Local Development

```
base_url: http://localhost:3001/api
token: (auto-filled)
destination_id: 1234
hotel_id: hotel_123
checkin: 2024-02-01
checkout: 2024-02-05
```

### Production

```
base_url: https://your-api.render.com/api
token: (auto-filled)
destination_id: 1234
hotel_id: hotel_123
checkin: 2024-02-01
checkout: 2024-02-05
```

---

## Tips & Tricks

### 1. Use Variables for Dates

Instead of hardcoding dates, use variables:
```
{{checkin}} and {{checkout}}
```

### 2. Save Response Data

Right-click response → **Save Response** → Save as example

### 3. View Request History

Click **History** in left sidebar to see all past requests

### 4. Duplicate Requests

Right-click request → **Duplicate** to create variations

### 5. Organize with Folders

Create folders in collection:
- Authentication
- Search & Discovery
- Booking
- User Management
- Diagnostics

### 6. Use Console

View **Postman Console** (bottom) to see:
- Request/response details
- Console logs from scripts
- Environment variable changes

---

## Collection Structure

```
Travel API/
├── Health/
│   └── GET Health Check
├── Authentication/
│   ├── POST Register
│   ├── POST Login
│   ├── GET Verify Token
│   └── GET Profile
├── Destinations/
│   └── GET Autocomplete
├── Hotels/
│   ├── GET Search Hotels
│   ├── POST Search Hotels (Advanced)
│   ├── POST Hotel Details
│   └── GET Hotel Info (Simple)
├── Booking/
│   ├── POST Create Booking Form
│   └── GET Countries List
├── Users/
│   ├── POST Create User (with logo)
│   ├── POST Email Verification
│   ├── GET User Status
│   ├── GET All Users
│   └── PUT Approve User
└── Diagnostics/
    ├── GET Diagnostics
    ├── GET Request Stats
    └── GET Memory Usage
```

---

## Testing Checklist

Use this checklist to verify all endpoints:

- [ ] Health check passes
- [ ] Can register new user
- [ ] Can login and receive token
- [ ] Token verification works
- [ ] Autocomplete returns destinations
- [ ] Hotel search returns results
- [ ] Hotel details loads correctly
- [ ] Booking form generates
- [ ] User creation with logo works
- [ ] Email verification succeeds
- [ ] Diagnostics endpoint accessible

---

## Sample Test Scenario

Complete booking flow test:

1. **Health Check**
   - Verify API is running

2. **Login**
   - Email: `test@example.com`
   - Password: `test123456`
   - Save token automatically

3. **Search Destination**
   - Query: "paris"
   - Save first destination ID

4. **Search Hotels**
   - Use saved destination ID
   - Dates: Tomorrow + 4 days
   - Guests: 2 adults
   - Save first hotel ID

5. **Get Hotel Details**
   - Use saved hotel ID
   - Verify rates are returned

6. **Create Booking Form**
   - Use hotel data from previous step
   - Verify form fields are returned

---

## Export/Share Collection

### Export Collection

1. Right-click collection
2. Click **Export**
3. Choose **Collection v2.1**
4. Save JSON file

### Share with Team

1. Click **Share** button
2. Generate link or invite by email
3. Set permissions (view/edit)

---

## Additional Resources

- **Full Documentation**: See `FRONTEND_API_DOCUMENTATION.md`
- **Quick Reference**: See `API_QUICK_REFERENCE.md`
- **Server Logs**: Check server console for detailed errors
- **Diagnostics**: Use `/api/diagnostics` endpoints

---

**Last Updated:** January 2024
