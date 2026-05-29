const express = require("express");

const router = express.Router();

const Employee = require("../models/Employee");

// ==========================================
// GENERATE PASSWORD
// ==========================================
const generatePassword = () => {

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#";

  let password = "";

  for (let i = 0; i < 10; i++) {

    password += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return password;
};

// ==========================================
// GENERATE EMPLOYEE ID
// ==========================================
const generateEmployeeId = (
  name,
  position
) => {

  const random = Math.floor(
    1000 + Math.random() * 9000
  );

  const cleanName = name
    .replace(/\s+/g, "")
    .substring(0, 3)
    .toUpperCase();

  const role = position
    .substring(0, 3)
    .toUpperCase();

  return `DGO-${role}-${cleanName}-${random}`;
};

// ==========================================
// CREATE EMPLOYEE
// ==========================================
router.post("/create", async (req, res) => {

  try {

    const {
      name,
      phone,
      email,
      position,
    } = req.body;

    // CHECK EXISTING EMAIL
    const existingEmployee =
      await Employee.findOne({ email });

    if (existingEmployee) {

      return res.status(400).json({
        success: false,
        message:
          "Employee already exists",
      });
    }

    // GENERATE PASSWORD
    const password =
      generatePassword();

    // GENERATE EMPLOYEE ID
    const employeeId =
      generateEmployeeId(
        name,
        position
      );

    // CREATE EMPLOYEE
    const employee =
      new Employee({
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
      message:
        "Employee Created Successfully",
      employee,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// LOGIN EMPLOYEE
// ==========================================
router.post("/login", async (req, res) => {

  try {

    const {
      name,
      email,
      password,
    } = req.body;

    const employee =
      await Employee.findOne({
        name,
        email,
        isActive: true,
      });

    if (!employee) {

      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    // ONLY FOS & DELIVERY TEAM
    if (
      employee.position !== "FOS" &&
      employee.position !== "Delivery Team"
    ) {

      return res.status(403).json({
        success: false,
        message:
          "Access denied",
      });
    }

    // PASSWORD CHECK
    if (employee.password !== password) {

      return res.status(401).json({
        success: false,
        message:
          "Invalid password",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Login Successful",
      employee,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// GET ALL EMPLOYEES
// ==========================================
router.get("/", async (req, res) => {

  try {

    const employees =
      await Employee.find()
      .sort({ createdAt: -1 });

    res.status(200).json(
      employees
    );

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });
  }
});

// ==========================================
// GET ONLY ACTIVE EMPLOYEES
// ==========================================
router.get("/active", async (req, res) => {

  try {

    const employees =
      await Employee.find({
        isActive: true,
      }).sort({
        createdAt: -1,
      });

    res.status(200).json(
      employees
    );

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });
  }
});

// ==========================================
// UPDATE EMPLOYEE
// ==========================================
router.put("/:id", async (req, res) => {

  try {

    const updatedEmployee =
      await Employee.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

    res.status(200).json({
      success: true,
      employee:
        updatedEmployee,
    });

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });
  }
});

// ==========================================
// DELETE EMPLOYEE
// ==========================================
router.delete("/:id", async (req, res) => {

  try {

    await Employee.findByIdAndDelete(
      req.params.id
    );

    res.status(200).json({
      success: true,
      message:
        "Employee Deleted Successfully",
    });

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;

