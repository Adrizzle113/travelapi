/**
 * RateHawk Statistics Routes
 * Handles statistics and monitoring endpoints
 */

import express from "express";
import { getAuthStats } from "../../config/database.js";

const router = express.Router();

// ================================
// GET STATISTICS
// ================================

router.get("/stats", async (req, res) => {
  try {
    const stats = await getAuthStats();

    res.json({
      success: true,
      stats: {
        totalAttempts: stats.total_attempts || 0,
        successfulAttempts: stats.successful_attempts || 0,
        averageDuration: Math.round(stats.avg_duration || 0) + "ms",
        uniqueUsers: stats.unique_users || 0,
        attempts24h: stats.attempts_24h || 0,
        successRate:
          stats.total_attempts > 0
            ? Math.round((stats.successful_attempts / stats.total_attempts) * 100) + "%"
            : "0%",
      },
      activeSessions: global.userSessions.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Stats error:", error);
    res.status(500).json({
      success: false,
      error: `Failed to get stats: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
