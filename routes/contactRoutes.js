const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");

// POST - Save contact
router.post("/", async (req, res) => {
  try {
    const { firstname, lastname, email, phone, message } = req.body;

    if (!firstname || !lastname || !email || !phone || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newContact = new Contact({
      firstname,
      lastname,
      email,
      phone,
      message,
    });

    await newContact.save();

    res.json({ message: "✅ Message sent successfully" });
  } catch (err) {
    console.error("❌ Contact POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Fetch all contacts
router.get("/", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    console.error("❌ Contact GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;