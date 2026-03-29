const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const hpp = require("hpp");

const app = express();
const PORT = 4000;

// ---- ROUTES ----
const newsletterRoutes = require("./routes/newsletterRoutes");
const contactRoutes = require("./routes/contactRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const blogRoutes = require("./routes/blogRoutes");
const joinusRoutes = require("./routes/joinusRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

// ==========================================
// 1. SECURITY HEADERS
// ==========================================
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Required to serve images
    crossOriginOpenerPolicy: false,   // Prevents issues with Firebase/Popups
  })
);

// ==========================================
// 2. CORS CONFIGURATION (FIXED)
// ==========================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dailygolive.in",
  "https://www.dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Remove trailing slash for comparison
    const cleanOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.includes(cleanOrigin)) {
      callback(null, true);
    } else {
      console.log("Blocked Origin Attempted:", origin);
      callback(new Error("❌ Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Apply CORS globally
app.use(cors(corsOptions));

// 🔥 CRITICAL: Explicitly handle preflight requests for all routes
app.options("*", cors(corsOptions));

// ==========================================
// 3. BODY PARSER
// ==========================================
// Increased limits to handle Base64 image strings
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// 4. RATE LIMIT
// ==========================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased to 200 for admin panel usage
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api/", limiter); // Apply only to API routes

// ==========================================
// 5. STATIC FILES
// ==========================================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// 6. DATABASE
// ==========================================
mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ Mongo Error:", err));

// ==========================================
// 7. ROUTES
// ==========================================
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/joinus", joinusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// ==========================================
// 8. APPLY HPP SAFELY
// ==========================================
app.use(
  hpp({
    whitelist: ["sort", "filter"],
  })
);

// ==========================================
// 9. ROOT
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 DailyGo API running - CORS Enabled for Admin Panel");
});

// ==========================================
// 10. ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  if (err.message === "❌ Not allowed by CORS") {
    return res.status(403).json({ error: "CORS blocked - check allowedOrigins" });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large (max 50MB)" });
  }

  console.error("🔥 Global Error:", err.stack);
  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});

// ==========================================
// 11. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});