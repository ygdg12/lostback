// routes/admin.js
import express from "express";
import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/admin/users - Fetch all users (admin only)
router.get("/users", protect, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.query; // Optional filter by status
    const query = status ? { status } : {};
    const users = await User.find(query)
      .select("-password")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email")
      .sort({ createdAt: -1 });
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

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot change your own status" });
    }

    const update = {
      status,
      approvedBy: status === "approved" ? req.user._id : null,
      approvedAt: status === "approved" ? new Date() : null,
      rejectedBy: status === "rejected" ? req.user._id : null,
      rejectedAt: status === "rejected" ? new Date() : null,
      rejectionReason: status === "rejected" ? "Updated by admin" : null,
    };

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User status updated successfully", user });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id/approve - Approve user (admin only)
router.patch("/users/:id/approve", protect, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.status === "approved") {
      return res.status(400).json({ message: "User is already approved" });
    }

    user.status = "approved";
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    user.rejectedBy = null;
    user.rejectedAt = null;
    user.rejectionReason = null;

    await user.save();

    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("approvedBy", "name email");

    res.json({ message: "User approved successfully", user: updatedUser });
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id/reject - Reject user (admin only)
router.patch("/users/:id/reject", protect, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional rejection reason
    const user = await User.findById(id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.status === "rejected") {
      return res.status(400).json({ message: "User is already rejected" });
    }

    user.status = "rejected";
    user.rejectedBy = req.user._id;
    user.rejectedAt = new Date();
    user.rejectionReason = reason || null;
    user.approvedBy = null;
    user.approvedAt = null;

    await user.save();

    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("rejectedBy", "name email");

    res.json({ message: "User rejected successfully", user: updatedUser });
  } catch (error) {
    console.error("Error rejecting user:", error);
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

// POST /api/admin/verification-codes - Generate verification code for security officer (admin only)
router.post("/verification-codes", protect, requireRole("admin"), async (req, res) => {
  try {
    const { expiresInDays = 7 } = req.body;

    // Generate a random 8-character code
    const generateCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Ensure code is unique
    let code;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = generateCode();
      const existing = await VerificationCode.findOne({ code });
      if (!existing) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ message: "Failed to generate unique code" });
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

    // Create verification code
    const verificationCode = new VerificationCode({
      code,
      role: "staff",
      createdBy: req.user._id,
      expiresAt,
    });

    await verificationCode.save();

    res.status(201).json({
      message: "Verification code generated successfully",
      code: {
        id: verificationCode._id,
        code: verificationCode.code,
        role: verificationCode.role,
        expiresAt: verificationCode.expiresAt,
        createdAt: verificationCode.createdAt,
      },
    });
  } catch (error) {
    console.error("Error generating verification code:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/verification-codes - Get all verification codes (admin only)
router.get("/verification-codes", protect, requireRole("admin"), async (req, res) => {
  try {
    const codes = await VerificationCode.find({})
      .populate("createdBy", "name email")
      .populate("usedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ codes });
  } catch (error) {
    console.error("Error fetching verification codes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/verification-codes/:id - Delete verification code (admin only)
router.delete("/verification-codes/:id", protect, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const code = await VerificationCode.findByIdAndDelete(id);

    if (!code) return res.status(404).json({ message: "Verification code not found" });

    res.json({ message: "Verification code deleted successfully" });
  } catch (error) {
    console.error("Error deleting verification code:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/password-reset-requests - Get all password reset requests (admin only)
router.get("/password-reset-requests", protect, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.query; // Optional filter by status: "pending", "code_generated", "completed", "expired"
    
    const query = status ? { status } : {};
    
    const requests = await PasswordResetRequest.find(query)
      .populate("user", "name email studentId phone")
      .populate("generatedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    console.error("Error fetching password reset requests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/password-reset-requests/:id/generate-code - Generate code for a specific password reset request (admin only)
router.post(
  "/password-reset-requests/:id/generate-code",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { expiresInMinutes = 60 } = req.body; // Default 1 hour expiration

      // Find the password reset request
      const resetRequest = await PasswordResetRequest.findById(id).populate("user");
      
      if (!resetRequest) {
        return res.status(404).json({ message: "Password reset request not found" });
      }

      // Check if request is still valid
      if (resetRequest.status === "completed") {
        return res.status(400).json({ message: "This password reset request has already been completed" });
      }

      if (resetRequest.status === "expired") {
        return res.status(400).json({ message: "This password reset request has expired" });
      }

      // Generate a 6-character alphanumeric code
      const generateCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars
        let code = "";
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      // Ensure code is unique
      let code;
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        code = generateCode();
        const existing = await PasswordResetRequest.findOne({
          code,
          status: "code_generated",
          expiresAt: { $gt: new Date() },
        });
        if (!existing) isUnique = true;
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({ message: "Failed to generate unique code. Please try again." });
      }

      // Set expiration
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      // Update the request with code
      resetRequest.code = code;
      resetRequest.status = "code_generated";
      resetRequest.expiresAt = expiresAt;
      resetRequest.generatedBy = req.user._id;
      resetRequest.generatedAt = new Date();

      await resetRequest.save();

      // Populate user info for response
      const updatedRequest = await PasswordResetRequest.findById(id)
        .populate("user", "name email studentId phone")
        .populate("generatedBy", "name email");

      res.status(200).json({
        message: "Password reset code generated successfully",
        request: {
          id: updatedRequest._id,
          code: updatedRequest.code,
          expiresAt: updatedRequest.expiresAt,
          user: {
            id: updatedRequest.user._id,
            name: updatedRequest.user.name,
            email: updatedRequest.user.email,
            studentId: updatedRequest.user.studentId,
            phone: updatedRequest.user.phone,
          },
          generatedBy: updatedRequest.generatedBy,
          generatedAt: updatedRequest.generatedAt,
        },
      });
    } catch (error) {
      console.error("Error generating password reset code:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
