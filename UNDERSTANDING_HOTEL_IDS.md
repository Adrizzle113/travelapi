# Understanding Hotel IDs in RateHawk

## The Core Concept

RateHawk hotel IDs are **NOT** human-readable names. They are **system-generated alphanumeric identifiers**.

### ❌ These are NOT valid hotel IDs:
```
"caesars_palace"
"hilton_miami"
"marriott_downtown"
"hotel_california"
```

### ✅ These ARE valid hotel IDs:
```
"lH7Y9"
"kX3mP"
"x9Bm2"
"qR4nT"
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. USER SEARCHES FOR "LAS VEGAS"                      │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  2. API SEARCHES BY REGION_ID: 4898                    │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  3. API RETURNS HOTELS WITH REAL IDS                   │
│                                                         │
│     ┌─────────────────────────────────┐                │
│     │ Hotel 1:                         │                │
│     │   id: "lH7Y9"                   │                │
│     │   name: "Bellagio"              │                │
│     │   price: $299                    │                │
│     └─────────────────────────────────┘                │
│                                                         │
│     ┌─────────────────────────────────┐                │
│     │ Hotel 2:                         │                │
│     │   id: "kX3mP"                   │                │
│     │   name: "Caesars Palace"        │                │
│     │   price: $249                    │                │
│     └─────────────────────────────────┘                │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  4. USER CLICKS ON "CAESARS PALACE"                    │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  5. FRONTEND SENDS: hotelId = "kX3mP"                  │
│     (NOT "caesars_palace")                              │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  6. API FETCHES DETAILS FOR "kX3mP"                    │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  7. RETURN FULL HOTEL INFO + RATES                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Real Example

### ❌ WRONG Approach (What You Tried)
```javascript
// This will fail with 404!
fetch('/api/ratehawk/hotel/details', {
  method: 'POST',
  body: JSON.stringify({
    hotelId: 'caesars_palace',  // ❌ Fake ID!
    checkin: '2025-01-15',
    checkout: '2025-01-17'
  })
});
```

### ✅ CORRECT Approach

**Step 1: Search**
```javascript
// Search for hotels in Las Vegas
const searchResponse = await fetch('/api/ratehawk/search', {
  method: 'POST',
  body: JSON.stringify({
    region_id: '4898',  // Las Vegas
    checkin: '2025-01-15',
    checkout: '2025-01-17',
    guests: [{adults: 2, children: []}]
  })
});

const searchData = await searchResponse.json();
console.log(searchData.hotels);
// [
//   {id: "lH7Y9", name: "Bellagio"},
//   {id: "kX3mP", name: "Caesars Palace"},
//   {id: "x9Bm2", name: "MGM Grand"}
// ]
```

**Step 2: Get Details**
```javascript
// Use REAL hotel ID from search results
const hotel = searchData.hotels[1]; // Caesars Palace

const detailsResponse = await fetch('/api/ratehawk/hotel/details', {
  method: 'POST',
  body: JSON.stringify({
    hotelId: hotel.id,  // ✅ "kX3mP" - Real ID!
    checkin: '2025-01-15',
    checkout: '2025-01-17',
    guests: [{adults: 2, children: []}]
  })
});

const details = await detailsResponse.json();
// Full hotel info with rates, images, amenities, etc.
```

---

## Why This Design?

1. **Hotels have multiple listings** - Same hotel might have different IDs for different suppliers
2. **IDs change** - Hotel names stay the same, but system IDs can change
3. **Uniqueness** - Two hotels can have similar names, but IDs are always unique
4. **Efficiency** - Short alphanumeric IDs are faster to process than long names
5. **Availability** - Search results only show hotels with current availability

---

## Frontend State Management

Your frontend should:

1. **Store search results** with their hotel IDs
2. **Pass hotel ID** when user selects a hotel
3. **Never create** or guess hotel IDs

```javascript
// Example React state
const [hotels, setHotels] = useState([]);
const [selectedHotel, setSelectedHotel] = useState(null);

// After search
const searchResults = await searchHotels('4898', checkin, checkout);
setHotels(searchResults.hotels);  // Store with IDs

// When user clicks
const handleHotelClick = (hotel) => {
  setSelectedHotel(hotel);  // hotel.id is the REAL ID
  fetchHotelDetails(hotel.id);  // Use REAL ID
};
```

---

## Common Mistakes

### Mistake 1: Using Hotel Names as IDs
```javascript
// ❌ WRONG
fetch(`/api/hotel/${encodeURIComponent("Caesars Palace")}`);
```

### Mistake 2: Creating Fake IDs
```javascript
// ❌ WRONG
const fakeId = hotelName.toLowerCase().replace(/\s+/g, '_');
fetch(`/api/hotel/${fakeId}`);
```

### Mistake 3: Hardcoding IDs
```javascript
// ❌ WRONG (IDs can change!)
const CAESARS_PALACE_ID = "caesars_palace";
```

### ✅ CORRECT: Always Use Search Results
```javascript
// ✅ CORRECT
const searchResults = await searchHotels(regionId, dates);
const hotelId = searchResults.hotels[0].id;  // From API
const details = await getHotelDetails(hotelId);
```

---

## Summary

**Golden Rule:** 
> Never create or guess hotel IDs. Always get them from search results.

**Remember:**
- Hotel names = Human-readable (for display)
- Hotel IDs = System identifiers (for API calls)
- Always: Search → Get IDs → Use IDs → Get Details
