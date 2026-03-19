const express = require("express");
const router = express.Router();
const multer = require("multer");
const Blog = require("../models/Blogs");

// Multer setup
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, Date.now() + "-" + safeName);
  },
});
const upload = multer({ storage });

// POST - Create blog
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, description, date } = req.body;

    const newBlog = new Blog({
      title,
      description,
      date,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });

    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) {
    console.error("❌ Blog POST error:", err);
    res.status(500).json({ error: "Failed to create blog" });
  }
});

// GET - Fetch blogs
router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    console.error("❌ Blog GET error:", err);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

// DELETE - Delete blog
router.delete("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    await Blog.findByIdAndDelete(req.params.id);

    res.json({ message: "🗑️ Blog deleted", id: req.params.id });
  } catch (err) {
    console.error("❌ Blog DELETE error:", err);
    res.status(500).json({ error: "Failed to delete blog" });
  }
});

module.exports = router;