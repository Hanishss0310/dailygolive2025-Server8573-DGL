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
  
  // --- Financial Logic (Auto-calculated based on plan) ---
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

// ==========================================
// Middleware: Auto-assign limits before saving
// ==========================================
funderSchema.pre('save', function(next) {
  // Only recalculate if it's a brand new user OR if the admin changes their plan later
  if (this.isNew || this.isModified('planType')) {
    if (this.planType === '10k') {
      this.perOrderRate = 10;
      this.dailyLimit = 200;
      this.minimumWithdrawal = 1000;
    } else if (this.planType === '25k') {
      this.perOrderRate = 20;
      this.dailyLimit = 400;
      this.minimumWithdrawal = 2000;
    }
  }
  next();
});

module.exports = mongoose.model('Funder', funderSchema);