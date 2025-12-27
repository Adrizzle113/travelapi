# Render Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Variables (CRITICAL)
Set these in Render Dashboard → Environment:

```
DATABASE_URL=<your-supabase-postgres-url>
ETG_API_KEY=<your-etg-api-key>
ETG_PARTNER_ID=11606
NODE_ENV=production
```

**How to get DATABASE_URL from Supabase:**
1. Go to Supabase Dashboard → Project Settings → Database
2. Copy the connection string (starts with `postgresql://`)
3. Make sure it includes the password

### 2. Build Configuration
- **Build Command**: `npm install && npx prisma generate`
- **Start Command**: `npm start`
- **Node Version**: 18.x or higher

### 3. Health Check Path (Optional but Recommended)
- Set to: `/api/health`
- This enables Render's built-in health monitoring

## Post-Deployment Verification

### Step 1: Wait for Deployment
Monitor the deployment logs for:
```
✅ Database connected successfully
✅ Database tables accessible: X tables found
🚀 Travel API Server Started
```

### Step 2: Test Health Endpoint
```bash
curl https://your-app.onrender.com/api/health
```

Expected response (status 200):
```json
{
  "status": "healthy",
  "database": {
    "status": "connected"
  }
}
```

If you get status 503, check the database connection.

### Step 3: Test Diagnostics
```bash
curl https://your-app.onrender.com/api/diagnostics
```

Check:
- All tests show "passed"
- Database tables are listed
- UUID extension is enabled
- Environment variables are set

### Step 4: Test Basic Endpoints

**Test endpoint:**
```bash
curl https://your-app.onrender.com/api/test
```

**Destination autocomplete:**
```bash
curl https://your-app.onrender.com/api/destinations/autocomplete?query=london
```

**Search (replace with actual region_id):**
```bash
curl -X POST https://your-app.onrender.com/api/ratehawk/search \
  -H "Content-Type: application/json" \
  -d '{
    "region_id": 6775,
    "checkin": "2025-02-01",
    "checkout": "2025-02-05",
    "guests": [{"adults": 2, "children": []}]
  }'
```

## Troubleshooting Guide

### Issue: Service Won't Start

**Check Render Logs for:**
1. `DATABASE_URL` not set → Add environment variable
2. Database connection failed → Verify DATABASE_URL is correct
3. Module not found → Check build command includes `npx prisma generate`

### Issue: 503 Errors After Deployment

**Diagnosis Steps:**

1. **Check Memory Usage:**
   ```bash
   curl https://your-app.onrender.com/api/diagnostics/memory
   ```
   - If heapUsed > 400MB → Memory pressure (see solution below)
   - If heapUsed < 400MB → Continue to step 2

2. **Check Database:**
   ```bash
   curl https://your-app.onrender.com/api/health
   ```
   - If database.status = "disconnected" → Fix DATABASE_URL
   - If database.status = "connected" → Continue to step 3

3. **Check Request Logs:**
   ```bash
   curl https://your-app.onrender.com/api/diagnostics/requests
   ```
   - Look at recent errors
   - Check for timeout errors

**Common Solutions:**

**Memory Pressure (heapUsed > 400MB):**
- Restart the service in Render dashboard
- Consider upgrading from free tier (512MB) to paid tier (2GB+)
- The service will auto-restart if it crashes

**Database Connection Issues:**
- Verify DATABASE_URL includes password
- Check Supabase isn't paused (free tier pauses after inactivity)
- Ensure Supabase database is in same region as Render for best performance

**Timeout Errors:**
- ETG API can be slow for large searches (25s timeout set)
- This is normal behavior, not a bug
- Frontend should show loading state
- Consider implementing retry logic in frontend

### Issue: Memory Keeps Growing

Monitor with:
```bash
# Before search
curl https://your-app.onrender.com/api/diagnostics/memory

# After search (wait 30 seconds)
curl https://your-app.onrender.com/api/diagnostics/memory
```

**Normal behavior:**
- First few searches: Memory increases as cache builds (up to ~200MB)
- Subsequent searches: Memory stable or slight increase

**Abnormal behavior:**
- Memory increases >50MB per search → Possible memory leak
- Memory reaches >450MB → Service will crash
- **Solution**: Restart service, monitor again

### Issue: Cold Starts (Free Tier)

Render's free tier spins down after 15 minutes of inactivity.

**Symptoms:**
- First request after inactivity takes 30-60 seconds
- Subsequent requests are fast

**Solutions:**
- Upgrade to paid tier to prevent spin-down
- Implement a cron job to ping the service every 10 minutes
- Accept this as normal free-tier behavior

## Monitoring Best Practices

### Regular Health Checks
Set up a monitoring service (e.g., UptimeRobot, Better Uptime) to:
- Ping `/api/health` every 5 minutes
- Alert if response is not 200
- Alert if response time > 5 seconds

### Memory Monitoring
Check memory usage periodically:
```bash
watch -n 10 'curl -s https://your-app.onrender.com/api/diagnostics/memory'
```

### Log Review
Review Render logs daily for:
- ⚠️ WARNING: Memory pressure warnings
- 🚨 CRITICAL: Memory at critical levels
- ❌ Server errors
- ⏱️ SLOW REQUEST: Requests taking >5 seconds

## Performance Expectations

### Free Tier (512MB RAM)
- **Light load**: 10-20 concurrent users
- **Search performance**: 2-5 seconds per search
- **Cold start**: 30-60 seconds
- **Memory usage**: 150-300MB under normal load

### Paid Tier (2GB+ RAM)
- **Medium load**: 50-100 concurrent users
- **Search performance**: 1-3 seconds per search
- **No cold starts**: Always running
- **Memory usage**: 200-500MB under normal load

## Upgrade Recommendations

Consider upgrading from free tier if:
1. Memory warnings appear frequently (>400MB)
2. Service crashes due to OOM (Out of Memory)
3. Cold start delays are unacceptable
4. You need >10 concurrent users
5. You need 99.9% uptime

**Recommended Paid Plan:**
- **Starter**: $7/month, 512MB RAM (same as free but no spin-down)
- **Standard**: $25/month, 2GB RAM (recommended for production)

## Support Resources

**If issues persist:**
1. Check Render Status: https://status.render.com
2. Review Render Logs (last 100 lines)
3. Export diagnostics: `/api/diagnostics` and `/api/diagnostics/requests`
4. Check Supabase status: https://status.supabase.com

**Documentation:**
- `/DIAGNOSTIC_GUIDE.md` - Detailed diagnostic information
- `/IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- Render Docs: https://render.com/docs
