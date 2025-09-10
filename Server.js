const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Models
const Newsletter = require("./models/Newsletter");
const Contact = require("./models/Contact");
const Gallery = require("./models/GalleryItem");
const Blog = require("./models/Blogs.js");
const JoinUs = require("./models/JoinUs");

// ⚠️ If you have Product & Service models, import them like this:
// const Product = require("./models/Product");
// const Service = require("./models/Service");

const app = express();
const PORT = 4000;

// ---- Security Middleware ----
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(express.json({ limit: "10kb" }));

// ---- Rate Limiting ----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// ---- CORS Setup ----
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://daily-fo26lbgolive-8-admin56-g.web.app",
  "https://daily-fo26lbgolive-8-admin56-g.firebaseapp.com",
  "https://dailygolive.in",
  "https://dailygo-userside-app.firebaseapp.com",
  "https://dgl-core-9x7.dailygolive.in", // ✅ new API subdomain
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Not allowed by CORS: " + origin));
      }
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ---- MongoDB Connection ----
mongoose
  .connect("mongodb://127.0.0.1:27017/dailygoDB")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ---- Multer Setup (File Uploads) ----
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, Date.now() + "-" + safeName);
  },
});
const upload = multer({ storage });

// ✅ Serve static uploads folder
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  })
);

// ======================== APIs ========================

// ---- Newsletter API ----
app.post("/api/newsletter", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const existing = await Newsletter.findOne({ email });
    if (existing) return res.status(400).json({ message: "Already subscribed" });

    const subscriber = new Newsletter({ email });
    await subscriber.save();

    res.json({ message: "Subscribed successfully ✅" });
  } catch (err) {
    console.error("❌ Newsletter POST error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.get("/api/newsletter", async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (err) {
    console.error("❌ Newsletter GET error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---- Contact API ----
app.post("/api/contact", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, message } = req.body;
    if (!firstname || !lastname || !email || !phone || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const contact = new Contact({ firstname, lastname, email, phone, message });
    await contact.save();

    res.json({ message: "✅ Your message has been sent successfully" });
  } catch (err) {
    console.error("❌ Contact POST error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.get("/api/contact", async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error("❌ Contact GET error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ---- Gallery API ----
app.post("/api/gallery", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image file is required" });

    const newItem = new Gallery({
      title: req.body.title,
      description: req.body.description,
      filename: req.file.filename,
      imageUrl: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
    });

    await newItem.save();
    res.json(newItem);
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/gallery", async (req, res) => {
  try {
    const items = await Gallery.find().sort({ createdAt: -1 });

    const updatedItems = items.map((item) => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      imageUrl: `${req.protocol}://${req.get("host")}/uploads/${item.filename}`,
      createdAt: item.createdAt,
    }));

    res.json(updatedItems);
  } catch (err) {
    console.error("❌ Gallery GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/gallery/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Gallery.findById(id);

    if (!item) return res.status(404).json({ message: "Item not found" });

    if (item.filename) {
      const filePath = path.join(__dirname, "uploads", item.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error("⚠️ File delete error:", err.message);
      });
    }

    await item.deleteOne();

    res.json({ message: "🗑️ Deleted successfully" });
  } catch (err) {
    console.error("❌ Gallery DELETE error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Blogs API ----
app.post("/api/blogs", upload.single("image"), async (req, res) => {
  try {
    const { title, description, date } = req.body;

    const newBlog = new Blog({
      title,
      description,
      date,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });

    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create blog" });
  }
});

app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

app.delete("/api/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: "Blog deleted successfully", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete blog" });
  }
});

// ---- Join Us API ----
app.get("/api/joinus", async (req, res) => {
  try {
    const submissions = await JoinUs.find().sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    console.error("❌ Error fetching submissions:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.post("/api/joinus", async (req, res) => {
  try {
    const newSubmission = new JoinUs(req.body);
    const savedSubmission = await newSubmission.save();
    res.status(201).json(savedSubmission);
  } catch (error) {
    console.error("❌ Error saving submission:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// ---- Analytics APIs ----
app.get("/api/analytics/summary", async (req, res) => {
  try {
    const [
      totalProducts,
      totalServices,
      newsletterSubscribers,
      usersContacted,
      serviceBookings,
      productQuotes,
    ] = await Promise.all([
      Gallery.countDocuments({ type: "product" }),
      Gallery.countDocuments({ type: "service" }),
      Newsletter.countDocuments(),
      Contact.countDocuments(),
      JoinUs.countDocuments({ category: "service" }),
      JoinUs.countDocuments({ category: "product" }),
    ]);

    const summary = {
      totalProducts: { value: totalProducts, percentage: 12.6, trend: "up" },
      totalServices: { value: totalServices, percentage: 5.2, trend: "up" },
      newsletterSubscribers: { value: newsletterSubscribers, percentage: -3.4, trend: "down" },
      usersContacted: { value: usersContacted, percentage: 9.8, trend: "up" },
      serviceBookings: { value: serviceBookings, percentage: 2.1, trend: "up" },
      productQuotes: { value: productQuotes, percentage: 4.5, trend: "up" },
    };

    res.json(summary);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 DailyGo API is running");
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`🚀 Secure DailyGo Server running on http://localhost:${PORT}`);
});
