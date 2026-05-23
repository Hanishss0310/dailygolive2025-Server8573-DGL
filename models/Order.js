const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    // ================= BASIC ORDER INFO =================
    invoiceNo: String,

    orderDate: String,

    location: String,

    // ================= CUSTOMER DETAILS =================
    customerDetails: {
      shopName: String,
      ownerName: String,
      mobileNumber: String,
      address: String,
      fos: String
    },

    // ================= ORDER ITEMS =================
    items: [
      {
        id: String,
        name: String,
        price: Number,
        qty: Number
      }
    ],

    // ================= PAYMENT DETAILS =================
    payment: {
      // Existing fields (KEEP FOR COMPATIBILITY)
      method: String,

      type: {
        type: String
      },

      amountPaid: {
        type: Number,
        default: 0
      },

      transactionId: String,

      balance: {
        type: Number,
        default: 0
      },

      // ================= DELIVERY STATUS =================
      status: {
        type: String,
        enum: ['due', 'partially_paid', 'completed', 'overdue'],
        default: 'due'
      },

      // ================= NEW SAFE TRACKING FIELDS =================

      // Total bill amount
      totalAmount: {
        type: Number,
        default: 0
      },

      // Running paid amount
      paidAmount: {
        type: Number,
        default: 0
      },

      // Remaining amount
      pendingAmount: {
        type: Number,
        default: 0
      },

      // Last payment update date
      lastPaymentDate: {
        type: Date,
        default: null
      }
    },

    // ================= TOTALS =================
    totals: {
      subtotal: Number,
      discount: Number,
      tax: Number,
      total: Number
    },

    // ================= DOCUMENTS =================
    documents: {
      shopImage: String,

      screenshot: String,

      // Invoice PDF
      invoicePdf: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Order', orderSchema);