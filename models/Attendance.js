// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      ref: "Employee",
    },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String, required: true },
    employeePhone: { type: String, required: true },
    position: { type: String, required: true },

    date: {
      // stored as YYYY-MM-DD string for easy querying
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["present", "absent", "leave"],
      default: "absent",
    },

    // Location captured at time of marking
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },   // reverse-geocoded or user-provided
    },

    // Selfie: stored as base64 or file path; auto-deleted after 24h via TTL index on selfieExpiresAt
    selfiePath: { type: String, default: null },
    selfieExpiresAt: {
      type: Date,
      default: null,
      // TTL index defined below — MongoDB will null-out or we handle deletion in cron
    },

    // OTP verification
    otpVerified: { type: Boolean, default: false },

    // Mark time
    markedAt: { type: Date },

    // Leave details
    leaveReason: { type: String, default: "" },

    // Which month-year this belongs to for easy aggregation
    month: { type: String }, // "2025-06"
    year:  { type: Number },
  },
  { timestamps: true }
);

// Compound unique index: one record per employee per date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Index for monthly queries
attendanceSchema.index({ month: 1, employeeId: 1 });

// TTL index: automatically removes selfie data after 24 hours
// We'll set selfieExpiresAt = markedAt + 24h when saving
attendanceSchema.index({ selfieExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Attendance", attendanceSchema);