const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

// ---- SECURITY IMPORTS ----
const mongoSanitize = require("express-mongo-sanitize");
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

// ---- Security: Headers ----
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ---- Body Parsers (FIXED POSITION) ----
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ---- Security: Data Sanitization (FIXED) ----
app.use(
  mongoSanitize({
    replaceWith: "_", // 🔥 prevents req.query crash
  })
);
app.use(hpp());

// ---- Rate Limiting (MOVED BELOW SANITIZATION) ----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// ---- CORS ----
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://daily-fo26lbgolive-8-admin56-g.web.app",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
  "https://dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ---- Static Uploads ----
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---- MongoDB Connection ----
mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => console.log("✅ MongoDB Connected: dailygoDB"))
  .catch((err) => console.log("❌ Mongo Error:", err));

// ---- Routes ----
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/joinus", joinusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/products", productRoutes);

// ---- Root ----
app.get("/", (req, res) => {
  res.send("🚀 DailyGo API running clean and secure");
});

// ---- Global Error Handler ----
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.message);

  // Handle CORS error
  if (err.message === "❌ Not allowed by CORS") {
    return res.status(403).json({ error: "CORS origin rejected." });
  }

  // Handle payload too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload too large. Try reducing image size or use file upload.",
    });
  }

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});