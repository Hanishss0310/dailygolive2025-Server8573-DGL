// authRoutes.js
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Hardcoded Allowed Users
const allowedUsers = [
  { name: 'Shivram', email: 'maddylucky67@gmail.com', password: 'Shivram@DG2025' },
  { name: 'Hanish S.S', email: 'hanishgowda7795@gmail.com', password: 'Hanish@DG2025' },
  { name: 'Kiran G.S', email: 'Kirangowdakiru0198@gmail.com', password: 'KiranGS@2025' }
];

// In-memory OTP store (Email -> OTP)
const otpStore = {};

// Nodemailer Transporter Setup
// Note: Replace with your actual sending Gmail address and an "App Password"
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'donotreply.dailygolive@gmail.com', // Replace with your email
    pass: 'obpl mptx lfkh ebcf'      // Replace with your 16-character App Password
  }
});

// Route 1: Validate Credentials & Send OTP
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = allowedUsers.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Access Denied.' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp; // Store OTP mapped to email

  // Send Email
  const mailOptions = {
    from: 'donotreply.dailygolive@gmail.com',
    to: email,
    subject: 'Daily Go Live - Admin Login OTP',
    html: `
      <div style="font-family: Poppins, sans-serif; padding: 20px;">
        <h2>Hello ${user.name},</h2>
        <p>Your OTP for logging into the Daily Go Live Admin Panel is: <strong style="font-size: 24px; color: #059669;">${otp}</strong></p>
        <p>This OTP is valid for this session only.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'OTP sent successfully to your email.' });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
  }
});

// Route 2: Verify OTP
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // Clear OTP after successful use
    return res.status(200).json({ success: true, message: 'Login successful' });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
  }
});

module.exports = router;