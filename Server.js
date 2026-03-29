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
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// ==========================================
// 2. CORS (SIMPLIFIED + STABLE)
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

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ FORCE HANDLE PREFLIGHT (CRITICAL FIX)
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,PATCH,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

// ==========================================
// 3. BODY PARSER
// ==========================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// 4. HPP (MOVE BEFORE ROUTES)
// ==========================================
app.use(hpp({ whitelist: ["sort", "filter"] }));

// ==========================================
// 5. RATE LIMIT
// ==========================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests, please try again later",
});

app.use("/api", limiter);

// ==========================================
// 6. STATIC FILES
// ==========================================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// 7. DATABASE
// ==========================================
mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ Mongo Error:", err));

// ==========================================
// 8. ROUTES
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
// 9. ROOT
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 DailyGo API running");
});

// ==========================================
// 10. GLOBAL ERROR HANDLER (FIXED)
// ==========================================
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.message);

  // ✅ ALWAYS send CORS headers even on error
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,PATCH,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large (max 50MB)" });
  }

  res.status(500).json({ error: "Internal Server Error" });
});

// ==========================================
// 11. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});