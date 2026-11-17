const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { normalize, canUpload } = require("../utils/roles");

// Reads the token and loads the CURRENT role from the database
async function loadUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    const u = await User.findById(decoded.id).select("role passwordChangedAt");
    if (!u) return null;
    // A login from before the last password change is no longer valid
    if (u.passwordChangedAt && decoded.iat * 1000 < u.passwordChangedAt.getTime()) return null;
    return { id: String(u._id), role: normalize(u.role), lifetime: decoded.exp - decoded.iat };
  } catch {
    return null;
  }
}

exports.protect = async (req, res, next) => {
  const user = await loadUser(req);
  if (!user) return res.status(401).json({ message: "Not authorized" });
  req.user = user;
  next();
};

exports.optionalAuth = async (req, res, next) => {
  req.user = await loadUser(req);
  next();
};

exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin")
    return res.status(403).json({ message: "Admin access only" });
  next();
};

// Use after protect: only developers and admins may upload games or builds
exports.developerOnly = (req, res, next) => {
  if (!canUpload(req.user))
    return res.status(403).json({ message: "Only developer accounts can upload games" });
  next();
};