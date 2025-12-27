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

// Prefer IPv4 DNS results first to avoid resolver issues on some Windows networks
try { dns.setDefaultResultOrder("ipv4first"); } catch {}

// Trust first proxy
app.set("trust proxy", 1);

// Connect to MongoDB
try {
  await connectDB();
  console.log("✅ MongoDB connected");
} catch (err) {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
}

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS Configuration - MUST be before all routes
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [
      "https://foundcloud.vercel.app",
      "https://front2-git-main-ygdg12s-projects.vercel.app",
      "https://front2-bo950y4cp-ygdg12s-projects.vercel.app",
      "https://foundcloud-xi.vercel.app/",
      "https://front2-ruddy.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5000",
    ];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    
    // In production, only allow specified origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Type"],
};

// Apply CORS globally
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

// ✅ Serve uploads folder (fixed path: backend/uploads) - with CORS
app.use(
  "/uploads",
  cors(corsOptions),
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

// ✅ Backward compatibility: also serve legacy path where older files were stored - with CORS
app.use(
  "/uploads/found-items",
  cors(corsOptions),
  express.static(path.resolve("./routes/routes/uploads/found-items"), {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        res.setHeader("Content-Type", "image/*");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/lost-items", lostItemsRoutes);
app.use("/api/found-items", foundItemsRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Lost Items API Server",
    status: process.env.NODE_ENV === "production" ? "Production" : "Development",
    api: `${req.protocol}://${req.get("host")}/api`,
    documentation: "API endpoints available at /api/*",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  
  // Handle CORS errors
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      message: "CORS policy violation",
      error: err.message,
    });
  }
  
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 for API routes
app.use("/api/*", (req, res) => res.status(404).json({ message: "API endpoint not found" }));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
  console.log(`Uploads available at: http://localhost:${PORT}/uploads/found-items`);
});
