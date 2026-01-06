import { createRequire } from "module";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

const require = createRequire(import.meta.url);
const { WorldOTAService } = require("../../services/worldotaService.js");

const worldotaService = new WorldOTAService();

export const createBookingForm = async (req, res) => {
  const startTime = Date.now();
  const { book_hashs, hotelData, book_hash } = req.body;
  
  console.log("📝 === CREATE BOOKING FORM REQUEST ===");
  console.log("📥 Request body:", { book_hashs, book_hash, hasHotelData: !!hotelData });

  try {
    // Use provided book_hash or first from book_hashs array, or fallback to temp
    let bookHash = book_hash;
    
    if (!bookHash && book_hashs && Array.isArray(book_hashs) && book_hashs.length > 0) {
      bookHash = book_hashs[0];
    }
    
    if (!bookHash) {
      // Fallback to temp hash for sandbox (remove in production)
      bookHash = "h-48eb6527-778e-5f64-91c9-b03065f9cc1e";
      console.warn("⚠️ Using temporary book_hash for sandbox testing");
    }

    const partnerOrderId = `partner-${uuidv4()}`;

    console.log(`🔑 Book Hash: ${bookHash}`);
    console.log(`🆔 Partner Order ID: ${partnerOrderId}`);

    // Use WorldOTAService method
    const bookingFormResult = await worldotaService.createBookingForm({
      bookHash: bookHash,
      partnerOrderId: partnerOrderId,
      language: "en",
      userIp: req.ip || "127.0.0.1",
    });

    const duration = Date.now() - startTime;

    if (!bookingFormResult.success) {
      throw new Error(bookingFormResult.error || "Failed to create booking form");
    }

    res.json({
      message: "✅ Booking form created successfully",
      data: {
        hotelDetails: hotelData,
        bookingForm: bookingFormResult.data,
        orderId: bookingFormResult.data.order_id,
        partnerOrderId: partnerOrderId,
        paymentTypes: bookingFormResult.data.payment_types,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("💥 Create booking form error:", error.message);
    
    res.status(500).json({
      message: "❌ Failed to create booking form",
      error: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

export const getCountries = async (req, res) => {
  try {
    // This endpoint is from RateHawk public API, not WorldOTA
    const response = await fetch(
      "https://www.ratehawk.com/api/v3/site/accounts/countries/"
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch countries: ${response.statusText}`);
    }
    
    const countries = await response.json();
    res.json(countries);
  } catch (error) {
    console.error("💥 Get countries error:", error);
    res.status(500).json({ 
      message: "❌ Failed to get countries",
      error: error.message 
    });
  }
};
