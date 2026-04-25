const express = require('express');
const router = express.Router();
const Funder = require('../models/Funder');

// ==========================================
// HELPER: Should we roll over today?
// Uses lastRolloverDate (NOT updatedAt) so the
// MAGIC SYNC PUT never interferes with this check.
// Rollover fires once per calendar day after 12:00 PM IST.
// ==========================================
function isRolloverDue(funder) {
  const now = new Date();

  // IST = UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // Gate 1: Must be past 12:00 PM IST
  const todayNoonIST = new Date(istNow);
  todayNoonIST.setHours(12, 0, 0, 0);
  if (istNow < todayNoonIST) return false;

  // Gate 2: Never rolled over before
  if (!funder.lastRolloverDate) return true;

  // Gate 3: Last rollover was on a previous IST calendar day
  const lastRolloverIST = new Date(new Date(funder.lastRolloverDate).getTime() + istOffset);
  const lastRolloverDay = lastRolloverIST.toDateString();
  const todayISTDay     = istNow.toDateString();

  return lastRolloverDay !== todayISTDay;
}

// ==========================================
// HELPER: Apply the daily rollover
// ==========================================
function applyRollover(funder) {
  if (!isRolloverDue(funder)) return false;

  // 1. Lock in today's earnings into all-time total
  funder.allTimeEarnings = (funder.allTimeEarnings || 0) + (funder.todayEarnings || 0);

  // 2. Yesterday's earnings become part of withdrawable total
  funder.totalBalance = (funder.totalBalance || 0) + (funder.yesterdayEarnings || 0);

  // 3. Shift: today → yesterday, reset today
  funder.yesterdayEarnings = funder.todayEarnings || 0;
  funder.todayEarnings = 0;

  // 4. Stamp rollover date so it won't fire again today
  funder.lastRolloverDate = new Date();

  console.log(`✅ Rollover applied for ${funder.name}: totalBalance=₹${funder.totalBalance}, allTime=₹${funder.allTimeEarnings}`);
  return true;
}

// ==========================================
// 1. POST /api/admin/funders/add
// ==========================================
router.post('/add', async (req, res) => {
  try {
    const {
      name, email, phoneNumber, storeName, panNumber,
      adhar, upiId, gpayNumber, planType, validUntil, password
    } = req.body;

    let existingFunder = await Funder.findOne({ email });
    if (existingFunder) {
      return res.status(400).json({ message: 'A funder with this email already exists.' });
    }

    let perOrderRate = 10, dailyLimit = 200, minimumWithdrawal = 1000;
    if (planType === '25k') {
      perOrderRate = 20; dailyLimit = 400; minimumWithdrawal = 2000;
    }

    const newFunder = new Funder({
      name, email, phoneNumber, storeName, panNumber,
      adhar, upiId, gpayNumber, planType, validUntil, password,
      perOrderRate, dailyLimit, minimumWithdrawal
    });

    await newFunder.save();
    res.status(201).json({ message: 'Funder activated successfully!', funder: newFunder });
  } catch (error) {
    console.error("Add Funder Error:", error);
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
    let funder = await Funder.findOne({ email });

    if (!funder) return res.status(400).json({ message: 'Funder not found.' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expireDate = new Date(funder.validUntil);
    if (expireDate < today) {
      return res.status(403).json({ message: 'Your plan has expired. Please contact admin.' });
    }

    if (!funder.isActive) return res.status(403).json({ message: 'Account deactivated.' });
    if (password !== funder.password) return res.status(400).json({ message: 'Incorrect password.' });

    const didRollover = applyRollover(funder);
    if (didRollover) await funder.save();

    const { password: _, ...funderProfile } = funder.toObject();
    res.status(200).json({ message: 'Login successful', funder: funderProfile });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ==========================================
// 3. GET /api/admin/funders  (Admin — all funders)
// ==========================================
router.get('/', async (req, res) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await Funder.deleteMany({ validUntil: { $lte: tenDaysAgo } });
    const funders = await Funder.find().select('-password');
    res.status(200).json({ funders });
  } catch (error) {
    console.error("Get All Funders Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 4. PUT /api/admin/funders/:id
//    Used by: Admin edits + Frontend MAGIC SYNC (todayEarnings)
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const funderId = req.params.id;
    const updateData = { ...req.body };

    let funder = await Funder.findById(funderId);
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    // Auto-recalculate plan limits if admin changes plan
    if (updateData.planType && updateData.planType !== funder.planType) {
      if (updateData.planType === '10k') {
        updateData.perOrderRate = 10; updateData.dailyLimit = 200; updateData.minimumWithdrawal = 1000;
      } else if (updateData.planType === '25k') {
        updateData.perOrderRate = 20; updateData.dailyLimit = 400; updateData.minimumWithdrawal = 2000;
      }
    }

    // ✅ Protect sensitive balance fields from admin accidental overwrite
    // NOTE: todayEarnings is intentionally NOT deleted — the MAGIC SYNC needs to write it
    delete updateData.totalBalance;
    delete updateData.yesterdayEarnings;
    delete updateData.allTimeEarnings;
    delete updateData.lastRolloverDate;

    funder = await Funder.findByIdAndUpdate(funderId, { $set: updateData }, { new: true });
    res.status(200).json({ message: 'Funder updated', funder });
  } catch (error) {
    console.error("Update Funder Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 5. GET /api/admin/funders/me/:id
//    Called every 60s by the dashboard — runs rollover check
// ==========================================
router.get('/me/:id', async (req, res) => {
  try {
    let funder = await Funder.findById(req.params.id);
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    // ✅ Rollover uses lastRolloverDate — MAGIC SYNC PUT can't interfere
    const didRollover = applyRollover(funder);
    if (didRollover) await funder.save();

    const { password: _, ...funderProfile } = funder.toObject();
    res.status(200).json({ funder: funderProfile });
  } catch (error) {
    console.error("Get Funder Profile Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;