const express = require("express");

const router = express.Router();

const Employee = require("../models/Employee");

// ==========================================
// GENERATE EMPLOYEE ID
// ==========================================

const generateEmployeeId = (
  name,
  positions
) => {

  const random = Math.floor(
    1000 + Math.random() * 9000
  );

  const cleanName = name
    .replace(/\s+/g, "")
    .substring(0, 3)
    .toUpperCase();

  const primaryRole =
    positions?.[0] || "EMP";

  const role = primaryRole
    .substring(0, 3)
    .toUpperCase();

  return `DGO-${role}-${cleanName}-${random}`;
};

// ==========================================
// CREATE EMPLOYEE
// ==========================================

// ==========================================
// CREATE EMPLOYEE
// ==========================================

router.post("/create", async (req, res) => {
  try {
    console.log("========== CREATE EMPLOYEE ==========");
    console.log("BODY RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));

    const {
      name,
      phone,
      email,
      password,
      positions,
    } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, phone, email and password are required",
      });
    }

    if (
      !positions ||
      !Array.isArray(positions) ||
      positions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one position must be selected",
      });
    }

    const existingEmployee =
      await Employee.findOne({ email });

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message:
          "Employee already exists",
      });
    }

    const employeeId =
      generateEmployeeId(
        name,
        positions
      );

    const employee =
      await Employee.create({
        employeeId,
        name,
        phone,
        email,
        password,
        positions,
      });

    return res.status(201).json({
      success: true,
      message:
        "Employee Created Successfully",
      employee,
    });

  } catch (error) {

    console.error(
      "EMPLOYEE CREATE ERROR"
    );

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// EMPLOYEE LOGIN
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

    // BACKWARD COMPATIBILITY

    let employeeRoles =
      employee.positions || [];

    if (
      employeeRoles.length === 0 &&
      employee.position
    ) {
      employeeRoles = [
        employee.position,
      ];
    }

    const allowedRoles = [
      "FOS",
      "Delivery Team",
    ];

    const hasAccess =
      employeeRoles.some((role) =>
        allowedRoles.includes(role)
      );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied",
      });
    }

    if (
      employee.password !== password
    ) {
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
      .sort({
        createdAt: -1,
      });

    res.status(200).json(
      employees
    );

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// GET ACTIVE EMPLOYEES
// ==========================================

router.get(
  "/active",
  async (req, res) => {

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
        success: false,
        message:
          error.message,
      });
    }
  }
);

// ==========================================
// UPDATE EMPLOYEE
// ==========================================

router.put("/:id", async (req, res) => {

  try {

    const {
      name,
      phone,
      email,
      password,
      positions,
      isActive,
    } = req.body;

    const updatedEmployee =
      await Employee.findByIdAndUpdate(
        req.params.id,
        {
          name,
          phone,
          email,
          password,
          positions,
          isActive,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!updatedEmployee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Employee Updated Successfully",
      employee:
        updatedEmployee,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// DELETE EMPLOYEE
// ==========================================

router.delete("/:id", async (req, res) => {

  try {

    const employee =
      await Employee.findByIdAndDelete(
        req.params.id
      );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Employee Deleted Successfully",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;