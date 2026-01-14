// routes/lostItems.js
import express from "express";
import LostItem from "../models/LostItem.js";
import { protect, requireRole } from "../middleware/auth.js";
import { uploadLost } from "../middleware/upload.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// GET /api/lost-items - Fetch all lost items (public, optional filters)
router.get("/", async (req, res) => {
  try {
    const { category, status, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const items = await LostItem.find(query)
      .populate("reportedBy", "name email studentId phone")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ items });
  } catch (error) {
    console.error("Error fetching lost items:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/lost-items - Create new lost item (public, but attach user if authenticated)
router.post("/", uploadLost.array("images", 5), async (req, res) => {
  try {
    // Extract Cloudinary URLs from uploaded files
    const imageUrls = (req.files || []).map((file) => {
      // Cloudinary returns secure_url in file object
      return file.path || file.secure_url || file.url;
    }).filter(Boolean); // Remove any undefined/null values

    // Optional auth - try to get user from token
    let userId = null;
    let userEmail = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("_id email");
        if (user) {
          userId = user._id;
          userEmail = user.email;
        }
      } catch (_) {
        // Invalid token, continue as anonymous
      }
    }

    const {
      uniqueIdentifier,
      title,
      description,
      category,
      location,
      dateLost,
      contactEmail,
      contactPhone,
      color,
      brand,
      size,
      additionalDetails,
    } = req.body;

    if (!uniqueIdentifier || !title || !description || !category || !location || !dateLost) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const lostItem = new LostItem({
      uniqueIdentifier,
      title,
      description,
      category,
      location,
      dateLost: new Date(dateLost),
      reportedBy: userId || null,
      contactInfo: {
        email: contactEmail || userEmail || undefined,
        phone: contactPhone || undefined,
      },
      images: imageUrls,
      color,
      brand,
      size,
      additionalDetails,
    });

    await lostItem.save();
    if (lostItem.reportedBy) {
      await lostItem.populate("reportedBy", "name email studentId phone");
    }

    res.status(201).json({ message: "Lost item reported successfully", item: lostItem });
  } catch (error) {
    console.error("Error creating lost item:", error);
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 10MB)" });
    }
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/lost-items/my-items - Fetch user's lost items
router.get("/my-items", protect, async (req, res) => {
  try {
    const items = await LostItem.find({ reportedBy: req.user._id })
      .populate("foundBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    console.error("Error fetching user's lost items:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/lost-items/:id - Fetch single lost item
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await LostItem.findById(id)
      .populate("reportedBy", "name email studentId phone");

    if (!item) return res.status(404).json({ message: "Item not found" });

    res.json({ item });
  } catch (error) {
    console.error("Error fetching lost item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/lost-items/:id - Update lost item (owner or staff/admin only)
router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if ("uniqueIdentifier" in updates && !updates.uniqueIdentifier) {
      return res.status(400).json({ message: "uniqueIdentifier cannot be empty" });
    }

    const item = await LostItem.findById(id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    // Check ownership: only owner or staff/admin can update
    const isOwner = item.reportedBy && item.reportedBy.toString() === req.user._id.toString();
    const isStaffOrAdmin = req.user.role === "staff" || req.user.role === "admin";
    
    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({ message: "You can only update items you reported" });
    }

    Object.assign(item, updates);
    await item.save();

    await item.populate("reportedBy", "name email studentId phone");

    res.json({ message: "Item updated successfully", item });
  } catch (error) {
    console.error("Error updating lost item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/lost-items/:id/mark-found - User reports they found the lost item
// Creates a pending report that staff/admin must approve (does NOT mark item as found yet)
router.post("/:id/mark-found", uploadLost.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const providedUniqueId = (req.body.uniqueIdentifier || "").trim();

    const item = await LostItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Lost item not found" });
    }

    // Require an image as verification
    if (!req.file) {
      return res.status(400).json({ message: "Verification image is required" });
    }

    const imageUrl = req.file.path || req.file.secure_url || req.file.url;
    if (!imageUrl) {
      return res.status(500).json({ message: "Failed to process verification image" });
    }

    // If already marked found/closed, prevent duplicate
    if (item.status === "found" || item.status === "closed") {
      return res.status(400).json({ message: "This lost item has already been marked as found or closed" });
    }

    // Attach submitter if authenticated (optional)
    let submittedBy = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        submittedBy = decoded?.id || null;
      } catch (_) {
        submittedBy = null;
      }
    }

    // If there's already a pending report, overwrite it with the latest submission
    if (item.foundReport?.status === "pending") {
      item.foundReport.submittedBy = submittedBy || item.foundReport.submittedBy;
      item.foundReport.submittedAt = new Date();
      item.foundReport.submittedUniqueIdentifier = providedUniqueId || item.foundReport.submittedUniqueIdentifier;
      item.foundReport.image = imageUrl;
      item.foundReport.rejectedBy = null;
      item.foundReport.rejectedAt = null;
      item.foundReport.rejectionReason = null;
    } else {
      item.foundReport = {
        status: "pending",
        submittedBy,
        submittedAt: new Date(),
        submittedUniqueIdentifier: providedUniqueId || null,
        image: imageUrl,
      };
    }

    await item.save();

    return res.status(200).json({
      message: "Report submitted. Awaiting staff/admin approval.",
      item: await LostItem.findById(id).populate("reportedBy", "name email studentId phone"),
    });
  } catch (error) {
    console.error("Error marking lost item as found:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/lost-items/found-reports - List lost items with pending/approved/rejected found reports (staff/admin only)
router.get("/found-reports", protect, requireRole("admin", "staff"), async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const items = await LostItem.find({ "foundReport.status": status })
      .populate("reportedBy", "name email studentId phone")
      .populate("foundReport.submittedBy", "name email studentId phone")
      .populate("foundReport.approvedBy", "name email")
      .populate("foundReport.rejectedBy", "name email")
      .sort({ "foundReport.submittedAt": -1 });

    res.json({ items });
  } catch (error) {
    console.error("Error fetching found reports:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/lost-items/:id/found-report/approve - Approve a found report (staff/admin only)
router.patch("/:id/found-report/approve", protect, requireRole("admin", "staff"), async (req, res) => {
  try {
    const { id } = req.params;
    const item = await LostItem.findById(id);
    if (!item) return res.status(404).json({ message: "Lost item not found" });

    if (!item.foundReport || item.foundReport.status !== "pending") {
      return res.status(400).json({ message: "No pending found report to approve" });
    }

    // Mark lost item as found
    item.status = "found";
    item.foundVerification = {
      image: item.foundReport.image,
      reportedAt: item.foundReport.submittedAt || new Date(),
      approvedBy: req.user._id,
    };

    // Update report status
    item.foundReport.status = "approved";
    item.foundReport.approvedBy = req.user._id;
    item.foundReport.approvedAt = new Date();
    item.foundReport.rejectedBy = null;
    item.foundReport.rejectedAt = null;
    item.foundReport.rejectionReason = null;

    await item.save();

    const populated = await LostItem.findById(id)
      .populate("reportedBy", "name email studentId phone")
      .populate("foundReport.submittedBy", "name email studentId phone")
      .populate("foundReport.approvedBy", "name email");

    res.json({ message: "Found report approved. Lost item marked as found.", item: populated });
  } catch (error) {
    console.error("Error approving found report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/lost-items/:id/found-report/reject - Reject a found report (staff/admin only)
router.patch("/:id/found-report/reject", protect, requireRole("admin", "staff"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const item = await LostItem.findById(id);
    if (!item) return res.status(404).json({ message: "Lost item not found" });

    if (!item.foundReport || item.foundReport.status !== "pending") {
      return res.status(400).json({ message: "No pending found report to reject" });
    }

    item.foundReport.status = "rejected";
    item.foundReport.rejectedBy = req.user._id;
    item.foundReport.rejectedAt = new Date();
    item.foundReport.rejectionReason = reason || null;

    await item.save();

    const populated = await LostItem.findById(id)
      .populate("reportedBy", "name email studentId phone")
      .populate("foundReport.submittedBy", "name email studentId phone")
      .populate("foundReport.rejectedBy", "name email");

    res.json({ message: "Found report rejected.", item: populated });
  } catch (error) {
    console.error("Error rejecting found report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/lost-items/:id - Delete a lost item (staff/admin only)
router.delete("/:id", protect, requireRole("admin", "staff"), async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await LostItem.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Lost item not found" });
    }

    return res.status(200).json({ message: "Lost item removed successfully" });
  } catch (error) {
    console.error("Delete lost item error:", error);
    return res.status(500).json({ message: "Failed to remove lost item" });
  }
});

export default router;
