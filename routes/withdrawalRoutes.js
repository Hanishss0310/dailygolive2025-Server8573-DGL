const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const Funder = require('../models/Funder');

// ─── GET /api/admin/funders/withdraw/all ──────────────────────────────────────
router.get('/withdraw/all', async (req, res) => {
  try {
    const requests = await Withdrawal.find().sort({ createdAt: -1 });
    res.status(200).json({ requests });
  } catch (error) {
    console.error('Fetch withdrawals error:', error);
    res.status(500).json({ message: 'Failed to fetch withdrawals.' });
  }
});

// ─── POST /api/admin/funders/withdraw/:id ─────────────────────────────────────
router.post('/withdraw/:id', async (req, res) => {
  const { amount } = req.body;
  const funderId = req.params.id;

  try {
    // 1. Find funder in DB
    const funder = await Funder.findById(funderId);
    if (!funder) {
      return res.status(404).json({ message: 'Funder account not found.' });
    }

    // 2. Server-side validation
    const parsedAmount      = Number(amount);
    const totalBalance      = Number(funder.totalBalance || 0);
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

    // 3. Deduct from totalBalance
    funder.totalBalance = totalBalance - parsedAmount;
    await funder.save();

    // 4. Create withdrawal record
    await Withdrawal.create({
      funderId:    funder._id,
      name:        funder.name,
      email:       funder.email,
      phoneNumber: funder.phoneNumber,
      upiId:       funder.upiId,
      amount:      parsedAmount,
      status:      'Pending',
    });

    // 5. Return updated funder
    res.status(201).json({
      message: 'Withdrawal request submitted successfully.',
      funder,
    });

  } catch (error) {
    console.error('Withdrawal Error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// ─── PUT /api/admin/funders/withdraw/status/:id ───────────────────────────────
// Admin route to update the status of a withdrawal request
router.put('/withdraw/status/:id', async (req, res) => {
  const withdrawalId = req.params.id;
  const { status } = req.body; 

  try {
    const validStatuses = ['Pending', 'Approved', 'Paid', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update.' });
    }

    // 1. Find the specific withdrawal request
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal request not found.' });
    }

    // 2. Prevent updating if it's already resolved (optional but recommended)
    if (withdrawal.status !== 'Pending') {
      return res.status(400).json({ 
        message: `Cannot change status because it is already ${withdrawal.status}.` 
      });
    }

    // 3. If Admin Rejects the withdrawal, refund the amount to the Funder
    if (status === 'Rejected') {
      const funder = await Funder.findById(withdrawal.funderId);
      if (funder) {
        funder.totalBalance = Number(funder.totalBalance || 0) + Number(withdrawal.amount);
        await funder.save();
      }
    }

    // 4. Update the status and save
    withdrawal.status = status;
    await withdrawal.save();

    res.status(200).json({ 
      message: `Withdrawal successfully marked as ${status}.`,
      withdrawal
    });

  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ message: 'Server error while updating status.' });
  }
});

module.exports = router;