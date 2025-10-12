import express from "express";
const BookingFormCreationRoute = express.Router();
import { createBookingForm, getCountries } from "../controllers/createBookingForm.js";
getCountries
BookingFormCreationRoute.post("/create-booking-form", createBookingForm);
BookingFormCreationRoute.get("/countries", getCountries)

export { BookingFormCreationRoute };
