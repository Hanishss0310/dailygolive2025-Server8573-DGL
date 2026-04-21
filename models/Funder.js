const mongoose = require('mongoose');

const funderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  storeName: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  adhar: { type: String, default: '' },
  upiId: { type: String, required: true },
  gpayNumber: { type: String, required: true },
  planType: { type: String, enum: ['10k', '25k'], required: true },
  validUntil: { type: Date, required: true },
  perOrderRate: { type: Number, required: true },
  dailyLimit: { type: Number, required: true },
  minimumWithdrawal: { type: Number, required: true },

  // --- Financial Tracking ---
  // totalBalance = money already earned and ready to withdraw
  totalBalance: { type: Number, default: 0 }, 
  // todayEarnings = earnings for CURRENT day (reset at midnight)
  todayEarnings: { type: Number, default: 0 },
  // yesterdayEarnings = earnings from previous day (ready for withdrawal)
  yesterdayEarnings: { type: Number, default: 0 },
  // allTimeEarnings = historical total
  allTimeEarnings: { type: Number, default: 0 },

  password: { type: String, required: true }, 
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Funder', funderSchema);