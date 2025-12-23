/**
 * RateHawk Main Router
 * Combines all RateHawk sub-routes
 */

import express from "express";
import authRoutes from "./auth.js";
import searchRoutes from "./search.js";
import detailsRoutes from "./details.js";
import staticInfoRoutes from "./static-info.js";
import poiRoutes from "./poi.js";
import statsRoutes from "./stats.js";

const router = express.Router();

// Mount all sub-routes
router.use(authRoutes);       // /login, /logout, /session, /test-auth
router.use(searchRoutes);     // /search
router.use(detailsRoutes);    // /hotel/details, /hotel/details-t, /hotel-details
router.use(staticInfoRoutes); // /hotel/static-info
router.use(poiRoutes);        // /hotel/:id/poi, /poi/refresh-cache
router.use(statsRoutes);      // /stats

export default router;