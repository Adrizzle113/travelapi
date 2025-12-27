import { v4 as uuidv4 } from 'uuid';

const requestLog = [];
const MAX_LOG_SIZE = 100;
const MEMORY_WARNING_THRESHOLD = 400;
const MEMORY_CRITICAL_THRESHOLD = 480;

function getMemoryUsageMB() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024)
  };
}

function checkMemoryPressure(memory) {
  if (memory.heapUsed > MEMORY_CRITICAL_THRESHOLD) {
    return { level: 'critical', message: `🚨 CRITICAL: Heap usage at ${memory.heapUsed}MB (>480MB limit)` };
  } else if (memory.heapUsed > MEMORY_WARNING_THRESHOLD) {
    return { level: 'warning', message: `⚠️ WARNING: Heap usage at ${memory.heapUsed}MB (>400MB threshold)` };
  }
  return { level: 'normal', message: null };
}

export function requestTracker(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();
  const startMemory = getMemoryUsageMB();

  req.requestId = requestId;
  req.startTime = startTime;

  const memoryPressure = checkMemoryPressure(startMemory);
  if (memoryPressure.message) {
    console.log(memoryPressure.message);
  }

  console.log(`📨 [${requestId}] ${req.method} ${req.path} - Memory: ${startMemory.heapUsed}MB heap / ${startMemory.rss}MB RSS`);

  const originalSend = res.send;
  res.send = function (data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const endMemory = getMemoryUsageMB();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    const logEntry = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      startMemory: startMemory.heapUsed,
      endMemory: endMemory.heapUsed,
      memoryDelta,
      timestamp: new Date().toISOString(),
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    requestLog.unshift(logEntry);
    if (requestLog.length > MAX_LOG_SIZE) {
      requestLog.pop();
    }

    const statusEmoji = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
    const memoryEmoji = memoryDelta > 10 ? '📈' : memoryDelta < -10 ? '📉' : '➡️';

    console.log(
      `${statusEmoji} [${requestId}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${memoryEmoji} Memory: ${endMemory.heapUsed}MB (${memoryDelta > 0 ? '+' : ''}${memoryDelta}MB)`
    );

    if (duration > 5000) {
      console.warn(`⏱️ SLOW REQUEST: [${requestId}] took ${duration}ms`);
    }

    if (res.statusCode >= 500) {
      console.error(`🚨 SERVER ERROR: [${requestId}] ${req.method} ${req.path} returned ${res.statusCode}`);
    }

    originalSend.call(this, data);
  };

  next();
}

export function getRequestStats() {
  const now = Date.now();
  const recentRequests = requestLog.filter(log => now - new Date(log.timestamp).getTime() < 60000);

  const stats = {
    total: requestLog.length,
    last60Seconds: recentRequests.length,
    avgDuration: requestLog.length > 0
      ? Math.round(requestLog.reduce((sum, log) => sum + log.duration, 0) / requestLog.length)
      : 0,
    errorRate: requestLog.length > 0
      ? Math.round((requestLog.filter(log => log.statusCode >= 500).length / requestLog.length) * 100)
      : 0,
    slowRequests: requestLog.filter(log => log.duration > 5000).length,
    recentErrors: requestLog.filter(log => log.statusCode >= 500).slice(0, 10),
    memoryTrend: {
      avgDelta: requestLog.length > 0
        ? Math.round(requestLog.reduce((sum, log) => sum + log.memoryDelta, 0) / requestLog.length)
        : 0,
      maxMemoryUsed: Math.max(...requestLog.map(log => log.endMemory), 0)
    }
  };

  return stats;
}

export function getRecentRequests(limit = 20) {
  return requestLog.slice(0, limit);
}

export function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'unknown';
  const memory = getMemoryUsageMB();

  console.error(`🚨 ERROR [${requestId}]:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    memory: memory,
    timestamp: new Date().toISOString()
  });

  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(500).json({
      error: 'Database Error',
      message: 'A database operation failed',
      requestId,
      code: err.code
    });
  }

  if (err.name === 'PrismaClientInitializationError') {
    return res.status(503).json({
      error: 'Database Connection Failed',
      message: 'Unable to connect to the database',
      requestId
    });
  }

  if (err.message && err.message.includes('heap')) {
    return res.status(503).json({
      error: 'Memory Error',
      message: 'Server is experiencing memory pressure',
      requestId,
      memoryUsage: memory
    });
  }

  res.status(err.statusCode || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

export default {
  requestTracker,
  errorHandler,
  getRequestStats,
  getRecentRequests
};
