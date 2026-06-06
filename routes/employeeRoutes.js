const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee"); // Adjust path if needed

// ==========================================
// HELPER: GENERATE EMPLOYEE ID
// ==========================================
const generateEmployeeId = (name = "", positions = []) => {
  const random = Math.floor(1000 + Math.random() * 9000);

  // Safely extract name substring
  const cleanName = typeof name === "string" 
    ? name.replace(/\s+/g, "").substring(0, 3).toUpperCase() 
    : "XXX";

  // Safely extract role substring
  const primaryRole = (Array.isArray(positions) && positions.length > 0) ? positions[0] : "EMP";
  const role = typeof primaryRole === "string" 
    ? primaryRole.substring(0, 3).toUpperCase() 
    : "EMP";

  return `DGO-${role}-${cleanName}-${random}`;
};

// ==========================================
// POST: CREATE EMPLOYEE
// ==========================================
router.post("/create", async (req, res) => {
  try {
    const { name, phone, email, password, positions } = req.body;

    // 1. Validate basic fields
    if (!name || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, email and password are required",
      });
    }

    // 2. Validate positions array
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one position must be selected",
      });
    }

    // 3. Check for existing employee
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "An employee with this email already exists",
      });
    }

    // 4. Generate ID and Create
    const employeeId = generateEmployeeId(name, positions);

    const employee = await Employee.create({
      employeeId,
      name,
      phone,
      email: email.toLowerCase(),
      password,
      positions,
    });

    return res.status(201).json({
      success: true,
      message: "Employee Created Successfully",
      employee,
    });

  } catch (error) {
    console.error("EMPLOYEE CREATE ERROR:", error);

    // Handle MongoDB duplicate key error explicitly
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This email or Employee ID is already registered.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// ==========================================
// POST: EMPLOYEE LOGIN
// ==========================================
router.post("/login", async (req, res) => {
  try {
    // Only extracting email and password as 'name' is rarely used in login forms
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const employee = await Employee.findOne({
      email: email.toLowerCase(),
      isActive: true,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or account is inactive",
      });
    }

    // Validate Password
    if (employee.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Check Access Roles
    let employeeRoles = employee.positions || [];
    
    // Backward compatibility for older records
    if (employeeRoles.length === 0 && employee.position) {
      employeeRoles = [employee.position];
    }

    const allowedRoles = ["FOS", "Delivery Team"];
    const hasAccess = employeeRoles.some((role) => allowedRoles.includes(role));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have the required role.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      employee,
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// ==========================================
// GET: ALL EMPLOYEES
// ==========================================
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    // Note: Kept standard JSON array response to match your frontend mapping expectations
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// GET: ACTIVE EMPLOYEES
// ==========================================
router.get("/active", async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// PUT: UPDATE EMPLOYEE
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    const { name, phone, email, password, positions, isActive } = req.body;

    // Prevent removing all positions during an edit
    if (positions && (!Array.isArray(positions) || positions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "At least one position must be selected",
      });
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        name,
        phone,
        email: email ? email.toLowerCase() : undefined,
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
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee Updated Successfully",
      employee: updatedEmployee,
    });

  } catch (error) {
    console.error("UPDATE ERROR:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered to another employee.",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// DELETE: REMOVE EMPLOYEE
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee Deleted Successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;