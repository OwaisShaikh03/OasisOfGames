const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

// Writes one line to the activity log. It never throws: a logging problem must not break the
// action being logged.
//   audit.record(req, "game.delete", { type: "game", id: game._id, label: game.title }, "extra text")
async function record(req, action, target = {}, details = "") {
  try {
    let actorName = "unknown";
    if (req.user) {
      const u = await User.findById(req.user.id).select("username");
      if (u) actorName = u.username;
    }
    await ActivityLog.create({
      actor: req.user ? req.user.id : null,
      actorName,
      actorRole: req.user ? req.user.role : "",
      action,
      targetType: target.type || "",
      targetId: target.id ? String(target.id) : "",
      targetLabel: String(target.label || "").slice(0, 120),
      details: String(details || "").slice(0, 300),
    });
  } catch (err) {
    console.error("Activity log failed:", err.message);
  }
}

module.exports = { record };