const express = require("express");
const router = express.Router();

const Employee = require("../models/Employee");


// Generate Random Password
const generatePassword = () => {
  return Math.random().toString(36).slice(-8);
};


// Generate Employee ID
const generateEmployeeId = async (name) => {
  const random = Math.floor(1000 + Math.random() * 9000);

  const shortName = name
    .replace(/\s+/g, "")
    .substring(0, 4)
    .toUpperCase();

  return `DG-${shortName}-${random}`;
};



// CREATE EMPLOYEE
router.post("/create", async (req, res) => {
  try {
    const { name, phone, email, position } = req.body;

    const password = generatePassword();

    const employeeId = await generateEmployeeId(name);

    const employee = new Employee({
      employeeId,
      name,
      phone,
      email,
      position,
      password,
    });

    await employee.save();

    res.status(201).json({
      success: true,
      message: "Employee Created",
      employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});



// GET ALL EMPLOYEES
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});



// UPDATE EMPLOYEE
router.put("/:id", async (req, res) => {
  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});



module.exports = router;