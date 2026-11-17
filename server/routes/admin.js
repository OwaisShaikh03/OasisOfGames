const express = require("express");
const User = require("../models/User");
const Game = require("../models/Game");
const Metric = require("../models/Metric");
const ActivityLog = require("../models/ActivityLog");
const { protect, adminOnly } = require("../middleware/auth");
const { summaries, compact } = require("../utils/optimizationSummary");
const audit = require("../utils/audit");
const { ROLES, normalize } = require("../utils/roles");

const router = express.Router();
router.use(protect, adminOnly);

// Runs whose build no longer belongs to any game (left behind by deleted games)
async function orphanFilter() {
  const paths = await Game.distinct("builds.path");
  return { buildPath: { $nin: paths } };
}

router.get("/stats", async (req, res) => {
  const [users, games, runs, pending, orphans] = await Promise.all([
    User.countDocuments(),
    Game.countDocuments(),
    Metric.countDocuments(),
    Game.countDocuments({ status: "pending" }),
    orphanFilter().then((f) => Metric.countDocuments(f)),
  ]);
  res.json({ users, games, runs, pending, orphans });
});

// Delete the orphaned runs
router.delete("/orphan-metrics", async (req, res) => {
  // Safety: with no games at all, every run would look orphaned, so refuse
  if ((await Game.countDocuments()) === 0)
    return res.status(400).json({ message: "There are no games, so nothing is deleted" });
  const result = await Metric.deleteMany(await orphanFilter());
  await audit.record(req, "runs.cleanup", { type: "runs", label: "orphaned test runs" }, `${result.deletedCount} deleted`);
  res.json({ deleted: result.deletedCount });
});

router.put("/games/:id/status", async (req, res) => {
  const { status, reason } = req.body;
  if (!["approved", "rejected", "pending"].includes(status))
    return res.status(400).json({ message: "Invalid status" });
  const game = await Game.findByIdAndUpdate(
    req.params.id,
    { status, rejectReason: status === "rejected" ? String(reason || "").slice(0, 300) : "" },
    { returnDocument: "after" }
  );
  if (!game) return res.status(404).json({ message: "Game not found" });
  const action = { approved: "game.approve", rejected: "game.reject", pending: "game.pending" }[status];
  await audit.record(req, action, { type: "game", id: game._id, label: game.title }, status === "rejected" ? String(reason || "") : "");
  res.json(game);
});

router.get("/users", async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();
  const counts = await Game.aggregate([{ $group: { _id: "$createdBy", n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(users.map((u) => ({ ...u, role: normalize(u.role), gamesCount: map[String(u._id)] || 0 })));
});

router.get("/games", async (req, res) => {
  const games = await Game.find().sort({ createdAt: -1 }).populate("createdBy", "username").lean();
  const counts = await Metric.aggregate([{ $group: { _id: "$buildPath", n: { $sum: 1 } } }]);
  const byPath = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const sums = await summaries(games);
  res.json(
    games.map((g, i) => ({
      ...g,
      summary: compact(sums[i]),
      testRuns: (g.builds || []).reduce((s, b) => s + (byPath[b.path] || 0), 0),
    }))
  );
});

router.put("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role))
    return res.status(400).json({ message: "Invalid role" });
  if (req.params.id === req.user.id)
    return res.status(400).json({ message: "You cannot change your own role" });
  const before = await User.findById(req.params.id).select("username role");
  if (!before) return res.status(404).json({ message: "User not found" });
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
  await audit.record(req, "user.role", { type: "user", id: user._id, label: user.username }, `${normalize(before.role)} to ${role}`);
  res.json(user);
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ message: "You cannot delete yourself" });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  await audit.record(req, "user.delete", { type: "user", id: user._id, label: user.username }, user.email);
  res.json({ message: "User deleted" });
});

// ---- Activity log ----
// Filter groups shown in the Activity tab
const CATEGORIES = new Map([
  ["games", /^(game|build)\./],
  ["users", /^user\./],
  ["reviews", /^review\./],
  ["runs", /^runs?\./],
  ["account", /^account\./],
]);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PAGE_SIZE = 25;

router.get("/activity", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = {};
    const category = CATEGORIES.get(String(req.query.category || ""));
    if (category) filter.action = { $regex: category };
    const q = String(req.query.q || "").trim().slice(0, 60);
    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ actorName: re }, { targetLabel: re }, { details: re }, { action: re }];
    }
    const [total, items] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch {
    res.status(400).json({ message: "Could not load the activity log" });
  }
});

module.exports = router;