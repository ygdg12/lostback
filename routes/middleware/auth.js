import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Middleware: Protect routes by verifying JWT
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    // Check if user is approved (admin and staff are always approved)
    if (user.role !== "admin" && user.role !== "staff" && user.status !== "approved") {
      if (user.status === "pending") {
        return res.status(403).json({ 
          message: "Your account is pending approval. Please wait for admin approval.",
          status: "pending"
        });
      }
      if (user.status === "rejected") {
        return res.status(403).json({ 
          message: "Your account has been rejected. Please contact support.",
          status: "rejected"
        });
      }
    }

    req.user = user; // Attach user to request
    next();
  } catch (err) {
    console.error("❌ JWT verification error:", err.message);
    res.status(401).json({ message: "Not authorized, invalid or expired token" });
  }
};

/**
 * Middleware: Verify JWT token only (no approval status check)
 * Used for endpoints that need to check user status (like /api/auth/me)
 */
export const verifyToken = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = user; // Attach user to request (without approval check)
    next();
  } catch (err) {
    console.error("❌ JWT verification error:", err.message);
    res.status(401).json({ message: "Not authorized, invalid or expired token" });
  }
};

/**
 * Middleware: Restrict access to specific roles
 * @param  {...string} roles - Allowed roles (e.g. "admin", "staff")
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied: insufficient permissions" });
    }

    next();
  };
};
