const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    image: { type: String }, // URL of uploaded image
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", BlogSchema);
