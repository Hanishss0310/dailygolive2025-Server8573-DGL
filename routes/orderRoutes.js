const express = require('express');
const multer = require('multer');
const path = require('path');
const Order = require('../models/Order');

const router = express.Router();

// --- MULTER STORAGE CONFIGURATION ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Ensure this 'uploads' folder exists in your root directory!
  },
  filename: function (req, file, cb) {
    // Generates a unique filename: fieldname-timestamp-random.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer to accept specific fields
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
}).fields([
  { name: 'shopImage', maxCount: 1 },
  { name: 'screenshot', maxCount: 1 }
]);

// --- CREATE ORDER ROUTE ---
router.post('/', upload, async (req, res) => {
  try {
    // 1. Extract files
    const shopImagePath = req.files['shopImage'] ? req.files['shopImage'][0].path : null;
    const screenshotPath = req.files['screenshot'] ? req.files['screenshot'][0].path : null;

    if (!shopImagePath) {
      return res.status(400).json({ error: "Shop Image is mandatory" });
    }

    // 2. Parse the stringified JSON from the FormData payload
    const customerDetails = JSON.parse(req.body.customerDetails);
    const items = JSON.parse(req.body.items);
    const payment = JSON.parse(req.body.payment);
    const totals = JSON.parse(req.body.totals);

    // 3. Create the new Order document
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

    // 4. Save to Database
    const savedOrder = await newOrder.save();

    res.status(201).json({
      message: "Order successfully created and saved",
      order: savedOrder
    });

  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// --- GET ALL ORDERS ROUTE (For Admin Dashboard) ---
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;