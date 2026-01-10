# Frontend Multiroom Booking Implementation Guide

## Overview

This guide outlines the frontend changes needed to support multiroom booking (up to 6 rooms) with the backend implementation. The backend supports both single-room and multiroom formats, maintaining backward compatibility.

---

## 1. Type Definitions

### Update `src/types/booking.ts` or equivalent

```typescript
// Single Room Format (existing)
export interface PrebookParams {
  book_hash: string;
  guests: Array<{ adults: number; children: Array<{ age: number } | number> }>;
  residency?: string;
  currency?: string;
  price_increase_percent?: number; // 0-100
}

// Multiroom Format (NEW)
export interface MultiroomPrebookParams {
  rooms: Array<{
    book_hash?: string;
    match_hash?: string;
    guests: Array<{ adults: number; children: Array<{ age: number } | number> }>;
    residency?: string;
    price_increase_percent?: number; // 0-100, per room
  }>;
  language?: string;
}

// Prebook Response - Single Room
export interface PrebookResponse {
  status: "ok";
  success: boolean;
  data: {
    book_hash: string;
    booking_hash: string;
    price_changed: boolean;
    new_price?: number;
    original_price?: number;
    currency: string;
    price_increase_percent: number;
  };
}

// Prebook Response - Multiroom (NEW)
export interface MultiroomPrebookResponse {
  status: "ok";
  success: boolean; // true if all rooms succeeded, false if any failed
  data: {
    rooms: Array<{
      roomIndex: number;
      booking_hash: string;
      book_hash: string; // Alias
      price_changed: boolean;
      new_price?: number;
      original_price?: number;
      currency: string;
    }>;
    failed?: Array<{
      roomIndex: number;
      error: string;
      code: string;
    }>;
    total_rooms: number;
    successful_rooms: number;
    failed_rooms: number;
  };
}

// Order Form Response - Single Room (existing)
export interface OrderFormResponse {
  success: boolean;
  data: {
    order_id: number;
    item_id: number;
    payment_types: Array<PaymentType>;
    form_fields?: Array<any>;
  };
}

// Order Form Response - Multiroom (NEW)
export interface MultiroomOrderFormResponse {
  success: boolean; // true if all rooms succeeded
  data: {
    rooms: Array<{
      roomIndex: number;
      order_id: number;
      item_id: number;
      booking_hash: string;
      payment_types: Array<PaymentType>;
      form_fields?: Array<any>;
    }>;
    failed?: Array<{
      roomIndex: number;
      booking_hash: string;
      error: string;
      code: string;
    }>;
    total_rooms: number;
    successful_rooms: number;
    failed_rooms: number;
  };
}

// Order Finish Request - Single Room (existing)
export interface OrderFinishParams {
  order_id: number | string;
  item_id: number | string;
  guests: Array<{ adults: number; children: Array<{ age: number }> }>;
  payment_type: "hotel" | "deposit" | "now";
  partner_order_id: string;
  language?: string;
  upsell_data?: Array<any>;
}

// Order Finish Request - Multiroom (NEW)
export interface MultiroomOrderFinishParams {
  rooms: Array<{
    order_id: number | string;
    item_id: number | string;
    guests: Array<{ adults: number; children: Array<{ age: number }> }>;
  }>;
  // OR use order_forms array + separate guests array:
  order_forms?: Array<{ order_id: number; item_id: number }>;
  guests?: Array<Array<{ adults: number; children: Array<{ age: number }> }>>;
  
  payment_type: "hotel" | "deposit" | "now"; // Same for all rooms
  partner_order_id: string; // Same for all rooms (links them)
  language?: string;
  upsell_data?: Array<any>; // Same for all rooms
}

// Order Finish Response - Multiroom (NEW)
export interface MultiroomOrderFinishResponse {
  success: boolean; // true if all rooms succeeded
  data: {
    rooms: Array<{
      roomIndex: number;
      order_id: number;
      status: "processing" | "confirmed" | "failed";
    }>;
    failed?: Array<{
      roomIndex: number;
      order_id: number | string;
      item_id: number | string;
      error: string;
      code: string;
    }>;
    partner_order_id: string;
    order_ids: Array<number>; // All order IDs from successful bookings
    total_rooms: number;
    successful_rooms: number;
    failed_rooms: number;
  };
}
```

---

## 2. API Service Updates

### Update `src/services/bookingApi.ts` or equivalent

```typescript
class BookingApiService {
  private API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://travelapi-bg6t.onrender.com';

  /**
   * Prebook - supports both single room and multiroom
   */
  async prebook(params: PrebookParams | MultiroomPrebookParams): Promise<PrebookResponse | MultiroomPrebookResponse> {
    const isMultiroom = 'rooms' in params && Array.isArray(params.rooms);
    
    const url = `${this.API_BASE_URL}/api/ratehawk/prebook`;
    const userId = this.getCurrentUserId();
    
    const requestBody = isMultiroom
      ? {
          userId,
          rooms: params.rooms, // Multiroom format
          language: params.language || 'en'
        }
      : {
          userId,
          book_hash: params.book_hash,
          guests: params.guests,
          residency: params.residency || 'US',
          currency: params.currency || 'USD',
          price_increase_percent: params.price_increase_percent || 20,
          language: 'en'
        };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Prebook failed');
    }

    return response.json();
  }

  /**
   * Get Order Form - supports both single room and multiroom
   */
  async getOrderForm(
    params: 
      | { book_hash: string; partner_order_id: string; language?: string } // Single room
      | { prebooked_rooms: Array<{ booking_hash: string }>; partner_order_id: string; language?: string } // Multiroom
  ): Promise<OrderFormResponse | MultiroomOrderFormResponse> {
    const isMultiroom = 'prebooked_rooms' in params;
    
    const url = `${this.API_BASE_URL}/api/ratehawk/order/form`;
    const userId = this.getCurrentUserId();
    
    const requestBody = isMultiroom
      ? {
          userId,
          prebooked_rooms: params.prebooked_rooms,
          partner_order_id: params.partner_order_id,
          language: params.language || 'en'
        }
      : {
          userId,
          book_hash: params.book_hash,
          partner_order_id: params.partner_order_id,
          language: params.language || 'en'
        };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Get order form failed');
    }

    return response.json();
  }

  /**
   * Finish Order - supports both single room and multiroom
   */
  async finishOrder(
    params: OrderFinishParams | MultiroomOrderFinishParams
  ): Promise<OrderFinishResponse | MultiroomOrderFinishResponse> {
    const isMultiroom = 'rooms' in params || ('order_forms' in params && Array.isArray(params.order_forms));
    
    const url = `${this.API_BASE_URL}/api/ratehawk/order/finish`;
    const userId = this.getCurrentUserId();
    
    const requestBody = isMultiroom
      ? {
          userId,
          rooms: params.rooms || params.order_forms?.map((form, index) => ({
            order_id: form.order_id,
            item_id: form.item_id,
            guests: params.guests?.[index] || []
          })),
          payment_type: params.payment_type,
          partner_order_id: params.partner_order_id,
          language: params.language || 'en',
          upsell_data: params.upsell_data
        }
      : {
          userId,
          order_id: params.order_id,
          item_id: params.item_id,
          guests: params.guests,
          payment_type: params.payment_type,
          partner_order_id: params.partner_order_id,
          language: params.language || 'en',
          upsell_data: params.upsell_data
        };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Finish order failed');
    }

    return response.json();
  }
}
```

---

## 3. State Management Updates

### Update booking store (e.g., `src/stores/bookingStore.ts`)

```typescript
interface BookingState {
  // Existing single room state
  selectedRoom: Room | null;
  prebookResult: PrebookResponse | null;
  orderForm: OrderFormResponse | null;
  
  // NEW: Multiroom state
  selectedRooms: Array<{
    roomIndex: number;
    room: Room;
    guests: Array<{ adults: number; children: Array<{ age: number }> }>;
    book_hash: string;
    prebookResult?: PrebookResponse['data'];
    orderForm?: OrderFormResponse['data'];
    priceChanged?: boolean;
    newPrice?: number;
    originalPrice?: number;
  }>;
  
  isMultiroom: boolean;
  partner_order_id: string | null;
  
  // Booking status
  bookingStatus: {
    rooms: Array<{
      roomIndex: number;
      order_id: number;
      status: 'processing' | 'confirmed' | 'failed';
    }>;
    failed?: Array<{
      roomIndex: number;
      error: string;
    }>;
  } | null;
}

const useBookingStore = create<BookingState>((set) => ({
  selectedRoom: null,
  prebookResult: null,
  orderForm: null,
  selectedRooms: [],
  isMultiroom: false,
  partner_order_id: null,
  bookingStatus: null,
  
  // Actions
  setSelectedRooms: (rooms: BookingState['selectedRooms']) => 
    set({ selectedRooms: rooms, isMultiroom: rooms.length > 1 }),
  
  setPrebookResult: (result: PrebookResponse | MultiroomPrebookResponse) => {
    if ('rooms' in result.data) {
      // Multiroom response
      set({
        prebookResult: result,
        selectedRooms: result.data.rooms.map((room, index) => ({
          ...room,
          roomIndex: index,
          prebookResult: room
        }))
      });
    } else {
      // Single room response (existing)
      set({ prebookResult: result });
    }
  },
  
  // ... other actions
}));
```

---

## 4. UI Components

### 4.1 Room Selection Component

**File:** `src/components/booking/MultiroomRoomSelector.tsx`

```typescript
interface MultiroomRoomSelectorProps {
  maxRooms?: number; // Default: 6 (RateHawk limit)
  onRoomsChange: (rooms: Array<RoomSelection>) => void;
  selectedRooms: Array<RoomSelection>;
}

interface RoomSelection {
  roomIndex: number;
  rate: Rate; // From hotel details page
  guests: Array<{ adults: number; children: Array<{ age: number }> }>;
  book_hash: string; // From rate selection
}

export const MultiroomRoomSelector: React.FC<MultiroomRoomSelectorProps> = ({
  maxRooms = 6,
  onRoomsChange,
  selectedRooms
}) => {
  const [rooms, setRooms] = useState<Array<RoomSelection>>(selectedRooms);

  const addRoom = () => {
    if (rooms.length >= maxRooms) {
      toast.error(`Maximum ${maxRooms} rooms allowed`);
      return;
    }
    
    // Open room selection modal/component
    // On selection, add to rooms array
  };

  const removeRoom = (index: number) => {
    setRooms(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, roomIndex: i })));
    onRoomsChange(rooms);
  };

  const updateRoomGuests = (index: number, guests: RoomSelection['guests']) => {
    setRooms(prev => prev.map((r, i) => 
      i === index ? { ...r, guests } : r
    ));
    onRoomsChange(rooms);
  };

  return (
    <div className="multiroom-selector">
      <h3>Selected Rooms ({rooms.length}/{maxRooms})</h3>
      
      {rooms.map((room, index) => (
        <RoomCard
          key={index}
          roomIndex={index}
          room={room}
          onRemove={() => removeRoom(index)}
          onGuestsChange={(guests) => updateRoomGuests(index, guests)}
        />
      ))}
      
      {rooms.length < maxRooms && (
        <Button onClick={addRoom}>+ Add Another Room</Button>
      )}
    </div>
  );
};
```

### 4.2 Price Change Modal (Multiroom)

**File:** `src/components/booking/MultiroomPriceChangeModal.tsx`

```typescript
interface MultiroomPriceChangeModalProps {
  isOpen: boolean;
  prebookResponse: MultiroomPrebookResponse;
  onAccept: () => void;
  onDecline: () => void;
}

export const MultiroomPriceChangeModal: React.FC<MultiroomPriceChangeModalProps> = ({
  isOpen,
  prebookResponse,
  onAccept,
  onDecline
}) => {
  const roomsWithPriceChange = prebookResponse.data.rooms.filter(r => r.price_changed);
  const failedRooms = prebookResponse.data.failed || [];

  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <DialogTitle>Price Changes & Availability</DialogTitle>
        
        {/* Show failed rooms */}
        {failedRooms.length > 0 && (
          <div className="error-section">
            <h4>Unavailable Rooms</h4>
            {failedRooms.map(room => (
              <div key={room.roomIndex}>
                Room {room.roomIndex + 1}: {room.error}
              </div>
            ))}
          </div>
        )}
        
        {/* Show price changes */}
        {roomsWithPriceChange.length > 0 && (
          <div className="price-changes-section">
            <h4>Price Changes</h4>
            {roomsWithPriceChange.map(room => (
              <div key={room.roomIndex}>
                <div>Room {room.roomIndex + 1}:</div>
                <div>
                  {room.original_price && (
                    <span className="original-price">${room.original_price}</span>
                  )}
                  → <span className="new-price">${room.new_price} {room.currency}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="actions">
          <Button onClick={onAccept} variant="primary">
            Continue with New Prices
          </Button>
          <Button onClick={onDecline} variant="secondary">
            Cancel Booking
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 5. Booking Flow Updates

### Update `src/pages/BookingPage.tsx` or equivalent

```typescript
const BookingPage: React.FC = () => {
  const bookingStore = useBookingStore();
  const { selectedRooms, isMultiroom } = bookingStore;
  
  // Prebook step
  const handlePrebook = async () => {
    if (isMultiroom && selectedRooms.length > 1) {
      // Multiroom prebook
      const prebookParams: MultiroomPrebookParams = {
        rooms: selectedRooms.map(room => ({
          book_hash: room.book_hash,
          guests: room.guests,
          residency: 'US', // From user input
          price_increase_percent: 20
        })),
        language: 'en'
      };
      
      const response = await bookingApi.prebook(prebookParams) as MultiroomPrebookResponse;
      
      // Handle partial failures
      if (response.data.failed && response.data.failed.length > 0) {
        // Show error modal for failed rooms
        setShowMultiroomErrorModal(true);
        return;
      }
      
      // Handle price changes
      const hasPriceChanges = response.data.rooms.some(r => r.price_changed);
      if (hasPriceChanges) {
        bookingStore.setPrebookResult(response);
        setShowPriceChangeModal(true);
        return;
      }
      
      // All successful, proceed to order form
      bookingStore.setPrebookResult(response);
      await handleOrderForm(response);
      
    } else {
      // Single room prebook (existing logic)
      // ... existing code
    }
  };
  
  // Order Form step
  const handleOrderForm = async (prebookResult: PrebookResponse | MultiroomPrebookResponse) => {
    const partnerOrderId = generatePartnerOrderId();
    bookingStore.setPartnerOrderId(partnerOrderId);
    
    if ('rooms' in prebookResult.data) {
      // Multiroom order form
      const orderFormParams = {
        prebooked_rooms: prebookResult.data.rooms.map(r => ({ 
          booking_hash: r.booking_hash 
        })),
        partner_order_id: partnerOrderId,
        language: 'en'
      };
      
      const response = await bookingApi.getOrderForm(orderFormParams) as MultiroomOrderFormResponse;
      
      // Handle partial failures
      if (response.data.failed && response.data.failed.length > 0) {
        // Show error for failed rooms
        toast.error(`${response.data.failed.length} room(s) failed to get order form`);
        return;
      }
      
      // Update booking store with order forms
      bookingStore.setOrderForms(response.data.rooms);
      
    } else {
      // Single room order form (existing logic)
      // ... existing code
    }
  };
  
  // Order Finish step
  const handleFinishOrder = async () => {
    const { selectedRooms, isMultiroom, partner_order_id, orderForms } = bookingStore;
    
    if (isMultiroom && orderForms && orderForms.length > 1) {
      // Multiroom finish
      const finishParams: MultiroomOrderFinishParams = {
        rooms: orderForms.map((form, index) => ({
          order_id: form.order_id,
          item_id: form.item_id,
          guests: selectedRooms[index]?.guests || [{ adults: 2, children: [] }]
        })),
        payment_type: selectedPaymentType, // From form
        partner_order_id: partner_order_id!,
        language: 'en',
        upsell_data: upsellData // If applicable
      };
      
      const response = await bookingApi.finishOrder(finishParams) as MultiroomOrderFinishResponse;
      
      // Handle results
      if (response.data.failed && response.data.failed.length > 0) {
        toast.error(`${response.data.failed.length} room(s) failed to complete booking`);
      }
      
      if (response.data.successful_rooms > 0) {
        // Start polling status for each successful room
        response.data.rooms.forEach(room => {
          startStatusPolling(room.order_id);
        });
      }
      
    } else {
      // Single room finish (existing logic)
      // ... existing code
    }
  };
  
  return (
    <div>
      {/* Render room selector for multiroom */}
      {isMultiroom && (
        <MultiroomRoomSelector
          selectedRooms={selectedRooms}
          onRoomsChange={(rooms) => bookingStore.setSelectedRooms(rooms)}
        />
      )}
      
      {/* Booking form */}
      {/* ... */}
    </div>
  );
};
```

---

## 6. Status Polling (Multiroom)

```typescript
const startStatusPolling = async (orderId: number) => {
  const pollInterval = setInterval(async () => {
    try {
      const status = await bookingApi.getOrderStatus(orderId);
      
      if (status.is_final) {
        clearInterval(pollInterval);
        
        if (status.is_success) {
          // Booking confirmed
          updateBookingStatus(orderId, 'confirmed');
        } else {
          // Booking failed
          updateBookingStatus(orderId, 'failed');
        }
      }
    } catch (error) {
      console.error('Status polling error:', error);
      clearInterval(pollInterval);
    }
  }, 2000); // Poll every 2 seconds
};

// For multiroom, poll all order IDs
const pollAllRoomStatuses = (orderIds: Array<number>) => {
  orderIds.forEach(orderId => startStatusPolling(orderId));
};
```

---

## 7. Error Handling

### Handle Partial Failures

```typescript
// When some rooms fail during prebook
if (prebookResponse.data.failed && prebookResponse.data.failed.length > 0) {
  const failedRoomIndices = prebookResponse.data.failed.map(r => r.roomIndex);
  
  // Option 1: Remove failed rooms and continue with successful ones
  const successfulRooms = prebookResponse.data.rooms;
  bookingStore.setSelectedRooms(successfulRooms);
  
  // Option 2: Show error modal and let user decide
  setShowPartialFailureModal({
    failedRooms: prebookResponse.data.failed,
    successfulRooms: successfulRooms.length,
    onContinue: () => {
      // Continue with successful rooms
      bookingStore.setSelectedRooms(successfulRooms);
    },
    onCancel: () => {
      // Cancel entire booking
      navigate('/hotel-details');
    }
  });
}
```

---

## 8. Testing Checklist

### Multiroom Prebook
- [ ] Select 2 different rooms with different rates
- [ ] Prebook both rooms → Both succeed
- [ ] Prebook with one unavailable room → Partial failure handled
- [ ] Prebook with price change → Modal shows per-room price changes
- [ ] Prebook with all rooms failing → Error message shown

### Multiroom Order Form
- [ ] Get order forms for 2 rooms → Both succeed
- [ ] Get order forms with one failure → Partial failure handled
- [ ] Verify same `partner_order_id` used for all rooms

### Multiroom Order Finish
- [ ] Finish booking for 2 rooms → Both succeed
- [ ] Finish with one failure → Partial failure handled
- [ ] Verify separate `order_id` for each room (or same if RateHawk links them)

### Status Polling
- [ ] Poll status for each room's `order_id`
- [ ] Handle different statuses per room (some confirmed, some processing)
- [ ] Show overall booking status (all confirmed, partial, all failed)

### Edge Cases
- [ ] Maximum 6 rooms enforced
- [ ] Children ages validated (0-17) per room
- [ ] Different payment types per room (if supported, otherwise same for all)
- [ ] Price changes displayed per room
- [ ] Cancel booking removes all rooms

---

## 9. Backend API Reference

### Prebook (Multiroom)
**Endpoint:** `POST /api/ratehawk/prebook`

**Request:**
```json
{
  "rooms": [
    {
      "book_hash": "h-...",
      "guests": [{ "adults": 2, "children": [{ "age": 5 }] }],
      "residency": "UZ",
      "price_increase_percent": 20
    },
    {
      "book_hash": "h-...",
      "guests": [{ "adults": 2, "children": [] }],
      "residency": "UZ",
      "price_increase_percent": 20
    }
  ],
  "language": "en"
}
```

**Response:**
```json
{
  "status": "ok",
  "success": true,
  "data": {
    "rooms": [
      {
        "roomIndex": 0,
        "booking_hash": "p-...",
        "price_changed": false,
        "new_price": 150.00,
        "currency": "USD"
      }
    ],
    "failed": [],
    "total_rooms": 2,
    "successful_rooms": 2,
    "failed_rooms": 0
  }
}
```

### Order Form (Multiroom)
**Endpoint:** `POST /api/ratehawk/order/form`

**Request:**
```json
{
  "prebooked_rooms": [
    { "booking_hash": "p-..." },
    { "booking_hash": "p-..." }
  ],
  "partner_order_id": "partner-uuid",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomIndex": 0,
        "order_id": 123456,
        "item_id": 789012,
        "booking_hash": "p-...",
        "payment_types": [...]
      }
    ],
    "total_rooms": 2,
    "successful_rooms": 2
  }
}
```

### Order Finish (Multiroom)
**Endpoint:** `POST /api/ratehawk/order/finish`

**Request:**
```json
{
  "rooms": [
    {
      "order_id": 123456,
      "item_id": 789012,
      "guests": [{ "adults": 2, "children": [{ "age": 5 }] }]
    },
    {
      "order_id": 123457,
      "item_id": 789013,
      "guests": [{ "adults": 2, "children": [] }]
    }
  ],
  "payment_type": "hotel",
  "partner_order_id": "partner-uuid",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomIndex": 0,
        "order_id": 123456,
        "status": "processing"
      }
    ],
    "partner_order_id": "partner-uuid",
    "order_ids": [123456, 123457],
    "total_rooms": 2,
    "successful_rooms": 2
  }
}
```

---

## 10. Important Notes

1. **Backward Compatibility**: All endpoints support both single-room (existing) and multiroom (new) formats. Existing single-room bookings continue to work.

2. **Partner Order ID**: Must be the same for all rooms in a multiroom booking. This links the rooms in RateHawk's system.

3. **Payment Type**: Currently, all rooms must use the same payment type. RateHawk API may not support different payment types per room.

4. **Price Changes**: Each room can have independent price changes during prebook. Display them per-room.

5. **Partial Failures**: Handle gracefully - some rooms may succeed while others fail. Allow users to continue with successful rooms or cancel entire booking.

6. **Status Polling**: Poll each room's `order_id` separately. Some rooms may confirm before others.

7. **Children Ages**: Must be specified for each room's guests (0-17 years). Validated on backend.

8. **Rate Limit**: Multiple prebooks/order forms may hit rate limits. Backend handles this, but frontend should show loading states.

---

## 11. Migration Path

1. **Phase 1**: Add type definitions and API service methods (keep existing single-room methods)
2. **Phase 2**: Add UI components (room selector, multiroom price modal)
3. **Phase 3**: Update booking flow to detect multiroom vs single-room
4. **Phase 4**: Add status polling for multiple rooms
5. **Phase 5**: Test with certification test case (2 rooms, different guests)
6. **Phase 6**: Deploy and monitor

---

## 12. Certification Test Case

**Requirements:**
- Room 1: 2 Adults + 1 Child (5 y.o)
- Room 2: 2 Adults
- Residency: "uz"

**Test Flow:**
1. Select 2 different rooms/rates
2. Configure guests per room (Room 1: 2 adults + 1 child age 5, Room 2: 2 adults)
3. Prebook both rooms
4. Handle price changes (if any)
5. Get order forms for both rooms
6. Fill booking form (same guest info for all rooms or per-room)
7. Finish booking
8. Poll status for both order IDs
9. Verify both bookings confirmed

---

**Last Updated:** 2026-01-10

