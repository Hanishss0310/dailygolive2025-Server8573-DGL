const express = require('express');
const router = express.Router();
const Funder = require('../models/Funder');

// ==========================================
// EXPORTED CRON FUNCTION
// Called by the 12pm IST cron job in Server.js
// Credits every active, non-expired funder instantly.
// ==========================================
const creditAllFunders = async () => {
  try {
    const now = new Date();
    const funders = await Funder.find({ isActive: true, validUntil: { $gte: now } });

    let credited = 0;
    for (const funder of funders) {
      // Skip if already credited today (IST)
      if (funder.lastCreditDate) {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const lastIST  = new Date(funder.lastCreditDate.getTime() + istOffset).toDateString();
        const todayIST = new Date(now.getTime() + istOffset).toDateString();
        if (lastIST === todayIST) continue;
      }

      const credit = funder.dailyCredit;

      funder.yesterdayEarnings = funder.todayEarnings; // shift display
      funder.todayEarnings     = credit;               // today's credit badge
      funder.totalBalance      = (funder.totalBalance || 0) + credit; // ✅ immediately withdrawable
      funder.allTimeEarnings   = (funder.allTimeEarnings || 0) + credit;
      funder.creditDays        = (funder.creditDays || 0) + 1;
      funder.lastCreditDate    = now;

      await funder.save();
      credited++;
      console.log(`✅ Credited ₹${credit} to ${funder.name} | totalBalance=₹${funder.totalBalance}`);
    }
    console.log(`🎯 Cron done: ${credited} funders credited.`);
  } catch (err) {
    console.error('❌ Cron credit error:', err);
  }
};

module.exports.creditAllFunders = creditAllFunders;

// ==========================================
// 1. POST /api/admin/funders/add
// ==========================================
router.post('/add', async (req, res) => {
  try {
    const {
      name, email, phoneNumber, storeName, panNumber,
      adhar, upiId, gpayNumber, planType, validUntil, password
    } = req.body;

    if (await Funder.findOne({ email })) {
      return res.status(400).json({ message: 'A funder with this email already exists.' });
    }

    let dailyCredit = 200, minimumWithdrawal = 1000;
    if (planType === '25k') { dailyCredit = 400; minimumWithdrawal = 2000; }

    const newFunder = new Funder({
      name, email, phoneNumber, storeName, panNumber,
      adhar, upiId, gpayNumber, planType, validUntil, password,
      dailyCredit, minimumWithdrawal
    });

    await newFunder.save();
    res.status(201).json({ message: 'Funder activated successfully!', funder: newFunder });
  } catch (error) {
    console.error('Add Funder Error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 2. POST /api/admin/funders/login
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const funder = await Funder.findOne({ email });

    if (!funder) return res.status(400).json({ message: 'Funder not found.' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(funder.validUntil) < today) {
      return res.status(403).json({ message: 'Your plan has expired. Please contact admin.' });
    }
    if (!funder.isActive)            return res.status(403).json({ message: 'Account deactivated.' });
    if (password !== funder.password) return res.status(400).json({ message: 'Incorrect password.' });

    const { password: _, ...funderProfile } = funder.toObject();
    res.status(200).json({ message: 'Login successful', funder: funderProfile });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ==========================================
// 3. GET /api/admin/funders  (Admin)
// ==========================================
router.get('/', async (req, res) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await Funder.deleteMany({ validUntil: { $lte: tenDaysAgo } });
    const funders = await Funder.find().select('-password');
    res.status(200).json({ funders });
  } catch (error) {
    console.error('Get All Funders Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 4. PUT /api/admin/funders/:id  (Admin edit only)
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    const funder = await Funder.findById(req.params.id);
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    // Recalculate plan values if plan changes
    if (updateData.planType && updateData.planType !== funder.planType) {
      if (updateData.planType === '10k') {
        updateData.dailyCredit = 200; updateData.minimumWithdrawal = 1000;
      } else if (updateData.planType === '25k') {
        updateData.dailyCredit = 400; updateData.minimumWithdrawal = 2000;
      }
    }

    // 🔒 Never let admin accidentally overwrite financial fields
    delete updateData.totalBalance;
    delete updateData.todayEarnings;
    delete updateData.yesterdayEarnings;
    delete updateData.allTimeEarnings;
    delete updateData.creditDays;
    delete updateData.lastCreditDate;

    const updated = await Funder.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.status(200).json({ message: 'Funder updated', funder: updated });
  } catch (error) {
    console.error('Update Funder Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 5. GET /api/admin/funders/me/:id  (Dashboard poll — every 60s)
// ==========================================
router.get('/me/:id', async (req, res) => {
  try {
    const funder = await Funder.findById(req.params.id).select('-password');
    if (!funder) return res.status(404).json({ message: 'Funder not found' });
    res.status(200).json({ funder });
  } catch (error) {
    console.error('Get Funder Profile Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 6. POST /api/admin/funders/withdraw/:id
//    Deducts from totalBalance immediately
// ==========================================
router.post('/withdraw/:id', async (req, res) => {
  try {
    const { amount } = req.body;
    const funder = await Funder.findById(req.params.id);
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0)
      return res.status(400).json({ message: 'Invalid amount.' });
    if (withdrawAmount < funder.minimumWithdrawal)
      return res.status(400).json({ message: `Minimum withdrawal is ₹${funder.minimumWithdrawal}.` });
    if (withdrawAmount > funder.totalBalance)
      return res.status(400).json({ message: 'Insufficient balance.' });

    // ✅ Deduct immediately from totalBalance
    funder.totalBalance = funder.totalBalance - withdrawAmount;
    await funder.save();

    const { password: _, ...funderProfile } = funder.toObject();
    res.status(200).json({
      message: `₹${withdrawAmount} withdrawal processed.`,
      funder: funderProfile
    });
  } catch (error) {
    console.error('Withdraw Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;