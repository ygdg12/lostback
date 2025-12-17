// routes/lostItems.js
import express from "express";
import LostItem from "../models/LostItem.js";
import { protect, requireRole } from "../middleware/auth.js";
import { uploadLost } from "../middleware/upload.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

const toAbsoluteImageUrl = (req, imagePath) => {
  if (!imagePath) return imagePath;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (!imagePath.startsWith("/")) return imagePath;
  return `${req.protocol}://${req.get("host")}${imagePath}`;
};

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

    const normalized = items.map((item) => {
      const obj = item.toObject({ virtuals: true });
      obj.images = (obj.images || []).map((p) => toAbsoluteImageUrl(req, p));
      // Compatibility fields for frontends that expect a single image
      obj.imageUrl = obj.images?.[0] || null;
      obj.image = obj.images?.[0] || null;
      return obj;
    });

    res.json({ items: normalized });
  } catch (error) {
    console.error("Error fetching lost items:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/lost-items - Create new lost item (public, but attach user if authenticated)
router.post("/", uploadLost.array("images", 5), async (req, res) => {
  try {
    const imagePaths = (req.files || []).map((file) => `/uploads/lost-items/${file.filename}`);

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
      images: imagePaths,
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
      return res.status(400).json({ message: "File too large (max 5MB)" });
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

export default router;
