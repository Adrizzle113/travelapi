/*
  # Add Autocomplete Cache Table

  1. New Tables
    - `autocomplete_cache`
      - `id` (uuid, primary key)
      - `query_key` (text, unique) - Combination of query + locale for cache lookup
      - `query` (text) - Original search query
      - `locale` (text) - Language code (default: en)
      - `results` (jsonb) - Normalized autocomplete results array
      - `cached_at` (timestamp) - When cached
      - `expires_at` (timestamp) - When cache expires (TTL: 24 hours)

  2. Indexes
    - Primary index on `query_key` for fast lookup
    - Index on `expires_at` for efficient cleanup of expired entries

  3. Purpose
    - Cache RateHawk autocomplete API responses
    - Reduce external API calls and improve response time
    - 24-hour TTL ensures data stays reasonably fresh
*/

CREATE TABLE IF NOT EXISTS autocomplete_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_key varchar(300) UNIQUE NOT NULL,
  query varchar(255) NOT NULL,
  locale varchar(10) DEFAULT 'en' NOT NULL,
  results jsonb NOT NULL,
  cached_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_autocomplete_query ON autocomplete_cache(query_key);
CREATE INDEX IF NOT EXISTS idx_autocomplete_expires ON autocomplete_cache(expires_at);

ALTER TABLE autocomplete_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to autocomplete cache"
  ON autocomplete_cache
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role to manage autocomplete cache"
  ON autocomplete_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);