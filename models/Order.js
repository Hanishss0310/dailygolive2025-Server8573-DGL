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
        id: Number,
        name: String,
        price: Number,
        qty: Number
      }
    ],

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