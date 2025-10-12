import express from "express";
import multer from "multer";
import {
  createUser,
  fetchUsers,
  emailVerification,
  getUserStatus,
  approveUser,
} from "../controllers/userController.js";

// Configure multer for file uploads - simplified version
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  // Remove fileFilter - we'll handle validation in the controller
});

const userRoutes = express.Router();

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Please upload an image smaller than 5MB.",
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  next();
};

userRoutes.post("/users", upload.single("logo"), handleMulterError, createUser);
userRoutes.get("/users", fetchUsers);
userRoutes.post("/email-verification", emailVerification);
userRoutes.get("/status/:email", getUserStatus);
userRoutes.put("/approve/:email", approveUser);

export default userRoutes;
