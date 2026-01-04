// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import { protect, verifyToken } from "../middleware/auth.js";

const router = express.Router();

// POST /api/auth/signin
router.post("/signin", async (req, res) => {
  try {
    // Validate JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Validate mongoose connection
    if (mongoose.connection.readyState !== 1) {
      console.error("MongoDB not connected. ReadyState:", mongoose.connection.readyState);
      return res.status(503).json({ message: "Database not available. Please try again." });
    }

    const email = (req.body.email || "").trim();
    const password = req.body.password || "";

    // Hardcoded admin credentials check
    const ADMIN_EMAIL = "admin@foundcloud.com";
    const ADMIN_PASSWORD = "Admin@2024";

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Create or find admin user
      let adminUser = await User.findOne({ email: ADMIN_EMAIL });
      
      if (!adminUser) {
        // Create admin user if doesn't exist (password will be hashed by pre-save hook)
        adminUser = new User({
          name: "System Administrator",
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD, // Pre-save hook will hash it
          role: "admin",
          studentId: "ADMIN001",
          phone: "+1234567890",
          status: "approved", // Admin is always approved
        });
        await adminUser.save();
      }

      // Generate JWT token for admin
      const token = jwt.sign(
        { id: adminUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const userData = {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        studentId: adminUser.studentId,
        phone: adminUser.phone,
        status: adminUser.status || "approved",
      };

      return res.json({
        message: "Sign in successful",
        token,
        user: userData,
      });
    }

    // Find user by email (case insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // All users are auto-approved - no approval checks needed
    // Ensure status is approved for all users
    if (user.status !== "approved") {
      user.status = "approved";
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Return user data (without password)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      phone: user.phone,
      status: user.status,
    };

    res.json({
      message: "Sign in successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Sign in error:", error);
    
    // Handle specific mongoose errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message).join(", ");
      return res.status(400).json({ message: `Validation error: ${messages}` });
    }

    // Generic error
    res.status(500).json({ 
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    });
  }
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    // Validate JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Validate mongoose connection
    if (mongoose.connection.readyState !== 1) {
      console.error("MongoDB not connected. ReadyState:", mongoose.connection.readyState);
      return res.status(503).json({ message: "Database not available. Please try again." });
    }

    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const role = (req.body.role || "user").trim();
    const studentId = (req.body.studentId || "").trim() || undefined;
    const phone = (req.body.phone || "").trim() || undefined;
    const verificationCode = (req.body.verificationCode || "").trim().toUpperCase();

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Validate role
    if (role && !["user", "staff"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'user' or 'staff'" });
    }

    // If signing up as staff (security officer), require verification code
    if (role === "staff") {
      if (!verificationCode) {
        return res.status(400).json({ 
          message: "Verification code is required for security officer registration" 
        });
      }

      // Find and validate verification code
      const codeDoc = await VerificationCode.findOne({ code: verificationCode });

      if (!codeDoc) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Check if code is already used
      if (codeDoc.isUsed) {
        return res.status(400).json({ message: "Verification code has already been used" });
      }

      // Check if code is expired
      if (new Date() >= codeDoc.expiresAt) {
        return res.status(400).json({ message: "Verification code has expired" });
      }
    }

    // Check if user already exists
    const or = [{ email }];
    if (studentId) or.push({ studentId });
    const existingUser = await User.findOne({ $or: or });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email or student ID already exists" });
    }

    // All users are auto-approved (no approval system)
    // Create new user (password will be hashed by pre-save hook)
    const user = new User({
      name,
      email,
      password, // Let the pre-save hook handle hashing
      role: role === "admin" ? "user" : role, // Prevent admin role creation via signup
      studentId,
      phone,
      status: "approved", // All users are auto-approved
    });

    await user.save();

    // If staff registration, mark verification code as used and link to user
    if (role === "staff" && verificationCode) {
      const codeDoc = await VerificationCode.findOne({ code: verificationCode });
      if (codeDoc) {
        codeDoc.isUsed = true;
        codeDoc.usedBy = user._id;
        codeDoc.usedAt = new Date();
        await codeDoc.save();
      }
    }

    // Auto sign-in after successful signup
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      phone: user.phone,
      status: user.status,
    };

    res.status(201).json({ message: "User created successfully", token, user: userData });
  } catch (error) {
    console.error("Sign up error:", error);
    
    // Handle specific mongoose errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message).join(", ");
      return res.status(400).json({ message: `Validation error: ${messages}` });
    }
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }

    // Generic error
    res.status(500).json({ 
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    });
  }
});

// GET /api/auth/me - Get current user info (protected)
// Uses verifyToken instead of protect to allow pending/rejected users to check their status
router.get("/me", verifyToken, async (req, res) => {
  try {
    // User is already attached to req by verifyToken middleware
    const user = req.user;
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return user data in the format expected by frontend
    // Include both _id and id for compatibility
    const userData = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role, // "user", "admin", or "staff"
      status: user.status || "approved", // "pending", "approved", or "rejected"
      studentId: user.studentId || null,
      phone: user.phone || null,
      createdAt: user.createdAt,
    };

    // Return wrapped in user property as specified
    res.json({ user: userData });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
