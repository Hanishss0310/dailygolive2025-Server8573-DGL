const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const Funder = require('../models/Funder');

// ─── POST /api/admin/funders/withdraw/:id ─────────────────────────────────────
// Matches the frontend: fetch(`/api/admin/funders/withdraw/${funder._id}`)
router.post('/withdraw/:id', async (req, res) => {
  const { amount } = req.body;
  const funderId = req.params.id;

  try {
    // 1. Find funder in DB — never trust frontend balance
    const funder = await Funder.findById(funderId);
    if (!funder) {
      return res.status(404).json({ message: 'Funder account not found.' });
    }

    // 2. Server-side validation
    const parsedAmount = Number(amount);
    const totalBalance = Number(funder.totalBalance || 0);
    const minimumWithdrawal = Number(funder.minimumWithdrawal || 1000);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Enter a valid amount.' });
    }
    if (parsedAmount < minimumWithdrawal) {
      return res.status(400).json({ message: `Minimum withdrawal is ₹${minimumWithdrawal}.` });
    }
    if (parsedAmount > totalBalance) {
      return res.status(400).json({ message: 'Insufficient withdrawable balance.' });
    }
    if (!funder.upiId) {
      return res.status(400).json({ message: 'UPI ID not found on your profile.' });
    }

    // 3. Deduct from totalBalance (single source of truth)
    funder.totalBalance = totalBalance - parsedAmount;
    await funder.save();

    // 4. Create withdrawal record
    await Withdrawal.create({
      funderId: funder._id,
      name: funder.name,
      email: funder.email,
      phoneNumber: funder.phoneNumber,
      upiId: funder.upiId,
      amount: parsedAmount,
      status: 'Pending',
    });

    // 5. Return updated funder so frontend can update state immediately
    res.status(201).json({
      message: 'Withdrawal request submitted successfully.',
      funder,          // ← frontend does: setFunder(data.funder)
    });

  } catch (error) {
    console.error('Withdrawal Error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// ─── GET /api/admin/funders/withdraw/all ─────────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const requests = await Withdrawal.find().sort({ createdAt: -1 });
    res.status(200).json({ requests });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch withdrawals.' });
  }
});

module.exports = router;