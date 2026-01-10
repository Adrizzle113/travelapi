# Files That Handle Upsells (Early Check-in / Late Check-out)

## Overview
Upsells functionality is handled across multiple files in the codebase. Here's a complete reference of all files involved in upsells processing.

---

## Backend Files

### 1. **Routes - Hotel Details Request**
**File:** `routes/ratehawk/details.js`

**Purpose:** Receives upsells parameter from frontend and forwards to service layer

**Key Sections:**
- **Lines 139-167**: Receives `upsells` from request body, logs it, and passes to `getHotelPage`
- **Lines 149-160**: Enhanced logging for upsells received from frontend
- **Line 194**: Passes `upsells` to `worldotaService.getHotelPage()`

**Functions:**
- `POST /api/ratehawk/hotel/details` - Main hotel details endpoint that accepts upsells

---

### 2. **Service - WorldOTA API Integration**
**File:** `services/worldotaService.js`

**Purpose:** Core service that handles RateHawk API calls with upsells parameter

**Key Sections:**
- **Lines 403-407**: JSDoc documentation for upsells parameters
- **Lines 412-423**: `getHotelPage()` method signature accepting `upsells` parameter
- **Lines 478-502**: Builds request body with upsells, includes debug logging
- **Lines 486**: Conditionally includes upsells in request: `...(upsells && Object.keys(upsells).length > 0 && { upsells })`
- **Lines 491-502**: Debug logging for upsells parameter being sent to RateHawk API
- **Lines 547-597**: Comprehensive debug logging for ECLC data in API response
- **Lines 954-1034**: `processWorldOTAResponse()` - Extracts and preserves ECLC data from rates

**Functions:**
- `getHotelPage()` - Fetches hotel details with upsells parameter
- `processWorldOTAResponse()` - Processes API response and extracts ECLC data

**Upsells Parameters Handled:**
- `early_checkin` - Object with optional `time` (HH:MM format)
- `late_checkout` - Object with optional `time` (HH:MM format)
- `multiple_eclc` - Boolean to request all available ECLC options
- `only_eclc` - Boolean to only show rates with ECLC

---

### 3. **Routes - Booking Finish Order**
**File:** `routes/ratehawk/orders.js`

**Purpose:** Handles booking completion with upsells data

**Key Sections:**
- **Line 335**: Receives `upsell_data` from request body
- **Lines 347-349**: Logs upsells count if provided
- **Line 404**: Passes `upsell_data` to `finishOrder()` service

**Functions:**
- `POST /api/ratehawk/order/finish` - Completes booking with upsells

**Note:** Uses `upsell_data` (array format) instead of `upsells` (object format) for booking

---

### 4. **Service - Booking Operations**
**File:** `services/booking/bookingService.js`

**Purpose:** Handles booking operations including upsells

**Key Sections:**
- **Lines 379-405**: `finishOrder()` function signature with `upsell_data` parameter
- **Lines 512-515**: Adds upsells to booking payload if provided

**Functions:**
- `finishOrder()` - Completes order with optional upsells array

**Upsells Format:** Array format for booking:
```javascript
upsell_data: [
  { type: 'early_checkin', time: '12:00' },
  { type: 'late_checkout', time: '15:00' }
]
```

---

### 5. **Routes - Booking (Alternative Endpoint)**
**File:** `routes/ratehawk/booking.js`

**Purpose:** Alternative booking endpoint that also handles upsells

**Key Sections:**
- **Line 306**: Receives `upsell_data` from request body
- **Line 378**: Passes `upsell_data` to booking service

**Functions:**
- `POST /api/ratehawk/booking/finish` - Alternative booking finish endpoint

---

### 6. **Service - ETG Client**
**File:** `services/etg/etgClient.js`

**Purpose:** Low-level ETG API client that handles booking requests

**Key Sections:**
- **Line 625**: Receives `upsell_data` from booking data
- **Lines 671-673**: Conditionally includes upsells in request body

**Functions:**
- Internal client methods for booking operations

---

## Documentation Files

### 7. **ECLC Debugging Guide**
**File:** `ECLC_DEBUGGING_GUIDE.md`

**Purpose:** Complete guide for debugging ECLC/upsells functionality

**Contents:**
- Debug logging interpretation
- Troubleshooting scenarios
- Testing recommendations
- Expected API response structures

---

### 8. **ECLC Implementation Summary**
**File:** `ECLC_DEBUG_IMPLEMENTATION.md`

**Purpose:** Documentation of ECLC implementation changes

**Contents:**
- Changes made to backend
- Debug logging additions
- Response processing updates

---

### 9. **Certification Checklist**
**File:** `CERTIFICATION_CHECKLIST_ANSWERS.md`

**Purpose:** Certification documentation mentioning upsells

**Key Sections:**
- Lines 196-199: Upsells parameters documented
- Early check-in / late checkout implementation status

---

### 10. **Frontend Certification Checklist**
**File:** `FRONTEND_CERTIFICATION_CHECKLIST.md`

**Purpose:** Frontend requirements documentation for upsells

**Contents:**
- Frontend implementation requirements
- UI components needed
- Data flow expectations

---

## Test/Sample Files

### 11. **Sample Booking Form Response**
**File:** `src/controllers/create-booking-form.json`

**Purpose:** Sample JSON response structure

**Note:** Contains example response structure (may not include upsells)

---

## Upsells Data Flow

### Search/Hotel Details Flow:
```
Frontend → routes/ratehawk/details.js → services/worldotaService.js → RateHawk API
         (upsells object)            (forwards upsells)            (sends upsells)
                                                                    ↓
Frontend ← routes/ratehawk/details.js ← services/worldotaService.js ← RateHawk API
         (hotel with rates)          (extracts ECLC data)          (returns rates with ECLC)
```

### Booking Flow:
```
Frontend → routes/ratehawk/orders.js → services/booking/bookingService.js → ETG API
         (upsell_data array)         (includes in payload)                  (sends upsells)
```

---

## Key Differences

### Search/Hotel Details (Request):
- **Parameter Name:** `upsells` (object)
- **Format:** 
  ```javascript
  {
    early_checkin: { time?: "12:00" },
    late_checkout: { time?: "15:00" },
    multiple_eclc: true,
    only_eclc: true
  }
  ```

### Booking Completion (Request):
- **Parameter Name:** `upsell_data` (array)
- **Format:**
  ```javascript
  [
    { type: "early_checkin", time: "12:00" },
    { type: "late_checkout", time: "15:00" }
  ]
  ```

---

## Summary by Function

| Function | File | Purpose |
|----------|------|---------|
| **Search with Upsells** | `routes/ratehawk/details.js` | Receives upsells from frontend |
| **Search API Call** | `services/worldotaService.js` | Sends upsells to RateHawk API |
| **Extract ECLC Data** | `services/worldotaService.js` | Extracts ECLC from API response |
| **Booking with Upsells** | `routes/ratehawk/orders.js` | Receives upsell_data for booking |
| **Booking API Call** | `services/booking/bookingService.js` | Sends upsells to ETG API |

---

## Notes

1. **Search uses `upsells` (object)** - Requesting ECLC options from hotels
2. **Booking uses `upsell_data` (array)** - Sending selected ECLC options to complete booking
3. **Debug logging is comprehensive** - All request/response stages are logged
4. **ECLC data extraction** - Handles both direct objects and `serp_filters` flags
5. **Multiple endpoints** - Both `/orders.js` and `/booking.js` handle booking upsells

---

## Next Steps for Development

If you need to modify upsells handling:

1. **For Search/Hotel Details:**
   - Modify `services/worldotaService.js` → `getHotelPage()`
   - Update request format, response processing, or debug logging

2. **For Booking:**
   - Modify `services/booking/bookingService.js` → `finishOrder()`
   - Update upsells format conversion from frontend object to API array format

3. **For Debugging:**
   - Check logs from `routes/ratehawk/details.js` (frontend → backend)
   - Check logs from `services/worldotaService.js` (backend → RateHawk API)
   - Check logs from `services/worldotaService.js` (RateHawk API → backend)

