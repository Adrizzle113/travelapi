# API Flow Diagrams

Visual representation of API flows for frontend integration.

## Complete Booking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER BOOKING JOURNEY                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ 1. HOME PAGE │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  SEARCH FORM                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Where: [Search destination...          ] ← Autocomplete  │  │
│  │ Check-in:  [2024-02-01]                                  │  │
│  │ Check-out: [2024-02-05]                                  │  │
│  │ Guests:    [2 Adults, 0 Children]                        │  │
│  │                                                           │  │
│  │                    [Search Hotels]                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ GET /destinations/autocomplete?query=paris
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  AUTOCOMPLETE RESULTS                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✓ Paris, France                                          │  │
│  │   Paris, Texas, USA                                      │  │
│  │   Paris, Ontario, Canada                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ User selects "Paris, France" (id: 1234)
       │
       │ GET /ratehawk/search?destination=1234&checkin=...
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  SEARCH RESULTS (150 hotels found)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ┌──────┐ Grand Hotel Paris           ⭐⭐⭐⭐⭐         │  │
│  │ │IMAGE │ 123 Rue de Rivoli            $250/night       │  │
│  │ └──────┘ [View Details]                                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ┌──────┐ Hotel Le Marais             ⭐⭐⭐⭐           │  │
│  │ │IMAGE │ 45 Rue des Francs            $180/night       │  │
│  │ └──────┘ [View Details]                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ User clicks "View Details" on Grand Hotel
       │
       │ POST /ratehawk/hotel/details
       │ { hotelId, checkin, checkout, guests }
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  HOTEL DETAILS PAGE                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Grand Hotel Paris                    ⭐⭐⭐⭐⭐          │  │
│  │  123 Rue de Rivoli, 75001 Paris, France                 │  │
│  │                                                           │  │
│  │  [Image Gallery - 5 photos]                              │  │
│  │                                                           │  │
│  │  Description: Luxury hotel in the heart of Paris...      │  │
│  │                                                           │  │
│  │  Amenities: ✓ WiFi ✓ Pool ✓ Restaurant ✓ Spa           │  │
│  │                                                           │  │
│  │  AVAILABLE ROOMS:                                        │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ Deluxe Double Room              $250/night         │ │  │
│  │  │ ⚬ King Bed                                         │ │  │
│  │  │ ⚬ Breakfast included                               │ │  │
│  │  │ ⚬ Free cancellation until Jan 25                  │ │  │
│  │  │                                    [Book Now]      │ │  │
│  │  ├────────────────────────────────────────────────────┤ │  │
│  │  │ Junior Suite                    $350/night         │ │  │
│  │  │ ⚬ King Bed + Sofa                                  │ │  │
│  │  │ ⚬ Breakfast included                               │ │  │
│  │  │ ⚬ Free cancellation until Jan 25                  │ │  │
│  │  │                                    [Book Now]      │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ User clicks "Book Now" on Deluxe Double Room
       │
       │ Check if user is authenticated
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  AUTHENTICATION CHECK                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Token exists? ───┬─── YES → Continue to booking         │  │
│  │                  │                                        │  │
│  │                  └─── NO  → Show login/register          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ If NO token: POST /auth/login or POST /auth/register
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  LOGIN / REGISTER                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Email:    [user@example.com              ]               │  │
│  │ Password: [••••••••••••                  ]               │  │
│  │                                                           │  │
│  │           [Login]  [Register]                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ Success: Receive JWT token
       │ Store: localStorage.setItem('auth_token', token)
       │
       │ POST /booking-form/create-booking-form
       │ { book_hashs, hotelData }
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  BOOKING FORM                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GUEST DETAILS                                           │  │
│  │  First Name:  [John              ]                       │  │
│  │  Last Name:   [Smith             ]                       │  │
│  │  Email:       [john@example.com  ]                       │  │
│  │  Phone:       [+1234567890       ]                       │  │
│  │                                                           │  │
│  │  BOOKING SUMMARY                                         │  │
│  │  Hotel:       Grand Hotel Paris                          │  │
│  │  Room:        Deluxe Double Room                         │  │
│  │  Check-in:    Feb 1, 2024                                │  │
│  │  Check-out:   Feb 5, 2024                                │  │
│  │  Guests:      2 Adults                                   │  │
│  │  Total:       $1,000 (4 nights × $250)                   │  │
│  │                                                           │  │
│  │                     [Confirm Booking]                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ Submit booking
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  BOOKING CONFIRMATION                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ✓ Booking Confirmed!                                    │  │
│  │                                                           │  │
│  │  Confirmation #: ABC123456                               │  │
│  │  Email sent to: john@example.com                         │  │
│  │                                                           │  │
│  │  [View Booking Details]  [Book Another]                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION FLOW                       │
└────────────────────────────────────────────────────────────┘

┌─────────────┐
│ User Opens  │
│   Website   │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Check Local Storage                                        │
│  token = localStorage.getItem('auth_token')                │
└──────┬─────────────────────────────────────────┬───────────┘
       │                                         │
       │ NO TOKEN                                │ HAS TOKEN
       ▼                                         ▼
┌─────────────────┐                    ┌──────────────────────┐
│  Show Login/    │                    │  Verify Token        │
│  Register Page  │                    │  GET /auth/verify    │
└────────┬────────┘                    └──────┬───────────────┘
         │                                    │
         │                              ┌─────┴─────┐
         │                              │           │
         │                          VALID       INVALID
         │                              │           │
         │                              ▼           ▼
         │                        ┌─────────┐ ┌─────────┐
         │                        │Continue │ │ Logout  │
         │                        │ to App  │ │ & Show  │
         │                        └─────────┘ │ Login   │
         │                                    └────┬────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  LOGIN FORM                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Email:    [                        ]                 │  │
│  │ Password: [                        ]                 │  │
│  │           [Login]  [Register Instead]                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ POST /auth/login
                     │ { email, password }
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Response:                                                   │
│  {                                                           │
│    "success": true,                                          │
│    "token": "eyJhbG...",                                     │
│    "user": { "email": "...", "id": 1 }                       │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Save Token & User Data                                      │
│  localStorage.setItem('auth_token', token)                   │
│  localStorage.setItem('user', JSON.stringify(user))          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Redirect to Search Page                                     │
│  window.location.href = '/search'                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Search Flow

```
┌────────────────────────────────────────────────────────────┐
│                      SEARCH FLOW                            │
└────────────────────────────────────────────────────────────┘

┌─────────────┐
│ User Types  │
│ "par" in    │
│ Search Box  │
└──────┬──────┘
       │
       │ Debounce 300ms
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  API Call (if query.length >= 2)                            │
│  GET /destinations/autocomplete?query=par                   │
└──────┬─────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Response:                                                   │
│  {                                                           │
│    "results": [                                              │
│      { "id": "1234", "name": "Paris",                        │
│        "display_name": "Paris, France" },                    │
│      { "id": "5678", "name": "Paris",                        │
│        "display_name": "Paris, Texas, USA" }                 │
│    ]                                                         │
│  }                                                           │
└──────┬─────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Show Dropdown                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Paris, France                    [City Icon]       │    │
│  │ Paris, Texas, USA                [City Icon]       │    │
│  └────────────────────────────────────────────────────┘    │
└──────┬─────────────────────────────────────────────────────┘
       │
       │ User clicks "Paris, France"
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Save Selection                                              │
│  selectedDestination = { id: "1234", name: "Paris, France" }│
└──────┬─────────────────────────────────────────────────────┘
       │
       │ User fills dates and clicks "Search"
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Validation                                                  │
│  - Check destination selected                                │
│  - Check checkin date >= today                               │
│  - Check checkout > checkin                                  │
└──────┬─────────────────────────────────────────────────────┘
       │
       │ All valid ✓
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Show Loading State                                          │
│  "Searching hotels..."                                       │
└──────┬─────────────────────────────────────────────────────┘
       │
       │ Build query string:
       │ destination=1234&checkin=2024-02-01&checkout=2024-02-05
       │ &guests=[{"adults":2,"children":[]}]
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  API Call                                                    │
│  GET /ratehawk/search?destination=1234&...                  │
└──────┬─────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Response:                                                   │
│  {                                                           │
│    "success": true,                                          │
│    "hotels": [ {...}, {...}, ... ],                          │
│    "totalHotels": 150,                                       │
│    "from_cache": false,                                      │
│    "searchDuration": "1250ms"                                │
│  }                                                           │
└──────┬─────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────┐
│  Display Results                                             │
│  - Render hotel cards                                        │
│  - Show total count                                          │
│  - Add pagination controls                                   │
└────────────────────────────────────────────────────────────┘
```

---

## API Request Headers Flow

```
┌────────────────────────────────────────────────────────────┐
│              REQUEST HEADER STRUCTURE                       │
└────────────────────────────────────────────────────────────┘

PUBLIC ENDPOINT (No Auth Required)
═══════════════════════════════════
GET /destinations/autocomplete
GET /ratehawk/search

Headers:
┌────────────────────────────────────┐
│ Content-Type: application/json     │
└────────────────────────────────────┘

─────────────────────────────────────

AUTHENTICATED ENDPOINT
══════════════════════
POST /ratehawk/hotel/details
POST /booking-form/create-booking-form

Headers:
┌────────────────────────────────────────────────┐
│ Content-Type: application/json                 │
│ Authorization: Bearer eyJhbGciOiJIUzI1NiIs...   │
└────────────────────────────────────────────────┘

─────────────────────────────────────

FILE UPLOAD ENDPOINT
════════════════════
POST /users/users (with logo)

Headers:
┌────────────────────────────────────────────────┐
│ Content-Type: multipart/form-data              │
│ (Auto-set by browser, don't override)          │
└────────────────────────────────────────────────┘

Body:
┌────────────────────────────────────────────────┐
│ FormData:                                       │
│   name: "Company Name"                          │
│   email: "user@email.com"                       │
│   password: "password123"                       │
│   logo: [File object]                           │
└────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌────────────────────────────────────────────────────────────┐
│                   ERROR HANDLING                            │
└────────────────────────────────────────────────────────────┘

API Request
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  try {                                                   │
│    const response = await fetch(url, options);          │
│    const data = await response.json();                  │
│  }                                                       │
└────┬────────────────────────────────────────────────────┘
     │
     ├─────► 200-299 (Success) ──────► Return data
     │
     ├─────► 400 (Bad Request) ──────┐
     │                                │
     ├─────► 401 (Unauthorized) ─────┤
     │                                │
     ├─────► 404 (Not Found) ────────┤
     │                                │
     ├─────► 500 (Server Error) ─────┤
     │                                │
     └─────► Network Error ───────────┤
                                      ▼
                          ┌────────────────────────────┐
                          │  Parse Error Response      │
                          │  {                         │
                          │    "success": false,       │
                          │    "error": "message",     │
                          │    "timestamp": "..."      │
                          │  }                         │
                          └──────────┬─────────────────┘
                                     │
                                     ▼
                          ┌────────────────────────────┐
                          │  Handle Based on Status    │
                          └──────────┬─────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌──────────────┐      ┌──────────────────┐    ┌─────────────────┐
    │ 400: Show    │      │ 401: Logout &    │    │ 500: Show       │
    │ validation   │      │ redirect to      │    │ "Service error" │
    │ errors       │      │ login            │    │ + retry button  │
    └──────────────┘      └──────────────────┘    └─────────────────┘
```

---

## Data Flow: Search to Booking

```
┌────────────────────────────────────────────────────────────┐
│             DATA FLOW: SEARCH TO BOOKING                    │
└────────────────────────────────────────────────────────────┘

USER INPUT                    API CALL                STORE IN STATE
══════════                    ════════                ══════════════

"paris" (typing)    ──────►   GET /autocomplete      ──────► destinations[]
     │                        ?query=paris                     │
     └─► Select                                                │
         "Paris, France"                                       ▼
              │                                        destinationId: "1234"
              │                                        destinationName: "Paris, France"
              │
              ▼
    Choose dates:
    - Check-in: 2024-02-01
    - Check-out: 2024-02-05
    - Guests: 2 adults
              │
              ▼
    Click "Search" ────────►   GET /ratehawk/search   ──────► hotels[]
                               ?destination=1234               searchContext {
                               &checkin=2024-02-01               checkin,
                               &checkout=2024-02-05              checkout,
                               &guests=[...]                     guests
                                                               }
              │
              │
              ▼
    Click hotel card ──────►   POST /hotel/details    ──────► selectedHotel {
    (hotelId: hotel_123)       {                               id,
                                 hotelId,                      name,
                                 checkin,                      rates[],
                                 checkout,                     images[],
                                 guests                        amenities[]
                               }                              }
              │
              │
              ▼
    Select room rate                                  ──────► selectedRate {
    (rateId: rate_1)                                           rateId,
                                                                price,
                                                                roomName,
                                                                cancellation
                                                              }
              │
              │
              ▼
    Check auth token
         │
         ├─► Has token ──────────────────┐
         │                                │
         └─► No token ───► Login ────────┤
                           POST /auth/login
                           Save token     │
                                         │
                                         ▼
    Click "Book Now" ──────►   POST /booking-form     ──────► bookingForm {
                               /create-booking-form             fields[],
                               {                                orderId,
                                 book_hashs,                    summary
                                 hotelData                     }
                               }
              │
              │
              ▼
    Fill form fields
    - First name
    - Last name
    - Email
    - Phone
              │
              ▼
    Submit booking ─────────►  POST /booking/confirm  ──────► confirmation {
                               (hypothetical endpoint)          confirmationId,
                               {                                status,
                                 guestDetails,                  email
                                 selectedRate,                }
                                 paymentInfo
                               }
```

---

## State Management Example (React)

```javascript
// Application State Structure

const [appState, setAppState] = useState({
  // Auth State
  auth: {
    token: null,
    user: null,
    isAuthenticated: false
  },

  // Search State
  search: {
    query: '',
    destinations: [],
    selectedDestination: null,
    dates: {
      checkin: null,
      checkout: null
    },
    guests: [{ adults: 2, children: [] }]
  },

  // Results State
  results: {
    hotels: [],
    totalHotels: 0,
    loading: false,
    error: null,
    searchContext: null
  },

  // Hotel Details State
  hotel: {
    details: null,
    rates: [],
    selectedRate: null,
    loading: false,
    error: null
  },

  // Booking State
  booking: {
    form: null,
    guestDetails: {},
    loading: false,
    error: null,
    confirmation: null
  }
});
```

---

## Caching Strategy

```
┌────────────────────────────────────────────────────────────┐
│                   CACHING STRATEGY                          │
└────────────────────────────────────────────────────────────┘

Request Made
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Check Cache First                                       │
│  const cached = cache.get(cacheKey);                    │
└────┬────────────────────────────────────────────────────┘
     │
     ├─────► Cache HIT ──────► Return cached data
     │                         (check expiry)
     │
     └─────► Cache MISS ─────┐
                             │
                             ▼
                  ┌──────────────────────┐
                  │  Make API Request    │
                  └──────┬───────────────┘
                         │
                         ▼
                  ┌──────────────────────┐
                  │  Store in Cache      │
                  │  cache.set(key, data,│
                  │    expiryTime)       │
                  └──────┬───────────────┘
                         │
                         ▼
                  ┌──────────────────────┐
                  │  Return data         │
                  └──────────────────────┘

Cache Durations:
═══════════════
- Autocomplete results:   24 hours
- Hotel static info:      7 days
- Search results:         15 minutes
- User session:           24 hours
```

---

**Use these diagrams** as reference when building your frontend flows!
