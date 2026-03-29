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
// 2. CORS (ROBUST VERSION)
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
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, postman, or curl)
    if (!origin) return callback(null, true);
    
    // Clean trailing slash
    const cleanOrigin = origin.replace(/\/$/, "");
    
    if (allowedOrigins.includes(cleanOrigin)) {
      callback(null, true);
    } else {
      console.error(`CORS Blocked for: ${origin}`);
      callback(new Error("❌ Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Handle Preflight globally for all routes
app.options("*", cors(corsOptions));

// ==========================================
// 3. BODY PARSER
// ==========================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// 4. HPP & RATE LIMIT
// ==========================================
app.use(hpp({ whitelist: ["sort", "filter"] }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // High limit for Admin panel
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// ==========================================
// 5. STATIC FILES
// ==========================================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// 6. DATABASE (With Timeout check)
// ==========================================
mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB", {
    serverSelectionTimeoutMS: 5000 
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ Mongo Error:", err.message);
    // Process continues so Nginx doesn't 502, but logs will show the issue
  });

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

app.get("/", (req, res) => {
  res.status(200).send("🚀 DailyGo API running stable");
});

// ==========================================
// 8. GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err.message);

  if (err.message === "❌ Not allowed by CORS") {
    return res.status(403).json({ error: "Access denied by CORS" });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large (max 50MB)" });
  }

  res.status(500).json({ error: "Internal Server Error" });
});

// ==========================================
// 9. START SERVER
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});