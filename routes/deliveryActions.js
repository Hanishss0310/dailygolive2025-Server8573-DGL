const express = require('express');
const router = express.Router();
const DeliveryOrder = require('../models/DeliveryOrder');
const Order = require('../models/Order');

// ======================================================
// DELIVERY AGENTS — single source of truth
// ======================================================
const DELIVERY_AGENTS = [
  { name: 'Pavan Kumar',         email: 'pavan@dg.com',    phone: '9000000001', password: 'PavanKumar@DG2026'         },
  { name: 'Kiran GS',            email: 'kiran@dg.com',    phone: '9000000002', password: 'KiranGS@DG2026'            },
  { name: 'Shivaraj',            email: 'shivaraj@dg.com', phone: '9000000003', password: 'Shivaraj@DG2026'           },
  { name: 'Gnanesh',             email: 'gnanesh@dg.com',  phone: '9000000004', password: 'Gnanesh@DG2026'            },
  { name: 'Karan Singh',         email: 'karan@dg.com',    phone: '9000000005', password: 'KaranSingh@DG2026'         },
  { name: 'Kallu Singh',         email: 'kallu@dg.com',    phone: '9000000006', password: 'KalluSingh@DG2026'         },
  { name: 'Mahaveer',            email: 'mahaveer@dg.com', phone: '9000000007', password: 'Mahaveer@DG2026'           },
  { name: 'Bhaskar L',           email: 'bhaskar@dg.com',  phone: '9000000008', password: 'BhaskarL@DG2026'           },
  { name: 'Ramesh Babu',         email: 'ramesh@dg.com',   phone: '9000000009', password: 'RameshBabu@DG2026'         },
  { name: 'Punith',              email: 'punith@dg.com',   phone: '9000000010', password: 'Punith@DG2026'             },
  { name: 'Testing - Fyntraxis', email: 'testing@dg.com',  phone: '9000000011', password: 'Testing-Fyntraxis@DG2026'  },
];

// ======================================================
// STATUS MAPPING
// These exact strings must match DS.* in the frontend
// and the enum in DeliveryOrder.model.js
// ======================================================
function mapDeliveryStatusToPaymentStatus(deliveryStatus, newPaidTotal, totalAmount) {
  switch (deliveryStatus) {
    case 'Order Delivered Payment Full Done':
      return 'completed';
    case 'Order Delivered Payment Full Not Done':
      return 'due';
    case 'Order Delivered Partial Payment':
      return newPaidTotal >= totalAmount && totalAmount > 0 ? 'completed' : 'partially_paid';
    case 'Delivery Failed':
      return 'cancelled';
    case 'Fake Order Placed':
      return 'fake';
    default:
      if (newPaidTotal >= totalAmount && totalAmount > 0) return 'completed';
      if (newPaidTotal > 0) return 'partially_paid';
      return 'due';
  }
}

const NON_PAYMENT_STATUSES = ['Delivery Failed', 'Fake Order Placed'];

// ======================================================
// POST /login
// Validates name + password, returns agent info
// ======================================================
router.post('/login', (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Name and password are required' });
    }

    const agent = DELIVERY_AGENTS.find(
      a => a.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );

    if (!agent) {
      return res.status(401).json({ success: false, message: 'Agent not found' });
    }

    if (agent.password !== String(password).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        name:  agent.name,
        email: agent.email,
        phone: agent.phone,
      },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ======================================================
// GET /orders
// Returns all orders assigned to the logged-in agent.
// Supports optional ?date=YYYY-MM-DD and ?status=xxx
// ======================================================
router.get('/orders', async (req, res) => {
  try {
    const { fosName, date, status } = req.query;

    if (!fosName) {
      return res.status(400).json({ success: false, error: 'fosName is required' });
    }

    // Escape special regex characters in the agent name
    const escapedName = fosName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match whichever field your Order schema uses for agent assignment.
    // Add or remove $or arms to match your actual schema.
    const query = {
      $or: [
        { 'customerDetails.fos':     { $regex: new RegExp(`^${escapedName}$`, 'i') } },
        { 'customerDetails.fosName': { $regex: new RegExp(`^${escapedName}$`, 'i') } },
        { 'assignedTo':              { $regex: new RegExp(`^${escapedName}$`, 'i') } },
        { 'agentName':               { $regex: new RegExp(`^${escapedName}$`, 'i') } },
      ],
    };

    if (date) {
      query.orderDate = { $regex: new RegExp(date.trim(), 'i') };
    }

    if (status) {
      query['payment.status'] = status.trim().toLowerCase();
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json(orders);
  } catch (err) {
    console.error('GET /orders error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ======================================================
// POST /update-status
// Updates an order's delivery + payment status
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

    if (!orderId || !deliveryStatus || !reason || !agentName) {
      return res.status(400).json({
        success: false,
        message: 'orderId, deliveryStatus, reason and agentName are required',
      });
    }

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Prevent updating already-locked orders
    const lockedStatuses = ['completed', 'cancelled', 'fake'];
    if (lockedStatuses.includes(existingOrder.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is already marked as "${existingOrder.payment.status}" and cannot be updated.`,
      });
    }

    // Amount calculations
    const isNonPayment  = NON_PAYMENT_STATUSES.includes(deliveryStatus);
    const totalAmount   = Number(existingOrder.totals?.total || totals?.total || 0);
    const previousPaid  = Number(existingOrder.payment?.paidAmount || 0);
    const currentPaid   = isNonPayment ? 0 : Math.max(0, Number(paidNow || 0));
    const newPaidTotal  = previousPaid + currentPaid;
    const pendingAmount = Math.max(totalAmount - newPaidTotal, 0);

    const mappedStatus = mapDeliveryStatusToPaymentStatus(deliveryStatus, newPaidTotal, totalAmount);

    // Save delivery history record
    await new DeliveryOrder({
      originalOrderId:   orderId,
      invoiceNo:         invoiceNo         || existingOrder.invoiceNo,
      orderDate:         orderDate         || existingOrder.orderDate,
      customerDetails:   customerDetails   || existingOrder.customerDetails,
      items:             items             || existingOrder.items,
      totals:            totals            || existingOrder.totals,
      agentName,
      deliveryStatus,
      reason,
      paymentReceivedAt: isNonPayment ? 'N/A' : (paymentReceivedAt || ''),
      handedOverTo:      isNonPayment ? 'N/A' : (handedOverTo      || ''),
      paidNow:           currentPaid,
      totalPaid:         newPaidTotal,
      pendingAmount,
      totalOrderAmount:  totalAmount,
    }).save();

    // Patch the original Order
    const prevPayment = existingOrder.payment?.toObject
      ? existingOrder.payment.toObject()
      : { ...(existingOrder.payment || {}) };

    existingOrder.payment = {
      ...prevPayment,
      status:          mappedStatus,
      paidAmount:      newPaidTotal,
      pendingAmount,
      totalAmount,
      lastPaymentDate: new Date().toISOString(),
    };
    existingOrder.deliveryStatus = deliveryStatus;

    await existingOrder.save();

    return res.status(200).json({
      success:       true,
      message:       'Delivery updated successfully',
      paymentStatus: mappedStatus,
      totalPaid:     newPaidTotal,
      pendingAmount,
    });
  } catch (err) {
    console.error('POST /update-status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update delivery status' });
  }
});

// ======================================================
// GET /history
// Returns delivery history records
// ======================================================
router.get('/history', async (req, res) => {
  try {
    const { agentName, invoiceNo } = req.query;
    const query = {};

    if (agentName) {
      const escaped = agentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.agentName = { $regex: new RegExp(`^${escaped}$`, 'i') };
    }
    if (invoiceNo) {
      query.invoiceNo = invoiceNo.trim();
    }

    const history = await DeliveryOrder.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json(history);
  } catch (err) {
    console.error('GET /history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch delivery history' });
  }
});

module.exports = router;