# Prebook Implementation Summary

## Date
2026-01-10

## What Was Implemented

### Backend Changes

#### 1. Added `price_increase_percent` Parameter Support

**File:** `services/booking/bookingService.js`
- Added `priceIncreasePercent` parameter to `prebookRate()` function signature
- Added validation to ensure value is between 0-100
- Conditionally includes `price_increase_percent` in API request body (only if > 0)
- Added logging for price increase tolerance

**File:** `routes/ratehawk/orders.js`
- Added `price_increase_percent` to request body extraction (default: 0)
- Validates and normalizes the value (0-100 range)
- Passes parameter to `prebookRate()` service function
- Returns the used value in response for frontend tracking

#### 2. Enhanced Price Extraction from WorldOTA Response

**File:** `services/booking/bookingService.js`
- Extracts `new_price` from: `data.hotels[0].rates[0].payment_options.payment_types[0].show_amount`
- Extracts `new_price_currency` from: `data.hotels[0].rates[0].payment_options.payment_types[0].show_currency_code`
- Extracts `original_price` from: `data.changes.original_price`
- Returns enhanced response with all price information at top level

#### 3. Improved Error Handling

**File:** `services/booking/bookingService.js` & `routes/ratehawk/orders.js`
- Added specific handling for `no_available_rates` error code
- Returns structured error response with code: `NO_AVAILABLE_RATES`
- Enhanced error logging with error codes
- Preserves error codes when re-throwing errors

#### 4. Updated Timeout Configuration

**File:** `services/booking/bookingService.js`
- Changed `TIMEOUTS.prebook` from 20000ms (20s) to 60000ms (60s)
- Complies with ETG API requirement: "Prebook rate from hotelpage step is implemented according to ETG timeout limitation (60s)"

#### 5. Enhanced Response Structure

**File:** `routes/ratehawk/orders.js`
- Response now includes:
  - `booking_hash` (new p-... hash)
  - `price_changed` (boolean)
  - `original_price` (number)
  - `new_price` (number)
  - `currency` (string)
  - `price_increase_percent` (number - what was used)
  - `room_data` (room name for display)

---

## API Request/Response Format

### Request
```json
POST /api/ratehawk/prebook
{
  "book_hash": "h-abc123...",        // Required: match_hash (m-...), book_hash (h-...), or prebooked hash (p-...)
  "guests": [{                        // Required: Array of guest objects
    "adults": 2,
    "children": []
  }],
  "residency": "US",                  // Required: ISO country code (uppercase)
  "language": "en",                   // Optional: Default "en"
  "currency": "USD",                  // Optional: Default "USD" (for logging only)
  "price_increase_percent": 20        // ✅ NEW: Optional (0-100, default: 0 = no increase allowed)
}
```

### Success Response
```json
{
  "success": true,
  "data": {
    "booking_hash": "p-newHash123...",  // New prebook hash (use this for booking form)
    "price_changed": true,               // Boolean: Did price change?
    "original_price": 250.00,            // Original price (if changed)
    "new_price": 275.00,                 // New price (if changed)
    "currency": "USD",                   // Currency code
    "price_increase_percent": 20,        // What was used
    "hotels": [...],                     // Full hotel/rate data
    "changes": {...},                    // Change details
    "room_data": "Standard Double room"  // Room name
  },
  "timestamp": "2026-01-10T03:00:00.000Z",
  "duration": "1234ms"
}
```

### Error Response - Rate Unavailable
```json
{
  "success": false,
  "error": {
    "message": "Rate not available",
    "code": "NO_AVAILABLE_RATES",
    "details": "The selected rate is no longer available and cannot be booked within the specified price increase limit."
  },
  "timestamp": "2026-01-10T03:00:00.000Z",
  "duration": "567ms"
}
```

---

## Frontend Implementation Instructions

### Step 1: Update BookingApi Service

**File:** `src/services/bookingApi.ts`

Update the `prebook()` method to include `price_increase_percent`:

```typescript
interface PrebookParams {
  book_hash: string;
  residency: string;
  currency?: string;
  price_increase_percent?: number;  // ✅ ADD THIS (0-100, default: 20)
}

async prebook(params: PrebookParams): Promise<PrebookResponse> {
  const url = `${API_BASE_URL}/api/ratehawk/prebook`;
  const userId = this.getCurrentUserId();

  const requestBody = {
    book_hash: params.book_hash,
    guests: [{ adults: 2, children: [] }],  // Get from booking context
    residency: params.residency,
    language: "en",
    currency: params.currency || "USD",
    price_increase_percent: params.price_increase_percent ?? 20  // ✅ ADD: Default 20%
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Add auth headers if needed
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || `Prebook failed: ${response.status}`);
  }

  return data;
}
```

### Step 2: Update Type Definitions

**File:** `src/types/etgBooking.ts` (or similar)

```typescript
export interface PrebookParams {
  book_hash: string;
  residency: string;
  currency?: string;
  price_increase_percent?: number;  // ✅ ADD (0-100)
}

export interface PrebookResponse {
  success?: boolean;
  data: {
    booking_hash: string;        // ✅ New p-... hash for booking form
    price_changed: boolean;       // ✅ Did price change?
    original_price?: number;      // ✅ Original price (if changed)
    new_price?: number;           // ✅ New price (if changed)
    currency?: string;            // ✅ Currency code
    price_increase_percent: number; // ✅ What was used
    room_data?: string;           // ✅ Room name
    hotels?: any[];               // Full hotel data
    changes?: any;                // Change details
  };
  error?: {
    message: string;
    code: "NO_AVAILABLE_RATES" | "PREBOOK_ERROR" | "PREBOOK_AUTH_ERROR" | "PREBOOK_ENDPOINT_NOT_FOUND";
    details?: string;
  };
  timestamp: string;
  duration: string;
}
```

### Step 3: Update BookingPage - Handle Prebook Response

**File:** `src/pages/BookingPage.tsx`

Update the `runPrebook()` function:

```typescript
const runPrebook = async (): Promise<{
  success: boolean;
  priceChanged: boolean;
  unavailable: boolean;
  originalPrice?: number;
  newPrice?: number;
  currency?: string;
  bookingHash?: string;
}> => {
  const firstRoom = selectedRooms[0];
  const bookHash = firstRoom?.book_hash || firstRoom?.match_hash;

  if (!bookHash) {
    throw new Error("No rate selected for prebook");
  }

  try {
    const response = await bookingApi.prebook({
      book_hash: bookHash,
      residency: residency || "US",
      currency: selectedHotel?.currency || "USD",
      price_increase_percent: 20  // ✅ ADD: Allow 20% price increase
    });

    // ✅ HANDLE ERROR RESPONSES
    if (!response.success || response.error) {
      if (response.error?.code === "NO_AVAILABLE_RATES") {
        return {
          success: false,
          priceChanged: false,
          unavailable: true
        };
      }
      throw new Error(response.error?.message || 'Prebook failed');
    }

    const { booking_hash, price_changed, new_price, original_price, currency } = response.data;
    
    // ✅ SAVE booking_hash for booking form
    setBookingHash(booking_hash);

    return {
      success: true,
      priceChanged: price_changed && new_price !== undefined,
      unavailable: false,
      originalPrice: original_price,
      newPrice: new_price,
      currency: currency,
      bookingHash: booking_hash
    };

  } catch (error: any) {
    // Handle network/API errors
    if (error.message?.includes('NO_AVAILABLE_RATES') || 
        error.code === 'NO_AVAILABLE_RATES') {
      return {
        success: false,
        priceChanged: false,
        unavailable: true
      };
    }
    throw error;
  }
};
```

### Step 4: Update Continue to Payment Handler

**File:** `src/pages/BookingPage.tsx`

```typescript
const handleContinueToPayment = async () => {
  if (!validateForm()) return;

  setIsPrebooking(true);
  setBookingError(null);

  try {
    const result = await runPrebook();

    // ✅ Handle unavailable rate
    if (result.unavailable) {
      setPriceChangeType("unavailable");
      setShowPriceChange(true);
      setIsPrebooking(false);
      return;
    }

    // ✅ Handle price change
    if (result.priceChanged && result.newPrice) {
      const priceIncreased = result.newPrice > (result.originalPrice || totalWithNights);
      setPriceChangeType(priceIncreased ? "increase" : "decrease");
      setOriginalPrice(result.originalPrice || totalWithNights);
      setNewPrice(result.newPrice);
      setShowPriceChange(true);
      setIsPrebooking(false);
      return;
    }

    // ✅ Success - no price change, proceed to payment with new booking_hash
    setIsPricingLocked(true);
    navigateToPayment(displayPrice, result.bookingHash);  // Use new p-... hash

  } catch (error) {
    console.error('Prebook error:', error);
    setBookingError(error.message || 'Failed to prebook rate. Please try again.');
    setIsPrebooking(false);
  }
};
```

### Step 5: Update Price Change Modal for Unavailable Rates

**File:** `src/components/booking/PriceChangeModal.tsx` (or `PriceConfirmationModal.tsx`)

Add handling for unavailable case:

```typescript
interface PriceChangeModalProps {
  type: "increase" | "decrease" | "unavailable";  // ✅ ADD "unavailable"
  originalPrice?: number;
  newPrice?: number;
  currency?: string;
  onConfirm?: () => void;
  onCancel: () => void;
}

function PriceChangeModal({ 
  type, 
  originalPrice, 
  newPrice, 
  currency = "USD",
  onConfirm,
  onCancel 
}: PriceChangeModalProps) {
  
  if (type === "unavailable") {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <h3>Rate No Longer Available</h3>
          <p>The selected rate is no longer available and cannot be booked.</p>
          <p>Please select a different room or search again.</p>
          <div className="modal-actions">
            <button onClick={onCancel} className="primary">
              Select Different Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ... existing price change modal UI ...
}
```

### Step 6: Use New Booking Hash for Booking Form

**Important:** After prebook succeeds, you MUST use the new `booking_hash` (starts with `p-`) for the booking form, not the original `book_hash`:

```typescript
// ❌ WRONG - Don't use original book_hash
const bookingForm = await bookingApi.createBookingForm({
  book_hash: originalBookHash  // Don't use this!
});

// ✅ CORRECT - Use the new booking_hash from prebook
const bookingForm = await bookingApi.createBookingForm({
  book_hash: prebookResponse.data.booking_hash  // Use the p-... hash from prebook
});
```

---

## Workflow Verification

After implementation, the correct flow should be:

1. ✅ User selects hotel → `/api/ratehawk/hotel/details` (Retrieve hotelpage)
2. ✅ User selects rate → User fills guest details
3. ✅ User clicks "Continue to Payment" → `/api/ratehawk/prebook` called
   - Includes `price_increase_percent: 20`
   - Returns new `booking_hash` (p-...)
4. ✅ If price changed → Show modal, ask user to confirm
5. ✅ If rate unavailable → Show unavailable message, return to hotel page
6. ✅ If price unchanged → Proceed directly to booking form
7. ✅ Create booking form → Use `booking_hash` from prebook (p-...)
8. ✅ Start booking → Use order_id from booking form
9. ✅ Check booking status → Poll until status = "ok"

---

## Testing Checklist

- [ ] Prebook with `price_increase_percent: 0` (should reject if price increased)
- [ ] Prebook with `price_increase_percent: 20` (should accept up to 20% increase)
- [ ] Handle `NO_AVAILABLE_RATES` error (rate no longer available)
- [ ] Handle price increase (show modal, get user confirmation)
- [ ] Handle price decrease (show modal, user continues with lower price)
- [ ] Handle no price change (proceed directly to booking form)
- [ ] Use new `booking_hash` (p-...) for booking form, not original `book_hash`
- [ ] Verify 60-second timeout is respected
- [ ] Test with invalid hash formats (should return validation error)
- [ ] Test with missing guests (should return validation error)

---

## Certification Requirements Met

✅ **Prebook is separate from booking step** - Already implemented
✅ **`price_increase_percent` implemented** - NOW IMPLEMENTED
✅ **User notified of price changes** - Frontend needs to handle modal
✅ **Handle `no_available_rates` error** - NOW IMPLEMENTED
✅ **60-second timeout** - NOW IMPLEMENTED

---

## Notes

1. **Default `price_increase_percent`**: Consider making this configurable (user preference, admin setting, or default 20%)

2. **Price Change Handling**: The frontend should:
   - Show clear comparison of old vs new price
   - Calculate and show percentage change
   - Allow user to accept or decline
   - If declined, return to hotel page to select different room

3. **Booking Hash**: The prebook hash (p-...) is different from the original book_hash (h-...). Make sure the frontend stores and uses the prebook hash for subsequent booking steps.

4. **Error Recovery**: When `NO_AVAILABLE_RATES` is returned, guide users to:
   - Go back to hotel page
   - Select a different rate
   - Adjust search dates
   - Try a different hotel

