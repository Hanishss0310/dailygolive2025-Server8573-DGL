const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const DeliveryOrder = require('../models/DeliveryOrder');

// ======================================================
// VALID DELIVERY STATUSES (must match schema enum)
// ======================================================
const DELIVERY_STATUS = {
  FULL_PAID:    'Order Delivered Payment full done',
  PARTIAL_PAID: 'Ordered deliver partiall payment',   // note: matches schema spelling
  FAILED:       'Delivery failed',
  FAKE:         'Fake order placed',
};

// ======================================================
// 1. GET ORDERS FOR DELIVERY APP
//    — always requires fosName (set by login session)
// ======================================================
router.get('/orders', async (req, res) => {
  try {
    const { fosName, date, status } = req.query;

    if (!fosName) {
      return res.status(400).json({
        success: false,
        error: 'fosName is required',
      });
    }

    let query = {};

    // Always filter by logged-in FOS agent
    query['customerDetails.fos'] = fosName;

    // Optional date filter
    if (date) {
      query['orderDate'] = { $regex: date, $options: 'i' };
    }

    // Optional payment status filter
    if (status) {
      query['payment.status'] = status;
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.status(200).json(orders);

  } catch (error) {
    console.error('GET /orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});


// ======================================================
// 2. UPDATE DELIVERY STATUS
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

    // ── Validate required fields ────────────────────────────────────────────
    if (!orderId || !deliveryStatus || !reason || !agentName) {
      return res.status(400).json({
        success: false,
        message: 'orderId, deliveryStatus, reason and agentName are required',
      });
    }

    // ── Fetch original order ────────────────────────────────────────────────
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // ── Block already-completed orders ──────────────────────────────────────
    const lockedStatuses = ['completed', 'cancelled', 'fake'];
    if (lockedStatuses.includes(existingOrder.payment?.status)) {
      return res.status(400).json({
        success: false,
        message: `Order already marked as "${existingOrder.payment.status}" and cannot be updated`,
      });
    }

    // ── Determine payment mutation ──────────────────────────────────────────
    const totalAmount   = Number(existingOrder.totals?.total || 0);
    const previousPaid  = Number(existingOrder.payment?.paidAmount || 0);
    const currentPaid   = Number(paidNow || 0);
    const newPaidTotal  = previousPaid + currentPaid;
    const pendingAmount = Math.max(totalAmount - newPaidTotal, 0);

    // ── Map deliveryStatus → payment.status ────────────────────────────────
    let mappedStatus;

    switch (deliveryStatus) {
      case DELIVERY_STATUS.FULL_PAID:
        // Trust the agent; also auto-complete if fully paid
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
        // Fallback: derive from numbers
        if (newPaidTotal >= totalAmount) mappedStatus = 'completed';
        else if (newPaidTotal > 0)        mappedStatus = 'partially_paid';
        else                              mappedStatus = 'due';
    }

    // ── Save delivery history record ────────────────────────────────────────
    // For failed / fake orders paymentReceivedAt and handedOverTo can be empty;
    // the schema requires them so we fall back to a sentinel value.
    const isNonPaymentStatus = [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.FAKE].includes(deliveryStatus);

    const newDeliveryRecord = new DeliveryOrder({
      originalOrderId:  orderId,
      invoiceNo,
      orderDate,
      customerDetails,
      items,
      totals,
      agentName,
      deliveryStatus,
      reason,
      paymentReceivedAt: paymentReceivedAt || (isNonPaymentStatus ? 'N/A' : ''),
      handedOverTo:      handedOverTo      || (isNonPaymentStatus ? 'N/A' : ''),
      paidNow:           currentPaid,
      totalPaid:         newPaidTotal,
      pendingAmount,
      totalOrderAmount:  totalAmount,
    });

    await newDeliveryRecord.save();

    // ── Update original order ───────────────────────────────────────────────
    await Order.findByIdAndUpdate(orderId, {
      payment: {
        ...existingOrder.payment,
        // backward-compat fields
        amountPaid: newPaidTotal,
        balance:    pendingAmount,
        // new fields
        totalAmount,
        paidAmount:      newPaidTotal,
        pendingAmount,
        lastPaymentDate: new Date(),
        status:          mappedStatus,
      },
      // Surface cancellation / fake flag at order level too
      ...(mappedStatus === 'cancelled' && { deliveryStatus: 'Delivery failed' }),
      ...(mappedStatus === 'fake'      && { deliveryStatus: 'Fake order placed' }),
    });

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
// 3. GET DELIVERY HISTORY
// ======================================================
router.get('/history', async (req, res) => {
  try {
    const deliveryHistory = await DeliveryOrder.find().sort({ createdAt: -1 });
    res.status(200).json(deliveryHistory);
  } catch (error) {
    console.error('GET /history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch delivery history' });
  }
});


module.exports = router;