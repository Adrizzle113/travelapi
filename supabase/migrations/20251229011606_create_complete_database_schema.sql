/*
  # Create Complete Database Schema

  ## Overview
  This migration creates the complete database schema for the travel booking API,
  consolidating all tables and ensuring proper relationships and security.

  ## Tables Created
  
  ### 1. Users Table
  The main user account table with authentication and profile information:
    - `id` (uuid, primary key) - Unique user identifier
    - `email` (varchar 255, unique) - User's email address
    - `password` (text) - Hashed password for authentication
    - `first_name` (varchar 100) - User's first name
    - `last_name` (varchar 100) - User's last name
    - `phone_number` (varchar 20) - Contact phone number
    - `agency_name` (varchar 255) - Travel agency name
    - `legal_name` (varchar 255) - Legal business name
    - `city` (varchar 100) - City location
    - `address` (text) - Full address
    - `actual_address_matches` (boolean) - Whether address matches legal address
    - `itn` (varchar 100) - Tax identification number
    - `logo_url` (text) - URL to uploaded logo
    - `dummy_email` (varchar 255) - Temporary internal email
    - `otp` (varchar 10) - One-time password for verification
    - `email_verification` (varchar 20) - Verification status
    - `status` (varchar 20) - Account status (pending/approved/rejected/active)
    - `last_login` (timestamp) - Last successful login
    - `ratehawk_email` (varchar 255) - Associated RateHawk account
    - `created_at` (timestamp) - Account creation time
  
  ### 2. Auth Logs Table
  Tracks all authentication attempts for security and debugging:
    - `id` (uuid, primary key) - Unique log entry identifier
    - `user_id` (uuid, foreign key) - References users table
    - `email` (varchar 255) - Email used in attempt
    - `success` (boolean) - Whether authentication succeeded
    - `error_message` (text) - Error details if failed
    - `duration` (integer) - Time taken in milliseconds
    - `session_id` (varchar 255) - Session identifier
    - `final_url` (text) - Final URL after authentication
    - `timestamp` (timestamp) - When attempt occurred
  
  ### 3. Cache Tables (if not exist)
  These tables are created if they don't already exist:
    - `destination_cache` - Caches destination lookup results
    - `hotel_static_cache` - Caches hotel static information
    - `search_cache` - Caches search results
  
  ## Security Configuration
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with restrictive policies:
  
  **Users Table:**
    - Users can view their own profile
    - Users can update their own profile
    - Service role can manage all users
  
  **Auth Logs Table:**
    - Users can view their own auth logs
    - Users can insert their own auth logs
    - No user can modify or delete logs
  
  ## Indexes
  Performance indexes are created on frequently queried columns:
    - `idx_users_email` - Fast email lookups
    - `idx_auth_logs_user` - Fast user auth log queries
    - `idx_auth_logs_timestamp` - Time-based log queries
  
  ## Important Notes
  
  1. All tables use UUID v4 for primary keys
  2. Foreign keys have CASCADE delete for data integrity
  3. Default values are set for status and verification fields
  4. Passwords must be hashed before storage (use bcrypt)
  5. RLS policies ensure users can only access their own data
*/

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  agency_name VARCHAR(255),
  legal_name VARCHAR(255),
  city VARCHAR(100),
  address TEXT,
  actual_address_matches BOOLEAN DEFAULT true,
  itn VARCHAR(100),
  logo_url TEXT,
  dummy_email VARCHAR(255),
  otp VARCHAR(10),
  email_verification VARCHAR(20) DEFAULT 'unverified',
  status VARCHAR(20) DEFAULT 'pending',
  last_login TIMESTAMP,
  ratehawk_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create auth_logs table
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration INTEGER,
  session_id VARCHAR(255),
  final_url TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_auth_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for auth_logs
CREATE INDEX IF NOT EXISTS idx_auth_logs_user ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp);

-- Create destination_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS destination_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_name VARCHAR(255) NOT NULL UNIQUE,
  region_id INTEGER NOT NULL,
  region_name VARCHAR(255),
  last_verified TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destination_name ON destination_cache(destination_name);

-- Create hotel_static_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS hotel_static_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id VARCHAR(255) NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  name VARCHAR(500),
  address TEXT,
  city VARCHAR(255),
  country VARCHAR(100),
  star_rating SMALLINT,
  images JSONB,
  amenities JSONB,
  description TEXT,
  coordinates JSONB,
  raw_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(hotel_id, language)
);

CREATE INDEX IF NOT EXISTS idx_hotel_id ON hotel_static_cache(hotel_id);
CREATE INDEX IF NOT EXISTS idx_expires_at ON hotel_static_cache(expires_at);

-- Create search_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS search_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_signature VARCHAR(64) NOT NULL UNIQUE,
  search_params JSONB NOT NULL,
  region_id INTEGER NOT NULL,
  total_hotels INTEGER NOT NULL,
  hotel_ids TEXT[] NOT NULL,
  rates_index JSONB NOT NULL,
  etg_search_id VARCHAR(255),
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_search_signature ON search_cache(search_signature);
CREATE INDEX IF NOT EXISTS idx_search_expires_at ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_search_region ON search_cache(region_id);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on auth_logs table
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on cache tables
ALTER TABLE destination_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_static_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Service role can manage all users" ON users;

DROP POLICY IF EXISTS "Users can view their own auth logs" ON auth_logs;
DROP POLICY IF EXISTS "Users can insert their own auth logs" ON auth_logs;

DROP POLICY IF EXISTS "Anyone can read destination cache" ON destination_cache;
DROP POLICY IF EXISTS "Service role can manage destination cache" ON destination_cache;

DROP POLICY IF EXISTS "Anyone can read hotel cache" ON hotel_static_cache;
DROP POLICY IF EXISTS "Service role can manage hotel cache" ON hotel_static_cache;

DROP POLICY IF EXISTS "Anyone can read search cache" ON search_cache;
DROP POLICY IF EXISTS "Service role can manage search cache" ON search_cache;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id::text = auth.uid()::text);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id::text = auth.uid()::text)
  WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "Service role can manage all users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for auth_logs table
CREATE POLICY "Users can view their own auth logs"
  ON auth_logs FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert their own auth logs"
  ON auth_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

-- Create RLS policies for cache tables (public read, service role write)
CREATE POLICY "Anyone can read destination cache"
  ON destination_cache FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage destination cache"
  ON destination_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read hotel cache"
  ON hotel_static_cache FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage hotel cache"
  ON hotel_static_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read search cache"
  ON search_cache FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role can manage search cache"
  ON search_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);