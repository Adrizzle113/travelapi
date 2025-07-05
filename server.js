require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const ratehawkRoutes = require('./routes/ratehawk');

// Import services
const { loginUserToRateHawk } = require('./services/ratehawkLoginService');
const { verifyMailgunSignature, processIncomingEmail } = require('./services/mailgunService');
const { createRateHawkSubagent, generateRateHawkEmail } = require('./services/ratehawkSignupService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize global session storage
global.userSessions = new Map();

// Middleware setup
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:3000', 
    'https://lovable.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Special middleware for Mailgun webhook (raw body parsing)
app.use('/api/mailgun/webhook', express.raw({ type: 'application/x-www-form-urlencoded' }));

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

// Mailgun webhook endpoint
app.post('/api/mailgun/webhook', async (req, res) => {
  console.log('📧 ===== MAILGUN WEBHOOK RECEIVED =====');
  
  try {
    // Parse the form data
    const body = req.body.toString();
    const params = new URLSearchParams(body);
    
    // Extract Mailgun signature data
    const timestamp = params.get('timestamp');
    const token = params.get('token');
    const signature = params.get('signature');
    
    // Verify signature (optional for development)
    if (process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
      const isValid = verifyMailgunSignature(timestamp, token, signature);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Extract email data
    const emailData = {
      recipient: params.get('recipient'),
      sender: params.get('sender'),
      subject: params.get('subject'),
      bodyHtml: params.get('body-html'),
      bodyPlain: params.get('body-plain'),
      timestamp: params.get('Date'),
      messageId: params.get('Message-Id')
    };
    
    console.log('📨 Email received:');
    console.log(`  From: ${emailData.sender}`);
    console.log(`  To: ${emailData.recipient}`);
    console.log(`  Subject: ${emailData.subject}`);
    
    // Process the email
    const result = await processIncomingEmail(emailData);
    
    if (result.success) {
      console.log(`✅ Email processed successfully for user ${result.userId}`);
      res.status(200).json({
        success: true,
        userId: result.userId,
        emailType: result.emailType,
        linksFound: result.linksFound
      });
    } else {
      console.log(`⚠️ Email processing skipped: ${result.error}`);
      res.status(200).json({ success: false, reason: result.error });
    }
    
  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Webhook processing failed' 
    });
  }
});

// User signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  console.log('👤 ===== USER SIGNUP REQUEST =====');
  
  const {
    email,           // User's real email
    firstName,
    middleName,
    lastName,
    countryCode,
    phoneNumber,
    companyName
  } = req.body;
  
  // Validate required fields
  const requiredFields = { email, firstName, lastName, countryCode, phoneNumber, companyName };
  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missingFields.join(', ')}`
    });
  }
  
  try {
    // Generate user ID and RateHawk email
    const userId = email.replace('@', '_').replace(/\./g, '_');
    const generatedEmail = generateRateHawkEmail(userId);
    
    console.log(`👤 User ID: ${userId}`);
    console.log(`📧 Generated email: ${generatedEmail}`);
    
    // Store signup data temporarily
    if (!global.pendingSignups) {
      global.pendingSignups = new Map();
    }
    
    const signupData = {
      userId,
      userEmail: email,
      generatedEmail,
      firstName,
      middleName,
      lastName,
      countryCode,
      phoneNumber,
      companyName,
      status: 'initiated',
      createdAt: new Date()
    };
    
    global.pendingSignups.set(userId, signupData);
    
    // Start RateHawk automation
    console.log('🤖 Starting RateHawk subagent creation...');
    const signupResult = await createRateHawkSubagent({
      generatedEmail,
      firstName,
      middleName,
      lastName,
      countryCode,
      phoneNumber,
      companyName
    });
    
    if (signupResult.success) {
      // Update signup status
      signupData.status = 'ratehawk_created';
      signupData.ratehawkUrl = signupResult.finalUrl;
      signupData.automationResults = signupResult.formFillResults;
      
      console.log('✅ RateHawk subagent created successfully');
      
      res.json({
        success: true,
        message: 'Account creation initiated. You will receive an email shortly.',
        userId: userId,
        status: 'processing',
        estimatedTime: '2-5 minutes'
      });
      
    } else {
      console.error('❌ RateHawk creation failed:', signupResult.error);
      signupData.status = 'failed';
      signupData.error = signupResult.error;
      
      res.status(500).json({
        success: false,
        error: 'Account creation failed. Please try again.',
        details: signupResult.error
      });
    }
    
  } catch (error) {
    console.error('💥 Signup process error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during signup',
      details: error.message
    });
  }
});

// Check signup status endpoint
app.get('/api/auth/signup-status/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!global.pendingSignups || !global.pendingSignups.has(userId)) {
    return res.status(404).json({
      success: false,
      error: 'Signup not found'
    });
  }
  
  const signupData = global.pendingSignups.get(userId);
  
  // Check for any received emails
  let emailsReceived = 0;
  if (global.pendingEmails && global.pendingEmails.has(userId)) {
    emailsReceived = 1;
  }
  
  res.json({
    success: true,
    userId: userId,
    status: signupData.status,
    createdAt: signupData.createdAt,
    emailsReceived: emailsReceived,
    generatedEmail: signupData.generatedEmail,
    ratehawkUrl: signupData.ratehawkUrl,
    error: signupData.error
  });
});

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
      mailgun: process.env.MAILGUN_API_KEY ? 'configured' : 'not_configured',
      ratehawk: 'operational'
    },
    activeSessions: global.userSessions.size,
    endpoints: {
      auth: '/api/auth/*',
      ratehawk: '/api/ratehawk/*',
      hotels: '/api/hotels/*',
      mailgun: '/api/mailgun/*',
      admin: '/api/admin/*'
    }
  });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    browserlessToken: process.env.BROWSERLESS_TOKEN ? 'Configured' : 'Not configured',
    mailgunApiKey: process.env.MAILGUN_API_KEY ? 'Configured' : 'Not configured',
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

// List pending signups (for debugging)
app.get('/api/admin/signups', (req, res) => {
  if (!global.pendingSignups) {
    return res.json({ signups: [], emails: [] });
  }
  
  const signups = Array.from(global.pendingSignups.values()).map(signup => ({
    userId: signup.userId,
    userEmail: signup.userEmail,
    generatedEmail: signup.generatedEmail,
    status: signup.status,
    createdAt: signup.createdAt,
    error: signup.error
  }));
  
  const emails = global.pendingEmails ? 
    Array.from(global.pendingEmails.values()).map(email => ({
      userId: email.userId,
      recipient: email.recipient,
      sender: email.sender,
      subject: email.subject,
      timestamp: email.timestamp,
      processed: email.processed
    })) : [];
  
  res.json({
    signups: signups,
    emails: emails,
    totalSignups: signups.length,
    totalEmails: emails.length
  });
});

// Test Mailgun endpoint
app.post('/api/mailgun/test', async (req, res) => {
  console.log('🧪 Testing Mailgun setup...');
  
  try {
    const { sendUserNotification } = require('./services/mailgunService');
    
    const testCredentials = {
      email: 'test@example.com',
      password: 'TestPassword123!'
    };
    
    const result = await sendUserNotification('your-test-email@example.com', testCredentials);
    
    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Webhook endpoint for Make.com integration (existing)
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
      auth: 'POST /api/auth/login, POST /api/auth/register, POST /api/auth/signup',
      ratehawk: 'POST /api/ratehawk/login, POST /api/ratehawk/search',
      sessions: 'GET /api/sessions, POST /api/cleanup-sessions',
      mailgun: 'POST /api/mailgun/webhook, POST /api/mailgun/test',
      admin: 'GET /api/admin/signups'
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
      console.log(`📧 Mailgun webhook: http://localhost:${PORT}/api/mailgun/webhook`);
      console.log(`👥 Admin panel: http://localhost:${PORT}/api/admin/signups`);
      console.log(`🌍 Browserless: ${process.env.BROWSERLESS_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
      console.log(`📨 Mailgun: ${process.env.MAILGUN_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
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