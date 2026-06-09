const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ======================================================
// IMPORT MODELS
// ======================================================
// Reuse the existing Order model from your app
// Adjust the path to match your project structure
const Order = require('../models/Order');
const DeliveryOrder = require('../models/DeliveryOrder');

// ======================================================
// VALID DELIVERY STATUSES
// ======================================================
const DELIVERY_STATUS = {
  FULL_PAID:    'Order Delivered Payment full done',
  PARTIAL_PAID: 'Ordered deliver partiall payment',
  FAILED:       'Delivery failed',
  FAKE:         'Fake order placed',
};

// ======================================================
// LOGIN — looks up agent from the existing employees/users
// collection. Accepts name-only login (same as before).
// ======================================================
router.post('/login', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    // Try to find the employee in your existing DB collection.
    // Adjust the model import / collection name to match yours.
    // If you have a separate Employee/User model, import it above.
    // For now we do a case-insensitive regex search on the Orders
    // collection's fosName field to confirm the agent exists.
    const agentName = String(name).trim();

    const orderForAgent = await Order.findOne({
      $or: [
        { 'customerDetails.fos': { $regex: new RegExp(`^${agentName}$`, 'i') } },
        { fosName: { $regex: new RegExp(`^${agentName}$`, 'i') } },
      ],
    }).lean();

    // If no orders exist yet for this agent we still allow login
    // (new agents may have no orders). Just return success with name.
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: { name: agentName },
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ======================================================
// GET ORDERS — fetches live orders from MongoDB
// ======================================================
router.get('/orders', async (req, res) => {
  try {
    const { fosName, date, status } = req.query;

    if (!fosName || !String(fosName).trim()) {
      return res.status(400).json({ success: false, error: 'fosName is required' });
    }

    const agentName = String(fosName).trim();

    // Build the query — match orders assigned to this agent.
    // The field name may differ depending on how your Order schema stores the agent.
    // Common options: customerDetails.fos  |  fosName  |  assignedTo
    const query = {
      $or: [
        { 'customerDetails.fos': { $regex: new RegExp(`^${agentName}$`, 'i') } },
        { fosName: { $regex: new RegExp(`^${agentName}$`, 'i') } },
      ],
    };

    if (date) {
      // Support both ISO date strings and date-only strings
      query.orderDate = { $regex: new RegExp(String(date), 'i') };
    }

    if (status) {
      query['payment.status'] = String(status).toLowerCase();
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(orders);
  } catch (error) {
    console.error('GET /orders error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ======================================================
// UPDATE DELIVERY STATUS — updates real MongoDB order
// ======================================================
router.post('/update-status', async (req, res) => {
  try {
    const {
      orderId,
      invoiceNo,
      orderDate,
      customerDetails,
      items,
      totals,
      deliveryStatus,
      reason,
      paymentReceivedAt,
      handedOverTo,
      agentName,
      paidNow,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!orderId || !deliveryStatus || !reason || !agentName) {
      return res.status(400).json({
        success: false,
        message: 'orderId, deliveryStatus, reason, and agentName are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({ success: false, message: 'Invalid orderId format' });
    }

    // ── Fetch the real order from MongoDB ────────────────────────────────────
    const existingOrder = await Order.findById(orderId);

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // ── Guard: don't re-update locked statuses ───────────────────────────────
    const lockedStatuses = ['completed', 'cancelled', 'fake'];
    if (lockedStatuses.includes(existingOrder.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order already marked as "${existingOrder.payment.status}"`,
      });
    }

    // ── Payment math ─────────────────────────────────────────────────────────
    const isNonPaymentStatus = [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.FAKE].includes(deliveryStatus);

    const totalAmount   = Number(existingOrder.totals?.total || totals?.total || 0);
    const previousPaid  = Number(existingOrder.payment?.paidAmount || 0);
    const currentPaid   = isNonPaymentStatus ? 0 : Math.max(0, Number(paidNow || 0));
    const newPaidTotal  = previousPaid + currentPaid;
    const pendingAmount = Math.max(totalAmount - newPaidTotal, 0);

    // ── Map delivery status to internal payment status ───────────────────────
    let mappedStatus;
    switch (deliveryStatus) {
      case DELIVERY_STATUS.FULL_PAID:
        mappedStatus = 'completed';
        break;
      case DELIVERY_STATUS.PARTIAL_PAID:
        mappedStatus = newPaidTotal >= totalAmount ? 'completed' : 'partially_paid';
        break;
      case DELIVERY_STATUS.FAILED:
        mappedStatus = 'cancelled';
        break;
      case DELIVERY_STATUS.FAKE:
        mappedStatus = 'fake';
        break;
      default:
        if (newPaidTotal >= totalAmount && totalAmount > 0) mappedStatus = 'completed';
        else if (newPaidTotal > 0) mappedStatus = 'partially_paid';
        else mappedStatus = 'due';
    }

    // ── Save delivery history record ─────────────────────────────────────────
    const deliveryRecord = new DeliveryOrder({
      originalOrderId:   orderId,
      invoiceNo:         invoiceNo         || existingOrder.invoiceNo,
      orderDate:         orderDate         || existingOrder.orderDate,
      customerDetails:   customerDetails   || existingOrder.customerDetails,
      items:             items             || existingOrder.items,
      totals:            totals            || existingOrder.totals,
      agentName:         String(agentName).trim(),
      deliveryStatus,
      reason:            String(reason).trim(),
      paymentReceivedAt: isNonPaymentStatus ? 'N/A' : String(paymentReceivedAt || '').trim(),
      handedOverTo:      isNonPaymentStatus ? 'N/A' : String(handedOverTo || '').trim(),
      paidNow:           currentPaid,
      totalPaid:         newPaidTotal,
      pendingAmount,
      totalOrderAmount:  totalAmount,
    });

    await deliveryRecord.save();

    // ── Update the original order ────────────────────────────────────────────
    const updateFields = {
      'payment.paidAmount':     newPaidTotal,
      'payment.pendingAmount':  pendingAmount,
      'payment.amountPaid':     newPaidTotal,
      'payment.balance':        pendingAmount,
      'payment.totalAmount':    totalAmount,
      'payment.lastPaymentDate': new Date(),
      'payment.status':          mappedStatus,
    };

    if (mappedStatus === 'cancelled') updateFields.deliveryStatus = 'Delivery failed';
    if (mappedStatus === 'fake')      updateFields.deliveryStatus = 'Fake order placed';

    await Order.findByIdAndUpdate(orderId, { $set: updateFields }, { new: true });

    return res.status(200).json({
      success:       true,
      message:       'Delivery updated successfully',
      paymentStatus: mappedStatus,
      totalPaid:     newPaidTotal,
      pendingAmount,
    });
  } catch (error) {
    console.error('POST /update-status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update delivery' });
  }
});

// ======================================================
// DELIVERY HISTORY — reads from DeliveryOrder collection
// ======================================================
router.get('/history', async (req, res) => {
  try {
    const { agentName, orderId } = req.query;

    const query = {};
    if (agentName) query.agentName = { $regex: new RegExp(`^${String(agentName).trim()}$`, 'i') };
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) query.originalOrderId = orderId;

    const history = await DeliveryOrder.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(history);
  } catch (error) {
    console.error('GET /history error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch delivery history' });
  }
});

module.exports = router;