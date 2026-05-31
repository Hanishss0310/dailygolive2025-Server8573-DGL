// routes/attendance.js
// ─────────────────────────────────────────────────────────────────────────────
// Dependencies (add to your package.json):
//   npm install nodemailer multer xlsx node-cron
// ─────────────────────────────────────────────────────────────────────────────

const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const path       = require("path");
const fs         = require("fs");
const nodemailer = require("nodemailer");
const XLSX       = require("xlsx");
const cron       = require("node-cron");

const Employee      = require("../models/Employee");
const Attendance    = require("../models/Attendance");
const AttendanceOtp = require("../models/AttendanceOtp");

// ── Multer (selfie upload) ─────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "../uploads/selfies");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `selfie_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});

// ── Nodemailer transporter ─────────────────────────────────────────────────
// Hardcoded credentials (no .env required)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for port 465, false for 587
  auth: {
    user: "donotreply.dailygolive@gmail.com", // <-- REPLACE WITH YOUR EMAIL
    pass: "obpl mptx lfkh ebcf",    // <-- REPLACE WITH YOUR EMAIL PASSWORD OR APP PASSWORD
  },
});

const MAIL_FROM = "donotreply.dailygolive@gmail.com"; // <-- REPLACE WITH YOUR EMAIL

// ── Helpers ────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
};

const monthStr = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const isWithinAttendanceWindow = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMinutes = h * 60 + m;
  const start = 8 * 60;        // 08:00
  const end   = 10 * 60;       // 10:00
  return totalMinutes >= start && totalMinutes <= end;
};

// ── CRON: delete selfie files older than 24 h ─────────────────────────────
// Runs every hour
cron.schedule("0 * * * *", async () => {
  try {
    const expiredRecords = await Attendance.find({
      selfiePath:      { $ne: null },
      selfieExpiresAt: { $lte: new Date() },
    });
    for (const rec of expiredRecords) {
      if (rec.selfiePath && fs.existsSync(rec.selfiePath)) {
        fs.unlinkSync(rec.selfiePath);
      }
      await Attendance.updateOne(
        { _id: rec._id },
        { $set: { selfiePath: null } }
      );
    }
    if (expiredRecords.length) {
      console.log(`[Attendance CRON] Deleted ${expiredRecords.length} expired selfies`);
    }
  } catch (err) {
    console.error("[Attendance CRON] Error:", err.message);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. SEND OTP
// POST /api/attendance/send-otp
// Body: { email, phone, name }
// ══════════════════════════════════════════════════════════════════════════════
router.post("/send-otp", async (req, res) => {
  try {
    const { email, phone, name } = req.body;
    if (!email || !phone || !name) {
      return res.status(400).json({ message: "email, phone, and name are required." });
    }

    // Find active employee (not founder)
    const employee = await Employee.findOne({
      email:    email.toLowerCase().trim(),
      phone:    phone.trim(),
      name:     { $regex: new RegExp(`^${name.trim()}$`, "i") },
      isActive: true,
      position: { $nin: ["Founder"] },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found or not eligible for attendance." });
    }

    // Check if already marked today
    const today = todayStr();
    const existing = await Attendance.findOne({ employeeId: employee.employeeId, date: today });
    if (existing && existing.otpVerified && existing.status !== "absent") {
      return res.status(409).json({ message: "Attendance already marked for today." });
    }

    // Check attendance window
    if (!isWithinAttendanceWindow()) {
      return res.status(403).json({
        message: "Attendance window is 8:00 AM – 10:00 AM only.",
      });
    }

    // Invalidate old OTPs for this email
    await AttendanceOtp.deleteMany({ email: employee.email });

    // Generate & save new OTP
    const otp = generateOtp();
    await AttendanceOtp.create({
      email:     employee.email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send email
    await transporter.sendMail({
      from:    `"Daily Go Attendance" <${MAIL_FROM}>`,
      to:      employee.email,
      subject: "Your Attendance OTP – Daily Go",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#131921;margin-bottom:4px">Daily Go Pvt Ltd</h2>
          <p style="color:#6b7280;font-size:13px">Attendance Verification</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="font-size:15px">Hi <strong>${employee.name}</strong>,</p>
          <p style="font-size:14px;color:#374151">Your One-Time Password for attendance marking is:</p>
          <div style="background:#FF9900;color:#131921;font-size:36px;font-weight:900;letter-spacing:10px;text-align:center;padding:20px;border-radius:8px;margin:20px 0">${otp}</div>
          <p style="font-size:12px;color:#6b7280">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">Daily Go Pvt Ltd · Bangalore</p>
        </div>
      `,
    });

    res.json({
      message: `OTP sent to ${employee.email}`,
      employeeId: employee.employeeId,
      employeeName: employee.name,
    });
  } catch (err) {
    console.error("[send-otp]", err);
    res.status(500).json({ message: err.message || "Failed to send OTP." });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. MARK ATTENDANCE
// POST /api/attendance/mark
// multipart/form-data: email, phone, name, otp, latitude, longitude, address, selfie (file)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/mark", upload.single("selfie"), async (req, res) => {
  const selfiePath = req.file ? req.file.path : null;

  try {
    const { email, phone, name, otp, latitude, longitude, address, leaveReason, isLeave } = req.body;

    if (!email || !phone || !name || !otp) {
      if (selfiePath && fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
      return res.status(400).json({ message: "email, phone, name, and otp are required." });
    }

    // Find employee
    const employee = await Employee.findOne({
      email:    email.toLowerCase().trim(),
      phone:    phone.trim(),
      name:     { $regex: new RegExp(`^${name.trim()}$`, "i") },
      isActive: true,
      position: { $nin: ["Founder"] },
    });

    if (!employee) {
      if (selfiePath && fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
      return res.status(404).json({ message: "Employee not found or not eligible." });
    }

    // Check attendance window (skip for leave)
    const markingLeave = isLeave === "true" || isLeave === true;
    if (!markingLeave && !isWithinAttendanceWindow()) {
      if (selfiePath && fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
      return res.status(403).json({ message: "Attendance window is 8:00 AM – 10:00 AM only." });
    }

    // Verify OTP
    const otpRecord = await AttendanceOtp.findOne({
      email: employee.email,
      used:  false,
      expiresAt: { $gte: new Date() },
    });

    if (!otpRecord || otpRecord.otp !== otp.trim()) {
      if (selfiePath && fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
      return res.status(401).json({ message: "Invalid or expired OTP." });
    }

    // Selfie required for present attendance
    if (!markingLeave && !selfiePath) {
      return res.status(400).json({ message: "Selfie upload is mandatory." });
    }

    // Mark OTP as used
    await AttendanceOtp.updateOne({ _id: otpRecord._id }, { $set: { used: true } });

    // Upsert attendance record
    const today  = todayStr();
    const now    = new Date();
    const month  = monthStr(now);
    const year   = now.getFullYear();

    const selfieExpiresAt = selfiePath ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null;

    const attendanceData = {
      employeeId:    employee.employeeId,
      employeeName:  employee.name,
      employeeEmail: employee.email,
      employeePhone: employee.phone,
      position:      employee.position,
      date:          today,
      month,
      year,
      status:        markingLeave ? "leave" : "present",
      otpVerified:   true,
      markedAt:      now,
      location: {
        latitude:  latitude  ? Number(latitude)  : null,
        longitude: longitude ? Number(longitude) : null,
        address:   address   || "",
      },
      selfiePath:      selfiePath || null,
      selfieExpiresAt: selfieExpiresAt,
      leaveReason:     markingLeave ? (leaveReason || "") : "",
    };

    const record = await Attendance.findOneAndUpdate(
      { employeeId: employee.employeeId, date: today },
      { $set: attendanceData },
      { upsert: true, new: true }
    );

    // Send confirmation email
    const statusLabel = markingLeave ? "Leave" : "Present";
    const emailHtml = markingLeave
      ? `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#131921">Daily Go – Leave Recorded</h2>
          <p>Hi <strong>${employee.name}</strong>,</p>
          <p>Your leave for <strong>${today}</strong> has been recorded.</p>
          <p><strong>Reason:</strong> ${leaveReason || "Not specified"}</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">Daily Go Pvt Ltd · Bangalore</p>
        </div>
      `
      : `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#131921">Daily Go – Attendance Confirmed ✅</h2>
          <p>Hi <strong>${employee.name}</strong>,</p>
          <p>Your attendance for <strong>${today}</strong> has been marked as <strong style="color:#16a34a">Present</strong>.</p>
          <p><strong>Time:</strong> ${now.toLocaleTimeString("en-IN")}</p>
          <p><strong>Location:</strong> ${address || `${latitude}, ${longitude}`}</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">Daily Go Pvt Ltd · Bangalore</p>
        </div>
      `;

    await transporter.sendMail({
      from:    `"Daily Go Attendance" <${MAIL_FROM}>`,
      to:      employee.email,
      subject: `Attendance ${statusLabel} – ${today} | Daily Go`,
      html:    emailHtml,
    });

    res.json({
      message:    `Attendance marked as ${statusLabel} for ${today}.`,
      attendance: record,
    });
  } catch (err) {
    console.error("[mark-attendance]", err);
    if (selfiePath && fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
    res.status(500).json({ message: err.message || "Failed to mark attendance." });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. CHECK TODAY'S STATUS (for FOS order blocking)
// GET /api/attendance/today-status?employeeId=EMP001
// ══════════════════════════════════════════════════════════════════════════════
router.get("/today-status", async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ message: "employeeId required" });

    const today  = todayStr();
    const record = await Attendance.findOne({ employeeId, date: today });

    res.json({
      date:       today,
      employeeId,
      hasMarked:  !!(record && record.otpVerified && record.status !== "absent"),
      status:     record?.status || "absent",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN – GET ATTENDANCE FOR A MONTH
// GET /api/attendance/admin/monthly?month=2025-06
// Returns all active non-founder employees + their daily status for that month
// ══════════════════════════════════════════════════════════════════════════════
router.get("/admin/monthly", async (req, res) => {
  try {
    const { month } = req.query; // "YYYY-MM"
    if (!month) return res.status(400).json({ message: "month param required (YYYY-MM)" });

    // Get all active non-founder employees
    const employees = await Employee.find({
      isActive: true,
      position: { $nin: ["Founder"] },
    }).sort({ name: 1 });

    // Get all attendance records for that month
    const records = await Attendance.find({ month });

    // Build a map: employeeId -> { date -> status }
    const recordMap = {};
    for (const r of records) {
      if (!recordMap[r.employeeId]) recordMap[r.employeeId] = {};
      recordMap[r.employeeId][r.date] = r.status;
    }

    // Build calendar days for the month
    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const today = todayStr();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }

    // Build response
    const result = employees.map((emp) => {
      const dayStatus = {};
      for (const day of days) {
        if (day > today) {
          dayStatus[day] = "future";
        } else {
          dayStatus[day] = recordMap[emp.employeeId]?.[day] || "absent";
        }
      }
      const presentCount = Object.values(dayStatus).filter((s) => s === "present").length;
      const absentCount  = Object.values(dayStatus).filter((s) => s === "absent").length;
      const leaveCount   = Object.values(dayStatus).filter((s) => s === "leave").length;
      return {
        employeeId:   emp.employeeId,
        name:         emp.name,
        position:     emp.position,
        email:        emp.email,
        phone:        emp.phone,
        dayStatus,
        presentCount,
        absentCount,
        leaveCount,
        totalDays:    presentCount + absentCount + leaveCount,
      };
    });

    res.json({ month, days, employees: result });
  } catch (err) {
    console.error("[admin/monthly]", err);
    res.status(500).json({ message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN – DOWNLOAD EXCEL FOR A PAST MONTH
// GET /api/attendance/admin/export?month=2025-05
// ══════════════════════════════════════════════════════════════════════════════
router.get("/admin/export", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: "month required" });

    const employees = await Employee.find({
      isActive: true,
      position: { $nin: ["Founder"] },
    }).sort({ name: 1 });

    const records = await Attendance.find({ month });
    const recordMap = {};
    for (const r of records) {
      if (!recordMap[r.employeeId]) recordMap[r.employeeId] = {};
      recordMap[r.employeeId][r.date] = r.status;
    }

    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${month}-${String(d).padStart(2, "0")}`);
    }

    // Build worksheet data
    const header = ["Employee ID", "Name", "Position", "Email", "Phone", ...days, "Present", "Absent", "Leave"];
    const rows = employees.map((emp) => {
      const dayValues = days.map((day) => {
        const s = recordMap[emp.employeeId]?.[day];
        if (!s || s === "absent") return "A";
        if (s === "present") return "P";
        if (s === "leave")   return "L";
        return "-";
      });
      const present = dayValues.filter((v) => v === "P").length;
      const absent  = dayValues.filter((v) => v === "A").length;
      const leave   = dayValues.filter((v) => v === "L").length;
      return [emp.employeeId, emp.name, emp.position, emp.email, emp.phone, ...dayValues, present, absent, leave];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, `Attendance_${month}`);

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Attendance_${month}.xlsx`);
    res.send(buf);
  } catch (err) {
    console.error("[admin/export]", err);
    res.status(500).json({ message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. ADMIN – GET EMPLOYEE LIST (active, non-founder) for FOS dropdown
// GET /api/attendance/admin/employees
// ══════════════════════════════════════════════════════════════════════════════
router.get("/admin/employees", async (req, res) => {
  try {
    const employees = await Employee.find({
      isActive: true,
      position: { $nin: ["Founder"] },
    }).select("employeeId name position phone email").sort({ name: 1 });

    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;