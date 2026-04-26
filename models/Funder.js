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

  // ✅ Safe defaults added — won't fail if somehow undefined
  dailyCredit:       { type: Number, required: true, default: 200  },
  minimumWithdrawal: { type: Number, required: true, default: 1000 },

  // ── Financial tracking ──────────────────────────────
  totalBalance:      { type: Number, default: 0, min: 0 },
  todayEarnings:     { type: Number, default: 0, min: 0 },
  yesterdayEarnings: { type: Number, default: 0, min: 0 },
  allTimeEarnings:   { type: Number, default: 0, min: 0 },
  creditDays:        { type: Number, default: 0, min: 0 },
  lastCreditDate:    { type: Date,   default: null },

  password: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ✅ Pre-save guard — runs before EVERY save()
// Replaces NaN / undefined / null with 0 on all numeric fields
// This is why the cron was crashing — allTimeEarnings was NaN in DB
funderSchema.pre('save', function (next) {
  const numericFields = [
    'totalBalance',
    'todayEarnings',
    'yesterdayEarnings',
    'allTimeEarnings',
    'creditDays',
    'dailyCredit',
    'minimumWithdrawal'
  ];

  numericFields.forEach(field => {
    if (this[field] === undefined || this[field] === null || isNaN(this[field])) {
      this[field] = 0;
    }
  });

  // If dailyCredit is 0 or missing, derive from planType
  if (!this.dailyCredit) {
    this.dailyCredit       = this.planType === '25k' ? 400  : 200;
    this.minimumWithdrawal = this.planType === '25k' ? 2000 : 1000;
  }

  next();
});

module.exports = mongoose.model('Funder', funderSchema);