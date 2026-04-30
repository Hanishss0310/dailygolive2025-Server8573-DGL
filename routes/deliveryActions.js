const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const DeliveryOrder = require('../models/DeliveryOrder');

// 1. GET Orders for the Delivery App (Filtered by Date and FOS optionally)
router.get('/orders', async (req, res) => {
  try {
    const { fosName, date } = req.query;
    let query = {};

    if (fosName) query['customerDetails.fos'] = fosName;
    if (date) query['orderDate'] = { $regex: date, $options: 'i' }; // Simple date matching

    // Fetch all orders except those fully completed
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// 2. POST Update Delivery Status
router.post('/update-status', async (req, res) => {
  try {
    const { 
      orderId, invoiceNo, orderDate, customerDetails, items, totals, 
      deliveryStatus, reason, paymentReceivedAt, handedOverTo, agentName 
    } = req.body;

    // A. Save record in the NEW DeliveryOrder DB (without the bill/pdf)
    const newDeliveryRecord = new DeliveryOrder({
      originalOrderId: orderId,
      invoiceNo,
      orderDate,
      customerDetails,
      items,
      totals,
      deliveryStatus,
      reason,
      paymentReceivedAt,
      handedOverTo,
      agentName
    });
    await newDeliveryRecord.save();

    // B. Update the ORIGINAL Order DB Status
    // Map the long strings to your original Order schema enums
    let mappedStatus = 'due';
    if (deliveryStatus === 'Order Delivered Payment full done') mappedStatus = 'completed';
    if (deliveryStatus === 'Ordered deliver partiall payment') mappedStatus = 'partially_paid';
    if (deliveryStatus === 'Delivery failed' || deliveryStatus === 'Fake order placed') mappedStatus = 'overdue';

    await Order.findByIdAndUpdate(orderId, {
      'payment.status': mappedStatus
    });

    res.status(200).json({ success: true, message: "Delivery updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update delivery" });
  }
});

module.exports = router;