const mongoose = require("mongoose");

const GallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,   // ✅ Full URL for frontend display
    required: true,
  },
  filename: {
    type: String,   // ✅ Actual saved filename in /uploads
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Gallery = mongoose.model("Gallery", GallerySchema);
module.exports = Gallery;
