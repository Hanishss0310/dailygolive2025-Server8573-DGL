const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// ==============================
// CREATE
// ==============================
router.post("/", async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();

    res.status(201).json(savedProduct); // ✅ FIXED
  } catch (error) {
    console.error("❌ CREATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// GET ALL
// ==============================
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error("❌ FETCH ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// UPDATE
// ==============================
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    // 🔥 IMPORTANT FIX
    // If no new image sent → don't overwrite old image
    if (!updateData.image) {
      delete updateData.image;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("❌ UPDATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================
// DELETE
// ==============================
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;