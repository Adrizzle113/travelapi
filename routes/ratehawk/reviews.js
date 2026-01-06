/**
 * RateHawk Hotel Reviews Routes
 * Provides hotel reviews from Supabase database
 */

import express from "express";
import { supabase } from "../../config/supabaseClient.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/ratehawk/hotel/:hotelId/reviews
 * Get hotel reviews from database
 */
router.get("/hotel/:hotelId/reviews", async (req, res) => {
  const startTime = Date.now();
  const { hotelId } = req.params;
  const { limit = 20, offset = 0, order = "desc" } = req.query;

  console.log("⭐ === HOTEL REVIEWS REQUEST ===");
  console.log(`Hotel ID: ${hotelId}`);
  console.log(`Limit: ${limit}, Offset: ${offset}`);

  // Validation
  if (!hotelId) {
    return res.status(400).json({
      success: false,
      error: {
        message: "hotelId is required",
        code: "MISSING_HOTEL_ID"
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Try Prisma first (faster, direct database access)
    let reviews = [];
    let totalCount = 0;

    try {
      // Get reviews using Prisma
      const [reviewsData, count] = await Promise.all([
        prisma.hotelReview.findMany({
          where: {
            hotel_id: hotelId
          },
          orderBy: {
            review_date: order === "asc" ? "asc" : "desc"
          },
          take: parseInt(limit),
          skip: parseInt(offset),
          select: {
            id: true,
            hotel_id: true,
            reviewer_name: true,
            rating: true,
            review_text: true,
            review_date: true,
            helpful_count: true,
            language: true
          }
        }),
        prisma.hotelReview.count({
          where: {
            hotel_id: hotelId
          }
        })
      ]);

      reviews = reviewsData;
      totalCount = count;

    } catch (prismaError) {
      // Fallback to Supabase if Prisma fails
      console.warn("⚠️ Prisma query failed, falling back to Supabase:", prismaError.message);

      const { data, error, count } = await supabase
        .from("hotel_reviews")
        .select("*", { count: "exact" })
        .eq("hotel_id", hotelId)
        .order("review_date", { ascending: order === "asc" })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      reviews = data || [];
      totalCount = count || 0;
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: reviews,
      meta: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + reviews.length < totalCount
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Hotel reviews error:", error);

    res.status(500).json({
      success: false,
      error: {
        message: error.message || "Failed to fetch hotel reviews",
        code: "REVIEWS_FETCH_ERROR"
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    });
  }
});

export default router;

