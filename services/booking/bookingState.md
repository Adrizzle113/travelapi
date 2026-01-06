# Booking State Management

## Current Implementation

The booking service is currently stateless - it proxies requests directly to the RateHawk API without storing booking state in the database.

## Future Database Enhancements (Optional)

If you need to track booking state for status polling, debugging, or audit trails, consider adding the following to your Prisma schema:

```prisma
model Booking {
  id                String   @id @default(uuid()) @db.Uuid
  user_id           String?  @db.Uuid
  book_hash         String   @db.VarChar(255)
  booking_hash      String?  @db.VarChar(255)
  order_id          String?  @db.VarChar(255)
  partner_order_id  String   @db.VarChar(255)
  
  hotel_id          String?  @db.VarChar(255)
  checkin           DateTime? @db.Timestamp(6)
  checkout          DateTime? @db.Timestamp(6)
  
  status            String   @default("pending") @db.VarChar(50)
  payment_type      String?  @db.VarChar(50)
  
  guests            Json?    @db.JsonB
  booking_data      Json?    @db.JsonB
  
  created_at        DateTime @default(now()) @db.Timestamp(6)
  updated_at        DateTime @updatedAt @db.Timestamp(6)
  completed_at      DateTime? @db.Timestamp(6)
  
  @@index([user_id], name: "idx_booking_user")
  @@index([booking_hash], name: "idx_booking_hash")
  @@index([order_id], name: "idx_booking_order_id")
  @@index([status], name: "idx_booking_status")
  @@map("bookings")
}
```

## Benefits of Storing Booking State

1. **Status Polling**: Store booking_hash and order_id to enable status polling without re-requesting
2. **Audit Trail**: Track all booking attempts for debugging and compliance
3. **User History**: Allow users to view their booking history
4. **Error Recovery**: Retry failed bookings or recover from network issues
5. **Analytics**: Track booking success rates, common errors, etc.

## Implementation Notes

- The current stateless approach is simpler and works well for most use cases
- Only add database storage if you need the features listed above
- Consider rate limits and storage costs when storing booking data

