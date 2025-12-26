import express from "express";
import destinationController from "../controllers/DestinationController.js";
import { autocompleteDestinations } from "../controllers/AutocompleteController.js";

const DestinationRoute = express.Router();

DestinationRoute.get("/autocomplete", autocompleteDestinations);
DestinationRoute.post("/", destinationController);

export default DestinationRoute;