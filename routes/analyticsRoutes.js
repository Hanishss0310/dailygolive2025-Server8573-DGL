const express = require("express");
const router = express.Router();

const Gallery = require("../models/GalleryItem");
const Newsletter = require("../models/Newsletter");
const Contact = require("../models/Contact");
const JoinUs = require("../models/JoinUs");

// GET - Analytics Summary
router.get("/summary", async (req, res) => {
  try {
    const [
      totalProducts,
      totalServices,
      newsletterSubscribers,
      usersContacted,
      serviceBookings,
      productQuotes,
    ] = await Promise.all([
      Gallery.countDocuments({ type: "product" }),
      Gallery.countDocuments({ type: "service" }),
      Newsletter.countDocuments(),
      Contact.countDocuments(),
      JoinUs.countDocuments({ category: "service" }),
      JoinUs.countDocuments({ category: "product" }),
    ]);

    const summary = {
      totalProducts: {
        value: totalProducts,
        percentage: 12.6,
        trend: "up",
      },
      totalServices: {
        value: totalServices,
        percentage: 5.2,
        trend: "up",
      },
      newsletterSubscribers: {
        value: newsletterSubscribers,
        percentage: -3.4,
        trend: "down",
      },
      usersContacted: {
        value: usersContacted,
        percentage: 9.8,
        trend: "up",
      },
      serviceBookings: {
        value: serviceBookings,
        percentage: 2.1,
        trend: "up",
      },
      productQuotes: {
        value: productQuotes,
        percentage: 4.5,
        trend: "up",
      },
    };

    res.json(summary);
  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;