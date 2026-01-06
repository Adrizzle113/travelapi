# Booking Status Webhook Handler

## Overview
The booking status webhook handler receives real-time updates from ETG (Emerging Travel Group) about booking status changes. This eliminates the need for polling the `checkBookingProcess` endpoint.

## Endpoint
```
POST /api/webhook/booking-status
```

## Configuration
To receive webhook notifications, you need to:
1. Configure your webhook URL with ETG support
2. Provide them with your public webhook URL: `https://yourdomain.com/api/webhook/booking-status`
3. Ensure the endpoint is publicly accessible over HTTPS

## Webhook Payload Structure

The webhook receives booking status updates with the following structure:

```json
{
  "order_id": 559350847,
  "partner_order_id": "partner-12345",
  "item_id": 128903852,
  "status": "ok",
  "booking_status": "confirmed",
  "error": null,
  "data": {
    // Additional booking data
  }
}
```

### Payload Fields

- `order_id` (number, optional): ETG order ID
- `partner_order_id` (string, optional): Your partner order ID
- `item_id` (number, optional): Booking item ID
- `status` (string): Booking status ("ok", "error", "processing", etc.)
- `booking_status` (string, optional): Alternative status field
- `error` (string, optional): Error message if booking failed
- `data` (object, optional): Additional booking information

## Status Values

The webhook handler processes the following status values:

### ✅ Success Statuses
- `"ok"` - Booking confirmed successfully
- `"confirmed"` - Booking is confirmed
- `"completed"` - Booking process completed

### ⏳ Processing Statuses
- `"processing"` - Booking is still being processed

### ❌ Error Statuses
- `"error"` - Booking encountered an error
- `"failed"` - Booking failed
- `"rejected"` - Booking was rejected

### 🚫 Cancellation Statuses
- `"cancelled"` - Booking was cancelled

## Response

The webhook handler always returns HTTP 200 to acknowledge receipt, even if processing fails. This prevents ETG from retrying the webhook unnecessarily.

**Success Response:**
```json
{
  "success": true,
  "message": "Webhook received and processed",
  "order_id": 559350847,
  "partner_order_id": "partner-12345",
  "status": "ok",
  "timestamp": "2026-01-06T17:10:00.000Z",
  "duration": "5ms"
}
```

**Error Response (still 200):**
```json
{
  "success": false,
  "error": "Webhook received but processing failed",
  "error_message": "Error details",
  "timestamp": "2026-01-06T17:10:00.000Z",
  "duration": "3ms"
}
```

## Implementation Details

### Current Behavior
- ✅ Receives and logs webhook payloads
- ✅ Validates required fields (order_id or partner_order_id)
- ✅ Processes different booking statuses
- ✅ Returns 200 status to acknowledge receipt
- ✅ Logs all webhook events for debugging

### TODO: Extend Functionality
The handler includes TODO comments for additional functionality:

1. **Database Storage**: Store booking status updates in your database
2. **Email Notifications**: Send confirmation/cancellation emails to users
3. **Refund Processing**: Handle refunds for failed/cancelled bookings
4. **Status Updates**: Update booking records in your system

## Example Usage

### Testing with curl
```bash
curl -X POST http://localhost:3001/api/webhook/booking-status \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 559350847,
    "partner_order_id": "partner-12345",
    "status": "ok",
    "item_id": 128903852
  }'
```

### Production Setup
1. Deploy your server with a public HTTPS URL
2. Contact ETG support to register your webhook URL
3. Provide them with: `https://yourdomain.com/api/webhook/booking-status`
4. Test with a real booking to verify webhook delivery

## Security Considerations

### Current Implementation
- Basic validation of required fields
- Logging of all webhook payloads
- Error handling to prevent crashes

### Recommended Enhancements
1. **Webhook Signature Verification**: Verify webhook signatures from ETG
2. **IP Whitelisting**: Only accept webhooks from ETG IP addresses
3. **Rate Limiting**: Prevent webhook spam
4. **Idempotency**: Handle duplicate webhook deliveries

## Logging

The webhook handler logs:
- Webhook receipt timestamp
- Full payload (for debugging)
- Request headers
- Order IDs and status
- Processing duration
- Any errors encountered

Check your server logs for webhook activity:
```
🔔 === BOOKING STATUS WEBHOOK RECEIVED ===
📥 Webhook payload: {...}
📋 Order ID: 559350847
📊 Status: ok
✅ Webhook processed in 5ms
```

## Integration with Booking Flow

The webhook complements the booking process:

```
1. createBookingForm() → Creates booking
2. createCreditCardToken() → (If needed) Creates payment token
3. startBookingProcess() → Starts booking
4. [Webhook] → Receives status update (instead of polling)
```

Instead of polling `checkBookingProcess()`, you can wait for the webhook notification.

## Troubleshooting

### Webhook Not Received
1. Verify webhook URL is registered with ETG
2. Check that your server is publicly accessible
3. Ensure HTTPS is enabled (required for production)
4. Check server logs for incoming requests

### Webhook Processing Errors
- Check server logs for error details
- Verify payload structure matches expected format
- Ensure all required fields are present

### Testing Locally
Use tools like [ngrok](https://ngrok.com/) to expose your local server:
```bash
ngrok http 3001
# Use the ngrok URL as your webhook endpoint
```

