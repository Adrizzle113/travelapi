import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const ETG_BASE_URL = 'https://api.worldota.net/api/b2b/v3';
const WARMUP_CACHE_KEY = 'server_warmup_status';
let warmupStatus = {
  isWarm: false,
  lastWarmup: null,
  warmupAttempts: 0
};

async function checkETGService() {
  try {
    const startTime = Date.now();
    const response = await axios.get(ETG_BASE_URL, {
      timeout: 5000,
      validateStatus: () => true
    });
    const responseTime = Date.now() - startTime;

    return {
      status: response.status < 500 ? 'operational' : 'degraded',
      responseTime,
      statusCode: response.status
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { status: 'timeout', responseTime: 5000, error: 'Connection timeout' };
    }
    return { status: 'down', responseTime: null, error: error.message };
  }
}

export async function healthCheck(req, res) {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      arrayBuffers: Math.round(process.memoryUsage().arrayBuffers / 1024 / 1024),
      percentUsed: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
    },
    services: {
      database: {
        status: 'unknown',
        responseTime: null,
        error: null
      },
      etg_api: {
        status: 'unknown',
        responseTime: null,
        error: null
      }
    },
    serverState: {
      isWarm: warmupStatus.isWarm,
      lastWarmup: warmupStatus.lastWarmup,
      coldStartRisk: !warmupStatus.isWarm && process.uptime() < 300
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: process.env.NODE_ENV || 'development'
    }
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as health_check`;
    const dbEnd = Date.now();

    health.services.database.status = 'operational';
    health.services.database.responseTime = dbEnd - dbStart;
  } catch (error) {
    health.status = 'degraded';
    health.services.database.status = 'down';
    health.services.database.error = error.message;
    console.error('❌ Health check database error:', error);
  }

  const etgHealth = await checkETGService();
  health.services.etg_api = etgHealth;

  if (etgHealth.status === 'down' || etgHealth.status === 'timeout') {
    health.status = 'degraded';
  }

  const totalTime = Date.now() - startTime;
  health.responseTime = totalTime;

  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 503 : 503;
  res.status(statusCode).json(health);
}

export async function warmupServer(req, res) {
  const startTime = Date.now();
  const warmupResults = {
    timestamp: new Date().toISOString(),
    steps: [],
    totalDuration: 0,
    success: false
  };

  try {
    warmupResults.steps.push({ step: 'database_connection', status: 'starting' });
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStart;
    warmupResults.steps[0] = {
      step: 'database_connection',
      status: 'success',
      duration: dbDuration
    };

    warmupResults.steps.push({ step: 'etg_api_check', status: 'starting' });
    const etgStart = Date.now();
    const etgHealth = await checkETGService();
    const etgDuration = Date.now() - etgStart;
    warmupResults.steps[1] = {
      step: 'etg_api_check',
      status: etgHealth.status === 'down' ? 'failed' : 'success',
      duration: etgDuration,
      details: etgHealth
    };

    warmupResults.steps.push({ step: 'cache_check', status: 'starting' });
    const cacheStart = Date.now();
    const cacheCount = await prisma.searchCache.count();
    const cacheDuration = Date.now() - cacheStart;
    warmupResults.steps[2] = {
      step: 'cache_check',
      status: 'success',
      duration: cacheDuration,
      cachedSearches: cacheCount
    };

    warmupStatus = {
      isWarm: true,
      lastWarmup: new Date().toISOString(),
      warmupAttempts: warmupStatus.warmupAttempts + 1
    };

    warmupResults.success = true;
    warmupResults.totalDuration = Date.now() - startTime;
    warmupResults.message = 'Server warmed up successfully';

    console.log(`🔥 Server warmup completed in ${warmupResults.totalDuration}ms`);

    res.json(warmupResults);
  } catch (error) {
    warmupResults.success = false;
    warmupResults.error = error.message;
    warmupResults.totalDuration = Date.now() - startTime;

    console.error('❌ Server warmup failed:', error);

    res.status(500).json(warmupResults);
  }
}

export function getWarmupStatus() {
  return warmupStatus;
}

export async function detailedDiagnostics(req, res) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      cpuUsage: process.cpuUsage(),
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        rss: process.memoryUsage().rss,
        external: process.memoryUsage().external,
        arrayBuffers: process.memoryUsage().arrayBuffers,
        percentUsed: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
      }
    },
    database: {
      status: 'unknown',
      prismaVersion: null,
      connectionTest: null
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      ETG_API_KEY_SET: !!process.env.ETG_API_KEY,
      ETG_PARTNER_ID: process.env.ETG_PARTNER_ID
    },
    tests: []
  };

  try {
    const dbTest = await prisma.$queryRaw`SELECT version() as version`;
    diagnostics.database.status = 'connected';
    diagnostics.database.connectionTest = dbTest;
    diagnostics.tests.push({ name: 'Database Connection', status: 'passed' });
  } catch (error) {
    diagnostics.database.status = 'failed';
    diagnostics.database.error = error.message;
    diagnostics.tests.push({ name: 'Database Connection', status: 'failed', error: error.message });
  }

  try {
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    diagnostics.database.tables = tableCheck.map(t => t.table_name);
    diagnostics.tests.push({ name: 'Database Tables', status: 'passed', count: tableCheck.length });
  } catch (error) {
    diagnostics.tests.push({ name: 'Database Tables', status: 'failed', error: error.message });
  }

  try {
    const extensionCheck = await prisma.$queryRaw`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'uuid-ossp'
    `;
    diagnostics.database.uuidExtension = extensionCheck.length > 0;
    diagnostics.tests.push({
      name: 'UUID Extension',
      status: extensionCheck.length > 0 ? 'passed' : 'failed',
      message: extensionCheck.length > 0 ? 'uuid-ossp installed' : 'uuid-ossp NOT installed'
    });
  } catch (error) {
    diagnostics.tests.push({ name: 'UUID Extension', status: 'failed', error: error.message });
  }

  res.json(diagnostics);
}

export default {
  healthCheck,
  warmupServer,
  getWarmupStatus,
  detailedDiagnostics
};
