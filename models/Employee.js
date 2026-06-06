const mongoose = require("mongoose");
const bcrypt = require("bcrypt"); // Require bcrypt for password hashing

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      // Validates a standard 10-digit phone number
      match: [/^\d{10}$/, "Please provide a valid 10-digit phone number"], 
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      // Validates standard email formats (user@domain.com)
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },

    positions: {
      // Best practice syntax for arrays of enums
      type: [{
        type: String,
        enum: [
          "Founder",
          "Manager",
          "ASM",
          "Team Lead",
          "FOS",
          "Delivery Team",
        ],
      }],
      default: [],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      trim: true,
      minlength: [6, "Password must be at least 6 characters long"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// PRE-SAVE HOOK: ENCRYPT PASSWORD
// ==========================================
employeeSchema.pre("save", async function (next) {
  // Only run this function if the password was modified (not on other update calls)
  if (!this.isModified("password")) return next();

  try {
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Employee", employeeSchema);