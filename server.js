import express from "express";
import dns from "dns";
import path from "path";
import fs from "fs";
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
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
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
// ✅ CORS CONFIG
// -----------------------------
const allowedOrigins = [
  "https://front2-git-main-ygdg12s-projects.vercel.app",
  "https://front2-bo950y4cp-ygdg12s-projects.vercel.app",
  "https://foundcloud.vercel.app",
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
// BODY PARSING
// -----------------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// -----------------------------
// FILE UPLOAD SERVING (with CORS)
// -----------------------------
// Handle OPTIONS requests for uploads (CORS preflight)
app.options("/uploads/*", cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Middleware to capture request for static file serving
const captureRequest = (req, res, next) => {
  res.locals.origin = req.headers.origin;
  next();
};

// Helper function to set CORS and content-type headers for images
const setImageHeaders = (res, filePath) => {
  // Set proper Content-Type based on file extension
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  if (contentTypes[ext]) {
    res.setHeader('Content-Type', contentTypes[ext]);
  }
  
  // Set CORS headers explicitly (backup in case cors middleware doesn't apply)
  const origin = res.locals.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else if (!origin) {
    // No origin header (e.g., direct browser access, Postman) - no credentials with wildcard
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
};

// Static file serving with 404 handling
const staticUploads = express.static(path.resolve("./uploads"), {
  maxAge: "1d",
  setHeaders: (res, filePath, stat) => {
    setImageHeaders(res, filePath);
  },
});

app.use(
  "/uploads",
  captureRequest,
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("❌ CORS blocked (uploads):", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
  (req, res, next) => {
    // Log file requests for debugging
    if (req.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const filePath = path.join(path.resolve("./uploads"), req.path);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Image not found: ${req.path} (full path: ${filePath})`);
      }
    }
    next();
  },
  staticUploads,
  (req, res, next) => {
    // If static middleware didn't serve the file, it doesn't exist
    if (req.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      console.error(`❌ 404 - Image not found: ${req.path}`);
      return res.status(404).json({ 
        error: "Image not found",
        path: req.path,
        message: "This image may have been deleted or the server was redeployed. Please re-upload the image."
      });
    }
    next();
  }
);

// Legacy uploads path (optional, also CORS-enabled)
app.use(
  "/uploads/found-items",
  captureRequest,
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("❌ CORS blocked (legacy uploads):", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
  express.static(path.resolve("./routes/routes/uploads/found-items"), {
    maxAge: "1d",
    setHeaders: (res, filePath, stat) => {
      setImageHeaders(res, filePath);
    },
  })
);

// Handle legacy paths without /uploads prefix (redirect to correct path)
app.get("/found-items/:filename", captureRequest, cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}), (req, res) => {
  const filename = req.params.filename;
  const correctPath = `/uploads/found-items/${filename}`;
  res.redirect(301, correctPath);
});

app.get("/lost-items/:filename", captureRequest, cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}), (req, res) => {
  const filename = req.params.filename;
  const correctPath = `/uploads/lost-items/${filename}`;
  res.redirect(301, correctPath);
});

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

// Diagnostic endpoint to check uploads directory
app.get("/api/debug/uploads", (req, res) => {
  const uploadsPath = path.resolve("./uploads");
  const foundItemsPath = path.join(uploadsPath, "found-items");
  const lostItemsPath = path.join(uploadsPath, "lost-items");
  
  try {
    const foundItemsFiles = fs.existsSync(foundItemsPath) 
      ? fs.readdirSync(foundItemsPath).slice(0, 10) 
      : [];
    const lostItemsFiles = fs.existsSync(lostItemsPath) 
      ? fs.readdirSync(lostItemsPath).slice(0, 10) 
      : [];
    
    res.json({
      uploadsPath,
      foundItemsPath,
      lostItemsPath,
      foundItemsExists: fs.existsSync(foundItemsPath),
      lostItemsExists: fs.existsSync(lostItemsPath),
      foundItemsCount: foundItemsFiles.length,
      lostItemsCount: lostItemsFiles.length,
      sampleFoundItems: foundItemsFiles,
      sampleLostItems: lostItemsFiles,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
