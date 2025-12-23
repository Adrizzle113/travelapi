/**
 * RateHawk Authentication Routes
 * Handles login, logout, session management for RateHawk API
 */

import express from "express";
import { 
  loginUserToRateHawk, 
  validateSession 
} from "../../services/ratehawkLoginService.js";
import { logAuthAttempt } from "../../config/database.js";

const router = express.Router();

// ================================
// LOGIN TO RATEHAWK
// ================================

router.post("/login", async (req, res) => {
  const startTime = Date.now();
  const { email, password } = req.body;

  console.log("🔐 === RATEHAWK LOGIN REQUEST ===");
  console.log(`📧 Email: ${email}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
      timestamp: new Date().toISOString(),
    });
  }

  const userId = email.replace("@", "_").replace(/\./g, "_");
  console.log(`👤 Generated User ID: ${userId}`);

  try {
    const loginResult = await loginUserToRateHawk(email, password, userId);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Login attempt completed in ${duration}ms`);
    console.log(`🎯 Login result: ${loginResult.success ? "SUCCESS" : "FAILED"}`);

    try {
      await logAuthAttempt(userId, email, loginResult, duration);
    } catch (logError) {
      console.error("📝 Failed to log auth attempt:", logError);
    }

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

      console.log(`✅ RateHawk session stored for ${email}`);
      console.log(`🔑 Session ID: ${loginResult.sessionId}`);
      console.log(`🍪 Cookies: ${loginResult.cookies?.length || 0}`);

      res.json({
        success: true,
        message: "Successfully logged into RateHawk",
        sessionId: loginResult.sessionId,
        ratehawkSessionId: loginResult.ratehawkSessionId,
        loginUrl: loginResult.loginUrl,
        userId: userId,
        email: email,
        loginTime: new Date().toISOString(),
        cookieCount: loginResult.cookies?.length || 0,
        sessionStored: true,
        duration: `${duration}ms`,
      });
    } else {
      console.log(`❌ RateHawk login failed: ${loginResult.error}`);

      res.status(401).json({
        success: false,
        error: loginResult.error || "RateHawk authentication failed",
        finalUrl: loginResult.finalUrl,
        cookieCount: loginResult.cookieCount || 0,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 RateHawk login error:", error);

    try {
      await logAuthAttempt(
        userId,
        email,
        { success: false, error: error.message },
        duration
      );
    } catch (logError) {
      console.error("📝 Failed to log failed auth attempt:", logError);
    }

    res.status(500).json({
      success: false,
      error: `Login failed: ${error.message}`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

// ================================
// TEST AUTHENTICATION
// ================================

router.post("/test-auth", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required for testing",
    });
  }

  const userId = `test_${email.replace("@", "_").replace(/\./g, "_")}_${Date.now()}`;

  try {
    console.log("🧪 Testing RateHawk authentication...");

    const testResult = await loginUserToRateHawk(email, password, userId);

    res.json({
      success: testResult.success,
      message: testResult.success
        ? "Authentication test successful"
        : "Authentication test failed",
      error: testResult.error || null,
      sessionId: testResult.sessionId || null,
      cookieCount: testResult.cookies?.length || 0,
      testMode: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Auth test error:", error);
    res.status(500).json({
      success: false,
      error: `Auth test failed: ${error.message}`,
      testMode: true,
      timestamp: new Date().toISOString(),
    });
  }
});

// ================================
// LOGOUT FROM RATEHAWK
// ================================

router.post("/logout/:userId", (req, res) => {
  const { userId } = req.params;

  console.log(`👋 Logging out user: ${userId}`);

  if (global.userSessions.has(userId)) {
    global.userSessions.delete(userId);
    console.log(`✅ Session removed for user: ${userId}`);

    res.json({
      success: true,
      message: "Successfully logged out from RateHawk",
      userId: userId,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log(`⚠️ No session found for user: ${userId}`);

    res.json({
      success: true,
      message: "No active session found (already logged out)",
      userId: userId,
      timestamp: new Date().toISOString(),
    });
  }
});

// ================================
// CHECK RATEHAWK SESSION
// ================================

router.get("/session/:userId", async (req, res) => {
  const { userId } = req.params;
  console.log(`🔍 Checking session for user: ${userId}`);

  try {
    const userSession = global.userSessions.get(userId);

    if (!userSession) {
      console.log(`❌ No session found for user: ${userId}`);
      return res.json({
        hasSession: false,
        error: "No active session found",
        userId: userId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!validateSession(userSession)) {
      console.log(`❌ Invalid/expired session for user: ${userId}`);
      global.userSessions.delete(userId);
      return res.json({
        hasSession: false,
        error: "Session expired or invalid",
        userId: userId,
        timestamp: new Date().toISOString(),
      });
    }

    userSession.lastUsed = new Date();
    global.userSessions.set(userId, userSession);

    console.log(`✅ Valid session found for user: ${userId}`);

    res.json({
      hasSession: true,
      sessionId: userSession.sessionId,
      ratehawkSessionId: userSession.ratehawkSessionId,
      email: userSession.email,
      loginTime: userSession.loginTime,
      lastUsed: userSession.lastUsed,
      cookieCount: userSession.cookies?.length || 0,
      sessionAge:
        Math.round((Date.now() - new Date(userSession.loginTime)) / (1000 * 60)) + " minutes",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Session check error:", error);
    res.status(500).json({
      hasSession: false,
      error: `Session check failed: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;