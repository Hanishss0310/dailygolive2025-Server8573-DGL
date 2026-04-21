const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const Funder = require('../models/Funder'); // ✅ MUST IMPORT FUNDER MODEL

router.post('/request', async (req, res) => {
  // ✅ 1. Only extract the exact fields you expect (prevents injection attacks)
  const { funderId, amount, upiId, name, email, phoneNumber } = req.body;

  try {
    // ✅ 2. Find the Funder in the database
    const funder = await Funder.findById(funderId);
    if (!funder) {
      return res.status(404).json({ message: "Funder account not found." });
    }

    // ✅ 3. SERVER-SIDE VALIDATION (Never trust the frontend!)
    const dbTotal = Number(funder.totalBalance || 0);
    const dbYesterday = Number(funder.yesterdayEarnings || 0);
    const maxWithdrawable = dbTotal + dbYesterday;

    if (amount < 10) {
      return res.status(400).json({ message: "Minimum withdrawal is ₹10." });
    }
    if (amount > maxWithdrawable) {
      return res.status(400).json({ message: "Insufficient balance! Nice try, hacker." });
    }

    // ✅ 4. DEDUCT THE MONEY FROM THE DATABASE
    // Subtract from yesterdayEarnings first, then totalBalance
    if (amount <= funder.yesterdayEarnings) {
      funder.yesterdayEarnings -= amount;
    } else {
      const remainingAmountToDeduct = amount - funder.yesterdayEarnings;
      funder.yesterdayEarnings = 0;
      funder.totalBalance -= remainingAmountToDeduct;
    }

    // Save the new, lower balance to the user's account
    await funder.save();

    // ✅ 5. Create the Withdrawal Request Safely
    // Notice how we explicitly build the object instead of using req.body
    const newRequest = new Withdrawal({
      funderId,
      name,
      email,
      phoneNumber,
      upiId,
      amount,
      status: "Pending", // Force the status to Pending on the backend
      requestDate: new Date()
    });

    await newRequest.save();

    res.status(201).json({ message: "Withdrawal request saved and balance updated successfully" });
  } catch (error) {
    console.error("Withdrawal Error:", error);
    res.status(500).json({ message: "Failed to submit request due to server error" });
  }
});

// Add this inside your routes/withdrawalRoutes.js
router.get('/all', async (req, res) => {
  try {
    // Fetches all withdrawals, sorted by newest first
    const requests = await Withdrawal.find().sort({ createdAt: -1 });
    res.status(200).json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

module.exports = router;