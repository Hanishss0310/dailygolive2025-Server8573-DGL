const express = require('express');
const router  = express.Router();
const Funder  = require('../models/Funder');

// ==========================================
// CRON FUNCTION — exported for Server.js
// Credits every active, non-expired funder.
// ==========================================
const creditAllFunders = async () => {
  try {
    const now     = new Date();
    const funders = await Funder.find({ isActive: true, validUntil: { $gte: now } });

    let credited = 0;
    for (const funder of funders) {
      // Skip if already credited today (IST)
      if (funder.lastCreditDate) {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const lastIST   = new Date(funder.lastCreditDate.getTime() + istOffset).toDateString();
        const todayIST  = new Date(now.getTime()              + istOffset).toDateString();
        if (lastIST === todayIST) continue;
      }

      const credit = funder.dailyCredit;

      funder.yesterdayEarnings = funder.todayEarnings;
      funder.todayEarnings     = credit;
      funder.totalBalance      = (funder.totalBalance      || 0) + credit;
      funder.allTimeEarnings   = (funder.allTimeEarnings   || 0) + credit;
      funder.creditDays        = (funder.creditDays        || 0) + 1;
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
    if (!funder.isActive)             return res.status(403).json({ message: 'Account deactivated.' });
    if (password !== funder.password) return res.status(400).json({ message: 'Incorrect password.' });

    const { password: _, ...funderProfile } = funder.toObject();
    res.status(200).json({ message: 'Login successful', funder: funderProfile });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ==========================================
// 3. GET /api/admin/funders  (Admin list)
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
// 4. GET /api/admin/funders/active-users
//    ⚠️  MUST stay above /:id
// ==========================================
router.get('/active-users', async (req, res) => {
  try {
    const funders = await Funder.find({ isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });

    const now       = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;

    const enriched = funders.map(f => {
      const validUntil = new Date(f.validUntil);
      const daysLeft   = Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24));
      const isExpired  = validUntil < now;

      const creditedToday = f.lastCreditDate
        ? new Date(new Date(f.lastCreditDate).getTime() + istOffset).toDateString() ===
          new Date(now.getTime() + istOffset).toDateString()
        : false;

      return {
        _id:               f._id,
        name:              f.name,
        email:             f.email,
        phoneNumber:       f.phoneNumber,
        storeName:         f.storeName,
        upiId:             f.upiId,
        planType:          f.planType,
        dailyCredit:       f.dailyCredit,
        minimumWithdrawal: f.minimumWithdrawal,
        validUntil:        f.validUntil,
        daysLeft:          isExpired ? 0 : daysLeft,
        isExpired,
        totalBalance:      Number(f.totalBalance      || 0),
        todayEarnings:     Number(f.todayEarnings     || 0),
        yesterdayEarnings: Number(f.yesterdayEarnings || 0),
        allTimeEarnings:   Number(f.allTimeEarnings   || 0),
        creditDays:        Number(f.creditDays        || 0),
        lastCreditDate:    f.lastCreditDate,
        creditedToday,
        createdAt:         f.createdAt,
      };
    });

    res.status(200).json({ total: enriched.length, funders: enriched });
  } catch (error) {
    console.error('Active Users Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// 5. GET /api/admin/funders/me/:id
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
// 6. PUT /api/admin/funders/:id  (Admin edit)
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    const funder = await Funder.findById(req.params.id);
    if (!funder) return res.status(404).json({ message: 'Funder not found' });

    if (updateData.planType && updateData.planType !== funder.planType) {
      if (updateData.planType === '10k') {
        updateData.dailyCredit = 200; updateData.minimumWithdrawal = 1000;
      } else if (updateData.planType === '25k') {
        updateData.dailyCredit = 400; updateData.minimumWithdrawal = 2000;
      }
    }

    // Never overwrite financial fields
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
// 7. POST /api/admin/funders/withdraw/:id
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

    funder.totalBalance = funder.totalBalance - withdrawAmount;
    await funder.save();

    const { password: _, ...funderProfile } = funder.toObject();
    res.status(200).json({
      message: `₹${withdrawAmount} withdrawal processed.`,
      funder:  funderProfile
    });
  } catch (error) {
    console.error('Withdraw Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==========================================
// ✅ EXPORT BOTH router AND creditAllFunders
//    This was the bug — module.exports = router
//    was wiping out the creditAllFunders export
// ==========================================
module.exports = router;
module.exports.creditAllFunders = creditAllFunders;