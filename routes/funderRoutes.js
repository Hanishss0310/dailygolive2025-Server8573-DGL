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

    const newFunder = new Funder({
      name, email, phoneNumber, storeName, panNumber, 
      adhar, upiId, gpayNumber, planType, validUntil, password
    });

    await newFunder.save();

    res.status(201).json({ message: 'Funder activated successfully!', funder: newFunder });
  } catch (error) {
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
    const funder = await Funder.findOne({ email });
    
    if (!funder) return res.status(400).json({ message: 'Funder not found.' });

    // 🔒 INSTANT LOCKOUT: If today is past their validUntil date, block login.
    // Their data stays in the DB for 10 days, but they cannot access the dashboard.
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate date comparison
    const expireDate = new Date(funder.validUntil);
    
    if (expireDate < today) {
      return res.status(403).json({ message: 'Your plan has expired. Please contact admin.' });
    }

    if (!funder.isActive) return res.status(403).json({ message: 'Account deactivated.' });
    if (password !== funder.password) return res.status(400).json({ message: 'Incorrect password.' });

    // Remove password from the response data for security
    const { password: _, ...funderProfile } = funder.toObject();

    res.status(200).json({ message: 'Login successful', funder: funderProfile });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ==========================================
// 3. @route   GET /api/admin/funders
//    @desc    Get all funders + AUTO-DELETE 10-day expired (Admin)
// ==========================================
router.get('/', async (req, res) => {
  try {
    // 🧹 LAZY CLEANUP: Calculate the date 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Delete anyone whose validUntil date is older than 10 days ago
    await Funder.deleteMany({ validUntil: { $lte: tenDaysAgo } });

    // Fetch the remaining clean list of funders
    const funders = await Funder.find().select('-password'); 

    res.status(200).json({ funders });
  } catch (error) {
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

    delete updateData.currentBalance; 
    delete updateData.todayEarnings;

    funder = await Funder.findByIdAndUpdate(funderId, { $set: updateData }, { new: true });

    res.status(200).json({ message: 'Funder updated', funder });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 5. @route   GET /api/admin/funders/me/:id
//    @desc    Get fresh profile data for Funder Dashboard
// ==========================================
router.get('/me/:id', async (req, res) => {
  try {
    const funder = await Funder.findById(req.params.id).select('-password');
    if (!funder) return res.status(404).json({ message: 'Funder not found' });
    res.status(200).json({ funder });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;