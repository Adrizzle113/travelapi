-- Fix Hotel Reviews RLS Policy
-- This migration adds a public read policy for hotel_reviews table
-- Run this in Supabase SQL Editor or as a migration

-- Option 1: Add public read policy (Recommended for production)
CREATE POLICY IF NOT EXISTS "Allow public read access to reviews"
ON hotel_reviews
FOR SELECT
TO anon
USING (true);

-- Option 2: Disable RLS (Only for development - NOT recommended for production)
-- Uncomment the line below if you want to disable RLS entirely
-- ALTER TABLE hotel_reviews DISABLE ROW LEVEL SECURITY;

-- Note: If RLS is already disabled, the policy creation will still work
-- but won't be enforced. To re-enable RLS later, run:
-- ALTER TABLE hotel_reviews ENABLE ROW LEVEL SECURITY;

