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

    items: [
      {
        id: String,
        name: String,
        price: Number,
        qty: Number
      }
    ],

    payment: {
      method: String,
      // ✅ FIX: This tells Mongoose you literally have a field named "type"
      type: { type: String }, 
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