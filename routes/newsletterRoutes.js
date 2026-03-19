const express = require("express");
const router = express.Router();
const Newsletter = require("../models/Newsletter");

// POST
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email is required" });

    const existing = await Newsletter.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Already subscribed" });

    const subscriber = new Newsletter({ email });
    await subscriber.save();

    res.json({ message: "Subscribed successfully ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET
router.get("/", async (req, res) => {
  try {
    const data = await Newsletter.find().sort({ subscribedAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;