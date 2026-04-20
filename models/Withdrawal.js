const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  funderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Funder', required: true },
  name: String,
  email: String,
  phoneNumber: String,
  upiId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending' }, // Pending, Approved, Rejected
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);