const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Order = require('../models/Order');

const router = express.Router();

// ==========================================
// SAFE JSON PARSER
// ==========================================
const safeParse = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (err) {
    try {
      const fixed = data.replace(new RegExp("(\\w+)\\x3a", "g"), '"$1":').replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch (err2) {
      console.error("JSON_PARSE_FAILURE:", err2.message);
      return {};
    }
  }
};

// ==========================================
// MULTER CONFIG
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'), false);
    cb(null, true);
  }
}).fields([
  { name: 'shopImage', maxCount: 1 },
  { name: 'screenshot', maxCount: 1 }
]);

// ==========================================
// PDF GENERATOR
// ==========================================
const generateInvoicePDF = (orderData, invoiceNo, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).font('Helvetica-Bold').text('Daily Go Pvt Ltd', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Registered Office: No 6, Gubbala Main Road, Bangalore - 560062');
      doc.fontSize(24).text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).text(`Invoice No: ${invoiceNo}`, 400, 80, { align: 'right' });
      doc.moveTo(50, 130).lineTo(550, 130).strokeColor('#cccccc').stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('BILLED TO:', 50, 150);
      doc.fontSize(12).text(orderData.customerDetails?.shopName || 'N/A', 50, 165);

      let y = 250;
      doc.rect(50, y, 500, 20).fillColor('#1e293b').fill();
      doc.fillColor('#ffffff').text('Item Description', 60, y + 5);
      doc.text('Amount', 470, y + 5, { align: 'right', width: 70 });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
};

// ==========================================
// ROUTES
// ==========================================

// ─── CUSTOMER SEARCH (searches Order.customerDetails) ───────────
// GET /api/orders/customers/search?shopName=xxx&ownerName=xxx&mobileNumber=xxx
router.get('/customers/search', async (req, res) => {
  try {
    const { shopName, ownerName, mobileNumber } = req.query;

    // Build a flexible OR query so any field match returns results
    const orConditions = [];

    if (shopName && shopName.trim().length >= 2) {
      orConditions.push({
        'customerDetails.shopName': { $regex: shopName.trim(), $options: 'i' }
      });
    }
    if (ownerName && ownerName.trim().length >= 2) {
      orConditions.push({
        'customerDetails.ownerName': { $regex: ownerName.trim(), $options: 'i' }
      });
    }
    if (mobileNumber && mobileNumber.trim().length >= 2) {
      orConditions.push({
        'customerDetails.mobileNumber': { $regex: mobileNumber.trim(), $options: 'i' }
      });
    }

    if (orConditions.length === 0) {
      return res.status(400).json({ error: 'Provide at least one search parameter (min 2 chars)' });
    }

    // Find matching orders, project only customerDetails, deduplicate by mobileNumber
    const orders = await Order.find(
      { $or: orConditions },
      { customerDetails: 1, _id: 1, invoiceNo: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Deduplicate by mobileNumber — keep most recent entry per unique customer
    const seen = new Set();
    const uniqueCustomers = [];
    for (const order of orders) {
      const cd = order.customerDetails || {};
      const key = cd.mobileNumber || cd.shopName || order._id.toString();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCustomers.push({
          _id:          order._id,
          shopName:     cd.shopName     || '',
          ownerName:    cd.ownerName    || '',
          mobileNumber: cd.mobileNumber || '',
          address:      cd.address      || '',
          fos:          cd.fos          || '',
        });
      }
      if (uniqueCustomers.length >= 10) break; // cap at 10 results
    }

    res.status(200).json({ customers: uniqueCustomers });
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// ─── 1. TODAY'S ORDERS (IST) ────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);

    const startOfIstDay = new Date(istTime.getFullYear(), istTime.getMonth(), istTime.getDate());
    const startOfTodayUTC = new Date(startOfIstDay.getTime() - istOffset);

    const endOfIstDay = new Date(istTime.getFullYear(), istTime.getMonth(), istTime.getDate(), 23, 59, 59, 999);
    const endOfTodayUTC = new Date(endOfIstDay.getTime() - istOffset);

    const orders = await Order.find({
      createdAt: { $gte: startOfTodayUTC, $lte: endOfTodayUTC }
    }).sort({ createdAt: -1 });

    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching IST today orders:', error);
    res.status(500).json({ error: "Failed to fetch today's orders" });
  }
});

// ─── 2. ORDERS FOR SPECIFIC FUNDER ─────────────────────────────
router.get('/funder/:funderId', async (req, res) => {
  try {
    const orders = await Order.find({ funder: req.params.funderId }).sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch funder orders' });
  }
});

// ─── 3. CREATE ORDER ────────────────────────────────────────────
router.post('/', upload, async (req, res) => {
  try {
    const shopImagePath  = req.files?.shopImage?.[0]?.path  || null;
    const screenshotPath = req.files?.screenshot?.[0]?.path || null;

    if (!shopImagePath) return res.status(400).json({ error: 'Shop Image is mandatory' });

    const customerDetails = safeParse(req.body.customerDetails);
    const items           = safeParse(req.body.items);
    const payment         = safeParse(req.body.payment);
    const totals          = safeParse(req.body.totals);

    const invoicesDir = path.join(__dirname, '../uploads/invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const generatedInvoiceNo = req.body.invoiceNo || `INV-${Date.now()}`;
    const pdfFilename  = `${generatedInvoiceNo}.pdf`;
    const pdfFilePath  = path.join(invoicesDir, pdfFilename);

    await generateInvoicePDF({ customerDetails, items, totals, payment }, generatedInvoiceNo, pdfFilePath);

    const newOrder = new Order({
      invoiceNo:  generatedInvoiceNo,
      orderDate:  req.body.orderDate || new Date().toISOString(),
      location:   req.body.location,
      customerDetails,
      items,
      payment,
      totals,
      funder: req.body.funder || null,
      documents: {
        shopImage:  shopImagePath.replace(/\\/g, '/'),
        screenshot: screenshotPath ? screenshotPath.replace(/\\/g, '/') : null,
        invoicePdf: `uploads/invoices/${pdfFilename}`
      }
    });

    const savedOrder = await newOrder.save();
    res.status(201).json({ message: 'Order saved successfully', order: savedOrder });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// ─── 4. GET ALL ORDERS (with optional filters) ──────────────────
router.get('/', async (req, res) => {
  try {
    const { fosName, date } = req.query;
    const filterQuery = {};
    if (fosName) filterQuery['customerDetails.fos'] = fosName;
    if (date)    filterQuery['orderDate'] = { $regex: date, $options: 'i' };

    const orders = await Order.find(filterQuery).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ─── 5. UPDATE ORDER STATUS ─────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { 'payment.status': req.body.status },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
    res.status(200).json({ message: 'Status updated', order: updatedOrder });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;