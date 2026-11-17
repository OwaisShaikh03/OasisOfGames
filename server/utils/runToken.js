const jwt = require("jsonwebtoken");

// A short-lived code that lets the game page save a run under a tester's name.
// It is signed with a DIFFERENT key than logins, so it can never be used to log in as that
// person, and it expires after 2 hours. It only says "this run belongs to user X".
const key = () => process.env.JWT_SECRET + ":run-token";

function sign(userId) {
  return jwt.sign({ sub: String(userId), purpose: "run" }, key(), { expiresIn: "2h" });
}

// Returns the user id the code was issued to, or null if it is invalid or expired
function verify(token) {
  try {
    const p = jwt.verify(token, key());
    return p.purpose === "run" && p.sub ? String(p.sub) : null;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };