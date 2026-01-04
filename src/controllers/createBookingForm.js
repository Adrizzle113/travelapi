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
  
  // 2️⃣ Step 2: Call booking form API
  const book_hash_temp = "h-48eb6527-778e-5f64-91c9-b03065f9cc1e"; // this is temporary, replace with dynamic value from book_hashs  because we use sandbox key
  const bookingPayload = {
    partner_order_id: `partner-${uuidv4()}`, // unique ID
    book_hash: book_hash_temp,
    language: "en",
    user_ip: req.ip || "127.0.0.1",
  };
  
  try {
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
    // Enhanced error logging to capture full ETG API error response
    console.error("💥 ===== CREATE BOOKING FORM ERROR =====");
    console.error("📋 Request Context:");
    console.error("  - book_hash:", bookingPayload?.book_hash || "N/A");
    console.error("  - partner_order_id:", bookingPayload?.partner_order_id || "N/A");
    console.error("  - user_ip:", bookingPayload?.user_ip || "N/A");
    console.error("  - language:", bookingPayload?.language || "N/A");
    
    // Log request details if available
    if (error.config) {
      const fullUrl = error.config.baseURL 
        ? `${error.config.baseURL}${error.config.url || ""}`
        : error.config.url || "N/A";
      const requestPayload = typeof error.config.data === "string" 
        ? error.config.data 
        : (error.config.data || bookingPayload);
      
      console.error("📤 Request Details:");
      console.error("  - URL:", fullUrl);
      console.error("  - Method:", error.config.method?.toUpperCase() || "N/A");
      console.error("  - Request Payload:", JSON.stringify(requestPayload, null, 2));
    }
    
    // Handle HTTP errors (error.response exists)
    if (error.response) {
      console.error("❌ HTTP Error Response:");
      console.error("  - Status Code:", error.response.status);
      console.error("  - Status Text:", error.response.statusText);
      console.error("  - Response Headers:", JSON.stringify(error.response.headers, null, 2));
      console.error("  - Response Data:", JSON.stringify(error.response.data, null, 2));
      
      res.status(error.response.status || 500).json({
        message: "❌ Failed to create booking form",
        error: error.response.data || error.response.statusText || "Unknown error",
        statusCode: error.response.status,
        requestDetails: {
          book_hash: bookingPayload?.book_hash,
          partner_order_id: bookingPayload?.partner_order_id,
        },
      });
    } 
    // Handle network errors (no error.response)
    else if (error.request) {
      console.error("🌐 Network Error:");
      console.error("  - Error Message:", error.message);
      console.error("  - Request Object:", error.request);
      console.error("  - Error Code:", error.code);
      
      res.status(500).json({
        message: "❌ Failed to create booking form - Network error",
        error: error.message || "Network request failed",
        requestDetails: {
          book_hash: bookingPayload?.book_hash,
          partner_order_id: bookingPayload?.partner_order_id,
        },
      });
    } 
    // Handle other errors
    else {
      console.error("⚠️ Unknown Error Type:");
      console.error("  - Error Message:", error.message);
      console.error("  - Full Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      res.status(500).json({
        message: "❌ Failed to create booking form",
        error: error.message || "Unknown error occurred",
        requestDetails: {
          book_hash: bookingPayload?.book_hash,
          partner_order_id: bookingPayload?.partner_order_id,
        },
      });
    }
    
    console.error("=========================================");
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
