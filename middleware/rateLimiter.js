const requestStore = new Map();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

function cleanupOldRequests(store) {
  const now = Date.now();
  for (const [ip, data] of store.entries()) {
    data.requests = data.requests.filter(timestamp => now - timestamp < WINDOW_MS);
    if (data.requests.length === 0) {
      store.delete(ip);
    }
  }
}

setInterval(() => cleanupOldRequests(requestStore), WINDOW_MS);

export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!requestStore.has(ip)) {
    requestStore.set(ip, { requests: [] });
  }

  const ipData = requestStore.get(ip);
  ipData.requests = ipData.requests.filter(timestamp => now - timestamp < WINDOW_MS);

  if (ipData.requests.length >= MAX_REQUESTS) {
    const oldestRequest = Math.min(...ipData.requests);
    const resetTime = Math.ceil((oldestRequest + WINDOW_MS - now) / 1000);

    console.warn(`⚠️ Rate limit exceeded for IP: ${ip}`);

    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute allowed.`,
      retry_after_seconds: resetTime,
      timestamp: new Date().toISOString()
    });
  }

  ipData.requests.push(now);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - ipData.requests.length);
  res.setHeader('X-RateLimit-Reset', Math.ceil((now + WINDOW_MS) / 1000));

  next();
}

export function strictRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!requestStore.has(ip)) {
    requestStore.set(ip, { requests: [] });
  }

  const ipData = requestStore.get(ip);
  ipData.requests = ipData.requests.filter(timestamp => now - timestamp < WINDOW_MS);

  if (ipData.requests.length >= 10) {
    const oldestRequest = Math.min(...ipData.requests);
    const resetTime = Math.ceil((oldestRequest + WINDOW_MS - now) / 1000);

    console.warn(`⚠️ Strict rate limit exceeded for IP: ${ip}`);

    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Maximum 10 requests per minute allowed for this endpoint.',
      retry_after_seconds: resetTime,
      timestamp: new Date().toISOString()
    });
  }

  ipData.requests.push(now);

  res.setHeader('X-RateLimit-Limit', 10);
  res.setHeader('X-RateLimit-Remaining', 10 - ipData.requests.length);
  res.setHeader('X-RateLimit-Reset', Math.ceil((now + WINDOW_MS) / 1000));

  next();
}

export default rateLimiter;
