import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const api = axios.create({
  baseURL: "https://api.worldota.net/api/b2b/v3/",
  auth: {
    username: "11606",
    password: "ff9702bb-ba93-4996-a31e-547983c51530",
  },
  headers: {
    "Content-Type": "application/json",
  },
});

export const createBookingForm = async (req, res) => {
  try {
    // 1️⃣ Step 1: Call hotel search API
    const searchPayload = {
      checkin: "2025-10-05",
      checkout: "2025-10-06",
      residency: "gb",
      language: "en",
      guests: [
        {
          adults: 2,
          children: [],
        },
      ],
      id: "test_hotel_do_not_book",
      currency: "EUR",
    };

    const searchResponse = await api.post("search/hp/", searchPayload);

    // Ensure book_hash exists
    const hotelResults = searchResponse.data.data.hotels[0].rates[0];
    console.log("🚀 ~ createBookingForm ~ hotelResults:", hotelResults);
    const bookHash = hotelResults?.book_hash;
    if (!bookHash) {
      return res.status(400).json({
        message: "❌ No book_hash found in search response",
        results: hotelResults,
      });
    }

    // 2️⃣ Step 2: Call booking form API
    const bookingPayload = {
      partner_order_id: `partner-${uuidv4()}`, // unique ID
      book_hash: bookHash,
      language: "en",
      user_ip: req.ip || "127.0.0.1",
    };

    const bookingResponse = await api.post(
      "hotel/order/booking/form/",
      bookingPayload
    );

    // 3️⃣ Step 3: Send combined data
    res.json({
      message: "✅ Booking form created successfully",
      data: {
        hotelDetails: hotelResults,
        bookingForm: bookingResponse.data,
      },
    });
  } catch (error) {
    console.error(
      "💥 Create booking form error:",
      error?.response?.data || error.message
    );
    res.status(500).json({
      message: "❌ Failed to create booking form",
      error: error?.response?.data || error.message,
    });
  }
};

export const getCountries = async (req, res) => {
  try {
    const countries = await api.get("https://www.ratehawk.com/api/v3/site/accounts/countries/");
    res.json(countries.data);
  } catch (error) {
    console.error("💥 Get countries error:", error);
    res.status(500).json({ message: "❌ Failed to get countries" });
  }
};