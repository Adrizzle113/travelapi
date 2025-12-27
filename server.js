import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Import middleware
import { requestTracker, errorHandler, getRequestStats, getRecentRequests } from "./middleware/requestMonitoring.js";
import { healthCheck, detailedDiagnostics } from "./middleware/healthCheck.js";

const prisma = new PrismaClient();

// Import routes
import authRoutes from "./routes/auth.js";
import ratehawkRoutes from "./routes/ratehawk/index.js";
import userRoutes from "./src/routes/userRoutes.js";
import { BookingFormCreationRoute } from "./src/routes/createBookingFormRoutes.js";
import DestinationRoute from "./src/routes/destinationRoute.js";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
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
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      console.log(`✅ Allowing whitelisted origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ Blocking origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request tracking and memory monitoring
app.use(requestTracker);

// Test database connection on startup
async function initializeDatabase() {
  try {
    console.log('🔄 Testing database connection...');
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    const tableCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    console.log(`✅ Database tables accessible: ${tableCheck[0].count} tables found`);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error("⚠️ Server will start but database operations will fail");
  }
}

initializeDatabase();

// Health check endpoints
app.get("/api/health", healthCheck);

// Diagnostic endpoints for troubleshooting
app.get("/api/diagnostics", detailedDiagnostics);

app.get("/api/diagnostics/requests", (req, res) => {
  const stats = getRequestStats();
  const recent = getRecentRequests(50);
  res.json({
    stats,
    recentRequests: recent,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/diagnostics/memory", (req, res) => {
  const memory = process.memoryUsage();
  const memoryMB = {
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
    rss: Math.round(memory.rss / 1024 / 1024),
    external: Math.round(memory.external / 1024 / 1024),
    arrayBuffers: Math.round(memory.arrayBuffers / 1024 / 1024)
  };

  res.json({
    memory: memoryMB,
    percentUsed: Math.round((memoryMB.heapUsed / memoryMB.heapTotal) * 100),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    message: "Backend server is running!",
    timestamp: new Date().toISOString(),
    etgConfigured: process.env.ETG_PARTNER_ID ? "Configured" : "Not configured",
    databaseConfigured: process.env.DATABASE_URL ? "Configured" : "Not configured",
    environment: process.env.NODE_ENV || "development",
  });
});

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/ratehawk", ratehawkRoutes);
app.use("/api/users", userRoutes);
app.use("/api/booking-form", BookingFormCreationRoute);
app.use("/api/destinations", DestinationRoute);
app.use("/api/destination", DestinationRoute);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Travel API Server",
    version: "2.0.0",
    description: "ETG-powered hotel booking API",
    documentation: "/api/health",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler with detailed logging
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log("🚀 ================================");
  console.log("🚀 Travel API Server Started");
  console.log("🚀 ================================");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📚 API Base: http://localhost:${PORT}/api`);
  console.log("🚀 ================================");
  console.log(`🔑 ETG API: ${process.env.ETG_PARTNER_ID ? "Configured ✅" : "Not configured ❌"}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? "Configured ✅" : "Not configured ❌"}`);
  console.log("🚀 ================================");
});

export default app;