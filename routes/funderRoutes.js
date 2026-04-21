const express = require('express');
const router = express.Router();
const Funder = require('../models/Funder');

// ==========================================
// 1. @route   POST /api/admin/funders/add
//    @desc    Add a new funder (Admin)
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

    // Manually calculate the limits based on the plan before saving
    let perOrderRate = 10;
    let dailyLimit = 200;
    let minimumWithdrawal = 1000;

    if (planType === '25k') {
      perOrderRate = 20;
      dailyLimit = 400;
      minimumWithdrawal = 2000;
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
    if (error.name === 'ValidationError') {
       return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 2. @route   POST /api/admin/funders/login
//    @desc    Funder Login & Grace Period Lockout
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let funder = await Funder.findOne({ email });
    
    if (!funder) return res.status(400).json({ message: 'Funder not found.' });

    // 🔒 INSTANT LOCKOUT: If today is past their validUntil date, block login.
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const expireDate = new Date(funder.validUntil);
    
    if (expireDate < today) {
      return res.status(403).json({ message: 'Your plan has expired. Please contact admin.' });
    }

    if (!funder.isActive) return res.status(403).json({ message: 'Account deactivated.' });
    if (password !== funder.password) return res.status(400).json({ message: 'Incorrect password.' });

    // 🔄 DAILY ROLL-OVER LOGIC (Lazy Check)
    const lastUpdate = new Date(funder.updatedAt).toDateString();
    const currentDate = new Date().toDateString();

    if (lastUpdate !== currentDate) {
      // It's a new day! Shift the balances forward.
      funder.totalBalance += funder.yesterdayEarnings || 0; // Yesterday goes to Total
      funder.yesterdayEarnings = funder.todayEarnings || 0; // Today goes to Yesterday
      funder.todayEarnings = 0; // Reset Today
      await funder.save(); // This updates 'updatedAt' automatically!
    }

    // Remove password from the response data for security
    const { password: _, ...funderProfile } = funder.toObject();

    res.status(200).json({ message: 'Login successful', funder: funderProfile });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ==========================================
// 3. @route   GET /api/admin/funders
//    @desc    Get all funders + AUTO-DELETE 10-day expired (Admin)
// ==========================================
router.get('/', async (req, res) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Delete anyone whose validUntil date is older than 10 days ago
    await Funder.deleteMany({ validUntil: { $lte: tenDaysAgo } });

    // Fetch the remaining clean list of funders
    const funders = await Funder.find().select('-password'); 

    res.status(200).json({ funders });
  } catch (error) {
    console.error("Get All Funders Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 4. @route   PUT /api/admin/funders/:id
//    @desc    Update an existing funder (Admin)
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const funderId = req.params.id;
    const updateData = req.body;

    let funder = await Funder.findById(funderId);
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    // Auto-recalculate limits if Admin changes their plan
    if (updateData.planType && updateData.planType !== funder.planType) {
      if (updateData.planType === '10k') {
        updateData.perOrderRate = 10; updateData.dailyLimit = 200; updateData.minimumWithdrawal = 1000;
      } else if (updateData.planType === '25k') {
        updateData.perOrderRate = 20; updateData.dailyLimit = 400; updateData.minimumWithdrawal = 2000;
      }
    }

    // Prevent admin from accidentally overwriting financial tracking fields
    delete updateData.totalBalance;
    delete updateData.todayEarnings;
    delete updateData.yesterdayEarnings;
    delete updateData.allTimeEarnings;

    funder = await Funder.findByIdAndUpdate(funderId, { $set: updateData }, { new: true });

    res.status(200).json({ message: 'Funder updated', funder });
  } catch (error) {
    console.error("Update Funder Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 5. @route   GET /api/admin/funders/me/:id
//    @desc    Get fresh profile data for Funder Dashboard
// ==========================================
router.get('/me/:id', async (req, res) => {
  try {
    let funder = await Funder.findById(req.params.id).select('-password');
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    // 🔄 DAILY ROLL-OVER LOGIC (Lazy Check for Dashboard refresh)
    const lastUpdate = new Date(funder.updatedAt).toDateString();
    const currentDate = new Date().toDateString();

    if (lastUpdate !== currentDate) {
      // It's a new day! Shift the balances forward.
      funder.totalBalance += funder.yesterdayEarnings || 0;
      funder.yesterdayEarnings = funder.todayEarnings || 0;
      funder.todayEarnings = 0;
      await funder.save(); 
    }

    res.status(200).json({ funder });
  } catch (error) {
    console.error("Get Funder Profile Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;