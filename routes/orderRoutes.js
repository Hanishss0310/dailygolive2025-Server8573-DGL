const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit'); 
const Order = require('../models/Order');

const router = express.Router();

// ==========================================
// 🔥 SAFE JSON PARSER (STABILIZED)
// ==========================================
const safeParse = (data) => {
  if (!data) return {};
  if (typeof data === 'object') return data; 
  
  try { 
    return JSON.parse(data); 
  } catch (err) {
    try {
      /**
       * ✅ CRITICAL FIX: 
       * We use \x3a instead of the literal ":" character.
       * This prevents Express's 'path-to-regexp' from crashing with:
       * "TypeError: Missing parameter name at 1"
       */
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
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
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
// PDF GENERATOR (ROBUST)
// ==========================================
const generateInvoicePDF = (orderData, invoiceNo, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);

      // --- Header ---
      doc.fontSize(20).font('Helvetica-Bold').text('Daily Go Pvt Ltd', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Registered Office: No 6, Gubbala Main Road,', 50, 75);
      doc.text('Subramanyapura Pura Post, Gubalalla,');
      doc.text('Bangalore, Karnataka - 560062');
      doc.text('Phone: 9739777166 | Email: office-info@dailygolive.in');
      
      doc.fontSize(24).font('Helvetica').text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).text(`Invoice No: ${invoiceNo}`, 400, 80, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 400, 95, { align: 'right' });

      doc.moveTo(50, 130).lineTo(550, 130).strokeColor('#cccccc').stroke();

      // --- Billing Details ---
      doc.moveDown(3);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#666666').text('BILLED TO:', 50, 150);
      doc.fillColor('#000000').fontSize(12).text(orderData.customerDetails?.shopName || 'N/A', 50, 165);
      doc.fontSize(10).font('Helvetica').text(`Attn: ${orderData.customerDetails?.ownerName || 'N/A'}`);
      doc.text(orderData.customerDetails?.address || 'N/A', { width: 250 });
      doc.text(`Phone: ${orderData.customerDetails?.mobileNumber || 'N/A'}`);

      doc.font('Helvetica-Bold').fillColor('#666666').text('ORDER INFO:', 350, 150);
      doc.fillColor('#000000').font('Helvetica').text(`Sales Exec: ${orderData.customerDetails?.fos || 'N/A'}`, 350, 165);
      doc.text(`Payment Method: ${(orderData.payment?.method || 'N/A').toUpperCase()}`);

      // --- Items Table ---
      let y = 250;
      doc.rect(50, y, 500, 20).fillColor('#1e293b').fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text('Item Description', 60, y + 5);
      doc.text('Qty', 350, y + 5, { align: 'center', width: 50 });
      doc.text('Rate', 400, y + 5, { align: 'right', width: 60 });
      doc.text('Amount', 470, y + 5, { align: 'right', width: 70 });

      y += 25;
      doc.fillColor('#000000').font('Helvetica');
      
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      items.forEach((item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.qty) || 0;
        const amount = price * qty;

        doc.text(item.name || 'Product', 60, y, { width: 280 });
        doc.text(qty.toString(), 350, y, { align: 'center', width: 50 });
        doc.text(`${price.toFixed(2)}`, 400, y, { align: 'right', width: 60 });
        doc.text(`${amount.toFixed(2)}`, 470, y, { align: 'right', width: 70 });
        y += 20;
        doc.moveTo(50, y).lineTo(550, y).strokeColor('#eeeeee').stroke();
        y += 10;
      });

      // --- Calculations ---
      y += 10;
      const subtotal = Number(orderData.totals?.subtotal) || 0;
      const total = Number(orderData.totals?.total) || 0;
      const discount = Number(orderData.totals?.discount) || 0;

      doc.font('Helvetica-Bold').text('Subtotal:', 350, y, { align: 'right', width: 110 });
      doc.text(`${subtotal.toFixed(2)}`, 470, y, { align: 'right', width: 70 });
      
      if (discount > 0) {
        y += 20;
        doc.text('Discount:', 350, y, { align: 'right', width: 110 });
        doc.text(`- ${discount.toFixed(2)}`, 470, y, { align: 'right', width: 70 });
      }

      y += 25;
      doc.fontSize(12).text('TOTAL INVOICE:', 300, y, { align: 'right', width: 160 });
      doc.text(`Rs. ${total.toFixed(2)}`, 470, y, { align: 'right', width: 70 });

      doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Thank you for your business!', 50, 700, { align: 'center' });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
};

// ==========================================
// ROUTES
// ==========================================

// ✅ NEW ROUTE: Fetch orders for a specific funder
router.get('/funder/:funderId', async (req, res) => {
  try {
    const { funderId } = req.params;
    // Assuming 'funder' is the field name in your Order model
    const orders = await Order.find({ funder: funderId }).sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch funder orders" });
  }
});

router.post('/', upload, async (req, res) => {
  try {
    const shopImagePath = req.files?.shopImage?.[0]?.path || null;
    const screenshotPath = req.files?.screenshot?.[0]?.path || null;

    if (!shopImagePath) return res.status(400).json({ error: "Shop Image is mandatory" });

    // Sanitize incoming body strings
    const customerDetails = safeParse(req.body.customerDetails);
    const items = safeParse(req.body.items);
    const payment = safeParse(req.body.payment);
    const totals = safeParse(req.body.totals);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items missing or invalid" });
    }

    // Path handling
    const invoicesDir = path.join(__dirname, '../uploads/invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    
    const generatedInvoiceNo = req.body.invoiceNo || `INV-${Date.now()}`;
    const pdfFilename = `${generatedInvoiceNo}.pdf`;
    const pdfFilePath = path.join(invoicesDir, pdfFilename);

    await generateInvoicePDF({ customerDetails, items, totals, payment }, generatedInvoiceNo, pdfFilePath);

    const newOrder = new Order({
      invoiceNo: generatedInvoiceNo,
      orderDate: req.body.orderDate || new Date().toISOString(),
      location: req.body.location,
      customerDetails,
      items,
      payment,
      totals,
      // Pass the funder ID if sent in the request body
      funder: req.body.funder || null, 
      documents: {
        shopImage: shopImagePath.replace(/\\/g, '/'),
        screenshot: screenshotPath ? screenshotPath.replace(/\\/g, '/') : null,
        invoicePdf: `uploads/invoices/${pdfFilename}` 
      }
    });

    const savedOrder = await newOrder.save();

    res.status(201).json({
      message: "Order and PDF saved successfully",
      order: savedOrder
    });

  } catch (error) {
    console.error("🔥 ORDER_SERVER_ERROR:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id, 
      { 'payment.status': req.body.status },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Status updated", order: updatedOrder });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;