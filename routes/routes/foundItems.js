import express from "express"
import FoundItem from "../../routes/models/FoundItem.js" // fixed path
import { upload } from "../../routes/middleware/upload.js" // fixed multer import
import { protect, requireRole } from "../../routes/middleware/auth.js"
import jwt from "jsonwebtoken"
import User from "../../routes/models/User.js"

const router = express.Router()

// Helper function to get user from token (optional auth)
const getOptionalUser = async (req) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.id).select("_id")
      return user
    } catch (_) {
      return null
    }
  }
  return null
}

// POST /api/found-items - Add a new found item
router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    // Extract Cloudinary URLs from uploaded files
    const imageUrls = (req.files || []).map((file) => {
      // Cloudinary returns secure_url in file object
      return file.path || file.secure_url || file.url;
    }).filter(Boolean); // Remove any undefined/null values

    // Get user if authenticated (optional)
    const user = await getOptionalUser(req)

    // Create new found item
    if (!req.body.uniqueIdentifier) {
      return res.status(400).json({ message: "uniqueIdentifier is required" })
    }
    const newItem = new FoundItem({
      uniqueIdentifier: req.body.uniqueIdentifier,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      location: req.body.location,
      dateFound: req.body.dateFound,
      contactEmail: req.body.contactEmail,
      contactPhone: req.body.contactPhone,
      images: imageUrls,
      foundBy: user?._id || null,
    })

    // Save to DB
    const savedItem = await newItem.save()
    await savedItem.populate("foundBy", "_id name email studentId phone")
    res.status(201).json({
      message: "Item successfully added to registry!",
      item: savedItem,
    })
  } catch (error) {
    console.error("Error saving found item:", error)

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ message: "Validation error", errors })
    }

    // Handle Multer file upload errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 5MB)" })
    }
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ message: error.message })
    }

    res.status(500).json({ message: "Failed to save found item", error: error.message })
  }
})

// GET /api/found-items - Fetch all found items (public, but populate foundBy)
router.get("/", async (req, res) => {
  try {
    const items = await FoundItem.find()
      .populate("foundBy", "_id name email studentId phone")
      .sort({ createdAt: -1 })
    res.status(200).json({ items })
  } catch (error) {
    console.error("Error fetching found items:", error)
    res.status(500).json({ message: "Failed to load items", error: error.message })
  }
})

// GET /api/found-items/my-items - Fetch user's found items
router.get("/my-items", protect, async (req, res) => {
  try {
    const items = await FoundItem.find({ foundBy: req.user._id })
      .populate("foundBy", "_id name email studentId phone")
      .sort({ createdAt: -1 })
    res.status(200).json({ items })
  } catch (error) {
    console.error("Error fetching user's found items:", error)
    res.status(500).json({ message: "Failed to load items", error: error.message })
  }
})

// PATCH /api/found-items/:id - Update a found item (owner or staff/admin only)
router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params
    const item = await FoundItem.findById(id)
    
    if (!item) {
      return res.status(404).json({ message: "Item not found" })
    }

    // Check ownership: only owner or staff/admin can update
    // foundBy can be an ObjectId (not populated) or null
    const itemFoundById = item.foundBy ? item.foundBy.toString() : null
    const userId = req.user._id.toString()
    const isOwner = itemFoundById && itemFoundById === userId
    const isStaffOrAdmin = req.user.role === "staff" || req.user.role === "admin"
    
    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({ message: "You can only update items you reported" })
    }

    const allowed = [
      "uniqueIdentifier",
      "title",
      "description",
      "category",
      "location",
      "dateFound",
      "contactEmail",
      "contactPhone",
    ]
    const updates = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    if ("uniqueIdentifier" in updates && !updates.uniqueIdentifier) {
      return res.status(400).json({ message: "uniqueIdentifier cannot be empty" })
    }

    const updated = await FoundItem.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate("foundBy", "_id name email studentId phone")
    
    res.json({ message: "Item updated successfully", item: updated })
  } catch (error) {
    console.error("Error updating found item:", error)
    res.status(500).json({ message: "Failed to update item", error: error.message })
  }
})

// DELETE /api/found-items/:id - Delete a found item (staff/admin only)
router.delete("/:id", protect, requireRole("admin", "staff"), async (req, res) => {
  try {
    const { id } = req.params

    const deleted = await FoundItem.findByIdAndDelete(id)

    if (!deleted) {
      return res.status(404).json({ message: "Found item not found" })
    }

    return res.status(200).json({ message: "Found item removed successfully" })
  } catch (error) {
    console.error("Delete found item error:", error)
    return res.status(500).json({ message: "Failed to remove found item" })
  }
})

export default router
