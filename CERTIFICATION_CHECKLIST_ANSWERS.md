# ETG Pre-Certification Checklist - Implementation Status

This document provides answers to the ETG Pre-Certification Checklist based on our current implementation.

**Date:** 2026-01-10  
**Status:** Backend Implementation Complete, Frontend Integration In Progress

---

## Required Endpoints Implementation

### Static Data Endpoints

#### `/api/b2b/v3/hotel/info/dump/`
- **Status:** ✅ Implemented via Content API
- **Implementation:** Using `/api/b2b/v3/hotel/info/` endpoint for individual hotels
- **Update Frequency:** Real-time on-demand (Content API approach)
- **Note:** Full dump can be implemented if needed for bulk updates

#### `/api/b2b/v3/hotel/info/incremental_dump/`
- **Status:** ⚠️ Not Implemented
- **Implementation:** Using Content API instead for real-time updates
- **Alternative:** Content API `/hotel/info/` endpoint used for on-demand static data

#### One of `/api/b2b/v3/search/serp/*`
- **Status:** ✅ Implemented
- **Implementation:** 
  - ✅ `/api/b2b/v3/search/serp/region/` - Implemented
  - ✅ `/api/b2b/v3/search/serp/geo/` - Implemented  
  - ✅ `/api/b2b/v3/search/serp/hotels/` - Implemented (limited to 300 hotels per request)
- **Route:** `POST /api/ratehawk/search` (region-based)
- **Route:** `POST /api/ratehawk/search/by-geo` (geo-based)
- **Route:** `POST /api/ratehawk/search/by-ids` (hotels-based)

#### `/api/b2b/v3/search/hp/`
- **Status:** ✅ Implemented
- **Implementation:** `POST /api/ratehawk/hotel/details`
- **Note:** Used exclusively for hotels user has shown interest in

#### `/api/b2b/v3/hotel/prebook/`
- **Status:** ✅ Implemented
- **Implementation:** `POST /api/ratehawk/prebook`
- **Features:**
  - ✅ Separate from booking step
  - ✅ `price_increase_percent` parameter (0-100, default: 20)
  - ✅ 60-second timeout implemented
  - ✅ Returns new booking_hash (p-...)
  - ✅ Handles NO_AVAILABLE_RATES error

#### `/api/b2b/v3/hotel/order/booking/form/`
- **Status:** ✅ Implemented
- **Implementation:** `POST /api/ratehawk/order/form`

#### `/api/b2b/v3/hotel/order/booking/finish/`
- **Status:** ✅ Implemented
- **Implementation:** `POST /api/ratehawk/order/finish`

#### `/api/b2b/v3/hotel/order/booking/finish/status/` or Webhooks
- **Status:** ✅ Both Implemented
- **Polling Implementation:** `POST /api/ratehawk/order/status`
- **Webhook Implementation:** `POST /api/webhook/booking-status`
- **Note:** Both methods available, frontend can choose polling or webhook

---

## Static Data

### Hotel Static Data Upload and Updates
- **Method:** Content API (`/hotel/info/`)
- **Update Frequency:** Real-time on-demand
- **Alternative:** Can implement dump/incremental dump if bulk updates needed
- **Static Info Endpoint:** `POST /api/ratehawk/hotel/static-info`

### Hotel Important Information
- **Status:** ✅ Parsed and Available
- **Implementation:**
  - ✅ `description_struct` - Structured description
  - ✅ `amenity_groups` - Grouped amenities
  - ✅ `policy_struct` - Structured policies
  - ✅ `metapolicy_struct` - Available in response
  - ✅ `metapolicy_extra_info` - Available in response

### Room Static Data
- **Status:** ✅ Implemented
- **Implementation:** Room images and amenities from static data
- **Matching Parameter:** `room_name` and `room_group_id` used for matching

---

## Search Flow

### Search Logic
- **Type:** 2-step search
- **Step 1:** Search by region/geo/hotel IDs (SERP endpoints)
- **Step 2:** Retrieve hotel page for selected hotel (`/search/hp/`)

### Match_hash Usage
- **Status:** ✅ Implemented
- **Implementation:** `match_hash` can be passed to `/search/hp/` for SERP-HP matching
- **Parameter:** `matchHash` in `POST /api/ratehawk/hotel/details`

### Prebook Implementation
- **Status:** ✅ Fully Implemented
- **Separate from Booking:** ✅ Yes, separate endpoint
- **Price Increase Percent:** ✅ Implemented (default: 20%)
- **User Notification:** ⚠️ Frontend implementation needed
- **Timeout:** ✅ 60 seconds implemented

### Cache
- **Status:** Not implemented
- **Reason:** Real-time data preferred for availability and pricing

### Children Logic
- **Status:** ✅ Implemented
- **Age Range:** 0-17 years
- **Age Specification:** ✅ Age specified in `guests.children[]` array
- **Format:** `[{ adults: 2, children: [{ age: 5 }] }]`
- **Booking:** Age sent in booking finish request

### Multiroom Booking
- **Status:** ⚠️ Not Implemented
- **Note:** Single room booking only currently

---

## Tax and Fees Data

- **Display Method:** All taxes and fees displayed separately (both included and non-included)
- **Implementation:** From `payment_options.payment_types[].breakdown` in API responses

---

## Dynamic Search Timeouts

- **Status:** ✅ Implemented
- **Parameter:** `timeout` (1-100 seconds)
- **Implementation:** Passed to `/search/hp/` endpoint
- **Route:** `POST /api/ratehawk/hotel/details` accepts `timeout` parameter

---

## Cancellation Policies

- **Status:** ✅ Parsed and Available
- **Source:** `cancellation_penalties` from API responses
- **Modification:** No modification, shown as received from API
- **Deadline Handling:** ⚠️ Frontend implementation needed
  - Recommended: Display in UTC+0 with UTC+0 timezone, or convert to user's local timezone

---

## Lead Guest's Citizenship

- **Status:** ✅ Implemented
- **Collection:** Residency parameter accepted in all search and booking requests
- **Implementation:** 
  - Parameter: `residency` (ISO country code, uppercase)
  - Normalized to uppercase for prebook/finish requests
  - Default: "US" if not specified

---

## Meal Types

- **Status:** ✅ Displayed as received
- **Implementation:** Display ETG meal types as returned in API search responses
- **Parameter:** `meal` from API search responses

---

## Final Price

- **Status:** ✅ Implemented
- **Parameter Used:** `show_amount` from `payment_options.payment_types[0]`
- **Implementation:** Primary price display

---

## Commission

- **Model:** Not applicable (working with Affiliate API)

---

## Rate Name Reflection

- **Parameter Used:** `room_name` from `/search/hp/`
- **Mapping:** Display ETG room names as they are (no mapping)

---

## Early Check-in / Late Check-out (Upsells)

- **Status:** ✅ Fully Implemented
- **Supported Upsells:**
  - ✅ `early_checkin` with optional `time`
  - ✅ `late_checkout` with optional `time`
  - ✅ `multiple_eclc` - Request all available time options
  - ✅ `only_eclc` - Only show rates with these options
- **Implementation:** Passed to `/search/hp/` endpoint
- **Route:** `POST /api/ratehawk/hotel/details` accepts `upsells` parameter

---

## Hotel Chunk Size (for /serp/hotels)

- **Real Number:** 50-100 hotels per request (recommended: 50)
- **Maximum Number:** 300 hotels per request (ETG limit)

---

## Rates Filtration Logic

- **Method:** Display all rates from each supplier
- **Implementation:** All rates shown, user can filter/sort on frontend

---

## Booking Step

### Receiving Final Booking Status

- **Method:** Polling (`/order/status/`)
- **Implementation:** 
  - Endpoint: `POST /api/ratehawk/order/status`
  - Status values: "ok" (success), "processing" (continue polling), or final failure statuses
  - Frontend should poll until `is_final: true`

### Booking Cut-off

- **Expected Timeout:** 60-120 seconds
- **Maximum Timeout:** 300 seconds (5 minutes)
- **Implementation:** Frontend polling with exponential backoff recommended

---

## Payment Types

- **Type Used:** "hotel" (payment at hotel)
- **Reason:** Affiliate API with hotel payment

---

## IP Whitelisting

- **Status:** ⚠️ Not Configured
- **Requirement:** Provide IP addresses to ETG for whitelisting
- **Note:** Dynamic IP addresses may require domain-based whitelisting

---

## Test Hotel Mapping

- **Status:** ✅ Ready
- **Test Hotel:** Can access hotels via `/search/hp/` endpoint
- **Verification:** Use script `scripts/verify-test-hotel-certification.js`
- **Mapping:** Hotels accessible via numeric `hid` or string `id`

---

## Additional Endpoints Implemented

- ✅ `/api/ratehawk/order/info` - Retrieve booking details
- ✅ `/api/ratehawk/order/documents` - Retrieve booking documents
- ✅ `/api/ratehawk/order/bookings` - Retrieve all bookings
- ✅ `/api/ratehawk/hotel/static-info` - Get static hotel information
- ✅ `/api/ratehawk/filter-values` - Get filter values for search

---

## Frontend Integration Status

### ✅ Implemented
- Search flow
- Hotel details page
- Booking form
- Prebook with price_increase_percent

### ⚠️ Needs Verification/Implementation
- Price change modal (component exists, needs end-to-end testing)
- Children age input in booking form
- Residency selection (dropdown or IP detection)
- Cancellation policy display with deadline/timezone
- Booking status polling until "ok"
- Unavailable rate handling (NO_AVAILABLE_RATES)

---

## Certification Checklist Answers

### General
- **Product Type:** Website (provide ETG access to test search and booking functionalities)
- **Access Provided:** Yes (once deployed and accessible)

### Testing
- **Multi-room Booking:** Not implemented
- **Upsells Booking:** ✅ Implemented
- **Booking with Child:** ✅ Implemented (age specification required)
- **Payment Type:** "hotel" (payment at hotel)

### Static Data
- **Hotel Dump:** Using Content API (`/hotel/info/`) for real-time updates
- **Update Frequency:** Real-time on-demand
- **Incremental Dump:** Not implemented (using Content API instead)

### Search
- **Search Flow:** 2-steps
- **Match_hash:** ✅ Implemented (optional parameter)
- **Prebook:** ✅ Separate step, implemented correctly
- **Price Increase Percent:** ✅ Implemented (default: 20%)
- **Timeout:** ✅ 60 seconds

### Booking
- **Children Age:** ✅ Specified in guests.children[] with age field
- **Final Status:** Polling `/order/status/` until "ok" or final failure
- **Booking Timeout:** 60-300 seconds expected

---

## Notes for Certification

1. **Test Hotel:** Verify using `scripts/verify-test-hotel-certification.js`
2. **Price Change:** Backend returns price change info, frontend needs to display modal
3. **Booking Status:** Polling implementation exists, frontend needs to poll until final status
4. **Children Age:** Backend validates and normalizes children age structure
5. **Upsells:** Fully supported on backend, frontend integration complete
6. **Residency:** Collected and normalized on backend, frontend needs to provide

---

## Contact Information

- **ETG Support:** apisupport@ratehawk.com
- **Webhook URL:** `https://yourdomain.com/api/webhook/booking-status` (to be configured)

---

**Last Updated:** 2026-01-10

