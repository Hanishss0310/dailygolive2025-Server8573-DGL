const express = require("express");
const router = express.Router();
const JoinUs = require("../models/JoinUs");

// GET - Fetch all submissions
router.get("/", async (req, res) => {
  try {
    const submissions = await JoinUs.find().sort({ createdAt: -1 });
    res.json(submissions);
  } catch (err) {
    console.error("❌ JoinUs GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Create submission
router.post("/", async (req, res) => {
  try {
    const newSubmission = new JoinUs(req.body);
    const saved = await newSubmission.save();

    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ JoinUs POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;