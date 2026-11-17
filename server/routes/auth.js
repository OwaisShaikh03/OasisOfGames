const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Game = require("../models/Game");
const { protect } = require("../middleware/auth");
const audit = require("../utils/audit");
const { SIGNUP_ROLES, normalize } = require("../utils/roles");

const router = express.Router();

// A normal login lasts 1 day. "Keep me signed in" lasts 30 days.
const DAY = 24 * 60 * 60;
const makeToken = (user, seconds = DAY) =>
  jwt.sign({ id: user._id, role: normalize(user.role) }, process.env.JWT_SECRET, {
    expiresIn: seconds,
  });

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns an error message, or null when the password is acceptable
function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 72) return "Password must be at most 72 characters";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password needs at least one letter and one number";
  return null;
}

router.post("/register", async (req, res) => {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    // Account type chosen at sign-up. Nobody can pick admin; only an admin can change it later.
    const role = req.body.role === undefined ? "player" : req.body.role;

    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (!SIGNUP_ROLES.includes(role))
      return res.status(400).json({ message: "Choose an account type: player, tester or developer" });
    if (!USERNAME_RE.test(username))
      return res.status(400).json({ message: "Username must be 3-30 characters: letters, numbers or underscore" });
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ message: "Enter a valid email address" });
    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ message: pwProblem });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists)
      return res.status(400).json({ message: "A user with that email or username already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed, role });
    res.status(201).json({
      token: makeToken(user),
      user: { id: user._id, username, email, role: normalize(user.role) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    const remember = req.body.remember === true;
    if (!email || typeof password !== "string" || !password)
      return res.status(400).json({ message: "Enter your email and password" });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      token: makeToken(user, remember ? 30 * DAY : DAY),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: normalize(user.role),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Own account details
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password").lean();
  if (!user) return res.status(404).json({ message: "User not found" });
  const games = await Game.countDocuments({ createdBy: req.user.id });
  res.json({
    id: user._id,
    username: user.username,
    email: user.email,
    role: normalize(user.role),
    createdAt: user.createdAt,
    games,
  });
});

// Change own password
router.put("/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || !currentPassword)
      return res.status(400).json({ message: "Enter your current password" });
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });
    if (newPassword === currentPassword)
      return res.status(400).json({ message: "The new password must be different" });

    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    // Every other device is signed out; this one gets a fresh login of the same length
    user.passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await user.save();
    await audit.record(req, "account.password", { type: "user", id: user._id, label: user.username });
    res.json({ message: "Password changed", token: makeToken(user, req.user.lifetime || DAY) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;