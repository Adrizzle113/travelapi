/*
  # Fix RLS Policies for search_cache Table

  This migration fixes permission issues with the search_cache table by:
  1. Dropping existing policies that may be causing conflicts
  2. Creating more permissive read policy using TO public (includes all roles)
  3. Ensuring service_role has full access for all operations

  This addresses 403 errors when edge functions try to access search_cache.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read search cache" ON search_cache;
DROP POLICY IF EXISTS "Service role can manage search cache" ON search_cache;

-- Create more permissive read policy (public includes anon, authenticated, and service_role)
CREATE POLICY "Public read access to search cache"
  ON search_cache FOR SELECT
  TO public
  USING (true);

-- Service role full access for all operations (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Service role full access to search cache"
  ON search_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

