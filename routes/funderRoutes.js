const express = require('express');
const router = express.Router();
const Funder = require('../models/Funder');

// ==========================================
// @route   POST /api/admin/funders/add
// @desc    Add a new funder
// @access  Private/Admin
// ==========================================
router.post('/add', async (req, res) => {
  try {
    const { 
      name, email, phoneNumber, storeName, panNumber, 
      adhar, upiId, gpayNumber, planType, validUntil 
    } = req.body;

    // 1. Check if email already exists
    let existingFunder = await Funder.findOne({ email });
    if (existingFunder) {
      return res.status(400).json({ message: 'A funder with this email already exists.' });
    }

    // 2. Generate a default password (using phone number for simplicity right now)
    // Note: In production, you should hash this using bcrypt before saving!
    const defaultPassword = phoneNumber; 

    // 3. Create the new Funder
    const newFunder = new Funder({
      name,
      email,
      phoneNumber,
      storeName,
      panNumber,
      adhar,
      upiId,
      gpayNumber,
      planType,
      validUntil,
      password: defaultPassword 
    });

    // 4. Save to Database (Your pre-save hook in Funder.js will auto-calculate limits)
    await newFunder.save();

    res.status(201).json({
      message: 'Funder activated successfully!',
      funder: newFunder,
      assignedPassword: defaultPassword
    });

  } catch (error) {
    console.error("Error adding funder:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// @route   PUT /api/admin/funders/:id
// @desc    Update an existing funder's details
// @access  Private/Admin
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const funderId = req.params.id;
    const updateData = req.body;

    let funder = await Funder.findById(funderId);
    
    if (!funder) {
      return res.status(404).json({ message: 'Funder not found' });
    }

    if (updateData.planType && updateData.planType !== funder.planType) {
      if (updateData.planType === '10k') {
        updateData.perOrderRate = 10;
        updateData.dailyLimit = 200;
        updateData.minimumWithdrawal = 1000;
      } else if (updateData.planType === '25k') {
        updateData.perOrderRate = 20;
        updateData.dailyLimit = 400;
        updateData.minimumWithdrawal = 2000;
      }
    }

    delete updateData.currentBalance; 
    delete updateData.todayEarnings;

    funder = await Funder.findByIdAndUpdate(
      funderId, 
      { $set: updateData }, 
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Funder updated successfully',
      funder
    });

  } catch (error) {
    console.error("Error updating funder:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;