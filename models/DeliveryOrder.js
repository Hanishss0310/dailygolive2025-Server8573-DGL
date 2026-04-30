// models/DeliveryOrder.js
const mongoose = require('mongoose');

const deliveryOrderSchema = new mongoose.Schema({
  // 1. Link back to your original Order DB
  originalOrderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order',
    required: true
  },
  
  // 2. Snapshot of the order (No bills/images included)
  invoiceNo: String,
  orderDate: String,
  customerDetails: Object,
  items: Array,
  totals: Object,
  
  // 3. The New Delivery Tracking Fields (Mandatory)
  agentName: { type: String, required: true }, // Which FOS logged in
  
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
  reason: { type: String, required: true },
  paymentReceivedAt: { type: String, required: true },
  handedOverTo: { type: String, required: true }
  
}, { timestamps: true }); // Automatically logs EXACTLY when the agent submitted it

module.exports = mongoose.model('DeliveryOrder', deliveryOrderSchema);