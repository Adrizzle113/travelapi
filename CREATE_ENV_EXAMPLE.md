# How to Create .env.example

Due to sandbox restrictions, please create `.env.example` manually using the template below:

## Steps

1. Create a new file named `.env.example` in the root directory
2. Copy the content below into the file
3. Commit it to git: `git add .env.example && git commit -m "Add .env.example template"`

## Template Content

```env
# ============================================
# Travel API - Environment Variables Template
# ============================================
# 
# IMPORTANT SECURITY NOTES:
# 1. NEVER commit the actual .env file to git
# 2. Copy this file to .env and fill in your actual values
# 3. Rotate all credentials if .env was ever committed to git
# 4. Use a SINGLE Supabase project for both backend and frontend
#
# ============================================

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ============================================
# ETG/RateHawk API Configuration
# ============================================
# Get these from your ETG partner dashboard
ETG_PARTNER_ID=your-partner-id
ETG_API_KEY=your-etg-api-key

# ============================================
# Supabase Configuration
# ============================================
# 
# ⚠️ BUG 2 FIX REQUIRED:
# Currently configured with TWO different Supabase projects:
# - Backend uses: vewsxruqjeoehsjtgqyh
# - Frontend uses: xnanegfehwsdulvjwyjd
#
# RECOMMENDATION: Use a SINGLE Supabase project for both
# to ensure data consistency and avoid authentication issues.
#
# If separation is intentional, document why in your project README.
# ============================================

# Backend Supabase Configuration (Database & Auth)
# Use the SAME project for both backend and frontend
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-supabase-service-role-key-or-anon-key

# Database Connection String (from Supabase Dashboard → Settings → Database)
# Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
DATABASE_URL=postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres

# Frontend Supabase Configuration (for Vite/React apps)
# ⚠️ Should use the SAME project as backend (see Bug 2 above)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# ============================================
# Optional Configuration
# ============================================

# API Base URL (for testing scripts)
API_BASE_URL=http://localhost:3001

# Enable Mock Bookings (for testing only - NEVER in production)
ENABLE_MOCK_BOOKINGS=false
```

## Verification

After creating the file, verify it's not ignored:

```bash
# Should return empty (meaning .env.example is NOT ignored, which is correct)
git check-ignore .env.example

# Should show .env.example as untracked
git status
```

