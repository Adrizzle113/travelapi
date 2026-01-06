# Diagnostic and Monitoring Guide

## Overview

This guide explains the diagnostic improvements added to help identify and fix deployment issues on Render.

## Changes Made

### 1. Memory Optimization
- **Reduced heap size** from 2048MB to 450MB (compatible with Render's 512MB free tier)
- **Reduced body size limit** from 50MB to 10MB to conserve memory
- **Removed SQLite** dependency to eliminate file-based database overhead

### 2. Enhanced Health Checks

#### Basic Health Check
```
GET /api/health
```

Returns:
- Server status
- Database connectivity test (actual connection check)
- Memory usage in MB
- Uptime
- Response time

Example response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "memory": {
    "heapUsed": 120,
    "heapTotal": 200,
    "rss": 250,
    "external": 10,
    "arrayBuffers": 5
  },
  "database": {
    "status": "connected",
    "responseTime": 45
  },
  "responseTime": 50
}
```

#### Detailed Diagnostics
```
GET /api/diagnostics
```

Returns:
- Full system information
- Database connection test
- Table verification
- UUID extension check
- Environment variable validation

### 3. Request Monitoring

Every request is now tracked with:
- Unique request ID
- Memory usage before/after
- Response time
- Status code
- Memory delta

Console output format:
```
📨 [request-id] POST /api/search - Memory: 120MB heap / 250MB RSS
✅ [request-id] POST /api/search - 200 - 1500ms - ➡️ Memory: 122MB (+2MB)
```

Indicators:
- ✅ Success (2xx)
- ⚠️ Client error (4xx)
- ❌ Server error (5xx)
- 📈 Memory increased >10MB
- 📉 Memory decreased >10MB
- ➡️ Memory stable

### 4. Memory Pressure Warnings

Automatic warnings when memory usage exceeds thresholds:
- **400MB**: ⚠️ WARNING
- **480MB**: 🚨 CRITICAL

### 5. Request Statistics
```
GET /api/diagnostics/requests
```

Returns:
- Total requests logged (last 100)
- Requests in last 60 seconds
- Average response time
- Error rate percentage
- Slow requests (>5s)
- Recent errors
- Memory usage trends

### 6. Memory Monitoring
```
GET /api/diagnostics/memory
```

Returns current memory usage in real-time.

### 7. Improved Error Handling

All errors now include:
- Request ID for tracing
- Detailed error messages
- Memory usage at time of error
- Specific error types (Database, Timeout, Memory, etc.)

### 8. ETG API Timeout Optimization

- **Reduced timeout** from 120s to 25s
- **Better error messages** for timeout scenarios
- **Formatted error responses** with actionable information

Error types now detected:
- Connection timeouts
- Rate limiting
- ETG API unavailable (502/503)
- Network issues

## How to Use on Render

### Step 1: Deploy with New Configuration

After deploying, check these endpoints in order:

1. **Basic connectivity**:
   ```
   https://your-app.onrender.com/api/test
   ```

2. **Health check with database**:
   ```
   https://your-app.onrender.com/api/health
   ```
   - Check `database.status` = "connected"
   - Check `memory.heapUsed` < 400MB

3. **Detailed diagnostics**:
   ```
   https://your-app.onrender.com/api/diagnostics
   ```
   - Verify all tests pass
   - Check UUID extension is installed

### Step 2: Monitor Search Requests

When testing search functionality, monitor:

1. **Before search**:
   ```
   GET /api/diagnostics/memory
   ```

2. **Perform search**

3. **After search**:
   ```
   GET /api/diagnostics/requests
   ```
   - Check for errors
   - Review memory trends
   - Check response times

### Step 3: Read Render Logs

Look for these log patterns:

**Success pattern**:
```
📨 [abc-123] POST /api/ratehawk/search
🔍 ETG searchHotels: region_id=123
✅ ETG Search complete: 50 hotels found
✅ [abc-123] POST /api/ratehawk/search - 200 - 2500ms - Memory: 150MB (+5MB)
```

**Memory warning**:
```
⚠️ WARNING: Heap usage at 420MB (>400MB threshold)
```

**Timeout error**:
```
❌ ETG searchHotels error: Hotel search timed out after 25s
```

**Memory error**:
```
🚨 ERROR [abc-123]: heap out of memory
```

## Common Issues and Solutions

### Issue: 503 Error with "Upstream returned 5xx"

**Diagnosis**:
1. Check `/api/health` - if it fails, database issue
2. Check `/api/diagnostics/memory` - if >480MB, memory issue
3. Check Render logs for timeout or memory errors

**Solutions**:
- Memory issue: Restart service, monitor memory growth
- Database issue: Check DATABASE_URL environment variable
- Timeout issue: ETG API may be slow, retry later

### Issue: Slow Response Times (>5s)

**Diagnosis**:
1. Check `/api/diagnostics/requests`
2. Look for "SLOW REQUEST" warnings in logs
3. Identify which endpoint is slow

**Solutions**:
- ETG API slow: Normal for large searches, consider caching
- Database slow: Check database connectivity
- Memory pressure: Restart if memory >400MB

### Issue: Memory Keeps Growing

**Diagnosis**:
1. Monitor `/api/diagnostics/memory` over multiple requests
2. Check memory delta in logs
3. Review `/api/diagnostics/requests` for memory trends

**Solutions**:
- Large memory deltas per request: Reduce search scope
- Gradual growth: Possible memory leak, restart service
- Sudden spike: Cache building, normal on first requests

## Environment Variables to Verify

Ensure these are set in Render:

```
DATABASE_URL=postgresql://...
ETG_API_KEY=your_key_here
ETG_PARTNER_ID=11606
NODE_ENV=production
```

Check with:
```
GET /api/diagnostics
```

Look at the `env` section - all should show as "SET: true".

## Next Steps After Deployment

1. **Immediate**: Check `/api/health` returns 200
2. **Within 5 min**: Test search endpoint, monitor logs
3. **Within 15 min**: Check `/api/diagnostics/requests` for patterns
4. **Ongoing**: Monitor memory usage, watch for warnings

## Getting Help

When reporting issues, provide:
1. Output from `/api/diagnostics`
2. Last 50 lines from Render logs
3. Output from `/api/diagnostics/requests`
4. Specific request that failed (if known)
