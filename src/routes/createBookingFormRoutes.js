import express from "express";
import { createBookingForm, getCountries } from "../controllers/createBookingForm.js";
import { validateBookingForm } from "../../middleware/validation.js";

const BookingFormCreationRoute = express.Router();

BookingFormCreationRoute.post("/create-booking-form", validateBookingForm, createBookingForm);
BookingFormCreationRoute.get("/countries", getCountries);

export { BookingFormCreationRoute };
