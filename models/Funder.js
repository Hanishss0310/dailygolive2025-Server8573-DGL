const mongoose = require('mongoose');

const funderSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  phoneNumber:  { type: String, required: true },
  storeName:    { type: String, default: '' },
  panNumber:    { type: String, default: '' },
  adhar:        { type: String, default: '' },
  upiId:        { type: String, required: true },
  gpayNumber:   { type: String, required: true },
  planType:     { type: String, enum: ['10k', '25k'], required: true },
  validUntil:   { type: Date, required: true },

  dailyCredit:       { type: Number, required: true }, // 200 or 400
  minimumWithdrawal: { type: Number, required: true }, // 1000 or 2000

  // ── Financial tracking ──────────────────────────────
  totalBalance:      { type: Number, default: 0 }, // withdrawable pool (grows every 12pm)
  todayEarnings:     { type: Number, default: 0 }, // what was credited today (0 before 12pm)
  yesterdayEarnings: { type: Number, default: 0 }, // previous day display
  allTimeEarnings:   { type: Number, default: 0 }, // lifetime total, never resets
  creditDays:        { type: Number, default: 0 }, // how many days credited so far
  lastCreditDate:    { type: Date,   default: null }, // when cron last ran for this funder

  password: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Funder', funderSchema);