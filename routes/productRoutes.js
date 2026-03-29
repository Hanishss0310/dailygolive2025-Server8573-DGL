const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// 1. CREATE PRODUCT
// Route: POST /api/products
router.post("/", async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    return res.status(201).json(savedProduct);
  } catch (error) {
    console.error("CREATE_ERROR", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// 2. GET ALL PRODUCTS
// Route: GET /api/products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    console.error("FETCH_ERROR", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// 3. UPDATE PRODUCT
// Route: PUT /api/products/:id
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Prevent overwriting with null image
    if (!updateData.image) {
      delete updateData.image;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
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

// 4. DELETE PRODUCT
// Route: DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  try {
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