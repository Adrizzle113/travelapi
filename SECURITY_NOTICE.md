# Security Notice - Environment Variables

## IMPORTANT: `.env` File Management

The `.env` file contains sensitive credentials and **MUST NEVER** be committed to version control.

### What Was Fixed

1. ✅ **`.env` removed from git tracking** - The file has been removed from git history
2. ✅ **`.gitignore` updated** - `.env` is now properly ignored
3. ✅ **`.env.example` created** - Template file for setting up environment variables

### Required Actions

**If you have already pushed this repository with the `.env` file:**

1. **IMMEDIATELY ROTATE ALL CREDENTIALS**:
   - Change Supabase project keys (both projects)
   - Rotate database passwords
   - Regenerate ETG API keys
   - Update any other exposed credentials

2. **Remove from Git History** (if repository is public or shared):
   ```bash
   # Warning: This rewrites history - coordinate with team
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Or use BFG Repo-Cleaner (recommended)
   # bfg --delete-files .env
   ```

3. **Force push** (if you've already pushed):
   ```bash
   git push origin --force --all
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

### Supabase Project Configuration

**Current Configuration Issue:**
The `.env` file was configured with two different Supabase projects:
- **Backend**: `vewsxruqjeoehsjtgqyh` (SUPABASE_URL, SUPABASE_KEY, DATABASE_URL)
- **Frontend**: `xnanegfehwsdulvjwyjd` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

**Recommendation:**
- Use a **single Supabase project** for both backend and frontend to ensure data consistency
- If separation is required, document why and ensure proper configuration
- Update `.env.example` to reflect your chosen architecture

### Security Best Practices

- ✅ Never commit `.env` files
- ✅ Use `.env.example` as a template
- ✅ Rotate credentials regularly
- ✅ Use environment-specific files (`.env.development`, `.env.production`)
- ✅ Use secret management services for production (AWS Secrets Manager, etc.)
- ✅ Review `.gitignore` regularly to ensure sensitive files are excluded

