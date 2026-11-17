const express = require("express");
const fs = require("fs");
const path = require("path");
const Game = require("../models/Game");
const Metric = require("../models/Metric");
const Review = require("../models/Review");
const { protect, optionalAuth } = require("../middleware/auth");
const { buildReport, compareReports } = require("../utils/buildReport");
const { summaries, compact } = require("../utils/optimizationSummary");
const audit = require("../utils/audit");

const router = express.Router();
const PUBLIC = path.join(__dirname, "..", "public");
const BUILDS = path.join(PUBLIC, "builds");
const THUMBS = path.join(PUBLIC, "thumbnails");

const ownerId = (g) => String(g.createdBy?._id || g.createdBy);
const canManage = (u, g) => u && (u.role === "admin" || ownerId(g) === u.id);
const visible = { status: { $nin: ["pending", "rejected"] } };
const NO_ACCESS = { message: "Only the game owner or an admin can view this" };

function safeRemove(base, rel) {
  const target = path.join(PUBLIC, rel);
  if (!target.startsWith(base + path.sep)) return; // never delete outside the allowed folder
  fs.rmSync(target, { recursive: true, force: true });
}

const stat = (arr) => {
  const a = arr.filter(Number.isFinite);
  if (!a.length) return null;
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / (a.length - 1)) : 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return { mean, sd, median };
};
const round = (x, d = 1) => (x == null ? null : +x.toFixed(d));

// Public list: approved games only, with a small optimization rating
router.get("/", async (req, res) => {
  try {
    const { search, category, dimension } = req.query;
    const filter = { ...visible };
    if (search)
      filter.title = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (category) filter.category = category;
    if (dimension) filter.dimension = dimension;
    const games = await Game.find(filter).sort({ createdAt: -1 }).populate("createdBy", "username").lean();
    const sums = await summaries(games);
    res.json(games.map((g, i) => ({ ...g, summary: compact(sums[i]) })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// The logged-in user's own games (all statuses). Must stay above "/:id"
router.get("/mine", protect, async (req, res) => {
  try {
    const games = await Game.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).lean();
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
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Plain-language summary: visible to everyone who can see the game
router.get("/:id/summary", optionalAuth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id).lean();
    if (!game) return res.status(404).json({ message: "Game not found" });
    const hidden = ["pending", "rejected"].includes(game.status);
    if (hidden && !canManage(req.user, game)) return res.status(404).json({ message: "Game not found" });
    const [s] = await summaries([game]);
    res.json(s);
  } catch {
    res.status(400).json({ message: "Could not load summary" });
  }
});

// Detailed build report: owner or admin only
router.get("/:id/report", protect, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json(NO_ACCESS);

    const builds = {};
    for (const b of game.builds) {
      const dir = path.join(PUBLIC, b.path);
      if (!dir.startsWith(BUILDS + path.sep) || !fs.existsSync(dir)) continue;
      builds[b.version] = buildReport(dir);
    }
    res.json({ builds, comparison: compareReports(builds.unoptimized, builds.optimized) });
  } catch {
    res.status(400).json({ message: "Could not analyze build" });
  }
});

// Compare data: owner or admin only
router.get("/:id/compare", protect, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json(NO_ACCESS);

    const versionOf = Object.fromEntries(game.builds.map((b) => [b.path, b.version]));
    const metrics = await Metric.find({ buildPath: { $in: Object.keys(versionOf) } })
      .sort({ createdAt: -1 }).lean();

    // "all" = every run; "testers" = only runs saved under a tester's name
    const scope = req.query.scope === "testers" ? "testers" : "all";
    const testerRuns = metrics.filter((m) => m.tester);
    const pool = scope === "testers" ? testerRuns : metrics;

    // One row per tester who has run this game
    const byTester = new Map();
    for (const m of testerRuns) {
      const k = String(m.tester);
      const t = byTester.get(k) || { name: m.testerName || "tester", runs: 0, counted: 0, browsers: new Set(), devices: new Set(), last: null };
      t.runs += 1;
      if (m.verified !== false) t.counted += 1;
      if (m.browser) t.browsers.add(m.browser);
      if (m.deviceType) t.devices.add(m.deviceType);
      if (!t.last || m.createdAt > t.last) t.last = m.createdAt;
      byTester.set(k, t);
    }
    const testers = [...byTester.values()]
      .map((t) => ({ ...t, browsers: [...t.browsers], devices: [...t.devices] }))
      .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));

    const nets = {};
    for (const m of pool) {
      if (m.verified === false) continue;
      const v = versionOf[m.buildPath];
      const n = m.network || "unspecified";
      nets[n] = nets[n] || { unoptimized: [], optimized: [] };
      nets[n][v].push(m);
    }
    const summarize = (rows) =>
      rows.length
        ? {
            n: rows.length,
            load: stat(rows.map((r) => r.loadTimeMs / 1000)),
            fps: stat(rows.map((r) => r.avgFps)),
            heap: stat(rows.map((r) => r.jsHeapMB)),
          }
        : null;
    const pct = (a, b) => (a && b && a.mean ? ((b.mean - a.mean) / a.mean) * 100 : null);

    const order = ["no throttle", "Fast 4G", "Slow 4G", "unspecified"];
    const groups = Object.keys(nets)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((network) => {
        const u = summarize(nets[network].unoptimized);
        const o = summarize(nets[network].optimized);
        return {
          network, unoptimized: u, optimized: o,
          change: { load: round(pct(u?.load, o?.load)), fps: round(pct(u?.fps, o?.fps)) },
        };
      });

    const ub = game.builds.find((b) => b.version === "unoptimized");
    const ob = game.builds.find((b) => b.version === "optimized");
    res.json({
      title: game.title,
      scope,
      testerCount: testers.length,
      testers,
      builds: game.builds,
      sizeChange: ub && ob ? round(((ob.sizeBytes - ub.sizeBytes) / ub.sizeBytes) * 100) : null,
      groups,
      canExport: true,
      runs: pool.slice(0, 300).map((m) => ({
        _id: m._id, createdAt: m.createdAt, version: versionOf[m.buildPath],
        network: m.network || "unspecified", loadTimeMs: m.loadTimeMs,
        transferBytes: m.transferBytes, avgFps: m.avgFps, low1Fps: m.low1Fps, browser: m.browser, testerName: m.testerName || "",
        verified: m.verified !== false, note: m.verifyNote || "",
      })),
    });
  } catch {
    res.status(400).json({ message: "Could not load comparison" });
  }
});

// CSV of raw runs (owner or admin)
router.get("/:id/metrics.csv", protect, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json(NO_ACCESS);

    const byPath = Object.fromEntries(game.builds.map((b) => [b.path, b]));
    const metrics = await Metric.find({ buildPath: { $in: Object.keys(byPath) } }).sort({ createdAt: 1 }).lean();
    const header = "date,build,compression,network,browser,device,load_ms,transfer_mb,avg_fps,min_fps,low1_fps,frames,frame_ms,heap_mb,tester";
    const cell = (v) => (v == null ? "" : String(v).replace(/[",\r\n]/g, " "));
    const rows = metrics.map((m) => {
      const b = byPath[m.buildPath];
      return [
        new Date(m.createdAt).toISOString(), b.version, b.compression, m.network || "unspecified",
        m.browser, m.deviceType, m.loadTimeMs,
        m.transferBytes == null ? "" : (m.transferBytes / 1048576).toFixed(2),
        m.avgFps, m.minFps, m.low1Fps, m.frameCount, m.avgFrameMs, m.jsHeapMB, m.testerName,
      ].map(cell).join(",");
    });
    const name = game.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "game";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${name}-runs.csv"`);
    res.send([header, ...rows].join("\n"));
  } catch {
    res.status(400).json({ message: "Could not export" });
  }
});

// One game: pending/rejected ones are visible only to the owner and admins
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id).populate("createdBy", "username");
    if (!game) return res.status(404).json({ message: "Game not found" });
    const hidden = ["pending", "rejected"].includes(game.status);
    if (hidden && !canManage(req.user, game))
      return res.status(404).json({ message: "Game not found" });
    res.json(game);
  } catch {
    res.status(400).json({ message: "Invalid game id" });
  }
});

// Edit details (owner or admin; only these fields)
router.put("/:id", protect, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json({ message: "Not allowed" });
    const changed = [];
    ["title", "description", "category", "dimension", "complexity", "source"].forEach((k) => {
      if (req.body[k] !== undefined) {
        if (String(game[k]) !== String(req.body[k])) changed.push(k);
        game[k] = req.body[k];
      }
    });
    await game.save();
    if (changed.length)
      await audit.record(req, "game.update", { type: "game", id: game._id, label: game.title }, `changed: ${changed.join(", ")}`);
    res.json(game);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete the game and its files (owner or admin)
router.delete("/:id", protect, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json({ message: "Not allowed" });

    for (const b of game.builds) {
      safeRemove(BUILDS, b.path);
      const parent = path.dirname(path.join(PUBLIC, b.path));
      if (parent.startsWith(BUILDS + path.sep) && fs.existsSync(parent) && fs.readdirSync(parent).length === 0)
        fs.rmdirSync(parent);
    }
    if (game.thumbnail) safeRemove(THUMBS, game.thumbnail);

    await Metric.deleteMany({ buildPath: { $in: game.builds.map((b) => b.path) } });
    await Review.deleteMany({ game: game._id });
    await game.deleteOne();
    await audit.record(req, "game.delete", { type: "game", id: game._id, label: game.title });
    res.json({ message: "Game and its files deleted" });
  } catch {
    res.status(400).json({ message: "Could not delete game" });
  }
});

// Count a play (once per browser session per game, from the client)
router.post("/:id/play", async (req, res) => {
  try {
    await Game.findByIdAndUpdate(req.params.id, { $inc: { playCount: 1 } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ message: "Invalid game id" });
  }
});

module.exports = router;