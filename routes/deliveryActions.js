// routes/deliveryRoute.js
const express       = require('express');
const router        = express.Router();
const DeliveryOrder = require('../models/DeliveryOrder'); // CommonJS require (NOT import)

// ======================================================
// STATIC DELIVERY AGENTS
// ======================================================
const DELIVERY_AGENTS = [
  { name: 'Pavan Kumar',         email: 'pavan@dg.com',    phone: '9000000001', password: 'PavanKumar@DG2026'        },
  { name: 'Kiran GS',            email: 'kiran@dg.com',    phone: '9000000002', password: 'KiranGS@DG2026'           },
  { name: 'Shivaraj',            email: 'shivaraj@dg.com', phone: '9000000003', password: 'Shivaraj@DG2026'          },
  { name: 'Gnanesh',             email: 'gnanesh@dg.com',  phone: '9000000004', password: 'Gnanesh@DG2026'           },
  { name: 'Karan Singh',         email: 'karan@dg.com',    phone: '9000000005', password: 'KaranSingh@DG2026'        },
  { name: 'Kallu Singh',         email: 'kallu@dg.com',    phone: '9000000006', password: 'KalluSingh@DG2026'        },
  { name: 'Mahaveer',            email: 'mahaveer@dg.com', phone: '9000000007', password: 'Mahaveer@DG2026'          },
  { name: 'Bhaskar L',           email: 'bhaskar@dg.com',  phone: '9000000008', password: 'BhaskarL@DG2026'          },
  { name: 'Ramesh Babu',         email: 'ramesh@dg.com',   phone: '9000000009', password: 'RameshBabu@DG2026'        },
  { name: 'Punith',              email: 'punith@dg.com',   phone: '9000000010', password: 'Punith@DG2026'            },
  { name: 'Testing - Fyntraxis', email: 'testing@dg.com',  phone: '9000000011', password: 'Testing-Fyntraxis@DG2026' },
];

// ======================================================
// CANONICAL DELIVERY STATUS STRINGS
// These MUST exactly match:
//   • frontend option values (UpdateDrawer)
//   • DeliveryOrder model enum
// ======================================================
const DELIVERY_STATUS = {
  FULL_PAID:         'Order Delivered Payment Full Done',
  FULL_NOT_PAID:     'Order Delivered Payment Full Not Done',
  PARTIAL_PAID:      'Order Delivered Partial Payment',
  FAILED:            'Delivery Failed',
  FAKE:              'Fake Order Placed',
};

// ======================================================
// IN-MEMORY ORDER STORE (replace with DB query later)
// ======================================================
let MOCK_ORDERS = [
  {
    _id:             'order_1',
    invoiceNo:       'INV-1001',
    orderDate:       '2026-06-06',
    customerDetails: { fos: 'Pavan Kumar', shopName: 'Pavan Store', name: 'John Doe', phone: '1234567890', address: 'Bangalore', mobileNumber: '1234567890' },
    items:           [{ name: 'Sample Item A', qty: 2, price: 750 }],
    totals:          { total: 1500 },
    payment:         { status: 'due', paidAmount: 0, pendingAmount: 1500 },
    location:        '',
    createdAt:       new Date().toISOString(),
  },
  {
    _id:             'order_2',
    invoiceNo:       'INV-1002',
    orderDate:       '2026-06-06',
    customerDetails: { fos: 'Kiran GS', shopName: 'Kiran Mart', name: 'Jane Smith', phone: '0987654321', address: 'Mysore', mobileNumber: '0987654321' },
    items:           [{ name: 'Sample Item B', qty: 4, price: 200 }],
    totals:          { total: 800 },
    payment:         { status: 'due', paidAmount: 0, pendingAmount: 800 },
    location:        '',
    createdAt:       new Date().toISOString(),
  },
];

let MOCK_DELIVERY_HISTORY = [];

// ======================================================
// POST /login  — name + password
// ======================================================
router.post('/login', (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Name and password are required.' });
    }

    const agent = DELIVERY_AGENTS.find(
      (a) => a.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );

    if (!agent) {
      return res.status(401).json({ success: false, message: 'Agent not found. Please select a valid name.' });
    }

    if (agent.password !== String(password).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: { name: agent.name, email: agent.email, phone: agent.phone },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ======================================================
// GET /orders  — fetch orders for a given agent (fosName)
// ======================================================
router.get('/orders', (req, res) => {
  try {
    const { fosName, date, status } = req.query;

    if (!fosName) {
      return res.status(400).json({ success: false, error: 'fosName is required' });
    }

    let result = MOCK_ORDERS.filter(
      (o) =>
        o.customerDetails?.fos &&
        String(o.customerDetails.fos).toLowerCase() === String(fosName).toLowerCase()
    );

    if (date)   result = result.filter((o) => o.orderDate?.toLowerCase().includes(date.toLowerCase()));
    if (status) result = result.filter((o) => o.payment?.status?.toLowerCase() === status.toLowerCase());

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /orders error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ======================================================
// POST /update-status  — update delivery + save to DB
// ======================================================
router.post('/update-status', async (req, res) => {
  try {
    const {
      orderId, invoiceNo, orderDate, customerDetails, items, totals,
      deliveryStatus, reason, paymentReceivedAt, handedOverTo, agentName, paidNow,
    } = req.body;

    // ── 1. Validate required fields ──────────────────────────
    if (!orderId || !deliveryStatus || !reason || !agentName) {
      return res.status(400).json({
        success: false,
        message: 'orderId, deliveryStatus, reason and agentName are required.',
      });
    }

    // ── 2. Validate deliveryStatus is a known value ───────────
    const validStatuses = Object.values(DELIVERY_STATUS);
    if (!validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid deliveryStatus. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // ── 3. Find the order ─────────────────────────────────────
    const orderIndex = MOCK_ORDERS.findIndex((o) => String(o._id) === String(orderId));
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order        = MOCK_ORDERS[orderIndex];
    const lockedStates = ['completed', 'cancelled', 'fake'];

    if (lockedStates.includes(order.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is already locked as "${order.payment.status}" and cannot be updated.`,
      });
    }

    // ── 4. Calculate payment figures ──────────────────────────
    const isNonPayment  = [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.FAKE].includes(deliveryStatus);
    const totalAmount   = Number(order.totals?.total || totals?.total || 0);
    const previousPaid  = Number(order.payment?.paidAmount || 0);
    const currentPaid   = isNonPayment ? 0 : Number(paidNow || 0);
    const newTotalPaid  = previousPaid + currentPaid;
    const pendingAmount = Math.max(totalAmount - newTotalPaid, 0);

    // ── 5. Map deliveryStatus → internal payment status ───────
    let mappedStatus;
    switch (deliveryStatus) {
      case DELIVERY_STATUS.FULL_PAID:
        mappedStatus = 'completed';
        break;
      case DELIVERY_STATUS.FULL_NOT_PAID:
        // Delivered but cash NOT collected — stays due
        mappedStatus = newTotalPaid >= totalAmount ? 'completed' : 'due';
        break;
      case DELIVERY_STATUS.PARTIAL_PAID:
        mappedStatus = newTotalPaid >= totalAmount ? 'completed' : 'partially_paid';
        break;
      case DELIVERY_STATUS.FAILED:
        mappedStatus = 'cancelled';
        break;
      case DELIVERY_STATUS.FAKE:
        mappedStatus = 'fake';
        break;
      default:
        mappedStatus = newTotalPaid >= totalAmount && totalAmount > 0
          ? 'completed'
          : newTotalPaid > 0
            ? 'partially_paid'
            : 'due';
    }

    // ── 6. Save delivery record to MongoDB ────────────────────
    try {
      await DeliveryOrder.create({
        originalOrderId:   orderId,
        invoiceNo:         invoiceNo         || order.invoiceNo,
        orderDate:         orderDate         || order.orderDate,
        customerDetails:   customerDetails   || order.customerDetails,
        items:             items             || order.items,
        totals:            totals            || order.totals,
        agentName,
        deliveryStatus,                       // stored in English
        reason,
        paymentReceivedAt: isNonPayment ? 'N/A' : (paymentReceivedAt || 'N/A'),
        handedOverTo:      isNonPayment ? 'N/A' : (handedOverTo      || 'N/A'),
        paidNow:           currentPaid,
        totalPaid:         newTotalPaid,
        pendingAmount,
        totalOrderAmount:  totalAmount,
      });
    } catch (dbErr) {
      console.error('DB SAVE ERROR:', dbErr.message);
      // Don't block the response — still update in-memory and warn
    }

    // ── 7. Also push to in-memory history ─────────────────────
    MOCK_DELIVERY_HISTORY.push({
      _id:              'del_' + Date.now() + Math.floor(Math.random() * 1000),
      originalOrderId:  orderId,
      invoiceNo:        invoiceNo         || order.invoiceNo,
      orderDate:        orderDate         || order.orderDate,
      customerDetails:  customerDetails   || order.customerDetails,
      items:            items             || order.items,
      totals:           totals            || order.totals,
      agentName,
      deliveryStatus,
      reason,
      paymentReceivedAt: isNonPayment ? 'N/A' : (paymentReceivedAt || ''),
      handedOverTo:      isNonPayment ? 'N/A' : (handedOverTo      || ''),
      paidNow:           currentPaid,
      totalPaid:         newTotalPaid,
      pendingAmount,
      totalOrderAmount:  totalAmount,
      createdAt:         new Date().toISOString(),
    });

    // ── 8. Update in-memory order ─────────────────────────────
    MOCK_ORDERS[orderIndex] = {
      ...order,
      payment: {
        ...(order.payment || {}),
        paidAmount:      newTotalPaid,
        pendingAmount,
        totalAmount,
        amountPaid:      newTotalPaid,
        balance:         pendingAmount,
        lastPaymentDate: new Date().toISOString(),
        status:          mappedStatus,
      },
      ...(mappedStatus === 'cancelled' && { deliveryStatus: DELIVERY_STATUS.FAILED }),
      ...(mappedStatus === 'fake'      && { deliveryStatus: DELIVERY_STATUS.FAKE   }),
    };

    return res.status(200).json({
      success:       true,
      message:       'Delivery updated successfully.',
      paymentStatus: mappedStatus,
      totalPaid:     newTotalPaid,
      pendingAmount,
    });
  } catch (err) {
    console.error('POST /update-status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update delivery.' });
  }
});

// ======================================================
// GET /history  — all delivery update records
// ======================================================
router.get('/history', (req, res) => {
  try {
    const history = [...MOCK_DELIVERY_HISTORY].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return res.status(200).json(history);
  } catch (err) {
    console.error('GET /history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch history.' });
  }
});

module.exports = router;