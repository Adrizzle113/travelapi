import dotenv from "dotenv";
dotenv.config();
// #region agent log
console.log('[DEBUG] Starting server.js module load');
// #endregion
import express from "express";
import cors from "cors";
// #region agent log
console.log('[DEBUG] Express and cors imported');
// #endregion
import { initializeDatabase } from "./config/database.js";
// #region agent log
console.log('[DEBUG] Database module imported');
// #endregion

// Import routes
// #region agent log
console.log('[DEBUG] About to import authRoutes');
// #endregion
import authRoutes from "./routes/auth.js";
// #region agent log
console.log('[DEBUG] authRoutes imported, about to import ratehawkRoutes');
// #endregion
import ratehawkRoutes from "./routes/ratehawk/index.js";
// #region agent log
console.log('[DEBUG] ratehawkRoutes imported successfully', !!ratehawkRoutes);
if (typeof fetch !== 'undefined') {
  fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:15',message:'ratehawkRoutes imported successfully',data:{hasRoutes:!!ratehawkRoutes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
}
// #endregion

// Import services
import { loginUserToRateHawk } from "./services/ratehawkLoginService.js";
import userRoutes from "./src/routes/userRoutes.js";
import { BookingFormCreationRoute } from "./src/routes/createBookingFormRoutes.js";
import DestinationRoute from "./src/routes/destinationRoute.js";

// #region agent log
fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:18',message:'Express app created',data:{expressImported:typeof express},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion
const app = express();
const PORT = process.env.PORT || 3001;
// #region agent log
fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:21',message:'App initialized',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// Initialize global session storage
global.userSessions = new Map();

// Middleware setup
// CORS configuration - allow requests from frontend
const allowedOrigins = [
  "http://localhost:8080",
  "https://bookja.vercel.app",
  "https://travel-frontend-two-nu.vercel.app",
  "http://localhost:8081",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://localhost:3000",
  "https://lovable.dev",
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/id-preview--.*\.lovable\.app$/
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🌐 CORS request from origin: ${origin || "no origin"}`);

    if (!origin) {
      console.log("✅ Allowing request with no origin");
      return callback(null, true);
    }

    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("https://localhost:") ||
      origin.startsWith("https://127.0.0.1:")
    ) {
      console.log(`✅ Allowing localhost origin: ${origin}`);
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      return allowed.test(origin);
    });

    if (isAllowed) {
      console.log(`✅ Allowing origin from list: ${origin}`);
      callback(null, true);
    } else {
      console.log(`⚠️ CORS blocked origin: ${origin}`);
      if (origin === "https://travel-frontend-two-nu.vercel.app") {
        console.log(`✅ Allowing frontend origin: ${origin}`);
        callback(null, true);
      } else if (process.env.NODE_ENV === "development") {
        console.log(`🔓 Development mode: Allowing origin ${origin}`);
        callback(null, true);
      } else {
        console.log(`❌ Blocking origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.options("*", (req, res) => {
  const origin = req.headers.origin;
  console.log(`🔄 Handling OPTIONS preflight request from: ${origin}`);

  if (!origin) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
    res.header("Access-Control-Max-Age", "86400");
    console.log(`✅ OPTIONS preflight approved (no origin)`);
    return res.status(204).send();
  }

  const isAllowed = allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    }
    return allowed.test(origin);
  });

  if (isAllowed || origin === "https://travel-frontend-two-nu.vercel.app") {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");
    console.log(`✅ OPTIONS preflight approved for: ${origin}`);
    return res.status(204).send();
  } else {
    console.log(`❌ OPTIONS preflight blocked for: ${origin}`);
    res.status(403).json({ error: "CORS preflight failed" });
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware - log all incoming requests for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store request ID for error tracking
  req.requestId = requestId;
  
  console.log(`📨 [${requestId}] ${req.method} ${req.url} - Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB heap / ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB RSS`);
  
  // Log request body for POST requests (truncated for large bodies)
  if (req.method === 'POST' && req.body) {
    const bodyStr = JSON.stringify(req.body);
    const truncatedBody = bodyStr.length > 500 ? bodyStr.substring(0, 500) + '...' : bodyStr;
    console.log(`📦 [${requestId}] Request body: ${truncatedBody}`);
  }
  
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ratehawk", ratehawkRoutes);
app.use("/api/hotels", ratehawkRoutes);
app.use("/api/user", userRoutes);
app.use("/api", BookingFormCreationRoute);
app.use("/api", DestinationRoute);

app.options("/api/health", (req, res) => {
  const origin = req.headers.origin;
  console.log(`🔄 Handling OPTIONS for /api/health from: ${origin}`);

  if (!origin) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    res.header("Access-Control-Max-Age", "86400");
    return res.status(204).send();
  }

  const isAllowed = allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    }
    return allowed.test(origin);
  });

  if (isAllowed || origin === "https://travel-frontend-two-nu.vercel.app") {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");
    console.log(`✅ OPTIONS /api/health approved for: ${origin}`);
    return res.status(204).send();
  }

  console.log(`❌ OPTIONS /api/health blocked for: ${origin}`);
  res.status(403).json({ error: "CORS preflight failed" });
});

app.get("/api/health", (req, res) => {
  const origin = req.headers.origin;
  console.log(`📊 GET /api/health request from: ${origin}`);

  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      return allowed.test(origin);
    });

    if (isAllowed || origin === "https://travel-frontend-two-nu.vercel.app") {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
  }

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: "connected",
      browserless: process.env.BROWSERLESS_TOKEN ? "configured" : "not_configured",
      ratehawk: "operational",
    },
    activeSessions: global.userSessions.size,
    endpoints: {
      auth: "/api/auth/*",
      ratehawk: "/api/ratehawk/*",
      hotels: "/api/hotels/*",
    },
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "Backend server is running!",
    timestamp: new Date().toISOString(),
    browserlessToken: process.env.BROWSERLESS_TOKEN ? "Configured" : "Not configured",
    activeSessions: global.userSessions.size,
    environment: process.env.NODE_ENV || "development",
  });
});

app.post("/api/cleanup-sessions", (req, res) => {
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
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/sessions", (req, res) => {
  const sessions = Array.from(global.userSessions.entries()).map(
    ([userId, session]) => ({
      userId,
      email: session.email,
      loginTime: session.loginTime,
      lastUsed: session.lastUsed,
      cookieCount: session.cookies?.length || 0,
      sessionAge:
        Math.round((Date.now() - new Date(session.loginTime)) / (1000 * 60)) +
        " minutes",
    })
  );

  res.json({
    activeSessions: global.userSessions.size,
    sessions: sessions,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/webhook/ratehawk-login", async (req, res) => {
  console.log("🔗 Webhook received from Make.com");
  console.log("📥 Webhook payload:", JSON.stringify(req.body, null, 2));

  const { userId, email, password } = req.body;

  if (!userId || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: userId, email, password",
    });
  }

  try {
    const loginResult = await loginUserToRateHawk(email, password, userId);

    if (loginResult.success) {
      global.userSessions.set(userId, {
        sessionId: loginResult.sessionId,
        cookies: loginResult.cookies,
        email: email,
        loginTime: new Date(),
        lastUsed: new Date(),
        ratehawkSessionId: loginResult.ratehawkSessionId,
        loginUrl: loginResult.loginUrl,
      });

      console.log(`✅ Webhook: RateHawk session created for ${email}`);
    }

    res.json({
      success: loginResult.success,
      sessionId: loginResult.sessionId,
      loginUrl: loginResult.loginUrl,
      timestamp: new Date().toISOString(),
      webhook: true,
    });
  } catch (error) {
    console.error("💥 Webhook error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      webhook: true,
    });
  }
});

// ================================
// BOOKING STATUS WEBHOOK
// ================================
app.post("/api/webhook/booking-status", async (req, res) => {
  const startTime = Date.now();
  console.log("🔔 === BOOKING STATUS WEBHOOK RECEIVED ===");
  console.log("📥 Webhook payload:", JSON.stringify(req.body, null, 2));
  console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));

  try {
    // Extract booking information from webhook payload
    const {
      order_id,
      partner_order_id,
      status,
      item_id,
      booking_status,
      error,
      data,
    } = req.body;

    // Validate required fields
    if (!order_id && !partner_order_id) {
      console.warn("⚠️ Webhook missing order_id or partner_order_id");
      return res.status(400).json({
        success: false,
        error: "Missing order_id or partner_order_id",
        timestamp: new Date().toISOString(),
      });
    }

    const orderIdentifier = order_id || partner_order_id;
    const finalStatus = status || booking_status || "unknown";

    console.log(`📋 Order ID: ${order_id || 'N/A'}`);
    console.log(`🆔 Partner Order ID: ${partner_order_id || 'N/A'}`);
    console.log(`📊 Status: ${finalStatus}`);
    console.log(`📦 Item ID: ${item_id || 'N/A'}`);

    if (error) {
      console.error(`❌ Booking error: ${error}`);
    }

    // Process different booking statuses
    switch (finalStatus.toLowerCase()) {
      case "ok":
      case "confirmed":
      case "completed":
        console.log("✅ Booking confirmed successfully");
        // TODO: Update database, send confirmation email, etc.
        break;

      case "processing":
        console.log("⏳ Booking is still processing");
        // TODO: Update database status
        break;

      case "error":
      case "failed":
      case "rejected":
        console.error(`❌ Booking failed: ${error || 'Unknown error'}`);
        // TODO: Update database, notify user, handle refund, etc.
        break;

      case "cancelled":
        console.log("🚫 Booking was cancelled");
        // TODO: Update database, handle cancellation
        break;

      default:
        console.log(`ℹ️ Unknown booking status: ${finalStatus}`);
    }

    // Store booking status update (optional - you can implement database storage here)
    // Example: await storeBookingStatus(order_id, partner_order_id, finalStatus, data);

    const duration = Date.now() - startTime;
    console.log(`✅ Webhook processed in ${duration}ms`);

    // Always return 200 to acknowledge receipt
    // ETG will retry if we return an error status
    res.status(200).json({
      success: true,
      message: "Webhook received and processed",
      order_id: order_id,
      partner_order_id: partner_order_id,
      status: finalStatus,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Webhook processing error:", error);
    console.error("Error stack:", error.stack);

    // Still return 200 to prevent retries for processing errors
    // Log the error for manual review
    res.status(200).json({
      success: false,
      error: "Webhook received but processing failed",
      error_message: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  }
});

app.use("*", (req, res) => {
  const requestId = req.requestId || 'unknown';
  console.log(`❌ [${requestId}] Endpoint not found: ${req.method} ${req.originalUrl || req.url}`);
  console.log(`   Request ID: ${requestId}`);
  console.log(`   Original URL: ${req.originalUrl || req.url}`);
  
  res.status(404).json({
    error: "Endpoint not found",
    method: req.method,
    path: req.originalUrl || req.url,
    requestId: requestId,
    availableEndpoints: {
      health: "GET /api/health",
      test: "GET /api/test",
      auth: "POST /api/auth/login, POST /api/auth/register",
      ratehawk: "POST /api/ratehawk/login, POST /api/ratehawk/search, POST /api/ratehawk/hotel/static-info",
      destination: "POST /api/destination",
      filterValues: "GET /api/ratehawk/filter-values",
      sessions: "GET /api/sessions, POST /api/cleanup-sessions",
    },
  });
});

app.use((err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  const statusCode = err.statusCode || 500;
  
  console.error(`🚨 SERVER ERROR: [${requestId}] ${req.method} ${req.originalUrl || req.url} returned ${statusCode}`);
  console.error(`💥 Server error:`, err);
  console.error(`   Error message: ${err.message}`);
  console.error(`   Error stack: ${err.stack}`);
  console.error(`   Request ID: ${requestId}`);
  
  res.status(statusCode).json({
    success: false,
    error: "Internal server error",
    message: err.message || "An unexpected error occurred",
    requestId: requestId,
    timestamp: new Date().toISOString(),
  });
});

process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  process.exit(0);
});

async function startServer() {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:474',message:'startServer called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    await initializeDatabase();
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:477',message:'Database initialized',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    app.listen(PORT, () => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:480',message:'Server started successfully',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log("🚀 ===== SERVER STARTED =====");
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth/*`);
      console.log(`🏨 RateHawk routes: http://localhost:${PORT}/api/ratehawk/*`);
      console.log(`🔔 Booking webhook: http://localhost:${PORT}/api/webhook/booking-status`);
      console.log(`🌍 Browserless: ${process.env.BROWSERLESS_TOKEN ? "✅ Configured" : "❌ Not configured"}`);
      console.log("===============================");
    });

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
    }, 60 * 60 * 1000);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/099a78ad-e1a7-4214-9836-b699f34a3356',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:517',message:'Server startup error',data:{errorMessage:error.message,errorStack:error.stack,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

startServer();