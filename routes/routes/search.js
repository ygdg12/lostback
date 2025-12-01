// routes/search.js
import express from "express";
import LostItem from "../models/LostItem.js";
import FoundItem from "../models/FoundItem.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// GET /api/search - Advanced search across lost and found items
router.get("/", protect, async (req, res) => {
  try {
    const { q: query, category, color, brand, location, dateFrom, dateTo, type } = req.query;

    const searchQuery = {};
    const foundQuery = {};

    // Text search
    if (query) {
      const textSearch = {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { additionalDetails: { $regex: query, $options: "i" } },
        ],
      };
      searchQuery.$and = searchQuery.$and || [];
      searchQuery.$and.push(textSearch);
      foundQuery.$and = foundQuery.$and || [];
      foundQuery.$and.push(textSearch);
    }

    // Filters
    if (category) {
      searchQuery.category = category;
      foundQuery.category = category;
    }
    if (color) {
      searchQuery.color = { $regex: color, $options: "i" };
      foundQuery.color = { $regex: color, $options: "i" };
    }
    if (brand) {
      searchQuery.brand = { $regex: brand, $options: "i" };
      foundQuery.brand = { $regex: brand, $options: "i" };
    }
    if (location) {
      searchQuery.location = { $regex: location, $options: "i" };
      foundQuery.location = { $regex: location, $options: "i" };
    }

    // Date range
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.$lte = new Date(dateTo);
      searchQuery.dateLost = dateFilter;
      foundQuery.dateFound = dateFilter;
    }

    const results = {};

    if (type === "all" || type === "lost" || !type) {
      const lostItems = await LostItem.find(searchQuery)
        .populate("reportedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(50);
      results.lostItems = lostItems;
    }

    if (type === "all" || type === "found" || !type) {
      const foundItems = await FoundItem.find(foundQuery)
        .populate("foundBy", "name email")
        .sort({ createdAt: -1 })
        .limit(50);
      results.foundItems = foundItems;
    }

    res.json(results);
  } catch (error) {
    console.error("Error performing search:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/search/suggestions - Get search suggestions and autocomplete
router.get("/suggestions", protect, async (req, res) => {
  try {
    const { q: query, type } = req.query;

    if (!query || query.length < 2) return res.json({ suggestions: [] });

    const suggestions = new Set();

    if (type === "all" || type === "lost" || !type) {
      const lostTitles = await LostItem.find({ title: { $regex: query, $options: "i" } })
        .select("title")
        .limit(10);
      lostTitles.forEach((item) => suggestions.add(item.title));
    }

    if (type === "all" || type === "found" || !type) {
      const foundTitles = await FoundItem.find({ title: { $regex: query, $options: "i" } })
        .select("title")
        .limit(10);
      foundTitles.forEach((item) => suggestions.add(item.title));
    }

    const brands = await LostItem.distinct("brand", { brand: { $regex: query, $options: "i" } });
    brands.forEach((brand) => brand && suggestions.add(brand));

    const foundBrands = await FoundItem.distinct("brand", { brand: { $regex: query, $options: "i" } });
    foundBrands.forEach((brand) => brand && suggestions.add(brand));

    res.json({ suggestions: Array.from(suggestions).slice(0, 10) });
  } catch (error) {
    console.error("Error getting search suggestions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/search/matches - Find potential matches between lost and found items
router.get("/matches", protect, async (req, res) => {
  try {
    const { lostItemId } = req.query;
    if (!lostItemId) return res.status(400).json({ message: "Lost item ID required" });

    const lostItem = await LostItem.findById(lostItemId);
    if (!lostItem) return res.status(404).json({ message: "Lost item not found" });

    const matchQuery = { status: "unclaimed", category: lostItem.category };
    const optionalMatches = [];

    if (lostItem.color) optionalMatches.push({ color: { $regex: lostItem.color, $options: "i" } });
    if (lostItem.brand) optionalMatches.push({ brand: { $regex: lostItem.brand, $options: "i" } });
    if (lostItem.size) optionalMatches.push({ size: { $regex: lostItem.size, $options: "i" } });

    const titleWords = lostItem.title.split(" ").filter((w) => w.length > 2);
    if (titleWords.length) {
      optionalMatches.push({
        $or: [
          { title: { $regex: titleWords.join("|"), $options: "i" } },
          { description: { $regex: titleWords.join("|"), $options: "i" } },
        ],
      });
    }

    if (optionalMatches.length) matchQuery.$or = optionalMatches;

    const potentialMatches = await FoundItem.find(matchQuery)
      .populate("foundBy", "name email")
      .sort({ dateFound: -1 })
      .limit(20);

    const scoredMatches = potentialMatches.map((foundItem) => {
      let score = 0;
      if (foundItem.category === lostItem.category) score += 30;
      if (lostItem.color && foundItem.color && foundItem.color.toLowerCase().includes(lostItem.color.toLowerCase())) score += 25;
      if (lostItem.brand && foundItem.brand && foundItem.brand.toLowerCase().includes(lostItem.brand.toLowerCase())) score += 25;
      if (lostItem.size && foundItem.size && foundItem.size.toLowerCase().includes(lostItem.size.toLowerCase())) score += 15;

      const lostWords = lostItem.title.toLowerCase().split(" ");
      const foundWords = foundItem.title.toLowerCase().split(" ");
      score += lostWords.filter((w) => foundWords.includes(w)).length * 5;

      const daysDiff = Math.abs(new Date(foundItem.dateFound) - new Date(lostItem.dateLost)) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 7) score += 10;
      else if (daysDiff <= 30) score += 5;

      return { ...foundItem.toObject(), matchScore: score };
    });

    const topMatches = scoredMatches
      .filter((m) => m.matchScore >= 30)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json({ lostItem, matches: topMatches.slice(0, 10) });
  } catch (error) {
    console.error("Error finding matches:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
