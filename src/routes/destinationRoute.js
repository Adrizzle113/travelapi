import express from "express";
import destinationController from "../controllers/DestinationController.js";
import { autocompleteDestinations } from "../controllers/AutocompleteController.js";
import { rateLimiter, strictRateLimiter } from "../../middleware/rateLimiter.js";

const DestinationRoute = express.Router();

DestinationRoute.get("/autocomplete", strictRateLimiter, autocompleteDestinations);
DestinationRoute.post("/", strictRateLimiter, destinationController);

export default DestinationRoute;
