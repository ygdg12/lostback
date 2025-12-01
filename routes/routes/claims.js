// routes/claims.js
import express from "express";
import Claim from "../models/Claim.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/claims - Fetch claims (staff/admin see all, users see their own)
router.get("/", protect, async (req, res) => {
  try {
    const query = {};

    // Regular users can only see their own claims
    if (req.user.role === "user") {
      query.claimant = req.user._id;
    }

    const claims = await Claim.find(query)
      .populate("claimant", "name email studentId phone")
      .populate("reviewedBy", "name email")
      .populate({
        path: "item",
        select: "title description category uniqueIdentifier contactEmail contactPhone",
        populate: {
          path: "foundBy",
          select: "name email phone"
        }
      })
      .sort({ createdAt: -1 });

    res.json({ claims });
  } catch (error) {
    console.error("Error fetching claims:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/claims - Create new claim (public; associates claimant if authenticated)
router.post("/", async (req, res) => {
  try {
    const { item, ownershipProof, verificationAnswers } = req.body;

    // Validate required fields
    if (!item || !ownershipProof) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Attempt to attach claimant if an auth token was provided (non-intrusive)
    let claimantId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("_id");
        if (user) claimantId = user._id;
      } catch (_) {
        claimantId = null;
      }
    }

    // If authenticated, ensure no duplicate pending claim by same user
    if (claimantId) {
      const existingClaim = await Claim.findOne({ item, claimant: claimantId, status: "pending" });
      if (existingClaim) {
        return res.status(400).json({ message: "You already have a pending claim for this item" });
      }
    }

    let claimantName = undefined;
    let claimantEmail = undefined;
    if (claimantId) {
      const user = await User.findById(claimantId).select("name email");
      claimantName = user?.name;
      claimantEmail = user?.email;
    } else if (req.body.claimantName || req.body.claimantEmail) {
      claimantName = req.body.claimantName;
      claimantEmail = req.body.claimantEmail;
    }

    const claim = new Claim({
      item,
      claimant: claimantId,
      claimantName,
      claimantEmail,
      ownershipProof,
      verificationAnswers,
    });

    await claim.save();

    // Populate the response
    await claim.populate("claimant", "name email studentId phone");
    await claim.populate({
      path: "item",
      select: "title description category uniqueIdentifier contactEmail contactPhone",
      populate: {
        path: "foundBy",
        select: "name email phone"
      }
    });

    res.status(201).json({ message: "Claim submitted successfully", claim });
  } catch (error) {
    console.error("Error creating claim:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/claims/:id - Update claim status (staff/admin only)
router.patch("/:id", protect, requireRole("staff", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const claim = await Claim.findById(id).populate("item");
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    // Update claim
    claim.status = status;
    claim.reviewedBy = req.user._id;
    claim.reviewedAt = new Date();
    claim.reviewNotes = reviewNotes;

    await claim.save();
    await claim.populate("reviewedBy", "name email");
    await claim.populate("claimant", "name email studentId phone");
    await claim.populate({
      path: "item",
      select: "title description category uniqueIdentifier contactEmail contactPhone",
      populate: {
        path: "foundBy",
        select: "name email phone"
      }
    });

    res.json({ message: "Claim updated successfully", claim });
  } catch (error) {
    console.error("Error updating claim:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
