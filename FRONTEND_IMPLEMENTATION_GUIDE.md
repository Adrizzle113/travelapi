# Frontend Implementation Guide

> **Repository:** https://github.com/Adrizzle113/website-makeover  
> **Date:** December 30, 2025  
> **Priority:** Critical fixes for rate limiting and booking flow

## Overview

This guide provides exact code changes needed to fix:
1. Rate limiting error handling (429 responses)
2. `match_hash` extraction for prebook API
3. Booking flow validation

---

## Part 1: Rate Limiting Error Handling

### File: `src/services/bookingApi.ts`

**Add rate limit detection to `fetchWithError` method:**

```typescript
private async fetchWithError(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    // Handle rate limiting (429) - NEW
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || response.headers.get('retry-after');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60;
      
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || 
                          `Rate limit exceeded. Please wait ${waitTime} seconds and try again.`;
      
      const rateLimitError = new Error(errorMessage);
      (rateLimitError as any).isRateLimit = true;
      (rateLimitError as any).retryAfter = waitTime;
      throw rateLimitError;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || `API Error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
```

**Add retry method for critical operations (optional but recommended):**

```typescript
private async fetchWithRetry(
  url: string, 
  options?: RequestInit, 
  maxRetries = 3
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await this.fetchWithError(url, options);
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = (error as any).isRateLimit;

      // Only retry on rate limit errors
      if (isRateLimit && attempt < maxRetries - 1) {
        const retryAfter = (error as any).retryAfter || 60;
        const waitTime = Math.min(Math.pow(2, attempt) * 1000, retryAfter * 1000);
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      } else {
        throw error; // Don't retry other errors or if max retries reached
      }
    }
  }

  throw lastError;
}
```

**Update `prebook` method to use retry (optional):**

```typescript
async prebook(data: { book_hash: string; residency: string; currency: string }) {
  // Use fetchWithRetry for critical booking operations
  return this.fetchWithRetry(`${this.baseUrl}/ratehawk/prebook`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

---

### File: `src/services/ratehawkApi.ts`

**Apply the same rate limit handling:**

```typescript
private async fetchWithError(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    // Handle rate limiting (429) - NEW
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || response.headers.get('retry-after');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60;
      
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || 
                          `Rate limit exceeded. Please wait ${waitTime} seconds and try again.`;
      
      const rateLimitError = new Error(errorMessage);
      (rateLimitError as any).isRateLimit = true;
      (rateLimitError as any).retryAfter = waitTime;
      throw rateLimitError;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || `API Error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
```

**For search operations, add retry with exponential backoff:**

```typescript
async searchHotels(params: SearchParams) {
  // Search has lower rate limit (10 per minute), so add retry
  return this.fetchWithRetry(`${this.baseUrl}/ratehawk/search`, {
    method: "GET",
    // ... existing params
  });
}
```

---

## Part 2: Fix match_hash Extraction

### File: `src/components/hotel/RoomSelectionSection.tsx`

**1. Update `ProcessedRoom` interface (around line 13-32):**

```typescript
interface ProcessedRoom {
  id: string;
  name: string;
  type: string;
  price: number;
  currency: string;
  bedding: string;
  occupancy: string;
  size: string;
  amenities: string[];
  cancellation: string;
  paymentType: string;
  availability: number;
  rgHash?: string;
  bookHash?: string;
  matchHash?: string;  // ADD THIS - Required for prebook API
  meal?: string;
  isFallbackPrice?: boolean;
  category: RoomCategory;
}
```

**2. Update `processRoomsWithRoomGroups()` function (around line 260-278):**

Find the section where `processedRooms.push()` is called and update:

```typescript
// Find the best rate (prefer match_hash, then book_hash)
const bestRate = roomGroup.rates?.find((r: any) => r.match_hash) || 
                 roomGroup.rates?.[0];

processedRooms.push({
  // Use match_hash as primary ID, fallback to book_hash, then room_group_id
  id: bestRate?.match_hash || bestRate?.book_hash || roomGroup.room_group_id?.toString() || `room_${index}`,
  name: fullRoomName,
  type: roomType,
  price: bestRatePrice,
  currency: currency,
  bedding: bedding,
  occupancy: occupancy,
  size: size,
  amenities: amenities,
  cancellation: cancellation,
  paymentType: paymentType,
  availability: availability,
  rgHash: rgHash,
  bookHash: bestRate?.book_hash,
  matchHash: bestRate?.match_hash,  // ADD THIS - Critical for prebook
  meal: meal,
  isFallbackPrice: isFallbackPrice,
  category: category,
});
```

**3. Update `processRatesDirectly()` function (around line 422-440):**

```typescript
processedRooms.push({
  // Use match_hash as primary ID
  id: rate.match_hash || rate.book_hash || `rate_${index}`,
  name: roomName,
  type: roomType,
  price: ratePrice,
  currency: currency,
  bedding: bedding,
  occupancy: occupancy,
  size: size,
  amenities: amenities,
  cancellation: cancellation,
  paymentType: paymentType,
  availability: availability,
  rgHash: rate.rg_hash,
  bookHash: rate.book_hash,
  matchHash: rate.match_hash,  // ADD THIS - Critical for prebook
  meal: meal,
  isFallbackPrice: isFallbackPrice,
  category: category,
});
```

**4. Update `handleIncrease()` function (around line 497-510):**

```typescript
const handleIncrease = (room: ProcessedRoom) => {
  const currentQty = getSelectedQuantity(room.id);
  if (currentQty === 0) {
    addRoom({
      roomId: room.id,
      roomName: room.name,
      quantity: 1,
      pricePerRoom: room.price,
      totalPrice: room.price,
      matchHash: room.matchHash || room.bookHash || room.id,  // ADD THIS - Pass matchHash
    });
  } else {
    updateRoomQuantity(room.id, currentQty + 1);
  }
};
```

**5. Add validation logging (optional but helpful for debugging):**

```typescript
// In handleIncrease, add validation
const handleIncrease = (room: ProcessedRoom) => {
  // Validate we have a real hash
  if (!room.matchHash && !room.bookHash) {
    console.warn("⚠️ Room missing match_hash and book_hash:", room);
    // Still allow selection, but log warning
  } else {
    console.log("✅ Room has valid hash:", {
      matchHash: room.matchHash,
      bookHash: room.bookHash,
      roomId: room.id
    });
  }

  const currentQty = getSelectedQuantity(room.id);
  if (currentQty === 0) {
    addRoom({
      roomId: room.id,
      roomName: room.name,
      quantity: 1,
      pricePerRoom: room.price,
      totalPrice: room.price,
      matchHash: room.matchHash || room.bookHash || room.id,
    });
  } else {
    updateRoomQuantity(room.id, currentQty + 1);
  }
};
```

---

### File: `src/types/booking.ts`

**Update `RoomSelection` interface (around line 176-182):**

```typescript
export interface RoomSelection {
  roomId: string;
  roomName: string;
  quantity: number;
  pricePerRoom: number;
  totalPrice: number;
  matchHash?: string;  // ADD THIS - Required for prebook API
}
```

---

## Part 3: Update BookingPage to Use matchHash

### File: `src/pages/BookingPage.tsx`

**Update `runPrebook()` function:**

```typescript
const runPrebook = async (): Promise<{ 
  success: boolean; 
  priceChanged: boolean; 
  newPrice?: number; 
  bookingHash?: string 
}> => {
  const firstRoom = selectedRooms[0];

  if (!firstRoom) {
    throw new Error("No room selected");
  }

  // Use matchHash from the room selection (this is the real ETG hash)
  const bookHash = firstRoom.matchHash || firstRoom.roomId;

  // Validate we have a real hash, not a fallback ID
  if (!bookHash) {
    console.error("❌ No hash found in room selection:", firstRoom);
    throw new Error("Invalid room selection - missing rate hash");
  }

  // Check if it's a fallback ID (should not happen if match_hash was extracted correctly)
  if (bookHash.startsWith('room_') || 
      bookHash.startsWith('rate_') || 
      bookHash.startsWith('fallback')) {
    console.error("❌ Invalid rate hash detected:", bookHash);
    console.error("Room selection:", firstRoom);
    throw new Error("Invalid room selection - please go back and select a room with available rates");
  }

  // Validate hash format (ETG hashes typically start with 'm-' or 'h-')
  if (!bookHash.match(/^[mh]-[a-f0-9-]+$/i)) {
    console.warn("⚠️ Hash format unexpected:", bookHash);
    // Still try, but log warning
  }

  console.log("✅ Running prebook with hash:", bookHash);
  console.log("Room details:", {
    roomId: firstRoom.roomId,
    roomName: firstRoom.roomName,
    matchHash: firstRoom.matchHash,
    price: firstRoom.pricePerRoom
  });

  try {
    const response = await bookingApi.prebook({
      book_hash: bookHash,
      residency: residency || "US",
      currency: selectedHotel?.currency || "USD",
    });

    if (response.success) {
      // ... rest of existing logic
      return {
        success: true,
        priceChanged: false,
        bookingHash: response.data?.booking_hash,
      };
    } else {
      throw new Error(response.error || "Prebook failed");
    }
  } catch (error: any) {
    console.error("❌ Prebook error:", error);
    
    // Handle rate limit errors specifically
    if (error.isRateLimit) {
      throw new Error(`Too many requests. Please wait ${error.retryAfter} seconds and try again.`);
    }
    
    throw error;
  }
};
```

---

## Part 4: Update Booking Store

### File: `src/stores/bookingStore.ts`

**Verify `addRoom` action preserves `matchHash`:**

The store should already handle this since `RoomSelection` now includes `matchHash`, but verify:

```typescript
addRoom: (room: RoomSelection) =>
  set((state) => ({
    selectedRooms: [...state.selectedRooms, room],  // matchHash is included in room object
  })),
```

**Add validation in store (optional):**

```typescript
addRoom: (room: RoomSelection) =>
  set((state) => {
    // Validate matchHash is present
    if (!room.matchHash && !room.roomId.match(/^[mh]-[a-f0-9-]+$/i)) {
      console.warn("⚠️ Adding room without valid matchHash:", room);
    }
    
    return {
      selectedRooms: [...state.selectedRooms, room],
    };
  }),
```

---

## Part 5: Add User-Friendly Error Messages

### Create: `src/utils/errorHandler.ts` (if it doesn't exist)

```typescript
export function getErrorMessage(error: any): string {
  // Rate limit errors
  if (error.isRateLimit) {
    const waitTime = error.retryAfter || 60;
    return `Too many requests. Please wait ${waitTime} seconds before trying again.`;
  }

  // Network errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // API errors
  if (error.message) {
    return error.message;
  }

  // Generic fallback
  return 'An unexpected error occurred. Please try again.';
}

export function isRateLimitError(error: any): boolean {
  return error.isRateLimit === true || 
         error.message?.toLowerCase().includes('rate limit');
}
```

**Update components to use error handler:**

```typescript
import { getErrorMessage } from '@/utils/errorHandler';

try {
  await bookingApi.prebook(data);
} catch (error) {
  const message = getErrorMessage(error);
  toast.error(message); // or your notification system
}
```

---

## Testing Checklist

After implementing all changes:

### 1. Rate Limit Handling
- [ ] Make 10+ rapid search requests
- [ ] Verify 429 error is caught
- [ ] Verify user sees friendly message
- [ ] Verify retry logic works (if implemented)

### 2. Booking Flow
- [ ] Select a room on hotel details page
- [ ] Check console for `matchHash` in logs
- [ ] Verify `matchHash` appears in room selection
- [ ] Complete booking to prebook step
- [ ] Verify prebook uses real hash (starts with `m-` or `h-`)
- [ ] Verify no `rate_X` or `room_X` IDs in prebook request

### 3. Error Cases
- [ ] Test with rooms that have no `match_hash` (should show error)
- [ ] Test rate limit scenarios
- [ ] Test network failures
- [ ] Test invalid hotel IDs

### 4. Console Validation
- [ ] Check for `✅ Room has valid hash` logs
- [ ] Check for `✅ Running prebook with hash` logs
- [ ] No `❌ Invalid rate hash` errors
- [ ] No `⚠️ Room missing match_hash` warnings

---

## Debugging Tips

### Check if match_hash is in API response:

```typescript
// In RoomSelectionSection, add logging
console.log("Raw rate data:", rate);
console.log("match_hash:", rate.match_hash);
console.log("book_hash:", rate.book_hash);
```

### Verify room selection has matchHash:

```typescript
// In BookingPage, before prebook
console.log("Selected rooms:", selectedRooms);
console.log("First room matchHash:", selectedRooms[0]?.matchHash);
```

### Check prebook request:

```typescript
// In bookingApi.prebook, add logging
console.log("Prebook request:", {
  book_hash: data.book_hash,
  residency: data.residency,
  currency: data.currency
});
```

---

## Rollback Plan

If issues occur:

1. **Rate limiting too aggressive:**
   - Remove retry logic, keep error handling
   - Adjust wait times

2. **match_hash not found:**
   - Check API response structure
   - Verify ETG API returns `match_hash` field
   - Fallback to `book_hash` if `match_hash` unavailable

3. **Booking flow breaks:**
   - Verify `matchHash` is optional in `RoomSelection`
   - Add fallback to `roomId` if `matchHash` missing

---

## Summary of Changes

| File | Change Type | Priority |
|------|-------------|----------|
| `src/services/bookingApi.ts` | Add 429 handling | Critical |
| `src/services/ratehawkApi.ts` | Add 429 handling | Critical |
| `src/components/hotel/RoomSelectionSection.tsx` | Extract `matchHash` | Critical |
| `src/types/booking.ts` | Add `matchHash` to interface | Critical |
| `src/pages/BookingPage.tsx` | Use `matchHash` in prebook | Critical |
| `src/stores/bookingStore.ts` | Verify `matchHash` handling | Important |
| `src/utils/errorHandler.ts` | Add error utilities | Recommended |

---

**Next Steps:**
1. Apply changes file by file
2. Test each change incrementally
3. Check console logs for validation
4. Test complete booking flow
5. Monitor for rate limit errors

