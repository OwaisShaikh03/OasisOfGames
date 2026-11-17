const express = require("express");
const Game = require("../models/Game");
const Metric = require("../models/Metric");
const { protect } = require("../middleware/auth");
const { sizeOf, median, estimate } = require("../utils/optimizationSummary");

const router = express.Router();
router.use(protect);

const MB = 1048576;

// Size and Fast 4G load time for one build.
// Load time = median of counted Fast 4G runs (3 or more), otherwise estimated from size.
function buildInfo(build, runs) {
  if (!build) return null;
  const sizeBytes = sizeOf(build);
  const counted = runs
    .filter((r) => r.network === "Fast 4G" && r.verified !== false)
    .map((r) => r.loadTimeMs / 1000);
  const measured = counted.length >= 3;
  const loadSec = measured ? median(counted) : sizeBytes ? estimate(sizeBytes) : null;
  return {
    sizeBytes,
    loadSec: loadSec == null ? null : +loadSec.toFixed(1),
    basis: measured ? "measured" : "estimated",
    countedRuns: counted.length,
    totalRuns: runs.length,
  };
}

// Budgets apply to the optimized build
function check(budget, info) {
  const result = { size: null, load: null, overall: "none" };
  if (!info) return result;
  if (budget.maxSizeMB != null && info.sizeBytes)
    result.size = info.sizeBytes / MB <= budget.maxSizeMB ? "pass" : "fail";
  if (budget.maxLoadSec != null && info.loadSec != null)
    result.load = info.loadSec <= budget.maxLoadSec ? "pass" : "fail";
  const parts = [result.size, result.load].filter(Boolean);
  if (parts.length) result.overall = parts.includes("fail") ? "fail" : "pass";
  return result;
}

// The logged-in user's games with budget results
router.get("/", async (req, res) => {
  try {
    const games = await Game.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).lean();
    const paths = games.flatMap((g) => (g.builds || []).map((b) => b.path));
    const runs = paths.length
      ? await Metric.find({ buildPath: { $in: paths } }, "buildPath network verified loadTimeMs").lean()
      : [];
    const byPath = {};
    runs.forEach((r) => (byPath[r.buildPath] = byPath[r.buildPath] || []).push(r));

    res.json(
      games.map((g) => {
        const budget = {
          maxSizeMB: g.budget?.maxSizeMB ?? null,
          maxLoadSec: g.budget?.maxLoadSec ?? null,
        };
        const find = (v) => (g.builds || []).find((b) => b.version === v);
        const u = find("unoptimized");
        const o = find("optimized");
        const optimized = buildInfo(o, o ? byPath[o.path] || [] : []);
        return {
          _id: g._id,
          title: g.title,
          status: g.status,
          thumbnail: g.thumbnail,
          createdAt: g.createdAt,
          budget,
          builds: {
            unoptimized: buildInfo(u, u ? byPath[u.path] || [] : []),
            optimized,
          },
          check: check(budget, optimized),
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// A blank value clears the budget; otherwise it must be a number in range
function parse(v, min, max) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

// Set the budget (owner or admin)
router.put("/:id/budget", async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (req.user.role !== "admin" && String(game.createdBy) !== req.user.id)
      return res.status(403).json({ message: "Not allowed" });

    const maxSizeMB = parse(req.body.maxSizeMB, 0.1, 2000);
    const maxLoadSec = parse(req.body.maxLoadSec, 1, 3600);
    if (maxSizeMB === undefined) return res.status(400).json({ message: "Size budget must be between 0.1 and 2000 MB" });
    if (maxLoadSec === undefined) return res.status(400).json({ message: "Load time budget must be between 1 and 3600 seconds" });

    game.budget = { maxSizeMB, maxLoadSec };
    await game.save();
    res.json({ maxSizeMB, maxLoadSec });
  } catch {
    res.status(400).json({ message: "Could not save budget" });
  }
});

module.exports = router;