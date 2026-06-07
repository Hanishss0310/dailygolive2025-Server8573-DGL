const express = require('express');
const router = express.Router();
const DeliveryOrder = require('../models/DeliveryOrder');
const Order = require('../models/Order'); // your existing Order model

// ======================================================
// DELIVERY AGENTS
// ======================================================
const DELIVERY_AGENTS = [
  { name: 'Pavan Kumar',        email: 'pavan@dg.com',    phone: '9000000001', password: 'PavanKumar@DG2026'        },
  { name: 'Kiran GS',           email: 'kiran@dg.com',    phone: '9000000002', password: 'KiranGS@DG2026'           },
  { name: 'Shivaraj',           email: 'shivaraj@dg.com', phone: '9000000003', password: 'Shivaraj@DG2026'          },
  { name: 'Gnanesh',            email: 'gnanesh@dg.com',  phone: '9000000004', password: 'Gnanesh@DG2026'           },
  { name: 'Karan Singh',        email: 'karan@dg.com',    phone: '9000000005', password: 'KaranSingh@DG2026'        },
  { name: 'Kallu Singh',        email: 'kallu@dg.com',    phone: '9000000006', password: 'KalluSingh@DG2026'        },
  { name: 'Mahaveer',           email: 'mahaveer@dg.com', phone: '9000000007', password: 'Mahaveer@DG2026'          },
  { name: 'Bhaskar L',          email: 'bhaskar@dg.com',  phone: '9000000008', password: 'BhaskarL@DG2026'          },
  { name: 'Ramesh Babu',        email: 'ramesh@dg.com',   phone: '9000000009', password: 'RameshBabu@DG2026'        },
  { name: 'Punith',             email: 'punith@dg.com',   phone: '9000000010', password: 'Punith@DG2026'            },
  { name: 'Testing - Fyntraxis',email: 'testing@dg.com',  phone: '9000000011', password: 'Testing-Fyntraxis@DG2026' },
];

// ======================================================
// STATUS → PAYMENT STATUS MAPPING
// These exact strings must match what the frontend sends.
// Frontend DS values (ActiveDeliveries.jsx):
//   DS.FULL_PAID     = 'Order Delivered Payment Full Done'
//   DS.FULL_NOT_PAID = 'Order Delivered Payment Full Not Done'
//   DS.PARTIAL       = 'Order Delivered Partial Payment'
//   DS.FAILED        = 'Delivery Failed'
//   DS.FAKE          = 'Fake Order Placed'
// ======================================================
function mapDeliveryStatusToPaymentStatus(deliveryStatus, newPaidTotal, totalAmount) {
  switch (deliveryStatus) {
    case 'Order Delivered Payment Full Done':
      return 'completed';

    case 'Order Delivered Payment Full Not Done':
      // Delivered but no payment collected yet
      return 'due';

    case 'Order Delivered Partial Payment':
      // If cumulative paid has reached total, mark complete
      return newPaidTotal >= totalAmount && totalAmount > 0 ? 'completed' : 'partially_paid';

    case 'Delivery Failed':
      return 'cancelled';

    case 'Fake Order Placed':
      return 'fake';

    default:
      // Fallback: derive from amounts
      if (newPaidTotal >= totalAmount && totalAmount > 0) return 'completed';
      if (newPaidTotal > 0) return 'partially_paid';
      return 'due';
  }
}

// Non-payment statuses — no money collected
const NON_PAYMENT_STATUSES = ['Delivery Failed', 'Fake Order Placed'];

// ======================================================
// LOGIN (name only)
// ======================================================
router.post('/login', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const user = DELIVERY_AGENTS.find(
      a => a.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );
    if (!user) return res.status(401).json({ success: false, message: 'Agent not found' });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: { name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ======================================================
// GET ORDERS FOR AN AGENT
// ======================================================
router.get('/orders', async (req, res) => {
  try {
    const { fosName, date, status } = req.query;
    if (!fosName) return res.status(400).json({ success: false, error: 'fosName is required' });

    // Build query — adjust field path to match your Order schema
    const query = {
      $or: [
        { 'customerDetails.fos':  { $regex: new RegExp(`^${fosName}$`, 'i') } },
        { 'customerDetails.fosName': { $regex: new RegExp(`^${fosName}$`, 'i') } },
      ]
    };

    if (date) query.orderDate = { $regex: new RegExp(date, 'i') };
    if (status) query['payment.status'] = status.toLowerCase();

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json(orders);
  } catch (err) {
    console.error('GET /orders error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ======================================================
// UPDATE DELIVERY STATUS  ← main fix is here
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

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!orderId || !deliveryStatus || !reason || !agentName) {
      return res.status(400).json({
        success: false,
        message: 'orderId, deliveryStatus, reason and agentName are required',
      });
    }

    // ── Fetch order from DB ───────────────────────────────────────────────────
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // ── Prevent re-updating locked orders ────────────────────────────────────
    const lockedStatuses = ['completed', 'cancelled', 'fake'];
    if (lockedStatuses.includes(existingOrder.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is already marked as "${existingOrder.payment.status}" and cannot be updated.`,
      });
    }

    // ── Amount calculations ───────────────────────────────────────────────────
    const isNonPayment  = NON_PAYMENT_STATUSES.includes(deliveryStatus);
    const totalAmount   = Number(existingOrder.totals?.total || totals?.total || 0);
    const previousPaid  = Number(existingOrder.payment?.paidAmount || 0);
    const currentPaid   = isNonPayment ? 0 : Number(paidNow || 0);
    const newPaidTotal  = previousPaid + currentPaid;
    const pendingAmount = Math.max(totalAmount - newPaidTotal, 0);

    // ── Map to internal payment status ───────────────────────────────────────
    const mappedStatus = mapDeliveryStatusToPaymentStatus(deliveryStatus, newPaidTotal, totalAmount);

    // ── Save delivery record ──────────────────────────────────────────────────
    const deliveryRecord = new DeliveryOrder({
      originalOrderId:   orderId,
      invoiceNo:         invoiceNo   || existingOrder.invoiceNo,
      orderDate:         orderDate   || existingOrder.orderDate,
      customerDetails:   customerDetails || existingOrder.customerDetails,
      items:             items       || existingOrder.items,
      totals:            totals      || existingOrder.totals,
      agentName,
      deliveryStatus,
      reason,
      paymentReceivedAt: isNonPayment ? 'N/A' : (paymentReceivedAt || ''),
      handedOverTo:      isNonPayment ? 'N/A' : (handedOverTo || ''),
      paidNow:           currentPaid,
      totalPaid:         newPaidTotal,
      pendingAmount,
      totalOrderAmount:  totalAmount,
    });

    await deliveryRecord.save();

    // ── Update the original Order document ───────────────────────────────────
    existingOrder.payment = {
      ...(existingOrder.payment?.toObject?.() || existingOrder.payment || {}),
      status:          mappedStatus,
      paidAmount:      newPaidTotal,
      pendingAmount,
      totalAmount,
      lastPaymentDate: new Date().toISOString(),
    };

    // Store the human-readable delivery status on the order too
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
// DELIVERY HISTORY
// ======================================================
router.get('/history', async (req, res) => {
  try {
    const { agentName, invoiceNo } = req.query;
    const query = {};
    if (agentName) query.agentName = { $regex: new RegExp(`^${agentName}$`, 'i') };
    if (invoiceNo) query.invoiceNo = invoiceNo;

    const history = await DeliveryOrder.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json(history);
  } catch (err) {
    console.error('GET /history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch delivery history' });
  }
});

module.exports = router;