
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

app.set("trust proxy", 1);

// ==========================================
// SECURITY
// ==========================================
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(hpp({ whitelist: ["sort", "filter"] }));

// ==========================================
// CORS
// ==========================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4000",
  "https://dailygolive.in",
  "https://www.dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
  "https://daily-fo26lbgolive-8-admin56-g.web.app",
  "https://dailygo-funders-program.web.app",
  "https://dailygo-funders-program.firebaseapp.com",
  "https://dailygodelivery-b5396.firebaseapp.com",
  "https://dailygodelivery-b5396.web.app",
];

app.use(cors({
  origin: (origin, callback) => {
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
// RATE LIMIT
// ==========================================
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: "Too many requests, please try again later.",
  },
}));

// ==========================================
// ROUTES
// ==========================================
const newsletterRoutes = require("./routes/newsletterRoutes");
const contactRoutes = require("./routes/contactRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const blogRoutes = require("./routes/blogRoutes");
const joinusRoutes = require("./routes/joinusRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const funderRoutes = require("./routes/funderRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const deliveryAuthRoutes = require("./routes/deliveryAuth");
const deliveryActionsRoutes = require("./routes/deliveryActions");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
// const attendanceOtpRoutes = require("./routes/attendanceOtpRoutes");
const { creditAllFunders } = require("./routes/funderRoutes");

// ==========================================
// API ROUTES
// ==========================================
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/joinus", joinusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryAuthRoutes);
app.use("/api/delivery-actions", deliveryActionsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
// app.use("/api/attendance-otp", attendanceOtpRoutes);

app.use("/api/admin/funders", withdrawalRoutes);
app.use("/api/admin/funders", funderRoutes);

// ==========================================
// STATIC FILES
// ==========================================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ==========================================
// DATABASE
// ==========================================
mongoose.connect("mongodb://127.0.0.1:27017/dailygoDB")
.then(() => {

  console.log("✅ MongoDB Connected");

  // ==========================================
  // DAILY CRON JOB
  // ==========================================
  cron.schedule("30 18 * * *", async () => {

    const istTime = new Date().toLocaleString(
      "en-IN",
      { timeZone: "Asia/Kolkata" }
    );

    console.log(`🕛 Midnight IST: ${istTime}`);

    console.log("💰 Running daily funder credit...");

    await creditAllFunders();
  });

  console.log("✅ Cron Active → 00:00 IST Daily");
})
.catch(err =>
  console.log("❌ Mongo Error:", err)
);

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
  res.send("🚀 DailyGo API is Active");
});

// ==========================================
// MANUAL CREDIT TEST
// ==========================================
app.post("/api/admin/trigger-credit", async (req, res) => {
  try {

    console.log("🔧 Manual credit trigger");

    await creditAllFunders();

    res.status(200).json({
      message: "✅ Credit Complete",
    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });
  }
});

// ==========================================
// 404
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    attemptedUrl: req.url,
    method: req.method,
  });
});

// ==========================================
// GLOBAL ERROR
// ==========================================
app.use((err, req, res, next) => {

  console.error("🔥 Server Error:", err.message);

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {

  console.log(`
🚀 Server Running

🏠 Local:
http://localhost:${PORT}

👨‍💼 Employee API:
http://localhost:${PORT}/api/employees

🔐 Auth API:
http://localhost:${PORT}/api/auth/login
`);
});

