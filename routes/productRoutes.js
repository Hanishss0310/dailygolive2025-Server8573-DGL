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
    // ✅ Use return to ensure no further code executes
    return res.status(201).json(savedProduct); 
  } catch (error) {
    // ✅ Avoid colons in plain strings to be safe with path-to-regexp
    console.error("CREATE_ERROR", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==============================
// GET ALL
// ==============================
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    console.error("FETCH_ERROR", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==============================
// UPDATE
// ==============================
// ✅ Ensure no space between ":" and "id"
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (!updateData.image) {
      delete updateData.image;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData }, // ✅ Use $set for cleaner Mongoose updates
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("UPDATE_ERROR", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==============================
// DELETE
// ==============================
router.delete("/:id", async (req, res) => {
  try {
    // ✅ Use req.params.id directly
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("DELETE_ERROR", error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;