const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');

const router = express.Router();

// ==========================================
// 🔥 SAFE JSON PARSER (VERY IMPORTANT)
// ==========================================
const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.log("JSON Parse Error:", err.message);
    return {};
  }
};

// ==========================================
// MULTER CONFIG
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.random();
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 🔥 FILE FILTER (important)
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'), false);
    }
    cb(null, true);
  }
}).fields([
  { name: 'shopImage', maxCount: 1 },
  { name: 'screenshot', maxCount: 1 }
]);

// ==========================================
// CREATE ORDER
// ==========================================
router.post('/', upload, async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    // FILES
    const shopImagePath = req.files?.shopImage?.[0]?.path || null;
    const screenshotPath = req.files?.screenshot?.[0]?.path || null;

    if (!shopImagePath) {
      return res.status(400).json({ error: "Shop Image is mandatory" });
    }

    // 🔥 SAFE PARSE
    const customerDetails = safeParse(req.body.customerDetails);
    const items = safeParse(req.body.items);
    const payment = safeParse(req.body.payment);
    const totals = safeParse(req.body.totals);

    // 🔥 VALIDATION
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items missing or invalid" });
    }

    // CREATE ORDER
    const newOrder = new Order({
      invoiceNo: req.body.invoiceNo,
      orderDate: req.body.orderDate,
      location: req.body.location,
      customerDetails,
      items,
      payment,
      totals,
      documents: {
        shopImage: shopImagePath,
        screenshot: screenshotPath
      }
    });

    const savedOrder = await newOrder.save();

    res.status(201).json({
      message: "Order saved successfully",
      order: savedOrder
    });

  } catch (error) {
    console.error("🔥 ORDER ERROR:", error);

    res.status(500).json({
      error: "Internal Server Error",
      details: error.message
    });
  }
});

// ==========================================
// GET ORDERS
// ==========================================
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;