const express = require('express');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const router = express.Router();

// Store the daily password in memory.
let currentDailyPassword = "dailygo-temp-pass"; 

// --- NODEMAILER SETUP ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'donotreply.dailygolive@gmail.com',
        pass: 'obpl mptx lfkh ebcf' // Replace with your actual app password!
    }
});

const notifyTeamEmails = [
    'managedailygo@gmail.com',
    'managefyntraxis@gmail.com',
    'kirangowdakiru198@gmail.com',
    'dailygodeliveryteamupdates@gmail.com'
];

// --- CORE FUNCTION TO GENERATE & SEND PASSWORD ---
const generateAndSendPassword = async () => {
    // Generate a secure 8-character random password
    currentDailyPassword = crypto.randomBytes(4).toString('hex');

    const mailOptions = {
        from: 'donotreply.dailygolive@gmail.com',
        to: notifyTeamEmails.join(', '),
        subject: '🔐 Daily Go Live - Today\'s Delivery Team Password',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Daily Go Live Delivery Team Update</h2>
                <p>Here is the new password for the delivery team login for today.</p>
                <div style="padding: 15px; background: #f4f4f4; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Login Email:</strong> dailygodeliveryteamupdates@gmail.com</p>
                    <p><strong>Daily Password:</strong> <span style="font-size: 20px; color: #d9534f;">${currentDailyPassword}</span></p>
                </div>
                <p>This password will remain valid until tomorrow morning.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Daily password email sent successfully! Password is: ${currentDailyPassword}`);
    } catch (error) {
        console.error('❌ Error sending daily email:', error);
    }
};

// ==========================================
// 1. TRIGGER IMMEDIATELY ON SERVER START
// This guarantees you get the password NOW while building.
// ==========================================
console.log("🚀 Booting up Delivery Auth... generating today's password now.");
generateAndSendPassword();

// ==========================================
// 2. CRON JOB: Every Day at 6:00 AM IST
// ==========================================
cron.schedule('0 6 * * *', async () => {
    console.log('⏰ Running scheduled daily password generation (6:00 AM IST)...');
    await generateAndSendPassword();
}, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Ensures 6 AM is based on Indian Standard Time
});

// --- LOGIN ROUTE ---
router.post('/login', (req, res) => {
    const { fosName, email, password } = req.body;

    // Validate specific email and the dynamic daily password
    if (email === 'dailygodeliveryteamupdates@gmail.com' && password === currentDailyPassword) {
        return res.status(200).json({ 
            success: true, 
            message: 'Login successful',
            operator: fosName 
        });
    }

    return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials or expired daily password.' 
    });
});

module.exports = router;