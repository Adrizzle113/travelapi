# Frontend Certification Checklist - Required Actions

**Date:** 2026-01-10  
**Status:** ⚠️ Action Required on Frontend  
**Backend Status:** ✅ Complete

---

## Critical Items (Must Complete for Certification)

### 1. ✅ Price Change Notification Flow

**Requirement:** Show notification to users when price changes during prebook

**Backend Status:** ✅ Returns `price_changed`, `original_price`, `new_price`, `currency`

**Frontend Action Required:**

#### 1.1 Update Prebook Response Handling
- **File:** `src/pages/BookingPage.tsx` (or similar booking page)
- **Check:** Does `runPrebook()` function handle:
  - ✅ Price increase (show modal, get confirmation)
  - ✅ Price decrease (show modal, good news!)
  - ✅ Rate unavailable (`NO_AVAILABLE_RATES` error)

#### 1.2 Verify Price Change Modal
- **Component:** `PriceConfirmationModal` or `PriceChangeModal`
- **Check:**
  - [ ] Modal shows original price vs new price
  - [ ] Modal shows percentage change
  - [ ] Modal handles "unavailable" type (rate no longer available)
  - [ ] User can accept or decline price changes
  - [ ] On decline, user is redirected appropriately

#### 1.3 Test Scenarios
- [ ] Prebook with rate that has price increase → Modal shows correctly
- [ ] Prebook with rate that has price decrease → Modal shows correctly
- [ ] Prebook with unavailable rate → Shows "unavailable" message
- [ ] User accepts price change → Proceeds to booking form
- [ ] User declines price change → Returns to hotel page

---

### 2. ✅ Children Age Input in Booking Form

**Requirement:** Age specified in booking finish request within `guests.children[]` array

**Backend Status:** ✅ Validates and normalizes age (0-17)

**Frontend Action Required:**

#### 2.1 Booking Form UI
- **File:** Booking form component (likely `BookingPage.tsx` or `BookingForm.tsx`)
- **Check:**
  - [ ] Form has input field for child age (when children are added)
  - [ ] Age validation (0-17 years)
  - [ ] Age is required for each child

#### 2.2 Guest Data Format
- **File:** Booking form submission handler
- **Check:** When submitting booking, guests array format:
  ```typescript
  guests: [
    {
      adults: 2,
      children: [{ age: 5 }]  // ✅ Age must be specified
    }
  ]
  ```

#### 2.3 Test Scenarios
- [ ] Add 1 child, specify age 5 → Submit booking → Check network request has correct format
- [ ] Add 2 children, ages 3 and 7 → Submit booking → Check both ages are sent
- [ ] Try to submit without child age → Validation error shown
- [ ] Try to submit with age > 17 → Validation error shown

---

### 3. ✅ Residency Selection

**Requirement:** Collect residency/citizenship on first search step or booking step

**Backend Status:** ✅ Accepts and normalizes residency parameter

**Frontend Action Required:**

#### 3.1 Residency Collection Method
- **Check:** How is residency collected?
  - [ ] Dropdown with country list (recommended)
  - [ ] IP-based detection (with manual override option)
  - [ ] Default value only (not recommended for certification)

#### 3.2 Residency in Search Requests
- **File:** Search API calls
- **Check:**
  - [ ] `residency` parameter is sent in search requests (`/api/ratehawk/search`)
  - [ ] `residency` is sent in hotel details requests (`/api/ratehawk/hotel/details`)
  - [ ] `residency` format is ISO country code (e.g., "US", "GB")

#### 3.3 Residency in Booking Requests
- **File:** Booking API calls
- **Check:**
  - [ ] `residency` is sent in prebook request
  - [ ] `residency` is sent in booking finish request (if required)

#### 3.4 Test Scenarios
- [ ] Select "US" from dropdown → Search hotels → Check request has `residency: "US"`
- [ ] Select "GB" from dropdown → Book hotel → Check all booking requests have `residency: "GB"`

---

### 4. ✅ Cancellation Policy Display

**Requirement:** Parse and display cancellation policies from `cancellation_penalties`

**Backend Status:** ✅ Policies available in rate data

**Frontend Action Required:**

#### 4.1 Policy Display Location
- **Check:** Where are cancellation policies shown?
  - [ ] On rate cards in search results
  - [ ] On hotel details page (rate list)
  - [ ] On booking form/page (final confirmation)

#### 4.2 Policy Information Displayed
- **Check:** What information is shown?
  - [ ] Free cancellation before deadline
  - [ ] Cancellation deadline date
  - [ ] Cancellation deadline time
  - [ ] Cancellation deadline timezone (UTC+0 or local time)
  - [ ] Cancellation fee amount (if applicable)

#### 4.3 Timezone Handling
- **Requirement:** ETG requires showing deadline timezone
- **Check:**
  - [ ] Display deadline in UTC+0 with "UTC+0" label, OR
  - [ ] Convert to user's local timezone with local timezone label
  - [ ] Do NOT display without timezone information

#### 4.4 Test Scenarios
- [ ] Rate with free cancellation → Shows "Free cancellation until [date] [time] [timezone]"
- [ ] Rate with cancellation fee → Shows fee amount and deadline
- [ ] Rate with non-refundable → Shows "Non-refundable" clearly

---

### 5. ✅ Booking Status Polling

**Requirement:** Poll `/order/status` until status is "ok" or final failure

**Backend Status:** ✅ Returns `is_final`, `is_success`, `is_processing` flags

**Frontend Action Required:**

#### 5.1 Polling Implementation
- **File:** Booking confirmation page or booking flow handler
- **Check:**
  - [ ] After `finishOrder()`, start polling `/api/ratehawk/order/status`
  - [ ] Poll every 1-2 seconds (exponential backoff recommended)
  - [ ] Continue polling until `is_final: true`
  - [ ] Maximum polling duration: 300 seconds (5 minutes)

#### 5.2 Status Handling
- **Check:** Handle different status values:
  - [ ] `is_processing: true` → Continue polling, show "Processing booking..."
  - [ ] `is_success: true` → Show success page, stop polling
  - [ ] `is_final: true && !is_success` → Show error message, stop polling

#### 5.3 UI/UX During Polling
- **Check:**
  - [ ] Show loading indicator during polling
  - [ ] Show progress message ("Confirming booking...")
  - [ ] Disable form/buttons during polling
  - [ ] Show error if polling times out (5 minutes)

#### 5.4 Test Scenarios
- [ ] Complete booking → Polling starts → Status "processing" → Continue polling
- [ ] Complete booking → Polling starts → Status "ok" → Show success page
- [ ] Complete booking → Polling starts → Status "timeout" → Show error message
- [ ] Complete booking → Polling timeout (5 min) → Show timeout error

---

### 6. ✅ Unavailable Rate Handling

**Requirement:** Handle `NO_AVAILABLE_RATES` error gracefully

**Backend Status:** ✅ Returns error code `NO_AVAILABLE_RATES`

**Frontend Action Required:**

#### 6.1 Error Detection
- **File:** Prebook error handling
- **Check:**
  - [ ] Detects `error.code === "NO_AVAILABLE_RATES"`
  - [ ] Detects `error.message.includes("NO_AVAILABLE_RATES")`

#### 6.2 User Experience
- **Check:**
  - [ ] Show clear error message: "This rate is no longer available"
  - [ ] Provide action: "Select a different room" or "Search again"
  - [ ] Redirect user back to hotel page (not booking form)
  - [ ] Don't show generic error message

#### 6.3 Test Scenarios
- [ ] Prebook expired rate → Error detected → User-friendly message shown
- [ ] Prebook unavailable rate → User redirected to hotel page
- [ ] User can select different rate after unavailable error

---

### 7. ✅ Use Correct Booking Hash

**Requirement:** Use prebook `booking_hash` (p-...) for booking form, not original `book_hash`

**Backend Status:** ✅ Prebook returns new `booking_hash`

**Frontend Action Required:**

#### 7.1 Hash Management
- **File:** Booking flow state management
- **Check:**
  - [ ] After prebook succeeds, save `booking_hash` from response
  - [ ] Use `prebookResponse.data.booking_hash` (p-...) for booking form
  - [ ] Do NOT use original `book_hash` (h-...) from rate selection

#### 7.2 Test Scenarios
- [ ] Select rate (h-abc123) → Prebook → Get p-xyz789 → Use p-xyz789 for booking form
- [ ] Verify booking form request uses p-... hash, not h-... hash

---

## Important Items (Should Complete)

### 8. ⚠️ Price Increase Percent Configuration

**Requirement:** Default value and user preference

**Frontend Action Required:**

- [ ] Set default `price_increase_percent: 20` in prebook requests
- [ ] Optionally: Allow user to configure tolerance (advanced settings)
- [ ] Optionally: Show what price increase percent is being used

---

### 9. ⚠️ Match Hash Usage (Optional)

**Requirement:** Pass `match_hash` from SERP rate to hotel page request

**Frontend Action Required:**

- [ ] If using SERP search results, extract `match_hash` from rate
- [ ] Pass `match_hash` to `/api/ratehawk/hotel/details` request
- [ ] This helps ETG match rates between SERP and hotel page

---

### 10. ⚠️ Upsells Integration

**Requirement:** Support early check-in and late check-out

**Backend Status:** ✅ Fully implemented

**Frontend Action Required:**

- [ ] UI for selecting early check-in time (optional)
- [ ] UI for selecting late check-out time (optional)
- [ ] "Only show rates with these options" checkbox
- [ ] Pass upsells to `/api/ratehawk/hotel/details` request
- [ ] Show upsell indicators on rate cards (if applicable)

---

## Testing Checklist for Frontend

Before submitting for certification, test all flows:

### Prebook Flow
- [ ] Prebook with `price_increase_percent: 20`
- [ ] Prebook returns price increase → Modal shows correctly
- [ ] Prebook returns price decrease → Modal shows correctly
- [ ] Prebook returns `NO_AVAILABLE_RATES` → Error handled correctly
- [ ] Prebook succeeds with no price change → Proceeds to booking form

### Booking Flow
- [ ] Booking form collects child age (0-17)
- [ ] Booking form sends correct guests structure with age
- [ ] Booking finish uses correct `booking_hash` (p-...)
- [ ] Booking finish includes residency parameter

### Status Polling
- [ ] After booking finish, polling starts automatically
- [ ] Status "processing" → Continue polling, show loading
- [ ] Status "ok" → Show success page, stop polling
- [ ] Status error → Show error message, stop polling
- [ ] Polling timeout (5 min) → Show timeout error

### Display Requirements
- [ ] Cancellation policies shown on rate cards
- [ ] Cancellation deadline includes timezone
- [ ] Residency is collected and sent in all requests

---

## Certification Test Scenarios

These must work for ETG certification:

1. **Search + Hotel Selection:**
   - [ ] Search hotels → Select hotel → View rates
   - [ ] Residency is sent in search and hotel details requests

2. **Rate Selection + Prebook:**
   - [ ] Select rate → Click "Book" → Prebook called
   - [ ] Price change handled correctly
   - [ ] Unavailable rate handled correctly

3. **Booking Form:**
   - [ ] Fill guest details (including child age if applicable)
   - [ ] Submit booking form → Uses correct booking_hash

4. **Booking Finish:**
   - [ ] Submit booking → Finish order called
   - [ ] Children age sent correctly (if applicable)
   - [ ] Residency sent correctly

5. **Status Polling:**
   - [ ] After finish, polling starts
   - [ ] Poll until final status ("ok" or error)
   - [ ] Success page shown when booking confirmed

6. **Test Hotel:**
   - [ ] Can search test hotel (hid: 8473727 or id: "test_hotel_do_not_book")
   - [ ] Can view rates for test hotel
   - [ ] Can complete booking flow with test hotel (if allowed)

---

## Quick Reference: Backend Response Formats

### Prebook Response
```typescript
{
  success: true,
  data: {
    booking_hash: "p-abc123...",  // Use this for booking form!
    price_changed: true,
    original_price: 250.00,
    new_price: 275.00,
    currency: "USD",
    price_increase_percent: 20
  }
}
```

### Booking Status Response
```typescript
{
  success: true,
  data: {
    status: "ok" | "processing" | "timeout" | ...,
    is_final: boolean,      // true = stop polling
    is_success: boolean,    // true = booking confirmed
    is_processing: boolean  // true = continue polling
  }
}
```

### Rate Data (Cancellation Policy)
```typescript
{
  cancellation_penalties: {
    policies: [{
      start_at: null,
      end_at: "2025-10-05T20:00:00",  // Deadline in UTC
      amount_charge: "0.00",
      amount_show: "0.00"
    }]
  }
}
```

---

## Files to Check/Update

Based on typical React/TypeScript structure:

1. `src/pages/BookingPage.tsx` - Main booking flow
2. `src/components/booking/PriceConfirmationModal.tsx` - Price change modal
3. `src/services/bookingApi.ts` - API service layer
4. `src/types/etgBooking.ts` - Type definitions
5. Search page component - Residency selection
6. Rate card component - Cancellation policy display
7. Booking confirmation page - Status polling

---

**Status:** ⚠️ Frontend implementation/verification needed  
**Priority:** Complete Critical Items (1-7) first, then Important Items (8-10)  
**Timeline:** Test all items before certification submission

