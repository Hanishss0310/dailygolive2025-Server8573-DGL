// models/JoinUs.js
const mongoose = require("mongoose");

const JoinUsSchema = new mongoose.Schema(
  {
    city: { type: String, required: true },
    category: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    shopName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phonePrimary: { type: String, required: true },
    phoneSecondary: { type: String },
    email: { type: String },
    address: { type: String, required: true },
    knowUs: { type: String, required: true },
    feedback: { type: String },
  },
  { timestamps: true }
);

const JoinUs = mongoose.model("JoinUs", JoinUsSchema);

// 👇 Use CommonJS export
module.exports = JoinUs;
