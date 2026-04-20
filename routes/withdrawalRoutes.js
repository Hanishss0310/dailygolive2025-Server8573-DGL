const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');

router.post('/request', async (req, res) => {
  try {
    const newRequest = new Withdrawal(req.body);
    await newRequest.save();
    res.status(201).json({ message: "Withdrawal request saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit request" });
  }
});

module.exports = router;