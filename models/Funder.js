const mongoose = require('mongoose');

const funderSchema = new mongoose.Schema({
  // --- Personal & Contact Details ---
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  
  // Optional Details
  storeName: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  adhar: { type: String, default: '' },
  
  // --- Payment Details ---
  upiId: { type: String, required: true },
  gpayNumber: { type: String, required: true },
  
  // --- Plan & Validity ---
  planType: { type: String, enum: ['10k', '25k'], required: true },
  validUntil: { type: Date, required: true },
  
  // --- Financial Logic ---
  perOrderRate: { type: Number, required: true },
  dailyLimit: { type: Number, required: true },
  minimumWithdrawal: { type: Number, required: true },
  
  // --- Dynamic Tracking (Changes daily/per order) ---
  currentBalance: { type: Number, default: 0 },
  todayEarnings: { type: Number, default: 0 },
  
  // --- Authentication ---
  password: { type: String, required: true }, 
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Note: The pre('save') hook was removed. 
// Limits are now calculated directly in the funderRoutes.js before saving to prevent validation errors.

module.exports = mongoose.model('Funder', funderSchema);