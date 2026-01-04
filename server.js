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

// Rate limiting - exclude OPTIONS requests and increase limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Increased limit for admin operations
  message: "Too many requests from this IP, please try again later.",
  skip: (req) => req.method === "OPTIONS", // Skip rate limiting for preflight requests
});
app.use("/api", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS Configuration - MUST be before all routes
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/$/, ""))
  : [
      "https://foundcloud.vercel.app",
      "https://foundcloud-xi.vercel.app",
      "https://front2-git-main-ygdg12s-projects.vercel.app",
      "https://front2-bo950y4cp-ygdg12s-projects.vercel.app",
      "https://front2-ruddy.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5000",
    ];

// Normalize origin by removing trailing slash
const normalizeOrigin = (origin) => {
  if (!origin) return origin;
  return origin.replace(/\/$/, "");
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normalize the incoming origin
    const normalizedOrigin = normalizeOrigin(origin);
    
    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    
    // In production, only allow specified origins (case-insensitive comparison)
    const isAllowed = allowedOrigins.some(
      (allowed) => normalizeOrigin(allowed).toLowerCase() === normalizedOrigin.toLowerCase()
    );
    
    if (isAllowed) {
      // Only log blocked origins, not every allowed request
      callback(null, true);
    } else {
      // Log blocked origins for debugging
      console.error(`❌ CORS BLOCKED: ${origin}`);
      console.error(`   Normalized: ${normalizedOrigin}`);
      console.error(`   Allowed origins: ${allowedOrigins.join(", ")}`);
      console.error(`   Current NODE_ENV: ${process.env.NODE_ENV}`);
      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  exposedHeaders: ["Content-Type"],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
};

// Apply CORS globally - MUST be before all routes
app.use(cors(corsOptions));

// Explicit OPTIONS handler - must respond with CORS headers for preflight
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

// CORS diagnostic endpoint
app.get("/api/cors-info", (req, res) => {
  const origin = req.headers.origin;
  const normalizedOrigin = origin ? normalizeOrigin(origin) : null;
  const isAllowed = origin ? allowedOrigins.some(
    (allowed) => normalizeOrigin(allowed).toLowerCase() === normalizedOrigin.toLowerCase()
  ) : null;
  
  res.json({
    requestOrigin: origin || "none",
    normalizedOrigin: normalizedOrigin,
    isAllowed: isAllowed,
    allowedOrigins: allowedOrigins,
    nodeEnv: process.env.NODE_ENV || "development",
    corsEnabled: true,
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
  
  // Handle CORS errors - still send CORS headers even on error
  if (err.message && err.message.includes("CORS")) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.some(o => normalizeOrigin(o).toLowerCase() === normalizeOrigin(origin).toLowerCase())) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    return res.status(403).json({
      message: "CORS policy violation",
      error: err.message,
      origin: origin || "none",
      allowedOrigins: allowedOrigins,
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
