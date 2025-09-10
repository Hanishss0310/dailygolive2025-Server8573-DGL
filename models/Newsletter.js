const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true }, // ensures only one entry per email
  subscribedAt: { type: Date, default: Date.now },       // auto timestamp
});

module.exports = mongoose.model("Newsletter", newsletterSchema);
