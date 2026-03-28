const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

// ---- SECURITY IMPORTS ----
const hpp = require("hpp");

const app = express();
const PORT = 4000;

// ---- Import Routes ----
const newsletterRoutes = require("./routes/newsletterRoutes");
const contactRoutes = require("./routes/contactRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const blogRoutes = require("./routes/blogRoutes");
const joinusRoutes = require("./routes/joinusRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const productRoutes = require("./routes/productRoutes");

// ==========================================
// 1. SECURITY HEADERS
// ==========================================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ==========================================
// 2. CORS
// ==========================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://daily-fo26lbgolive-8-admin56-g.web.app",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
  "https://dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("❌ Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
};

app.use(cors(corsOptions));

// ✅ FIXED (no more path-to-regexp error)
app.options(/.*/, cors(corsOptions));

// ==========================================
// 3. BODY PARSERS
// ==========================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// 4. SECURITY (SAFE)
// ==========================================
app.use(hpp()); // keep this

// ❌ REMOVED mongoSanitize (causing crash)

// ==========================================
// 5. RATE LIMITING
// ==========================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// ==========================================
// 6. STATIC + DB
// ==========================================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => console.log("✅ MongoDB Connected: dailygoDB"))
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

// ==========================================
// 8. ROOT
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 DailyGo API running clean and secure");
});

// ==========================================
// 9. ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.message);

  if (err.message === "❌ Not allowed by CORS") {
    return res.status(403).json({ error: "CORS origin rejected." });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload too large. Try reducing image size or use file upload.",
    });
  }

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});

// ==========================================
// 10. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});