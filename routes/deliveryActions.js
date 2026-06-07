const express       = require('express');
const router        = express.Router();
const DeliveryOrder = require('../models/DeliveryOrder');

// ======================================================
// STATIC DELIVERY AGENTS
// Password format: NameWithoutSpaces@DG2026
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
// CANONICAL DELIVERY STATUS STRINGS
// These exact strings flow: frontend → route → MongoDB
// Keep in sync with DeliveryOrder model enum.
// ======================================================
const DELIVERY_STATUS = {
  FULL_PAID:     'Order Delivered Payment Full Done',
  FULL_NOT_PAID: 'Order Delivered Payment Full Not Done',
  PARTIAL:       'Order Delivered Partial Payment',
  FAILED:        'Delivery Failed',
  FAKE:          'Fake Order Placed',
};

// All valid values as an array (used for validation)
const VALID_STATUSES = Object.values(DELIVERY_STATUS);

// ======================================================
// IN-MEMORY ORDER STORE
// Replace the MOCK_ORDERS filter with a real DB query
// once your Order model is connected.
// ======================================================
let MOCK_ORDERS = [
  {
    _id:             'order_1',
    invoiceNo:       'INV-1001',
    orderDate:       '2026-06-06',
    customerDetails: {
      fos:          'Pavan Kumar',
      shopName:     'Pavan Stores',
      name:         'John Doe',
      mobileNumber: '9876543210',
      phone:        '9876543210',
      address:      'MG Road, Bangalore',
    },
    items:   [{ name: 'Rice 5kg', qty: 2, price: 400 }],
    totals:  { total: 800 },
    payment: { status: 'due', paidAmount: 0, pendingAmount: 800 },
    location: '',
    createdAt: new Date().toISOString(),
  },
  {
    _id:             'order_2',
    invoiceNo:       'INV-1002',
    orderDate:       '2026-06-06',
    customerDetails: {
      fos:          'Kiran GS',
      shopName:     'Kiran Mart',
      name:         'Jane Smith',
      mobileNumber: '9123456780',
      phone:        '9123456780',
      address:      'Jayanagar, Bangalore',
    },
    items:   [{ name: 'Oil 1L', qty: 5, price: 200 }],
    totals:  { total: 1000 },
    payment: { status: 'due', paidAmount: 0, pendingAmount: 1000 },
    location: '',
    createdAt: new Date().toISOString(),
  },
];

let MOCK_DELIVERY_HISTORY = [];

// ══════════════════════════════════════════════════════
// POST /api/delivery/login
// Body: { name: string, password: string }
// ══════════════════════════════════════════════════════
router.post('/login', (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name and password are required.',
      });
    }

    const agent = DELIVERY_AGENTS.find(
      (a) => a.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );

    if (!agent) {
      return res.status(401).json({
        success: false,
        message: 'Agent not found. Please select a valid name.',
      });
    }

    if (agent.password !== String(password).trim()) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
      });
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
    console.error('POST /login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/delivery/orders
// Query: fosName (required), date (optional), status (optional)
// ══════════════════════════════════════════════════════
router.get('/orders', (req, res) => {
  try {
    const { fosName, date, status } = req.query;

    if (!fosName) {
      return res.status(400).json({ success: false, error: 'fosName is required.' });
    }

    let result = MOCK_ORDERS.filter(
      (o) =>
        o.customerDetails?.fos &&
        String(o.customerDetails.fos).toLowerCase() === String(fosName).toLowerCase()
    );

    if (date) {
      result = result.filter((o) =>
        o.orderDate?.toLowerCase().includes(String(date).toLowerCase())
      );
    }

    if (status) {
      result = result.filter(
        (o) => o.payment?.status?.toLowerCase() === String(status).toLowerCase()
      );
    }

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /orders error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders.' });
  }
});

// ══════════════════════════════════════════════════════
// POST /api/delivery/update-status
// Body: { orderId, deliveryStatus, reason, agentName,
//         paidNow, paymentReceivedAt, handedOverTo,
//         invoiceNo, orderDate, customerDetails, items, totals }
// ══════════════════════════════════════════════════════
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

    // ── 1. Required field check ───────────────────────────────
    if (!orderId || !deliveryStatus || !reason || !agentName) {
      return res.status(400).json({
        success: false,
        message: 'orderId, deliveryStatus, reason and agentName are required.',
      });
    }

    // ── 2. Validate deliveryStatus is a known canonical value ─
    if (!VALID_STATUSES.includes(deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid deliveryStatus "${deliveryStatus}". Must be one of: ${VALID_STATUSES.join(' | ')}`,
      });
    }

    // ── 3. Find the in-memory order ───────────────────────────
    const idx = MOCK_ORDERS.findIndex((o) => String(o._id) === String(orderId));

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order        = MOCK_ORDERS[idx];
    const lockedStates = ['completed', 'cancelled', 'fake'];

    if (lockedStates.includes(order.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is already locked as "${order.payment.status}" and cannot be updated.`,
      });
    }

    // ── 4. Determine if this is a non-payment status ──────────
    const isNonPayment = [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.FAKE].includes(deliveryStatus);

    // ── 5. Calculate payment figures ──────────────────────────
    const totalAmount  = Number(order.totals?.total || totals?.total || 0);
    const prevPaid     = Number(order.payment?.paidAmount || 0);
    const nowPaid      = isNonPayment ? 0 : Number(paidNow || 0);
    const newTotalPaid = prevPaid + nowPaid;
    const pending      = Math.max(totalAmount - newTotalPaid, 0);

    // ── 6. Map deliveryStatus → internal payment status ───────
    let mappedStatus;
    switch (deliveryStatus) {
      case DELIVERY_STATUS.FULL_PAID:
        mappedStatus = 'completed';
        break;
      case DELIVERY_STATUS.FULL_NOT_PAID:
        // Order delivered but payment not yet collected
        mappedStatus = newTotalPaid >= totalAmount ? 'completed' : 'due';
        break;
      case DELIVERY_STATUS.PARTIAL:
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

    // ── 7. Build the delivery record ──────────────────────────
    const record = {
      originalOrderId:   orderId,
      invoiceNo:         invoiceNo         || order.invoiceNo,
      orderDate:         orderDate         || order.orderDate,
      customerDetails:   customerDetails   || order.customerDetails,
      items:             items             || order.items,
      totals:            totals            || order.totals,
      agentName,
      deliveryStatus,                        // stored as English canonical string
      reason,
      paymentReceivedAt: isNonPayment ? 'N/A' : (paymentReceivedAt || 'N/A'),
      handedOverTo:      isNonPayment ? 'N/A' : (handedOverTo      || 'N/A'),
      paidNow:           nowPaid,
      totalPaid:         newTotalPaid,
      pendingAmount:     pending,
      totalOrderAmount:  totalAmount,
    };

    // ── 8. Save to MongoDB ─────────────────────────────────────
    try {
      await DeliveryOrder.create(record);
      console.log(`✅ DeliveryOrder saved for ${orderId}`);
    } catch (dbErr) {
      // Log but don't block the response — in-memory update still proceeds
      console.error('❌ DB save error:', dbErr.message);
    }

    // ── 9. Update in-memory order ─────────────────────────────
    MOCK_DELIVERY_HISTORY.push({
      _id:       'del_' + Date.now() + Math.floor(Math.random() * 1000),
      ...record,
      createdAt: new Date().toISOString(),
    });

    MOCK_ORDERS[idx] = {
      ...order,
      payment: {
        ...(order.payment || {}),
        paidAmount:      newTotalPaid,
        pendingAmount:   pending,
        totalAmount,
        amountPaid:      newTotalPaid,
        balance:         pending,
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
      pendingAmount: pending,
    });

  } catch (err) {
    console.error('POST /update-status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update delivery.' });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/delivery/history
// Returns all delivery update records (newest first)
// ══════════════════════════════════════════════════════
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