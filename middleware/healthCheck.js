import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      arrayBuffers: Math.round(process.memoryUsage().arrayBuffers / 1024 / 1024)
    },
    database: {
      status: 'unknown',
      responseTime: null,
      error: null
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

    health.database.status = 'connected';
    health.database.responseTime = dbEnd - dbStart;
  } catch (error) {
    health.status = 'unhealthy';
    health.database.status = 'disconnected';
    health.database.error = error.message;
    console.error('❌ Health check database error:', error);
  }

  const totalTime = Date.now() - startTime;
  health.responseTime = totalTime;

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
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
  detailedDiagnostics
};
