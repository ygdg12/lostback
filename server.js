import express from "express";
import dns from "dns";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/database.js";
import dotenv from "dotenv";

import authRoutes from "./routes/routes/auth.js";
import lostItemsRoutes from "./routes/routes/lostItems.js";
import foundItemsRoutes from "./routes/routes/foundItems.js";
import claimsRoutes from "./routes/routes/claims.js";
import adminRoutes from "./routes/routes/admin.js";
import searchRoutes from "./routes/routes/search.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Prefer IPv4 DNS results
try { dns.setDefaultResultOrder("ipv4first"); } catch {}

// Trust proxy (important for Render)
app.set("trust proxy", 1);

// Connect to MongoDB
try {
  await connectDB();
  console.log("✅ MongoDB connected");
} catch (err) {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
}

// -----------------------------
// ✅ SECURITY HEADERS
// -----------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
      }
    }
  })
);

// -----------------------------
// RATE LIMITING
// -----------------------------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, try again later."
});
app.use("/api", limiter);

// -----------------------------
// BODY PARSING
// -----------------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// -----------------------------
// FILE UPLOAD SERVING
// -----------------------------
app.use(
  "/uploads",
  express.static(path.resolve("./uploads"), {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        res.setHeader("Content-Type", "image/*");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// Legacy uploads path (optional)
app.use(
  "/uploads/found-items",
  express.static(path.resolve("./routes/routes/uploads/found-items"), {
    maxAge: "1d",
    setHeaders: (res) => {
      res.setHeader("Content-Type", "image/*");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// -----------------------------
// ✅ FIXED CORS CONFIG
// -----------------------------
const allowedOrigins = [
  "https://front2-git-main-ygdg12s-projects.vercel.app",
  "https://front2-bo950y4cp-ygdg12s-projects.vercel.app",
  "https://foundcloud.vercel.app/",
  "https://front2-ruddy.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile apps / postman
      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.warn("❌ CORS blocked:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🔥 VERY IMPORTANT — FIXES YOUR ERROR
app.options("*", cors());

// -----------------------------
// API ROUTES
// -----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/lost-items", lostItemsRoutes);
app.use("/api/found-items", foundItemsRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);

// -----------------------------
// HEALTH CHECK + ROOT
// -----------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Lost Items API Server",
    api: `${req.protocol}://${req.get("host")}/api`,
  });
});

// -----------------------------
// GLOBAL ERROR HANDLER
// -----------------------------
app.use((err, req, res, next) => {
  console.error("Global error:", err.message);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

// 404 fallback
app.use("/api/*", (req, res) => res.status(404).json({ message: "API endpoint not found" }));

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});
