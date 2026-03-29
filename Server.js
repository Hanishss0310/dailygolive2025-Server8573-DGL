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

// 1. Security
app.use(helmet({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }));

// 2. CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dailygolive.in",
  "https://www.dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(cleanOrigin)) return callback(null, true);
    callback(new Error("CORS Blocked"));
  },
  credentials: true
}));

// 3. Body Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 4. Rate Limit (FIXED PATH)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
app.use("/api", limiter); // No trailing slash!

// 5. Static Files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 6. DB
mongoose.connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

// 7. Routes (FIXED PATHS)
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/joinus", joinusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => res.send("API Running"));

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));