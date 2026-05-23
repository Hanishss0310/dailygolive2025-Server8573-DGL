// models/DeliveryOrder.js

const mongoose = require('mongoose');

const deliveryOrderSchema = new mongoose.Schema({

  // ================= ORIGINAL ORDER LINK =================
  originalOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },

  // ================= ORDER SNAPSHOT =================
  invoiceNo: {
    type: String,
    required: true
  },

  orderDate: String,

  customerDetails: Object,

  items: Array,

  totals: Object,

  // ================= AGENT INFO =================
  agentName: {
    type: String,
    required: true
  },

  // ================= DELIVERY STATUS =================
  deliveryStatus: {
    type: String,
    enum: [
      'Order Delivered Payment full done',
      'Ordered deliver partiall payment',
      'Delivery failed',
      'Fake order placed'
    ],
    required: true
  },

  // ================= PAYMENT TRACKING =================

  // Amount collected in THIS update
  paidNow: {
    type: Number,
    default: 0
  },

  // Total paid till now
  totalPaid: {
    type: Number,
    default: 0
  },

  // Remaining amount
  pendingAmount: {
    type: Number,
    default: 0
  },

  // Total order amount snapshot
  totalOrderAmount: {
    type: Number,
    default: 0
  },

  // ================= REMARKS =================
  reason: {
    type: String,
    required: true
  },

  paymentReceivedAt: {
    type: String,
    required: true
  },

  handedOverTo: {
    type: String,
    required: true
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);