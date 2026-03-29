const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit'); 
const Order = require('../models/Order');

const router = express.Router();

// ==========================================
// 🔥 SAFE JSON PARSER
// ==========================================
const safeParse = (data) => {
  if (!data) return {};
  try { return JSON.parse(data); } 
  catch (err) {
    console.log("⚠️ JSON Parse Error, fixing...", data);
    try {
      const fixed = data.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch (err2) {
      return {};
    }
  }
};

// ==========================================
// MULTER CONFIG
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.random();
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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
// 🔥 PDF GENERATOR HELPER FUNCTION
// ==========================================
const generateInvoicePDF = (orderData, invoiceNo, filePath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // --- Header ---
    doc.fontSize(20).font('Helvetica-Bold').text('Daily Go Pvt Ltd', 50, 50);
    doc.fontSize(10).font('Helvetica').text('Registered Office: No 6, Gubbala Main Road,', 50, 75);
    doc.text('Subramanyapura Pura Post, Gubalalla,');
    doc.text('Bangalore, Karnataka - 560062');
    doc.text('Phone: 9739777166 | Email: office-info@dailygolive.in');
    
    // 🔥 THE FIX: Changed 'Helvetica-Light' to 'Helvetica'
    doc.fontSize(24).font('Helvetica').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).text(`Invoice No: ${invoiceNo}`, 400, 80, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 400, 95, { align: 'right' });

    doc.moveTo(50, 130).lineTo(550, 130).strokeColor('#cccccc').stroke();

    // --- Customer Details ---
    doc.moveDown(3);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#666666').text('BILLED TO:', 50, 150);
    doc.fillColor('#000000').fontSize(12).text(orderData.customerDetails?.shopName || 'N/A', 50, 165);
    doc.fontSize(10).font('Helvetica').text(`Attn: ${orderData.customerDetails?.ownerName || 'N/A'}`);
    doc.text(orderData.customerDetails?.address || 'N/A');
    doc.text(`Phone: ${orderData.customerDetails?.mobileNumber || 'N/A'}`);

    // --- Order Meta ---
    doc.font('Helvetica-Bold').fillColor('#666666').text('ORDER INFO:', 350, 150);
    doc.fillColor('#000000').font('Helvetica').text(`Sales Exec: ${orderData.customerDetails?.fos || 'N/A'}`, 350, 165);
    doc.text(`Payment Method: ${(orderData.payment?.method || 'N/A').toUpperCase()}`);

    // --- Table Header ---
    let y = 250;
    doc.rect(50, y, 500, 20).fillColor('#1e293b').fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
    doc.text('Item Description', 60, y + 5);
    doc.text('Qty', 350, y + 5, { align: 'center', width: 50 });
    doc.text('Rate', 400, y + 5, { align: 'right', width: 60 });
    doc.text('Amount', 470, y + 5, { align: 'right', width: 70 });

    // --- Table Rows ---
    y += 25;
    doc.fillColor('#000000').font('Helvetica');
    orderData.items.forEach((item, i) => {
      doc.text(item.name, 60, y, { width: 280 });
      doc.text(item.qty.toString(), 350, y, { align: 'center', width: 50 });
      doc.text(`Rs. ${item.price.toFixed(2)}`, 400, y, { align: 'right', width: 60 });
      doc.text(`Rs. ${(item.price * item.qty).toFixed(2)}`, 470, y, { align: 'right', width: 70 });
      y += 20;
      doc.moveTo(50, y).lineTo(550, y).strokeColor('#eeeeee').stroke();
      y += 10;
    });

    // --- Totals ---
    y += 10;
    doc.font('Helvetica-Bold');
    doc.text('Subtotal:', 350, y, { align: 'right', width: 110 });
    doc.text(`Rs. ${orderData.totals?.subtotal?.toFixed(2) || '0.00'}`, 470, y, { align: 'right', width: 70 });
    y += 20;
    
    if (orderData.totals?.discount > 0) {
      doc.text('Discount:', 350, y, { align: 'right', width: 110 });
      doc.text(`- Rs. ${orderData.totals?.discount?.toFixed(2)}`, 470, y, { align: 'right', width: 70 });
      y += 20;
    }

    doc.moveTo(350, y).lineTo(550, y).strokeColor('#000000').stroke();
    y += 10;
    
    doc.fontSize(12).text('TOTAL INVOICE:', 300, y, { align: 'right', width: 160 });
    doc.text(`Rs. ${orderData.totals?.total?.toFixed(2) || '0.00'}`, 470, y, { align: 'right', width: 70 });

    // --- Footer ---
    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    doc.text('Thank you for your business!', 50, 700, { align: 'center' });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

// ==========================================
// CREATE ORDER
// ==========================================
router.post('/', upload, async (req, res) => {
  try {
    const shopImagePath = req.files?.shopImage?.[0]?.path || null;
    const screenshotPath = req.files?.screenshot?.[0]?.path || null;

    if (!shopImagePath) return res.status(400).json({ error: "Shop Image is mandatory" });

    const customerDetails = safeParse(req.body.customerDetails);
    const items = safeParse(req.body.items);
    const payment = safeParse(req.body.payment);
    const totals = safeParse(req.body.totals);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items missing or invalid" });
    }

    // 1. Setup PDF Directory & Filename
    const invoicesDir = path.join(__dirname, '../uploads/invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    
    // Generate an invoice number if frontend didn't pass one
    const generatedInvoiceNo = req.body.invoiceNo || `INV-${Date.now()}`;
    const pdfFilename = `${generatedInvoiceNo}.pdf`;
    const pdfFilePath = path.join(invoicesDir, pdfFilename);

    // 2. Generate the PDF
    const orderDataForPdf = { customerDetails, items, totals, payment };
    await generateInvoicePDF(orderDataForPdf, generatedInvoiceNo, pdfFilePath);

    // 3. Save to MongoDB
    const newOrder = new Order({
      invoiceNo: generatedInvoiceNo,
      orderDate: req.body.orderDate || new Date().toISOString(),
      location: req.body.location,
      customerDetails,
      items,
      payment,
      totals,
      documents: {
        shopImage: shopImagePath,
        screenshot: screenshotPath,
        invoicePdf: `uploads/invoices/${pdfFilename}` 
      }
    });

    const savedOrder = await newOrder.save();

    res.status(201).json({
      message: "Order and PDF saved successfully",
      order: savedOrder
    });

  } catch (error) {
    console.error("🔥 ORDER ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
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

// ==========================================
// UPDATE ORDER STATUS
// ==========================================
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