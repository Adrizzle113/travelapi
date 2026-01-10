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
import filterValuesRoutes from "./filter-values.js";
import ordersRoutes from "./orders.js";  // ✅ ADD: Booking/order management routes

const router = express.Router();

// Mount all sub-routes
// Note: Auth routes were moved/removed - login/register are now in /api/auth
router.use(searchRoutes);     // /search
router.use(detailsRoutes);    // /hotel/details, /hotel/details-t, /hotel-details
router.use(staticInfoRoutes); // /hotel/static-info
router.use(poiRoutes);        // /hotel/:id/poi, /poi/refresh-cache
router.use(statsRoutes);      // /stats
router.use(filterValuesRoutes); // /filter-values
router.use(ordersRoutes);     // ✅ ADD: /prebook, /order/form, /order/finish, /order/status, etc.

export default router;