// models/DeliveryOrder.js
const mongoose = require('mongoose');

// ── Canonical delivery status strings ─────────────────────────────────────────
// These EXACT strings flow from frontend → route → DB.
// Keep them in sync with DELIVERY_STATUS in the route file.
const DELIVERY_STATUS_ENUM = [
  'Order Delivered Payment Full Done',
  'Order Delivered Payment Full Not Done',
  'Order Delivered Partial Payment',
  'Delivery Failed',
  'Fake Order Placed',
];

const deliveryOrderSchema = new mongoose.Schema(
  {
    // ── Original order reference ───────────────────────────────────────────────
    originalOrderId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Order',
      required: true,
    },

    // ── Order snapshot (stored so history is self-contained) ──────────────────
    invoiceNo:       { type: String, required: true },
    orderDate:       { type: String },
    customerDetails: { type: Object },
    items:           { type: Array },
    totals:          { type: Object },

    // ── Agent ─────────────────────────────────────────────────────────────────
    agentName: { type: String, required: true },

    // ── Delivery status (English, normalised) ─────────────────────────────────
    deliveryStatus: {
      type:     String,
      enum:     DELIVERY_STATUS_ENUM,
      required: true,
    },

    // ── Payment tracking ──────────────────────────────────────────────────────
    paidNow:          { type: Number, default: 0 },
    totalPaid:        { type: Number, default: 0 },
    pendingAmount:    { type: Number, default: 0 },
    totalOrderAmount: { type: Number, default: 0 },

    // ── Remarks ───────────────────────────────────────────────────────────────
    reason:            { type: String, required: true },
    paymentReceivedAt: { type: String, default: 'N/A' },  // not required; N/A for non-payment
    handedOverTo:      { type: String, default: 'N/A' },  // not required; N/A for non-payment
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);