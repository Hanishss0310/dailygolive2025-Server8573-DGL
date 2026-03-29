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
      type: { type: String }, 
      amountPaid: Number,
      transactionId: String,
      balance: Number,
      // 🔥 NEW: Added status field with a default value
      status: { 
        type: String, 
        enum: ['due', 'partially_paid', 'completed', 'overdue'],
        default: 'due' 
      }
    },

    totals: {
      subtotal: Number,
      discount: Number,
      tax: Number,
      total: Number
    },

    documents: {
      shopImage: String,
      screenshot: String,
      // 🔥 THE FIX: Added invoicePdf so Mongoose knows to save it!
      invoicePdf: String 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);