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
  console.log("hit");
  const { book_hashs, hotelData } = req.body;
  console.log(book_hashs, "book_hashbook_hashbook_hash");
  try {
    // 2️⃣ Step 2: Call booking form API
    const book_hash_temp = "h-48eb6527-778e-5f64-91c9-b03065f9cc1e"; // this is temporary, replace with dynamic value from book_hashs  because we use sandbox key
    const bookingPayload = {
      partner_order_id: `partner-${uuidv4()}`, // unique ID
      book_hash: book_hash_temp,
      language: "en",
      user_ip: req.ip || "127.0.0.1",
    };

    console.log(bookingPayload);
    const bookingResponse = await api.post(
      "hotel/order/booking/form/",
      bookingPayload
    );

    // 3️⃣ Step 3: Send combined data
    res.json({
      message: "✅ Booking form created successfully",
      data: {
        hotelDetails: hotelData,
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
    const countries = await api.get(
      "https://www.ratehawk.com/api/v3/site/accounts/countries/"
    );
    res.json(countries.data);
  } catch (error) {
    console.error("💥 Get countries error:", error);
    res.status(500).json({ message: "❌ Failed to get countries" });
  }
};
