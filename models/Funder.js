const mongoose = require('mongoose');

const funderSchema = new mongoose.Schema({
  // --- Personal & Contact Details ---
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
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
  
  // --- Dynamic Tracking ---
  currentBalance: { type: Number, default: 0 },
  todayEarnings: { type: Number, default: 0 },
  
  // --- Authentication ---
  password: { type: String, required: true }, // Store hashed!
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Pre-save middleware to auto-assign financial rules when creating a new funder
funderSchema.pre('save', function(next) {
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