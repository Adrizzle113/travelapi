# Frontend Code Patches

Quick reference patches for each file that needs changes.

---

## Patch 1: bookingApi.ts - Rate Limit Handling

**Location:** `src/services/bookingApi.ts`

**Find:**
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

**Replace with:**
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

    // Handle rate limiting (429)
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

---

## Patch 2: ratehawkApi.ts - Rate Limit Handling

**Location:** `src/services/ratehawkApi.ts`

**Apply the same patch as Patch 1** to the `fetchWithError` method.

---

## Patch 3: RoomSelectionSection.tsx - Add matchHash

**Location:** `src/components/hotel/RoomSelectionSection.tsx`

**Find:**
```typescript
interface ProcessedRoom {
  id: string;
  name: string;
  // ... other fields
  rgHash?: string;
  bookHash?: string;
  meal?: string;
  // ...
}
```

**Replace with:**
```typescript
interface ProcessedRoom {
  id: string;
  name: string;
  // ... other fields
  rgHash?: string;
  bookHash?: string;
  matchHash?: string;  // ADD THIS
  meal?: string;
  // ...
}
```

**Find in `processRoomsWithRoomGroups()`:**
```typescript
processedRooms.push({
  id: bestRate?.book_hash || roomGroup.room_group_id?.toString() || `room_${index}`,
  // ...
  rgHash: rgHash,
  bookHash: bestRate?.book_hash,
  meal: meal,
  // ...
});
```

**Replace with:**
```typescript
const bestRate = roomGroup.rates?.find((r: any) => r.match_hash) || 
                 roomGroup.rates?.[0];

processedRooms.push({
  id: bestRate?.match_hash || bestRate?.book_hash || roomGroup.room_group_id?.toString() || `room_${index}`,
  // ...
  rgHash: rgHash,
  bookHash: bestRate?.book_hash,
  matchHash: bestRate?.match_hash,  // ADD THIS
  meal: meal,
  // ...
});
```

**Find in `processRatesDirectly()`:**
```typescript
processedRooms.push({
  id: rate.book_hash || `rate_${index}`,
  // ...
  rgHash: rate.rg_hash,
  bookHash: rate.book_hash,
  meal: meal,
  // ...
});
```

**Replace with:**
```typescript
processedRooms.push({
  id: rate.match_hash || rate.book_hash || `rate_${index}`,
  // ...
  rgHash: rate.rg_hash,
  bookHash: rate.book_hash,
  matchHash: rate.match_hash,  // ADD THIS
  meal: meal,
  // ...
});
```

**Find in `handleIncrease()`:**
```typescript
addRoom({
  roomId: room.id,
  roomName: room.name,
  quantity: 1,
  pricePerRoom: room.price,
  totalPrice: room.price,
});
```

**Replace with:**
```typescript
addRoom({
  roomId: room.id,
  roomName: room.name,
  quantity: 1,
  pricePerRoom: room.price,
  totalPrice: room.price,
  matchHash: room.matchHash || room.bookHash || room.id,  // ADD THIS
});
```

---

## Patch 4: booking.ts - Add matchHash to Interface

**Location:** `src/types/booking.ts`

**Find:**
```typescript
export interface RoomSelection {
  roomId: string;
  roomName: string;
  quantity: number;
  pricePerRoom: number;
  totalPrice: number;
}
```

**Replace with:**
```typescript
export interface RoomSelection {
  roomId: string;
  roomName: string;
  quantity: number;
  pricePerRoom: number;
  totalPrice: number;
  matchHash?: string;  // ADD THIS
}
```

---

## Patch 5: BookingPage.tsx - Use matchHash in Prebook

**Location:** `src/pages/BookingPage.tsx`

**Find:**
```typescript
const runPrebook = async (): Promise<{ success: boolean; priceChanged: boolean; newPrice?: number; bookingHash?: string }> => {
  const firstRoom = selectedRooms[0];
  const bookHash = firstRoom?.roomId;
  // ...
}
```

**Replace with:**
```typescript
const runPrebook = async (): Promise<{ success: boolean; priceChanged: boolean; newPrice?: number; bookingHash?: string }> => {
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

  // Check if it's a fallback ID
  if (bookHash.startsWith('room_') || 
      bookHash.startsWith('rate_') || 
      bookHash.startsWith('fallback')) {
    console.error("❌ Invalid rate hash detected:", bookHash);
    throw new Error("Invalid room selection - please go back and select a room with available rates");
  }

  console.log("✅ Running prebook with hash:", bookHash);

  try {
    const response = await bookingApi.prebook({
      book_hash: bookHash,
      residency: residency || "US",
      currency: selectedHotel?.currency || "USD",
    });
    // ... rest unchanged
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

## Quick Apply Script

If you want to apply all patches at once, you can use this search-and-replace approach:

1. **Rate Limit Handling:** Search for `fetchWithError` in both API files and add 429 check
2. **matchHash Extraction:** Search for `bookHash` assignments and add `matchHash` alongside
3. **Interface Update:** Search for `RoomSelection` interface and add `matchHash?` field
4. **Prebook Update:** Search for `runPrebook` and update hash selection logic

---

## Verification Commands

After applying patches, verify with:

```bash
# Check if matchHash is in types
grep -r "matchHash" src/types/

# Check if matchHash is extracted
grep -r "match_hash" src/components/

# Check if rate limit handling exists
grep -r "429" src/services/

# Check if prebook uses matchHash
grep -r "matchHash.*prebook\|prebook.*matchHash" src/pages/
```

---

## Testing After Patches

1. **Console Check:**
   - Open browser console
   - Select a room
   - Look for: `✅ Room has valid hash`
   - Look for: `✅ Running prebook with hash: m-...`

2. **Network Check:**
   - Open Network tab
   - Complete booking
   - Check prebook request payload
   - Verify `book_hash` starts with `m-` or `h-`

3. **Error Check:**
   - Trigger rate limit (10+ rapid searches)
   - Verify friendly error message
   - Check error includes wait time

