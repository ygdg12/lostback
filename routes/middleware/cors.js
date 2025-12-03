import cors from "cors";

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5000",
  "http://127.0.0.1:5000",

  // FIXED: removed space + changed to https
  "https://front2-git-main-ygdg12s-projects.vercel.app",
  "https://front2-bo950y4cp-ygdg12s-projects.vercel.app"
];

// Add production frontend domain if set
if (process.env.NODE_ENV === "production") {
  const productionOrigin =
    process.env.FRONTEND_URL ||
    "https://front2-git-main-ygdg12s-projects.vercel.app";

  if (productionOrigin) {
    allowedOrigins.push(productionOrigin);
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.endsWith("/")
      ? origin.slice(0, -1)
      : origin;

    if (
      /^http:\/\/localhost(:\d+)?$/.test(normalizedOrigin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin) ||
      allowedOrigins.includes(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    console.warn("Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "Pragma"
  ],
  exposedHeaders: ["X-Total-Count"],
  maxAge: 86400
};

export default corsOptions;
