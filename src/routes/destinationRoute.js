import express from "express";
import destinationController from "../controllers/DestinationController.js";
const DestinationRoute = express.Router();

DestinationRoute.post("/destination", destinationController);

export default DestinationRoute;