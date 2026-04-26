const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const hpp = require("hpp");
const cron = require("node-cron");

const app = express();
const PORT = 4000;

// ✅ Trust Nginx proxy
app.set("trust proxy", 1);

// ==========================================
// 1. SECURITY & BODY PARSING
// ==========================================
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(hpp({ whitelist: ["sort", "filter"] }));

// ==========================================
// 2. CORS
// ==========================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dailygolive.in",
  "https://www.dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
  "https://daily-fo26lbgolive-8-admin56-g.web.app",
  "https://dailygo-funders-program.web.app",
  "https://dailygo-funders-program.firebaseapp.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked Origin:", origin);
      callback(new Error("❌ Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ==========================================
// 3. RATE LIMITING
// ==========================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Too many requests, please try again later." }
});
app.use("/api/", limiter);

// ==========================================
// 4. ROUTES
// ==========================================
const newsletterRoutes  = require("./routes/newsletterRoutes");
const contactRoutes     = require("./routes/contactRoutes");
const galleryRoutes     = require("./routes/galleryRoutes");
const blogRoutes        = require("./routes/blogRoutes");
const joinusRoutes      = require("./routes/joinusRoutes");
const analyticsRoutes   = require("./routes/analyticsRoutes");
const productRoutes     = require("./routes/productRoutes");
const orderRoutes       = require("./routes/orderRoutes");
const funderRoutes      = require("./routes/funderRoutes");
const withdrawalRoutes  = require("./routes/withdrawalRoutes");

// ✅ Import the cron function AFTER requiring funderRoutes
const { creditAllFunders } = require("./routes/funderRoutes");

app.use("/api/newsletter",      newsletterRoutes);
app.use("/api/contact",         contactRoutes);
app.use("/api/gallery",         galleryRoutes);
app.use("/api/blogs",           blogRoutes);
app.use("/api/joinus",          joinusRoutes);
app.use("/api/analytics",       analyticsRoutes);
app.use("/api/products",        productRoutes);
app.use("/api/orders",          orderRoutes);
app.use("/api/withdrawals",     withdrawalRoutes);
app.use("/api/admin/funders",   funderRoutes);

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// 5. DATABASE
// ==========================================
mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => {
    console.log("✅ MongoDB Connected: dailygoDB");

    // ==========================================
    // 6. CRON JOB — 12:00 PM IST every day
    //    IST = UTC+5:30, so 12:00pm IST = 06:30 UTC
    //    Cron format: minute hour * * *
    // ==========================================
    cron.schedule("30 6 * * *", async () => {
      console.log("⏰ 12:00 PM IST — Running daily funder credit...");
      await creditAllFunders();
    }, {
      timezone: "UTC" // we manually handle IST offset inside creditAllFunders
    });

    console.log("✅ Daily 12pm IST credit cron scheduled.");
  })
  .catch((err) => console.log("❌ Mongo Error:", err));

// ==========================================
// 7. DEBUG & ERROR HANDLING
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 DailyGo API is Active");
});

// ✅ Manual trigger endpoint — for testing only, remove in production
app.post("/api/admin/trigger-credit", async (req, res) => {
  try {
    console.log("🔧 Manual credit trigger hit");
    await creditAllFunders();
    res.status(200).json({ message: "✅ Manual credit run complete." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler
app.use((req, res, next) => {
  console.log(`404 attempted on: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Route not found",
    attemptedUrl: req.url,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ==========================================
// 8. START
// ==========================================
app.listen(PORT, () => {
  console.log(`
  🚀 Server Running!
  🏠 Local: http://localhost:${PORT}
  🔗 API: http://localhost:${PORT}/api/admin/funders/login
  `);
});