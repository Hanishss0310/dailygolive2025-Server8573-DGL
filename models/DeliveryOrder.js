const mongoose = require('mongoose');

const deliveryOrderSchema = new mongoose.Schema(
  {
    // ── Link to original order ──────────────────────────────────────────────
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },

    // ── Order snapshot (so history is self-contained) ───────────────────────
    invoiceNo: {
      type: String,
      required: true,
    },

    orderDate: String,

    customerDetails: Object,

    items: Array,

    totals: Object,

    // ── Agent ───────────────────────────────────────────────────────────────
    agentName: {
      type: String,
      required: true,
    },

    // ── Delivery status ─────────────────────────────────────────────────────
    // IMPORTANT: these must exactly match the DS.* values sent by the frontend
    deliveryStatus: {
      type: String,
      enum: [
        'Order Delivered Payment Full Done',
        'Order Delivered Payment Full Not Done',
        'Order Delivered Partial Payment',
        'Delivery Failed',
        'Fake Order Placed',
      ],
      required: true,
    },

    // ── Payment tracking ────────────────────────────────────────────────────
    paidNow: {
      type: Number,
      default: 0,
    },

    totalPaid: {
      type: Number,
      default: 0,
    },

    pendingAmount: {
      type: Number,
      default: 0,
    },

    totalOrderAmount: {
      type: Number,
      default: 0,
    },

    // ── Remarks / audit ─────────────────────────────────────────────────────
    reason: {
      type: String,
      required: true,
    },

    paymentReceivedAt: {
      type: String,
      default: '',
    },

    handedOverTo: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Index for fast agent + date queries
deliveryOrderSchema.index({ agentName: 1, createdAt: -1 });
deliveryOrderSchema.index({ originalOrderId: 1 });

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);