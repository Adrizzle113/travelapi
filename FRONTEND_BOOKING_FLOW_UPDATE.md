# Frontend Booking Flow Update Guide

This document outlines the **critical frontend changes** needed to match the updated backend booking flow.

## 🔄 Updated Booking Flow

The backend now follows the correct ETG API flow:

1. **Prebook** → Returns `book_hash`
2. **Create Booking Form** → Takes `partner_order_id` + `book_hash` → Returns `order_id` + `item_id`
3. **Finish Booking** → Takes `partner_order_id` + `order_id` + `item_id` + `guests` + `payment_type`

## ⚠️ Critical Changes Required

### 1. Generate and Store `partner_order_id`

**What:** You must generate a unique `partner_order_id` at the start of the booking flow and use the **same ID** for both form and finish steps.

**Where:** Generate when user selects a rate and clicks "Book Now"

**Example:**
```typescript
// Generate partner_order_id when booking starts
const partnerOrderId = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

// Store in state/context/localStorage
setBookingState({
  partner_order_id: partnerOrderId,
  // ... other booking data
});
```

### 2. Update Booking Form Call

**File:** Component that calls `/api/ratehawk/order/form`

**Before (WRONG):**
```typescript
// ❌ Missing partner_order_id
const response = await fetch(`${API_BASE}/api/ratehawk/order/form`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    booking_hash: prebookResponse.book_hash, // or booking_hash
    language: 'en'
  })
});
```

**After (CORRECT):**
```typescript
// ✅ Include partner_order_id (required)
const response = await fetch(`${API_BASE}/api/ratehawk/order/form`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    book_hash: prebookResponse.book_hash, // Use book_hash from prebook
    partner_order_id: bookingState.partner_order_id, // REQUIRED - same ID for form & finish
    language: 'en'
  })
});

const formData = await response.json();

// ✅ CRITICAL: Store order_id and item_id from response
if (formData.success && formData.data) {
  setBookingState({
    ...bookingState,
    order_id: formData.data.order_id,    // Store for finish step
    item_id: formData.data.item_id,      // Store for finish step
    formFields: formData.data.form_fields // Guest form fields
  });
}
```

### 3. Update Finish Booking Call

**File:** `PaymentPage.tsx` or booking completion component

**Before (WRONG):**
```typescript
// ❌ Using booking_hash (no longer supported)
const response = await fetch(`${API_BASE}/api/ratehawk/order/finish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    booking_hash: bookingState.booking_hash, // ❌ REMOVED
    guests: guestData,
    payment_type: 'deposit',
    language: 'en'
  })
});
```

**After (CORRECT):**
```typescript
// ✅ Use order_id, item_id, and partner_order_id (from form step)
const response = await fetch(`${API_BASE}/api/ratehawk/order/finish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    order_id: bookingState.order_id,              // ✅ From form response
    item_id: bookingState.item_id,                // ✅ From form response
    partner_order_id: bookingState.partner_order_id, // ✅ Same ID from form step
    guests: guestData,                            // Guest information array
    payment_type: 'deposit',                      // 'deposit', 'hotel', or 'now'
    language: 'en',
    // Optional:
    upsell_data: selectedUpsells                  // Early check-in, late checkout, etc.
  })
});

const finishData = await response.json();

if (finishData.success && finishData.data?.order_id) {
  // ✅ Use REAL order_id from backend
  navigate(`/processing/${finishData.data.order_id}`);
} else {
  // Show error, don't create fake ID
  setError(finishData.error?.message || "Booking failed. Please try again.");
}
```

### 4. Complete Booking Flow Example

Here's a complete example of the updated flow:

```typescript
// ============================================
// STEP 1: Prebook (Lock Rate)
// ============================================
const prebookResponse = await fetch(`${API_BASE}/api/ratehawk/prebook`, {
  method: 'POST',
  body: JSON.stringify({
    book_hash: selectedRate.book_hash,
    residency: 'us',
    currency: 'USD'
  })
});

const prebookData = await prebookResponse.json();
const book_hash = prebookData.data.book_hash; // Store this

// ============================================
// STEP 2: Generate partner_order_id
// ============================================
const partnerOrderId = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

// ============================================
// STEP 3: Create Booking Form
// ============================================
const formResponse = await fetch(`${API_BASE}/api/ratehawk/order/form`, {
  method: 'POST',
  body: JSON.stringify({
    book_hash: book_hash,
    partner_order_id: partnerOrderId, // ✅ REQUIRED
    language: 'en'
  })
});

const formData = await formResponse.json();

// ✅ CRITICAL: Store order_id and item_id
const order_id = formData.data.order_id;
const item_id = formData.data.item_id;
const formFields = formData.data.form_fields; // Guest form fields

// Show form to user, collect guest information...

// ============================================
// STEP 4: Finish Booking
// ============================================
const finishResponse = await fetch(`${API_BASE}/api/ratehawk/order/finish`, {
  method: 'POST',
  body: JSON.stringify({
    order_id: order_id,              // ✅ From form step
    item_id: item_id,                // ✅ From form step
    partner_order_id: partnerOrderId, // ✅ Same ID from form step
    guests: [
      {
        first_name: "John",
        last_name: "Doe",
        // ... other guest fields from formFields
      }
    ],
    payment_type: 'deposit',
    language: 'en'
  })
});

const finishData = await finishResponse.json();

if (finishData.success) {
  // ✅ Use REAL order_id from response
  const realOrderId = finishData.data.order_id;
  navigate(`/processing/${realOrderId}`);
} else {
  // Handle error - don't create fake ID
  setError(finishData.error?.message);
}
```

## 📋 Request/Response Formats

### POST `/api/ratehawk/order/form`

**Request:**
```json
{
  "book_hash": "h-48eb6527-778e-5f64-91c9-b03065f9cc1e",
  "partner_order_id": "BK-1234567890-ABC123",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_12345",
    "item_id": "item_67890",
    "form_fields": [
      {
        "field_name": "first_name",
        "field_type": "text",
        "required": true
      }
      // ... more fields
    ]
  }
}
```

### POST `/api/ratehawk/order/finish`

**Request:**
```json
{
  "order_id": "order_12345",
  "item_id": "item_67890",
  "partner_order_id": "BK-1234567890-ABC123",
  "guests": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    }
  ],
  "payment_type": "deposit",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_12345",
    "status": "processing",
    "booking_reference": "BK-REF-12345"
  }
}
```

## ❌ Common Mistakes to Avoid

1. **Don't use `booking_hash` in finish step** - It's been removed
2. **Don't generate new `partner_order_id` for finish** - Use the same one from form step
3. **Don't forget to store `order_id` and `item_id`** - You need them for finish
4. **Don't create fake order IDs** - Use the real `order_id` from finish response
5. **Don't skip `partner_order_id`** - It's now required for both form and finish

## ✅ Migration Checklist

- [ ] Generate `partner_order_id` when booking starts
- [ ] Store `partner_order_id` in booking state/context
- [ ] Update form endpoint call to include `partner_order_id`
- [ ] Store `order_id` and `item_id` from form response
- [ ] Update finish endpoint call to use `order_id` and `item_id` (not `booking_hash`)
- [ ] Use same `partner_order_id` in both form and finish calls
- [ ] Remove any `booking_hash` usage in finish step
- [ ] Use real `order_id` from finish response (not fake IDs)
- [ ] Test complete booking flow end-to-end
- [ ] Verify error handling for missing parameters

## 🔍 Testing

After implementing changes, test:

1. **Complete booking flow:**
   - Prebook → Form → Finish → Status check
   - Verify `partner_order_id` is consistent
   - Verify `order_id` and `item_id` are used correctly

2. **Error scenarios:**
   - Missing `partner_order_id` in form call
   - Missing `order_id`/`item_id` in finish call
   - Different `partner_order_id` in form vs finish

3. **Edge cases:**
   - User navigates away and returns
   - Multiple booking attempts
   - Network failures during booking

## 📝 Notes

- `partner_order_id` must be **unique per booking** and **consistent** across form and finish steps
- `order_id` and `item_id` come from the **form response** - don't generate them
- The backend validates that `partner_order_id` matches between form and finish steps
- All fake order IDs (`ORD-{timestamp}`) are rejected by the backend

