const express = require('express');
const router = express.Router();
const Funder = require('../models/Funder');

// @route   PUT /api/admin/funders/:id
// @desc    Update an existing funder's details
// @access  Private/Admin
router.put('/:id', async (req, res) => {
  try {
    const funderId = req.params.id;
    const updateData = req.body;

    // 1. Find the funder first
    let funder = await Funder.findById(funderId);
    
    if (!funder) {
      return res.status(404).json({ message: 'Funder not found' });
    }

    // 2. Check if the admin is updating the planType
    // If they upgrade/downgrade the plan, recalculate the financial limits
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

    // 3. Prevent admin from accidentally overwriting sensitive dynamic data directly via generic update
    // If you want admins to edit balances manually, remove these two lines.
    delete updateData.currentBalance; 
    delete updateData.todayEarnings;

    // 4. Perform the update
    funder = await Funder.findByIdAndUpdate(
      funderId, 
      { $set: updateData }, 
      { new: true, runValidators: true } // new: true returns the updated document
    );

    res.status(200).json({
      message: 'Funder updated successfully',
      funder
    });

  } catch (error) {
    console.error("Error updating funder:", error);
    
    // Handle Mongoose validation errors (e.g., missing required fields)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;