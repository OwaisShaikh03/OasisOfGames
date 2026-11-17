const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Websites allowed to call this API from a browser, for example your Vercel site:
//   CLIENT_ORIGINS=https://my-site.vercel.app,http://localhost:5173
// If it is not set, every website is allowed, so a missing setting never locks you out.
function corsMiddleware() {
  const allowed = (process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (!allowed.length) return cors();
  return cors({ origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)) });
}

// Security headers for the API only. The game pages are left alone: Unity needs inline scripts
// and has to load inside an iframe on your Vercel site.
const apiHeaders = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
});

// Reject JSON that contains database operators such as {"$ne": ""} (NoSQL injection)
function hasOperatorKey(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return false;
  return Object.keys(value).some((k) => k.startsWith("$") || hasOperatorKey(value[k], depth + 1));
}
function noOperatorKeys(req, res, next) {
  if (hasOperatorKey(req.body)) return res.status(400).json({ message: "Invalid request" });
  next();
}

const limiter = (windowMinutes, limit, text, extra = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: text },
    ...extra,
  });

module.exports = {
  cors: corsMiddleware,
  apiHeaders,
  noOperatorKeys,
  // Everything under /api: generous, only stops runaway scripts
  apiLimiter: limiter(15, 600, "Too many requests. Please slow down and try again in a few minutes."),
  // Wrong passwords only: 20 failures per 15 minutes. Many people can share one address (a lab, a
  // campus Wi-Fi), so the numbers are generous.
  loginLimiter: limiter(15, 20, "Too many failed login attempts. Try again in 15 minutes.", { skipSuccessfulRequests: true }),
  registerLimiter: limiter(60, 30, "Too many accounts created from this connection. Try again later."),
  uploadLimiter: limiter(60, 20, "Too many uploads. Try again in an hour."),
  // Posting or deleting reviews (reading is not limited)
  reviewLimiter: limiter(60, 60, "You are posting too quickly. Try again later.", { skip: (req) => req.method === "GET" }),
};