const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    invoiceNo: String,
    orderDate: String,
    location: String,

    customerDetails: {
      shopName: String,
      ownerName: String,
      mobileNumber: String,
      address: String,
      fos: String
    },

    // 🔥 FIX 1: allow string ID
    items: [
      {
        id: mongoose.Schema.Types.Mixed, // ✅ FIXED
        name: String,
        price: Number,
        qty: Number
      }
    ],

    // 🔥 FIX 2: make payment OBJECT
    payment: {
      method: String,
      type: String,
      amountPaid: Number,
      transactionId: String,
      balance: Number
    },

    totals: {
      subtotal: Number,
      discount: Number,
      tax: Number,
      total: Number
    },

    documents: {
      shopImage: String,
      screenshot: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);