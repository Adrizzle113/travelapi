/**
 * RateHawk Main Router
 * Combines all RateHawk sub-routes
 */
import express from "express";
import searchRoutes from "./search.js";
import detailsRoutes from "./details.js";
import staticInfoRoutes from "./static-info.js";
import poiRoutes from "./poi.js";
import statsRoutes from "./stats.js";
import orderRoutes from "./orders.js";

const router = express.Router();

// Mount all sub-routes
router.use(searchRoutes);     // /search
router.use(detailsRoutes);    // /hotel/details, /hotel/details-t, /hotel-details
router.use(staticInfoRoutes); // /hotel/static-info
router.use(poiRoutes);        // /hotel/:id/poi, /poi/refresh-cache
router.use(statsRoutes);      // /stats
router.use(orderRoutes);      // /prebook, /order/*

export default router;