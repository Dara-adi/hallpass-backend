const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// Middleware
// ===============================

app.use(cors());
app.use(express.json());

// ===============================
// MongoDB
// ===============================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas!");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// ===============================
// Student Schema
// ===============================

const studentSchema = new mongoose.Schema(
  {
    username: {
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

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Never store the actual passcode.
    passcodeHash: {
      type: String,
      required: true,
    },

    // Academic profile
    track: {
      type: String,
      enum: ["Science", "Arts", "Commercial"],
      default: "Science",
    },

    subjects: {
      type: [String],
      default: [],
    },

    // Progress
    xp: {
      type: Number,
      default: 0,
    },

    streak: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    stats: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    exams: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    badges: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    read: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Student = mongoose.model("Student", studentSchema);

// ===============================
// TEST ROUTE
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Hallpass Backend is running with MongoDB!",
  });
});

// ===============================
// REGISTER
// ===============================

app.post("/api/register", async (req, res) => {
  try {
    const {
      username,
      name,
      email,
      passcode,
      track,
      subjects,
    } = req.body;

    // Validate required fields
    if (!username || !name || !email || !passcode) {
      return res.status(400).json({
        success: false,
        message: "Username, name, email and passcode are required.",
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // Validate passcode
    if (!/^\d{4,8}$/.test(String(passcode))) {
      return res.status(400).json({
        success: false,
        message: "Passcode must be between 4 and 8 digits.",
      });
    }

    // Check existing email
    const existingEmail = await Student.findOne({
      email: email.toLowerCase(),
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Check existing username
    const existingUsername = await Student.findOne({
      username: username.toLowerCase(),
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken.",
      });
    }

    // Hash passcode
    const passcodeHash = await bcrypt.hash(String(passcode), 12);

    // Create student
    const student = await Student.create({
      username: username.toLowerCase(),
      name,
      email: email.toLowerCase(),
      passcodeHash,
      track: track || "Science",
      subjects: subjects || [],
      xp: 0,
      streak: {},
      stats: {},
      exams: [],
      badges: [],
      read: {},
    });

    console.log(`New Hallpass student registered: ${student.email}`);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      student: {
        id: student._id,
        username: student.username,
        name: student.name,
        email: student.email,
        track: student.track,
        subjects: student.subjects,
        xp: student.xp,
        streak: student.streak,
        stats: student.stats,
        exams: student.exams,
        badges: student.badges,
        read: student.read,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create account.",
    });
  }
});

// ===============================
// LOGIN
// ===============================

app.post("/api/login", async (req, res) => {
  try {
    const { email, passcode } = req.body;

    if (!email || !passcode) {
      return res.status(400).json({
        success: false,
        message: "Email and passcode are required.",
      });
    }

    // Find student by email
    const student = await Student.findOne({
      email: email.toLowerCase(),
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or passcode.",
      });
    }

    // Compare passcode with hashed version
    const correctPasscode = await bcrypt.compare(
      String(passcode),
      student.passcodeHash
    );

    if (!correctPasscode) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or passcode.",
      });
    }

    console.log(`Student logged in: ${student.email}`);

    res.json({
      success: true,
      message: "Login successful.",
      student: {
        id: student._id,
        username: student.username,
        name: student.name,
        email: student.email,
        track: student.track,
        subjects: student.subjects,
        xp: student.xp,
        streak: student.streak,
        stats: student.stats,
        exams: student.exams,
        badges: student.badges,
        read: student.read,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Could not log in.",
    });
  }
});

// ===============================
// GET STUDENT
// ===============================

app.get("/api/get-student/:username", async (req, res) => {
  try {
    const student = await Student.findOne({
      username: req.params.username.toLowerCase(),
    }).select("-passcodeHash");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    res.json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get student error:", error);

    res.status(500).json({
      success: false,
      message: "Database error.",
    });
  }
});

// ===============================
// SAVE PROGRESS
// ===============================

app.post("/api/save-progress", async (req, res) => {
  try {
    const studentData = req.body;

    if (!studentData.username) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    // Never allow the frontend to overwrite the password hash.
    delete studentData.passcodeHash;

    const updatedStudent = await Student.findOneAndUpdate(
      {
        username: studentData.username.toLowerCase(),
      },
      {
        $set: studentData,
      },
      {
        new: true,
        upsert: false,
      }
    ).select("-passcodeHash");

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student account not found.",
      });
    }

    console.log(
      `Progress saved to MongoDB for student: ${studentData.username}`
    );

    res.json({
      success: true,
      message: "Progress permanently saved to MongoDB!",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error saving to database:", error);

    res.status(500).json({
      success: false,
      message: "Database error.",
    });
  }
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`Hallpass backend running on http://localhost:${PORT}`);
});