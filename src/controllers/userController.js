import { addUser, getUsers, updateVerified } from "../models/userModel.js";
import { fileTypeFromBuffer } from "file-type";
import { generateDummyEmail } from "../utils/dummyEmail.js";
import { generateOTP } from "../utils/OTPGen.js";
import {
  mailOptionsForOTP,
  mailOptionsForUser,
  mailOptionsForAdmin,
  mailOptionsForApproval,
} from "../utils/mailOptions.js";
import { supabase } from "../../config/supabaseClient.js";
import { SendEmail } from "../utils/SendEmail.js";

export const createUser = async (req, res) => {
  try {
    let userData = req.body;

    // If logo file exists
    if (req.file) {
      console.log("📁 File received:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      // Validate file type using file-type library
      try {
        const fileType = await fileTypeFromBuffer(req.file.buffer);
        console.log("🔍 Detected file type:", fileType);

        if (!fileType || !fileType.mime.startsWith("image/")) {
          return res.status(400).json({
            success: false,
            error: `File type ${fileType ? fileType.mime : "unknown"
              } is not supported. Please upload an image file (JPEG, PNG, GIF, WebP, or SVG).`,
          });
        }

        console.log("✅ Valid image file confirmed:", fileType.mime);
      } catch (fileTypeError) {
        console.error("Error detecting file type:", fileTypeError);
        return res.status(400).json({
          success: false,
          error:
            "Unable to determine file type. Please upload a valid image file.",
        });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error:
            "File size too large. Please upload an image smaller than 5MB.",
        });
      }

      try {
        const { data, error } = await supabase.storage
          .from("logos")
          .upload(
            `logos/${Date.now()}-${req.file.originalname}`,
            req.file.buffer,
            {
              cacheControl: "3600",
              upsert: false,
              contentType: req.file.mimetype,
            }
          );

        if (error) {
          console.error("Supabase upload error:", error);
          throw error;
        }

        const logoUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/logos/${data.path}`;
        userData.logo_url = logoUrl;
        console.log("✅ Logo uploaded successfully:", logoUrl);
      } catch (uploadError) {
        console.error("Logo upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          error: `Failed to upload logo: ${uploadError.message}`,
        });
      }
    }

    const dummyEmail = generateDummyEmail(userData.email);
    console.log("🚀 ~ createUser ~ dummyEmail:", dummyEmail);

    const otp = generateOTP();
    console.log("🚀 ~ createUser ~ otp:", otp, "type:", typeof otp);
    const email_Verification = "unverified";
    const status = "pending";

    // Clean and prepare user data for database insertion
    const cleanUserData = {
      email: userData.email,
      first_name: userData.first_name || null,
      last_name: userData.last_name || null,
      phone_number: userData.phone_number || null,
      agency_name: userData.agency_name || null,
      legal_name: userData.legal_name || null,
      city: userData.city || null,
      address: userData.address || null,
      actual_address_matches: userData.actual_address_matches !== undefined ? userData.actual_address_matches : true,
      itn: userData.itn || null,
      logo_url: userData.logo_url || null,
      dummyEmail: dummyEmail,
      status: status,
      email_Verification: email_Verification,
      otp: otp
    };

    console.log("🚀 ~ createUser ~ cleanUserData:", JSON.stringify(cleanUserData, null, 2));

    const result = await addUser(cleanUserData);

    const res_mailOptionsForOTP = await mailOptionsForOTP(otp, userData.email, userData);
    console.log("🚀 ~ createUser ~ res_mailOptionsForOTP:", res_mailOptionsForOTP)

    const res_sendEmail = await SendEmail(res_mailOptionsForOTP);
    console.log("🚀 ~ createUser ~ res_sendEmail:", res_sendEmail)

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
};

export const emailVerification = async (req, res) => {
  const { email, otp } = req.body;
  console.log('🔍 Email verification request:', { email, otp });

  try {
    // Get user data from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      console.log('❌ User not found:', userError);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log('👤 User found:', {
      email: user.email,
      storedOTP: user.otp,
      receivedOTP: otp,
      status: user.status,
      email_Verification: user.email_Verification
    });

    if (user.otp == otp) {
      console.log('✅ OTP matches, updating verification status');
      const update_res = await updateVerified(email);

      const res_mailOptionsForUser = await mailOptionsForUser(user);

      await SendEmail(res_mailOptionsForUser);

      const res_mailOptionsForAdmin = await mailOptionsForAdmin(user);

      await SendEmail(res_mailOptionsForAdmin);

      console.log('✅ Email verification completed successfully');
      res.json({
        success: true,
        message: "email verified",
        update_res: update_res,
      });
    } else {
      console.log('❌ OTP mismatch');
      res.json({
        success: false,
        message: "email Verification failed || email unverified ",
      });
    }
  } catch (error) {
    console.error('💥 Email verification error:', error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const fetchUsers = async (req, res) => {
  try {
    const result = await getUsers();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getUserStatus = async (req, res) => {
  const { email } = req.params;
  try {
    // Get user data from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Return user status information
    res.json({
      success: true,
      data: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        status: user.status,
        email_Verification: user.email_Verification,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error("Get user status error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const approveUser = async (req, res) => {
  const { email } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  try {
    // Update user status in database
    const { data: user, error: updateError } = await supabase
      .from("users")
      .update({ status: status })
      .eq("email", email)
      .select()
      .single();

    if (updateError || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found or update failed"
      });
    }

    // Send approval email if status is approved
    if (status === 'approved') {
      const res_mailOptionsForApproval = await mailOptionsForApproval(user);
      await SendEmail(res_mailOptionsForApproval);
      console.log(`✅ Approval email sent to ${email}`);
    }

    res.json({
      success: true,
      message: `User ${status} successfully`,
      data: user
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

