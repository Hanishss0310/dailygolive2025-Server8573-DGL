const mongoose = require('mongoose');

const deliveryOrderSchema = new mongoose.Schema(
  {
    // ─── Original order reference ──────────────────────────────────────────────
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },

    // ─── Order snapshot (so history is self-contained) ─────────────────────────
    invoiceNo: {
      type: String,
      required: true,
    },

    orderDate: String,

    customerDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    items: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    totals: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ─── Agent ────────────────────────────────────────────────────────────────
    agentName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ─── Delivery status (must match exactly what the frontend sends) ──────────
    // Frontend option values (from UpdateDrawer select):
    //   "Order Delivered Payment full done"
    //   "Order Delivered Payment full not done"   ← new option in frontend
    //   "Ordered deliver partial payment"          ← note: single 'l' in partial
    //   "Delivery failed"
    //   "Fake order placed"
    deliveryStatus: {
      type: String,
      enum: [
        'Order Delivered Payment full done',
        'Order Delivered Payment full not done',
        'Ordered deliver partiall payment',   // legacy spelling (double-l)
        'Ordered deliver partial payment',    // corrected spelling
        'Delivery failed',
        'Fake order placed',
      ],
      required: true,
    },

    // ─── Payment tracking ─────────────────────────────────────────────────────
    paidNow: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ─── Remarks & handover ───────────────────────────────────────────────────
    reason: {
      type: String,
      required: true,
      trim: true,
    },

    // 'N/A' for failed/fake orders; payment mode string otherwise
    paymentReceivedAt: {
      type: String,
      required: true,
      trim: true,
    },

    // 'N/A' for failed/fake orders; person name otherwise
    handedOverTo: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Compound index for efficient agent-based history lookups
deliveryOrderSchema.index({ agentName: 1, createdAt: -1 });
deliveryOrderSchema.index({ originalOrderId: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);