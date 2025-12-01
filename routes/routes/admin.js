// routes/admin.js
import express from "express";
import User from "../models/User.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/admin/users - Fetch all users (admin only)
router.get("/users", protect, requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id/role - Update user role (admin only)
router.patch("/users/:id/role", protect, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["user", "staff", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot change your own role" });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User role updated successfully", user });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id/status - Update user status (admin only)
router.patch("/users/:id/status", protect, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot change your own status" });
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User status updated successfully", user });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/users/:id - Delete user (admin only)
router.delete("/users/:id", protect, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
