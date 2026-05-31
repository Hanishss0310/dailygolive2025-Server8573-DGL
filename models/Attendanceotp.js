// models/AttendanceOtp.js
const mongoose = require("mongoose");

const attendanceOtpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp:   { type: String, required: true },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 min
  },
  used: { type: Boolean, default: false },
});

// TTL: auto-remove after expiry
attendanceOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AttendanceOtp", attendanceOtpSchema);