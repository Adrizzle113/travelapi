# Security Notice - Environment Variables

## ⚠️ CRITICAL SECURITY ISSUES IDENTIFIED AND FIXED

### Bug 1: `.env` File Committed to Repository ✅ FIXED

**Status:** The `.env` file was committed to git history in commit `1c26b2a` and earlier commits.

**What Was Fixed:**
1. ✅ **`.env` removed from git tracking** - The file is no longer tracked
2. ✅ **`.gitignore` verified** - `.env` is properly ignored (lines 8 and 54)
3. ✅ **`.env.example` created** - Template file for setting up environment variables

**VERIFICATION:**
- ✅ `.env` is currently ignored by git (`git check-ignore .env` confirms)
- ✅ `.env` file exists locally but is NOT tracked
- ⚠️ **`.env` still exists in git history** - See "Remove from Git History" below

### Required Actions - DO THESE IMMEDIATELY

**⚠️ The `.env` file was committed to git history. You MUST:**

#### Step 1: IMMEDIATELY ROTATE ALL CREDENTIALS

**URGENT:** If this repository is public or shared, rotate ALL credentials NOW:

1. **Supabase Project 1** (`vewsxruqjeoehsjtgqyh`):
   - Go to Supabase Dashboard → Project Settings → API
   - Regenerate `service_role` key (SUPABASE_KEY)
   - Regenerate `anon` key if used
   - Update database password (DATABASE_URL)

2. **Supabase Project 2** (`xnanegfehwsdulvjwyjd`):
   - Same steps as above
   - Regenerate `anon` key (VITE_SUPABASE_ANON_KEY)

3. **ETG API**:
   - Contact ETG support to regenerate API key
   - Update `ETG_API_KEY` in your `.env` file

4. **JWT Secret**:
   - Generate new JWT_SECRET
   - Invalidate all existing tokens

#### Step 2: Remove `.env` from Git History

**⚠️ WARNING:** This rewrites git history. Coordinate with your team first.

**Option A: Using git filter-branch (built-in)**
```bash
# Remove .env from all commits in history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to remote (WARNING: This rewrites history)
git push origin --force --all
```

**Option B: Using BFG Repo-Cleaner (recommended - faster)**
```bash
# Install BFG (one-time)
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Remove .env from history
bfg --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

**Option C: If repository is new/private and you can start fresh**
```bash
# Create new repository without history
rm -rf .git
git init
git add .
git commit -m "Initial commit (credentials removed)"
git remote add origin <new-repo-url>
git push -u origin main
```

#### Step 3: Verify `.env` is Not Tracked

```bash
# Should return ".env" (meaning it's ignored)
git check-ignore .env

# Should NOT show .env
git status

# Should return empty
git ls-files | grep "^\.env$"
```

### Setting Up Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual credentials in `.env`

3. Verify `.env` is ignored:
   ```bash
   git status
   # .env should NOT appear in untracked files
   ```

### Bug 2: Two Different Supabase Projects Configured ⚠️ REQUIRES FIX

**Status:** The `.env` file configures two different Supabase projects, which can cause:
- Data inconsistency (backend and frontend use different databases)
- Authentication failures (users can't access data created by backend)
- Confusion during debugging
- Increased maintenance overhead

**Current Configuration:**
- **Backend Project**: `vewsxruqjeoehsjtgqyh`
  - Used for: `SUPABASE_URL`, `SUPABASE_KEY`, `DATABASE_URL`
  - Purpose: Database connections, authentication, backend operations
  
- **Frontend Project**: `xnanegfehwsdulvjwyjd`
  - Used for: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Purpose: Frontend client-side operations

**Required Fix:**

**Option 1: Consolidate to Single Project (RECOMMENDED)**
```env
# Use the SAME Supabase project for both
SUPABASE_URL=https://vewsxruqjeoehsjtgqyh.supabase.co
SUPABASE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.vewsxruqjeoehsjtgqyh.supabase.co:5432/postgres

# Frontend uses same project
VITE_SUPABASE_URL=https://vewsxruqjeoehsjtgqyh.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-same-project
```

**Option 2: Keep Separate Projects (If Intentional)**
If you need separate projects for security/isolation reasons:
1. Document WHY in `README.md` or `ARCHITECTURE.md`
2. Ensure proper data synchronization if needed
3. Update `.env.example` with clear comments explaining the separation
4. Add validation to ensure frontend/backend use correct project IDs

**Migration Steps (if consolidating):**
1. Choose which project to keep (recommend keeping backend project)
2. Export data from the project you're abandoning (if needed)
3. Import data into the project you're keeping
4. Update all environment variables to point to single project
5. Test authentication and data access
6. Update deployment configurations (Render, Vercel, etc.)

### Security Best Practices

- ✅ Never commit `.env` files
- ✅ Use `.env.example` as a template
- ✅ Rotate credentials regularly
- ✅ Use environment-specific files (`.env.development`, `.env.production`)
- ✅ Use secret management services for production (AWS Secrets Manager, etc.)
- ✅ Review `.gitignore` regularly to ensure sensitive files are excluded

