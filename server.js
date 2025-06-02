require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const ratehawkRoutes = require('./routes/ratehawk');

// Import services
const { loginUserToRateHawk } = require('./services/ratehawkLoginService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize global session storage
global.userSessions = new Map();

// Middleware setup
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',     // ← ADD THIS for your frontend
    'http://127.0.0.1:8081',     // ← ADD THIS too
    'http://localhost:3000', 
    'https://lovable.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ratehawk', ratehawkRoutes);
app.use('/api/hotels', ratehawkRoutes); // Alias for compatibility

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected',
      browserless: process.env.BROWSERLESS_TOKEN ? 'configured' : 'not_configured',
      ratehawk: 'operational'
    },
    activeSessions: global.userSessions.size,
    endpoints: {
      auth: '/api/auth/*',
      ratehawk: '/api/ratehawk/*',
      hotels: '/api/hotels/*'
    }
  });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    browserlessToken: process.env.BROWSERLESS_TOKEN ? 'Configured' : 'Not configured',
    activeSessions: global.userSessions.size,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Session cleanup endpoint
app.post('/api/cleanup-sessions', (req, res) => {
  const beforeCount = global.userSessions.size;
  let cleanedCount = 0;
  
  global.userSessions.forEach((session, userId) => {
    const sessionAge = Date.now() - new Date(session.loginTime);
    const hoursOld = sessionAge / (1000 * 60 * 60);
    
    if (hoursOld > 24) {
      global.userSessions.delete(userId);
      cleanedCount++;
    }
  });
  
  console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
  
  res.json({
    success: true,
    beforeCount,
    afterCount: global.userSessions.size,
    cleanedCount,
    timestamp: new Date().toISOString()
  });
});

// List active sessions endpoint (for debugging)
app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(global.userSessions.entries()).map(([userId, session]) => ({
    userId,
    email: session.email,
    loginTime: session.loginTime,
    lastUsed: session.lastUsed,
    cookieCount: session.cookies?.length || 0,
    sessionAge: Math.round((Date.now() - new Date(session.loginTime)) / (1000 * 60)) + ' minutes'
  }));
  
  res.json({
    activeSessions: global.userSessions.size,
    sessions: sessions,
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint for Make.com integration
app.post('/api/webhook/ratehawk-login', async (req, res) => {
  console.log('🔗 Webhook received from Make.com');
  console.log('📥 Webhook payload:', JSON.stringify(req.body, null, 2));
  
  const { userId, email, password } = req.body;
  
  if (!userId || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, email, password'
    });
  }
  
  try {
    const loginResult = await loginUserToRateHawk(email, password, userId);
    
    if (loginResult.success) {
      // Store session
      global.userSessions.set(userId, {
        sessionId: loginResult.sessionId,
        cookies: loginResult.cookies,
        email: email,
        loginTime: new Date(),
        lastUsed: new Date(),
        ratehawkSessionId: loginResult.ratehawkSessionId,
        loginUrl: loginResult.loginUrl
      });
      
      console.log(`✅ Webhook: RateHawk session created for ${email}`);
    }
    
    res.json({
      success: loginResult.success,
      sessionId: loginResult.sessionId,
      loginUrl: loginResult.loginUrl,
      timestamp: new Date().toISOString(),
      webhook: true
    });
    
  } catch (error) {
    console.error('💥 Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      webhook: true
    });
  }
});

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      health: 'GET /api/health',
      test: 'GET /api/test',
      auth: 'POST /api/auth/login, POST /api/auth/register',
      ratehawk: 'POST /api/ratehawk/login, POST /api/ratehawk/search',
      sessions: 'GET /api/sessions, POST /api/cleanup-sessions'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log('🚀 ===== SERVER STARTED =====');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth/*`);
      console.log(`🏨 RateHawk routes: http://localhost:${PORT}/api/ratehawk/*`);
      console.log(`🌍 Browserless: ${process.env.BROWSERLESS_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
      console.log('===============================');
    });
    
    // Session cleanup interval (every hour)
    setInterval(() => {
      const beforeCount = global.userSessions.size;
      let cleanedCount = 0;
      
      global.userSessions.forEach((session, userId) => {
        const sessionAge = Date.now() - new Date(session.loginTime);
        const hoursOld = sessionAge / (1000 * 60 * 60);
        
        if (hoursOld > 24) {
          global.userSessions.delete(userId);
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Auto-cleanup: Removed ${cleanedCount} expired sessions`);
      }
    }, 60 * 60 * 1000); // 1 hour
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();