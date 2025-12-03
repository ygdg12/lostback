import cors from "cors";

const allowedOrigins = [
  "http://localhost:3000", // React dev
  "http://127.0.0.1:3000",
  "http://localhost:3001", // Alternative React port
  "http://127.0.0.1:3001",
  "http://localhost:5000", // Backend self-requests
  "http://127.0.0.1:5000",
 "http:// front2-git-main-ygdg12s-projects.vercel.app"
];

// Add production frontend domain if set
if (process.env.NODE_ENV === "production") {
  const productionOrigin = process.env.FRONTEND_URL || "https://front2-git-main-ygdg12s-projects.vercel.app";
  if (productionOrigin) {
    allowedOrigins.push(productionOrigin);
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);

    // Normalize origin by removing trailing slash for consistent matching
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    // Allow localhost with any port OR exact matches in allowedOrigins
    if (/^http:\/\/localhost(:\d+)?$/.test(normalizedOrigin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin) ||
        allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn("Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["X-Total-Count"],
  maxAge: 86400, // 24 hours
};

export default corsOptions; // ✅ ESM default export
