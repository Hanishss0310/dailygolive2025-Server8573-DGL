const mongoose = require("mongoose");

const tierSchema = new mongoose.Schema({
  qty: { type: Number, required: true },
  price: { type: Number, required: true },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    specs: { type: String },
    description: { type: String },
    basePrice: { type: Number, default: 0 },
    image: { type: String }, // Will store the Base64 image string
    tiers: [tierSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);