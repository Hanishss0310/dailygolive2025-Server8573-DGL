const mongoose = require('mongoose');

const deliveryOrderSchema = new mongoose.Schema(
  {
    // ── Link to original order ─────────────────────────────────────────────
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },

    // ── Snapshot of order at time of delivery update ───────────────────────
    invoiceNo: {
      type: String,
      required: true,
    },
    orderDate:       String,
    customerDetails: Object,
    items:           Array,
    totals:          Object,

    // ── Agent ──────────────────────────────────────────────────────────────
    agentName: {
      type: String,
      required: true,
    },

    // ── Delivery status ────────────────────────────────────────────────────
    // Must exactly match DS.* constants in the frontend and the switch cases
    // in delivery.route.js  (case-sensitive)
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

    // ── Payment tracking ───────────────────────────────────────────────────
    paidNow:          { type: Number, default: 0 },   // collected in this update
    totalPaid:        { type: Number, default: 0 },   // cumulative paid so far
    pendingAmount:    { type: Number, default: 0 },   // remaining balance
    totalOrderAmount: { type: Number, default: 0 },   // order total snapshot

    // ── Audit fields ───────────────────────────────────────────────────────
    reason:            { type: String, required: true },
    paymentReceivedAt: { type: String, default: '' },  // 'N/A' for non-payment
    handedOverTo:      { type: String, default: '' },  // 'N/A' for non-payment
  },
  { timestamps: true }
);

deliveryOrderSchema.index({ agentName: 1, createdAt: -1 });
deliveryOrderSchema.index({ originalOrderId: 1 });
deliveryOrderSchema.index({ invoiceNo: 1 });

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);
MODELFILE