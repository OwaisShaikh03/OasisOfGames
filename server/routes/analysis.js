const express = require("express");
const Game = require("../models/Game");
const Metric = require("../models/Metric");
const { protect } = require("../middleware/auth");
const { describe, welch, outlierIndexes } = require("../utils/stats");

const router = express.Router();
router.use(protect);

const ORDER = ["no throttle", "Fast 4G", "Slow 4G", "unspecified"];
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

// Round every number in a describe() result
const tidy = (d) => (d ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, r3(v)])) : null);

// Welch test result for the client. Needs 3+ counted runs of each build.
function compareTest(u, o) {
  if (!u || !o || u.length < 3 || o.length < 3) return null;
  const t = welch(u, o);
  if (!t) return null;
  return { diff: r3(t.diff), p: r3(t.p), significant: t.p != null && t.p < 0.05 };
}

// Extra statistics for the Compare page (owner or admin)
router.get("/:id", async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (req.user.role !== "admin" && String(game.createdBy) !== req.user.id)
      return res.status(403).json({ message: "Not allowed" });

    const versionOf = Object.fromEntries(game.builds.map((b) => [b.path, b.version]));
    let metrics = await Metric.find({ buildPath: { $in: Object.keys(versionOf) } }).lean();
    // ?scope=testers: only runs saved under a tester's name
    if (req.query.scope === "testers") metrics = metrics.filter((m) => m.tester);

    // network -> version -> counted runs
    const cells = {};
    for (const m of metrics) {
      if (m.verified === false) continue;
      const net = m.network || "unspecified";
      cells[net] = cells[net] || { unoptimized: [], optimized: [] };
      cells[net][versionOf[m.buildPath]].push(m);
    }

    const outliers = [];
    const side = (runs) => {
      if (!runs.length) return null;
      const loads = runs.map((m) => m.loadTimeMs / 1000);
      outlierIndexes(loads).forEach((i) => outliers.push(String(runs[i]._id)));
      return {
        n: runs.length,
        load: tidy(describe(loads)),
        fps: tidy(describe(runs.map((m) => m.avgFps))),
        low1: tidy(describe(runs.map((m) => m.low1Fps))),
        heap: tidy(describe(runs.map((m) => m.jsHeapMB))),
      };
    };

    const groups = Object.keys(cells)
      .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
      .map((network) => {
        const { unoptimized: u, optimized: o } = cells[network];
        const loadsU = u.map((m) => m.loadTimeMs / 1000);
        const loadsO = o.map((m) => m.loadTimeMs / 1000);
        return {
          network,
          unoptimized: side(u),
          optimized: side(o),
          tests: {
            load: compareTest(loadsU, loadsO),
            fps: compareTest(u.map((m) => m.avgFps).filter(Number.isFinite), o.map((m) => m.avgFps).filter(Number.isFinite)),
            low1: compareTest(u.map((m) => m.low1Fps).filter(Number.isFinite), o.map((m) => m.low1Fps).filter(Number.isFinite)),
          },
        };
      });

    res.json({ groups, outliers });
  } catch {
    res.status(400).json({ message: "Could not analyze the runs" });
  }
});

module.exports = router;