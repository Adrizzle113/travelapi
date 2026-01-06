/**
 * Sessions Route
 * Handles session management endpoints
 * Since the backend uses JWT tokens, this endpoint returns session information
 * based on active auth logs or returns empty array
 */

import express from "express";
import { supabase } from "../config/supabaseClient.js";

const router = express.Router();

/**
 * GET /api/sessions
 * Returns active sessions information
 * Frontend expects: { sessions: [...], activeSessions: number }
 */
router.get("/", async (req, res) => {
  try {
    // Get recent successful auth logs (last 24 hours) as "active sessions"
    const { data: recentLogs, error } = await supabase
      .from("auth_logs")
      .select("user_id, email, timestamp, session_id")
      .eq("success", true)
      .gte("timestamp", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Error fetching sessions:", error);
      // Return empty response instead of error
      return res.json({
        activeSessions: 0,
        sessions: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Transform logs into session format expected by frontend
    const sessions = (recentLogs || []).map((log) => {
      const loginTime = new Date(log.timestamp);
      const now = new Date();
      const ageMs = now - loginTime;
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
      const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
      const sessionAge = ageHours > 0 
        ? `${ageHours}h ${ageMinutes}m` 
        : `${ageMinutes}m`;

      return {
        userId: log.user_id,
        email: log.email,
        loginTime: log.timestamp,
        lastUsed: log.timestamp, // Using same timestamp since we don't track last used separately
        cookieCount: log.session_id ? 1 : 0, // If session_id exists, assume cookies are present
        sessionAge,
      };
    });

    res.json({
      activeSessions: sessions.length,
      sessions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Sessions error:", error);
    // Return empty response instead of error to prevent frontend issues
    res.json({
      activeSessions: 0,
      sessions: [],
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

