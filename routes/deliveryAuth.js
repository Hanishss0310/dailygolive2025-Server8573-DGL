const express = require('express');
const router  = express.Router();

// ======================================================
// STATIC DELIVERY AGENTS
// Each agent logs in with their name (dropdown) + password.
// Password format: NameWithoutSpaces@DG2026
// ======================================================
const DELIVERY_AGENTS = [
  { name: 'Pavan Kumar',         email: 'pavan@dg.com',    phone: '9000000001', password: 'PavanKumar@DG2026'         },
  { name: 'Kiran GS',            email: 'kiran@dg.com',    phone: '9000000002', password: 'KiranGS@DG2026'            },
  { name: 'Shivaraj',            email: 'shivaraj@dg.com', phone: '9000000003', password: 'Shivaraj@DG2026'           },
  { name: 'Gnanesh',             email: 'gnanesh@dg.com',  phone: '9000000004', password: 'Gnanesh@DG2026'            },
  { name: 'Karan Singh',         email: 'karan@dg.com',    phone: '9000000005', password: 'KaranSingh@DG2026'         },
  { name: 'Kallu Singh',         email: 'kallu@dg.com',    phone: '9000000006', password: 'KalluSingh@DG2026'         },
  { name: 'Mahaveer',            email: 'mahaveer@dg.com', phone: '9000000007', password: 'Mahaveer@DG2026'           },
  { name: 'Bhaskar L',           email: 'bhaskar@dg.com',  phone: '9000000008', password: 'BhaskarL@DG2026'           },
  { name: 'Ramesh Babu',         email: 'ramesh@dg.com',   phone: '9000000009', password: 'RameshBabu@DG2026'         },
  { name: 'Punith',              email: 'punith@dg.com',   phone: '9000000010', password: 'Punith@DG2026'             },
  { name: 'Testing - Fyntraxis', email: 'testing@dg.com',  phone: '9000000011', password: 'Testing-Fyntraxis@DG2026'  },
];

// ======================================================
// POST /login
// Body: { name: string, password: string }
// ======================================================
router.post('/login', (req, res) => {
  try {
    const { name, password } = req.body;

    // ── 1. Validate presence ──────────────────────────────
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name and password are required.',
      });
    }

    // ── 2. Find agent (case-insensitive name match) ───────
    const agent = DELIVERY_AGENTS.find(
      (a) => a.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );

    if (!agent) {
      return res.status(401).json({
        success: false,
        message: 'Agent not found. Please select a valid name.',
      });
    }

    // ── 3. Validate password (exact match) ───────────────
    if (agent.password !== String(password).trim()) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
      });
    }

    // ── 4. Success ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        name:  agent.name,
        email: agent.email,
        phone: agent.phone,
      },
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;