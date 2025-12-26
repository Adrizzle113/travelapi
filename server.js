import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { initializeDatabase } from "./config/database.js";

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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Initialize database
initializeDatabase()
  .then(() => {
    console.log("✅ Database initialized successfully");
  })
  .catch((error) => {
    console.error("❌ Database initialization failed:", error);
  });

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Travel API Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: "connected",
      etg: process.env.ETG_PARTNER_ID ? "configured" : "not_configured",
    },
    endpoints: {
      auth: "/api/auth/*",
      ratehawk: "/api/ratehawk/*",
      hotels: "/api/hotels/*",
      users: "/api/users/*",
      destinations: "/api/destinations/*",
    },
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
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("💥 Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

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