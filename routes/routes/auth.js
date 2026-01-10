// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import { sendEmail } from "../../config/email.js";
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

    // Block access for users awaiting admin approval or rejected
    if (user.status === "pending") {
      return res.status(403).json({ message: "Your account is pending admin approval." });
    }

    if (user.status === "rejected") {
      return res.status(403).json({ message: "Your account was rejected by an admin." });
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

    // Create new user (password will be hashed by pre-save hook)
    const user = new User({
      name,
      email,
      password, // Let the pre-save hook handle hashing
      role: role === "admin" ? "user" : role, // Prevent admin role creation via signup
      studentId,
      phone,
      status: role === "staff" ? "approved" : "pending", // Staff auto-approved, regular users need admin approval
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

    // Return minimal data; frontend can poll /api/auth/me after approval
    res.status(201).json({ 
      message: user.role === "staff"
        ? "Staff account created and approved."
        : "Account created. Please wait for admin approval.",
      user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      phone: user.phone,
      status: user.status,
      },
    });
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
      status: user.status, // "pending", "approved", or "rejected"
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

// POST /api/auth/request-password-reset
// Body: { email: string }
// Response: { message: "Password reset code sent successfully" }
router.post("/request-password-reset", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    // Validate email
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a 6-character reset code/token
    const generateToken = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars
      let token = "";
      for (let i = 0; i < 6; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    };

    // Ensure token is unique
    let token;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      token = generateToken();
      const existing = await PasswordResetToken.findOne({ token, usedAt: null });
      if (!existing || new Date() >= existing.expiresAt) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ message: "Failed to generate unique reset token. Please try again." });
    }

    // Set expiration (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Invalidate previous unused tokens for this user
    await PasswordResetToken.updateMany(
      { user: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    // Store the reset token in the database
    const resetToken = new PasswordResetToken({
      user: user._id,
      token,
      expiresAt,
    });

    await resetToken.save();

    // Send the code to the user's email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Code - FoundCloud",
        text: `Hello ${user.name},

You requested a password reset for your FoundCloud account.

Your password reset code is: ${resetToken.token}

This code will expire in 1 hour (${expiresAt.toLocaleString()}).

Please use this code on the reset password page to create a new password.

If you did not request this password reset, please ignore this email or contact support.

Thanks,
FoundCloud Support`,
      });
      console.log(`✅ Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send password reset email to ${user.email}:`, emailError.message);
      // Still return success to prevent email enumeration
      // Token is generated and stored, admin can share manually if needed
    }

    // Always return success message (even if email fails) to prevent user enumeration
    return res.json({
      message: "Password reset code sent successfully",
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/reset-password
// Body: { email, token, newPassword }
router.post("/reset-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const token = (req.body.token || "").trim().toUpperCase();
    const newPassword = req.body.newPassword || "";

    if (!email || !token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, reset token, and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = await PasswordResetToken.findOne({
      user: user._id,
      token,
    });

    if (!resetToken) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    if (!resetToken.isValid()) {
      return res.status(400).json({ message: "Reset token is expired or already used" });
    }

    // Update password (User model pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    // Mark token as used
    resetToken.usedAt = new Date();
    await resetToken.save();

    return res.json({ message: "Password updated successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
