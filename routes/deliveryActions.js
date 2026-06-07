const express = require('express');
const router = express.Router();

// ======================================================
// STATIC DELIVERY AGENTS
// ======================================================
const DELIVERY_AGENTS = [
  { name: 'Pavan Kumar',         email: 'pavan@dg.com',    phone: '9000000001', password: 'PavanKumar@DG2026' },
  { name: 'Kiran GS',            email: 'kiran@dg.com',    phone: '9000000002', password: 'KiranGS@DG2026' },
  { name: 'Shivaraj',            email: 'shivaraj@dg.com', phone: '9000000003', password: 'Shivaraj@DG2026' },
  { name: 'Gnanesh',             email: 'gnanesh@dg.com',  phone: '9000000004', password: 'Gnanesh@DG2026' },
  { name: 'Karan Singh',         email: 'karan@dg.com',    phone: '9000000005', password: 'KaranSingh@DG2026' },
  { name: 'Kallu Singh',         email: 'kallu@dg.com',    phone: '9000000006', password: 'KalluSingh@DG2026' },
  { name: 'Mahaveer',            email: 'mahaveer@dg.com', phone: '9000000007', password: 'Mahaveer@DG2026' },
  { name: 'Bhaskar L',           email: 'bhaskar@dg.com',  phone: '9000000008', password: 'BhaskarL@DG2026' },
  { name: 'Ramesh Babu',         email: 'ramesh@dg.com',   phone: '9000000009', password: 'RameshBabu@DG2026' },
  { name: 'Punith',              email: 'punith@dg.com',   phone: '9000000010', password: 'Punith@DG2026' },
  { name: 'Testing - Fyntraxis', email: 'testing@dg.com',  phone: '9000000011', password: 'Testing-Fyntraxis@DG2026' },
];

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
// IN-MEMORY DATA STORES
// ======================================================
let MOCK_ORDERS = [
  {
    _id: 'order_1',
    invoiceNo: 'INV-1001',
    orderDate: '2026-06-06',
    customerDetails: { fos: 'Pavan Kumar', name: 'John Doe', phone: '1234567890' },
    items: [{ name: 'Sample Item A', qty: 1 }],
    totals: { total: 1500 },
    payment: { status: 'due', paidAmount: 0, pendingAmount: 1500 },
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'order_2',
    invoiceNo: 'INV-1002',
    orderDate: '2026-06-06',
    customerDetails: { fos: 'Kiran GS', name: 'Jane Smith', phone: '0987654321' },
    items: [{ name: 'Sample Item B', qty: 2 }],
    totals: { total: 800 },
    payment: { status: 'due', paidAmount: 0, pendingAmount: 800 },
    createdAt: new Date().toISOString(),
  },
];

let MOCK_DELIVERY_HISTORY = [];

// ======================================================
// LOGIN (NAME + PASSWORD)
// ======================================================
router.post('/login', (req, res) => {
  try {
    const { name, password } = req.body;

    // ── Validate required fields ──────────────────────────
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name and password are required',
      });
    }

    // ── Find agent by name (case-insensitive) ─────────────
    const user = DELIVERY_AGENTS.find(
      (agent) =>
        agent.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Agent not found. Please select a valid name.',
      });
    }

    // ── Validate password (exact match) ───────────────────
    if (user.password !== String(password).trim()) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
      });
    }

    // ── Success ───────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        name:  user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ======================================================
// GET ORDERS FOR DELIVERY APP
// ======================================================
router.get('/orders', (req, res) => {
  try {
    const { fosName, date, status } = req.query;

    if (!fosName) {
      return res.status(400).json({ success: false, error: 'fosName is required' });
    }

    let filteredOrders = MOCK_ORDERS.filter(
      (order) =>
        order.customerDetails?.fos &&
        String(order.customerDetails.fos).toLowerCase() ===
          String(fosName).toLowerCase()
    );

    if (date) {
      filteredOrders = filteredOrders.filter((order) =>
        order.orderDate &&
        order.orderDate.toLowerCase().includes(String(date).toLowerCase())
      );
    }

    if (status) {
      filteredOrders = filteredOrders.filter(
        (order) =>
          order.payment?.status &&
          String(order.payment.status).toLowerCase() ===
            String(status).toLowerCase()
      );
    }

    filteredOrders.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.status(200).json(filteredOrders);
  } catch (error) {
    console.error('GET /orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// ======================================================
// UPDATE DELIVERY STATUS
// ======================================================
router.post('/update-status', (req, res) => {
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

    const existingOrderIndex = MOCK_ORDERS.findIndex(
      (o) => String(o._id) === String(orderId)
    );

    if (existingOrderIndex === -1) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const existingOrder   = MOCK_ORDERS[existingOrderIndex];
    const lockedStatuses  = ['completed', 'cancelled', 'fake'];

    if (lockedStatuses.includes(existingOrder.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order already marked as "${existingOrder.payment.status}"`,
      });
    }

    const totalAmount    = Number(existingOrder.totals?.total || totals?.total || 0);
    const previousPaid   = Number(existingOrder.payment?.paidAmount || 0);
    const currentPaid    = Number(paidNow || 0);
    const newPaidTotal   = previousPaid + currentPaid;
    const pendingAmount  = Math.max(totalAmount - newPaidTotal, 0);

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
        else if (newPaidTotal > 0)                          mappedStatus = 'partially_paid';
        else                                                mappedStatus = 'due';
    }

    const isNonPaymentStatus = [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.FAKE].includes(
      deliveryStatus
    );

    const deliveryRecord = {
      _id:             'del_' + Date.now() + Math.floor(Math.random() * 1000),
      originalOrderId: orderId,
      invoiceNo:       invoiceNo      || existingOrder.invoiceNo,
      orderDate:       orderDate      || existingOrder.orderDate,
      customerDetails: customerDetails || existingOrder.customerDetails,
      items:           items          || existingOrder.items,
      totals:          totals         || existingOrder.totals,
      agentName,
      deliveryStatus,
      reason,
      paymentReceivedAt: paymentReceivedAt || (isNonPaymentStatus ? 'N/A' : ''),
      handedOverTo:      handedOverTo      || (isNonPaymentStatus ? 'N/A' : ''),
      paidNow:           currentPaid,
      totalPaid:         newPaidTotal,
      pendingAmount,
      totalOrderAmount:  totalAmount,
      createdAt:         new Date().toISOString(),
    };

    MOCK_DELIVERY_HISTORY.push(deliveryRecord);

    MOCK_ORDERS[existingOrderIndex] = {
      ...existingOrder,
      payment: {
        ...(existingOrder.payment || {}),
        amountPaid:      newPaidTotal,
        balance:         pendingAmount,
        totalAmount,
        paidAmount:      newPaidTotal,
        pendingAmount,
        lastPaymentDate: new Date().toISOString(),
        status:          mappedStatus,
      },
      ...(mappedStatus === 'cancelled' && { deliveryStatus: 'Delivery failed' }),
      ...(mappedStatus === 'fake'      && { deliveryStatus: 'Fake order placed' }),
    };

    res.status(200).json({
      success:       true,
      message:       'Delivery updated successfully',
      paymentStatus: mappedStatus,
      totalPaid:     newPaidTotal,
      pendingAmount,
    });
  } catch (error) {
    console.error('POST /update-status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update delivery' });
  }
});

// ======================================================
// DELIVERY HISTORY
// ======================================================
router.get('/history', (req, res) => {
  try {
    const history = [...MOCK_DELIVERY_HISTORY].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.status(200).json(history);
  } catch (error) {
    console.error('GET /history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch delivery history' });
  }
});

module.exports = router;