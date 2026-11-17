const mongoose = require("mongoose");

// One line per notable action: who did what, and to what. Entries are deleted after 180 days.
const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // Names are copied in, so the log still reads well after a user or game is deleted
  actorName: { type: String, default: "unknown" },
  actorRole: { type: String, default: "" },
  action: { type: String, required: true, index: true },
  targetType: { type: String, default: "" },
  targetId: { type: String, default: "" },
  targetLabel: { type: String, default: "" },
  details: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
});

module.exports = mongoose.model("ActivityLog", activitySchema);