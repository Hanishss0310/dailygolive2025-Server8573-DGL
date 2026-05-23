const express = require('express');

const router = express.Router();

const Order = require('../models/Order');

const DeliveryOrder = require('../models/DeliveryOrder');



// ======================================================
// 1. GET ORDERS FOR DELIVERY APP
// ======================================================

router.get('/orders', async (req, res) => {
  try {

    const { fosName, date, status } = req.query;

    let query = {};

    // Filter by FOS
    if (fosName) {
      query['customerDetails.fos'] = fosName;
    }

    // Filter by date
    if (date) {
      query['orderDate'] = { $regex: date, $options: 'i' };
    }

    // Filter by payment status
    if (status) {
      query['payment.status'] = status;
    }

    // Fetch orders
    const orders = await Order.find(query).sort({
      createdAt: -1
    });

    res.status(200).json(orders);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });

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
      paidNow
    } = req.body;



    // ======================================================
    // FETCH ORIGINAL ORDER
    // ======================================================

    const existingOrder = await Order.findById(orderId);

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }



    // ======================================================
    // BLOCK COMPLETED ORDERS
    // ======================================================

    if (existingOrder.payment?.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order already completed'
      });
    }



    // ======================================================
    // PAYMENT CALCULATIONS
    // ======================================================

    const totalAmount =
      existingOrder.totals?.total || 0;

    const previousPaid =
      existingOrder.payment?.paidAmount || 0;

    const currentPaid =
      Number(paidNow || 0);

    const newPaidTotal =
      previousPaid + currentPaid;

    const pendingAmount =
      Math.max(totalAmount - newPaidTotal, 0);



    // ======================================================
    // DETERMINE FINAL STATUS
    // ======================================================

    let mappedStatus = 'due';

    // Full payment done
    if (newPaidTotal >= totalAmount) {
      mappedStatus = 'completed';
    }

    // Partial payment
    else if (newPaidTotal > 0) {
      mappedStatus = 'partially_paid';
    }

    // Failed delivery
    if (
      deliveryStatus === 'Delivery failed' ||
      deliveryStatus === 'Fake order placed'
    ) {
      mappedStatus = 'overdue';
    }



    // ======================================================
    // SAVE DELIVERY HISTORY LOG
    // ======================================================

    const newDeliveryRecord = new DeliveryOrder({

      // Original order reference
      originalOrderId: orderId,

      // Order snapshot
      invoiceNo,
      orderDate,
      customerDetails,
      items,
      totals,

      // Delivery details
      deliveryStatus,
      reason,
      paymentReceivedAt,
      handedOverTo,
      agentName,

      // Payment tracking
      paidNow: currentPaid,
      totalPaid: newPaidTotal,
      pendingAmount,
      totalOrderAmount: totalAmount

    });

    await newDeliveryRecord.save();



    // ======================================================
    // UPDATE ORIGINAL ORDER
    // ======================================================

    await Order.findByIdAndUpdate(orderId, {

      payment: {

        // Keep old values
        ...existingOrder.payment,

        // Existing compatibility fields
        amountPaid: newPaidTotal,
        balance: pendingAmount,

        // New fields
        totalAmount,
        paidAmount: newPaidTotal,
        pendingAmount,
        lastPaymentDate: new Date(),

        // Final status
        status: mappedStatus
      }

    });



    // ======================================================
    // SUCCESS RESPONSE
    // ======================================================

    res.status(200).json({
      success: true,
      message: 'Delivery updated successfully',
      paymentStatus: mappedStatus,
      totalPaid: newPaidTotal,
      pendingAmount
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Failed to update delivery'
    });

  }
});



// ======================================================
// 3. GET DELIVERY HISTORY
// ======================================================

router.get('/history', async (req, res) => {

  try {

    const deliveryHistory =
      await DeliveryOrder.find()
        .sort({ createdAt: -1 });

    res.status(200).json(deliveryHistory);

  } catch (error) {

    console.error('History fetch error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch delivery history'
    });

  }
});



module.exports = router;