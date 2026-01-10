# Language Localization - Known Limitations

## Summary

The language parameter is **correctly forwarded** from frontend to backend to RateHawk API. However, RateHawk API has **different localization support** for different content types.

## ✅ What IS Localized by RateHawk

When `language` parameter is sent (e.g., `"language": "pt"`), the following content IS returned in the requested language:

1. **Hotel Descriptions** - ✅ Localized
   - From `/hotel/info/` (static info endpoint)
   - Example: "Passe a noite na agradável atmosfera do bar..."

2. **Amenities** - ✅ Localized
   - From `/hotel/info/` (static info endpoint)
   - Example: "Caixa eletrônico", "Ar-condicionado", "Recepção 24 horas"

3. **Policies** - ✅ Localized
   - From `/hotel/info/` (static info endpoint)
   - Example: "Refeições", "Crianças e informação sobre camas extra"

4. **Cancellation Policies** - ✅ Localized
   - From rates/details endpoints
   - Cancellation penalty descriptions

## ❌ What is NOT Localized by RateHawk

**Room Names from Rates API** - ❌ NOT Localized

- Room names come from `/search/hp/` (hotel page/rates endpoint)
- **RateHawk API limitation:** Room type names are returned in English regardless of language parameter
- Example: "Superior Double room (full double bed)" remains in English even when `language: "pt"` is sent

**Why:** RateHawk's rates API doesn't translate room type names - they are standardized English names used across all suppliers.

## Backend Implementation

### Current Status

**File:** `routes/ratehawk/details.js`

**Before (Hardcoded):**
```javascript
language: "en",  // ❌ Hardcoded to English
```

**After (Fixed):**
```javascript
const { hotelId, searchContext, residency, currency, language, upsells, timeout, matchHash } = req.body;
// ...
language: requestLanguage,  // ✅ Extracted from request body (defaults to "en")
```

**File:** `services/worldotaService.js`

The `getHotelPage()` method correctly forwards the language parameter to RateHawk API:
```javascript
const requestData = {
  checkin,
  checkout,
  residency: normalizedResidency,
  language,  // ✅ Forwarded to RateHawk API
  guests,
  // ...
};
```

## Request Flow

```
Frontend Request:
{
  "hotelId": "...",
  "language": "pt",  // ✅ Sent by frontend
  // ...
}

Backend (routes/ratehawk/details.js):
- Extracts: const { language } = req.body;  // ✅ Now extracts from request
- Forwards: language: requestLanguage || "en"  // ✅ Defaults to "en" if not provided

Service (services/worldotaService.js):
- getHotelPage({ language: "pt", ... })  // ✅ Receives and forwards

RateHawk API Request:
{
  "language": "pt",  // ✅ Sent to RateHawk
  // ...
}
```

## RateHawk API Response

### Static Info Endpoint (`/hotel/info/`)
```json
{
  "description_struct": {
    "main": "Passe a noite na agradável atmosfera..."  // ✅ Portuguese
  },
  "amenity_groups": [
    {
      "name": "Caixa eletrônico"  // ✅ Portuguese
    }
  ]
}
```

### Rates Endpoint (`/search/hp/`)
```json
{
  "rates": [
    {
      "room_name": "Superior Double room (full double bed)",  // ❌ English (RateHawk limitation)
      "meal": "nomeal",  // ❌ English (RateHawk limitation)
      "payment_options": {
        "payment_types": [{
          "cancellation_penalties": {
            "policies": [
              {
                "description": "Cancelamento gratuito até..."  // ✅ Portuguese (if available)
              }
            ]
          }
        }]
      }
    }
  ]
}
```

## Frontend Expectations

The frontend should:

1. ✅ **Display localized static content** (descriptions, amenities, policies) - This works correctly
2. ✅ **Display English room names** - Accept that RateHawk doesn't localize room names
3. ⚠️ **Optionally translate room names client-side** - If needed, implement custom translation mapping

## Workaround (Optional)

If room name localization is critical, the frontend can:

1. **Maintain translation mapping:**
   ```javascript
   const roomNameTranslations = {
     "pt": {
       "Superior Double room (full double bed)": "Quarto Duplo Superior (cama de casal completa)",
       "Standard Double room": "Quarto Duplo Padrão",
       // ...
     }
   };
   ```

2. **Translate client-side:**
   ```javascript
   const translatedRoomName = roomNameTranslations[language]?.[roomName] || roomName;
   ```

**Note:** This is a maintenance burden as new room types appear. It's generally better to accept English room names with a note explaining this is a supplier limitation.

## Testing

### Verify Language Parameter is Forwarded

**Check Backend Logs:**
```
🌐 Language: pt  // ✅ Should show the language from request
```

**Check RateHawk API Request:**
```javascript
// In services/worldotaService.js debug logs
requestData: {
  "language": "pt",  // ✅ Should match request
  // ...
}
```

### Verify Localization Works

1. **Static Content:**
   - Request with `language: "pt"`
   - Check `/api/ratehawk/hotel/static-info` response
   - ✅ Descriptions, amenities, policies should be in Portuguese

2. **Rates Content:**
   - Request with `language: "pt"`
   - Check `/api/ratehawk/hotel/details` response
   - ❌ Room names will be in English (expected behavior)
   - ✅ Cancellation policies may be in Portuguese (if RateHawk provides)

## Summary

| Content Type | Localized? | Endpoint | Notes |
|--------------|------------|----------|-------|
| Hotel Descriptions | ✅ Yes | `/hotel/info/` | Fully localized |
| Amenities | ✅ Yes | `/hotel/info/` | Fully localized |
| Policies | ✅ Yes | `/hotel/info/` | Fully localized |
| Room Names | ❌ No | `/search/hp/` | **RateHawk limitation** |
| Meal Types | ❌ No | `/search/hp/` | **RateHawk limitation** |
| Cancellation Policies | ⚠️ Partial | `/search/hp/` | May be localized if available |

## Conclusion

**The backend is now correctly forwarding the language parameter.** However, **room names from the rates API will remain in English** due to RateHawk API limitations. This is expected behavior and not a bug in our implementation.

**Action Required:** None - this is working as designed. Frontend should be aware that room names are not localized and display them in English.

