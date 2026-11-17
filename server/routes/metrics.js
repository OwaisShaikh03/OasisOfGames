const express = require("express");
const Metric = require("../models/Metric");
const Game = require("../models/Game");
const { protect, adminOnly } = require("../middleware/auth");
const audit = require("../utils/audit");
const User = require("../models/User");
const runToken = require("../utils/runToken");

const router = express.Router();
const NETS = ["no throttle", "Fast 4G", "Slow 4G", "unspecified"];
const BROWSERS = ["Chrome", "Firefox", "Edge", "Safari", "Other"];
// A missing value (null) stays missing instead of becoming 0
const num = (v, min, max) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

// Simple per-IP limit: 60 runs per 10 minutes
const hits = new Map();
// Drop IPs with no recent runs so the map cannot grow forever
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [ip, list] of hits) {
    const recent = list.filter((t) => t > cutoff);
    if (recent.length) hits.set(ip, recent);
    else hits.delete(ip);
  }
}, 5 * 60 * 1000).unref();
function limiter(req, res, next) {
  const now = Date.now();
  const list = (hits.get(req.ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 60) return res.status(429).json({ message: "Too many runs. Try again later." });
  list.push(now);
  hits.set(req.ip, list);
  next();
}

// A tester asks for a short-lived code before opening a game, so that their runs carry their name.
// Everyone else gets no code (their runs stay anonymous).
router.get("/run-token", protect, (req, res) => {
  res.json({ token: req.user.role === "tester" ? runToken.sign(req.user.id) : null });
});

// Tester dashboard: return only the logged-in tester's own recorded runs.
router.get("/mine", protect, async (req, res) => {
  try {
    if (req.user.role !== "tester") {
      return res.status(403).json({
        message: "Test Runs is available to tester accounts only",
      });
    }

    const metrics = await Metric.find({ tester: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    if (!metrics.length) {
      return res.json({
        summary: {
          gamesTested: 0,
          totalRuns: 0,
          verifiedRuns: 0,
          unverifiedRuns: 0,
          optimizedRuns: 0,
          unoptimizedRuns: 0,
        },
        games: [],
      });
    }

    const paths = [...new Set(metrics.map((m) => m.buildPath))];

    const gamesFound = await Game.find({
      "builds.path": { $in: paths },
    })
      .populate("createdBy", "username")
      .lean();

    // Match every build path to its game and optimization version.
    const gameByPath = new Map();

    for (const game of gamesFound) {
      for (const build of game.builds || []) {
        gameByPath.set(build.path, {
          game,
          version: build.version,
        });
      }
    }

    const grouped = new Map();

    for (const metric of metrics) {
      const match = gameByPath.get(metric.buildPath);

      // Ignore records whose game/build no longer exists.
      if (!match) continue;

      const { game, version } = match;
      const gameId = String(game._id);

      if (!grouped.has(gameId)) {
        grouped.set(gameId, {
          gameId,
          title: game.title,
          thumbnail: game.thumbnail || "",
          category: game.category || "General",
          dimension: game.dimension || "",
          developer: game.createdBy?.username || "Unknown",
          lastRun: metric.createdAt,
          _optimized: [],
          _unoptimized: [],
          runs: [],
        });
      }

      const entry = grouped.get(gameId);

      if (new Date(metric.createdAt) > new Date(entry.lastRun)) {
        entry.lastRun = metric.createdAt;
      }

      const run = {
        id: String(metric._id),
        createdAt: metric.createdAt,
        version,
        network: metric.network || "unspecified",
        loadTimeMs: metric.loadTimeMs ?? null,
        transferBytes: metric.transferBytes ?? null,
        avgFps: metric.avgFps ?? null,
        minFps: metric.minFps ?? null,
        low1Fps: metric.low1Fps ?? null,
        frameCount: metric.frameCount ?? null,
        avgFrameMs: metric.avgFrameMs ?? null,
        jsHeapMB: metric.jsHeapMB ?? null,
        browser: metric.browser || "Other",
        deviceType: metric.deviceType || "desktop",
        cores: metric.cores ?? null,
        screen: metric.screen || "",
        verified: metric.verified !== false,
        verifyNote: metric.verifyNote || "",
      };

      entry.runs.push(run);

      if (version === "optimized") {
        entry._optimized.push(run);
      } else if (version === "unoptimized") {
        entry._unoptimized.push(run);
      }
    }

    // Average only verified runs, so unreliable cached runs don't distort results.
    const average = (rows, field) => {
      const values = rows
        .map((row) => row[field])
        .filter((value) => Number.isFinite(value));

      if (!values.length) return null;

      return Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
      );
    };

    const summarizeVersion = (rows) => {
  const counted = rows.filter((row) => row.verified);

  const networkNames = [...new Set(rows.map((row) => row.network))];

  const byNetwork = networkNames.map((network) => {
    const networkRows = rows.filter((row) => row.network === network);
    const networkCounted = networkRows.filter((row) => row.verified);

    return {
      network,
      totalRuns: networkRows.length,
      countedRuns: networkCounted.length,
      avgLoadTimeMs: average(networkCounted, "loadTimeMs"),
      avgFps: average(networkCounted, "avgFps"),
      avgLow1Fps: average(networkCounted, "low1Fps"),
    };
  });

  return {
    totalRuns: rows.length,
    countedRuns: counted.length,
    uncountedRuns: rows.length - counted.length,
    avgLoadTimeMs: average(counted, "loadTimeMs"),
    avgFps: average(counted, "avgFps"),
    avgMinFps: average(counted, "minFps"),
    avgLow1Fps: average(counted, "low1Fps"),
    avgHeapMB: average(counted, "jsHeapMB"),
    byNetwork,
  };
};

    const resultGames = [...grouped.values()]
      .map((entry) => {
        const {
          _optimized,
          _unoptimized,
          ...game
        } = entry;

        return {
          ...game,
          totalRuns: game.runs.length,
          verifiedRuns: game.runs.filter((r) => r.verified).length,
          unverifiedRuns: game.runs.filter((r) => !r.verified).length,
          versions: {
            optimized: summarizeVersion(_optimized),
            unoptimized: summarizeVersion(_unoptimized),
          },
        };
      })
      .sort((a, b) => new Date(b.lastRun) - new Date(a.lastRun));

    const summary = resultGames.reduce(
      (total, game) => {
        total.gamesTested += 1;
        total.totalRuns += game.totalRuns;
        total.verifiedRuns += game.verifiedRuns;
        total.unverifiedRuns += game.unverifiedRuns;
        total.optimizedRuns += game.versions.optimized.totalRuns;
        total.unoptimizedRuns += game.versions.unoptimized.totalRuns;
        return total;
      },
      {
        gamesTested: 0,
        totalRuns: 0,
        verifiedRuns: 0,
        unverifiedRuns: 0,
        optimizedRuns: 0,
        unoptimizedRuns: 0,
      }
    );

    res.json({
      summary,
      games: resultGames,
    });
  } catch (err) {
    console.error("Tester runs error:", err);
    res.status(500).json({
      message: "Could not load your test runs",
    });
  }
});

// The logger inside the game page posts here (no login needed)
router.post("/", limiter, async (req, res) => {
  try {
    const b = req.body || {};
    const game = typeof b.buildPath === "string"
      ? await Game.findOne({ "builds.path": b.buildPath }, "builds")
      : null;
    if (!game) return res.status(400).json({ message: "Unknown build" });
    const build = game.builds.find((x) => x.path === b.buildPath);

    const loadTimeMs = num(b.loadTimeMs, 1, 3600000);
    if (loadTimeMs === undefined) return res.status(400).json({ message: "Invalid metric" });
    const transferBytes = num(b.transferBytes, 0, 5e9);
    const network = NETS.includes(b.network) ? b.network : "unspecified";

    // Who ran it? Only a valid, unexpired code from a CURRENT tester links a run to a name.
    // Anything else is saved as an anonymous run; a name typed into the request is never trusted.
    let tester = null;
    let testerNote = "";
    if (typeof b.testerToken === "string" && b.testerToken) {
      const userId = runToken.verify(b.testerToken.slice(0, 1000));
      const u = userId ? await User.findById(userId).select("username role") : null;
      if (u && u.role === "tester") tester = u;
      else testerNote = userId ? "this account is not a tester, so the run is anonymous" : "tester session expired, so the run is anonymous";
    }

    // Automatic check: is this run trustworthy?
    let verified = true;
    let reason = "";
    const mbps = transferBytes ? (transferBytes * 8) / 1e6 / (loadTimeMs / 1000) : 0;
    if (!transferBytes) {
      verified = false;
      reason = "files came from the browser cache (use a private window or a simulated connection)";
    } else if (build.sizeBytes && transferBytes < build.sizeBytes * 0.6) {
      verified = false;
      reason = "part of the game came from the browser cache";
    } else if (network === "Fast 4G" && (mbps < 4 || mbps > 11)) {
      verified = false;
      reason = "the speed did not match Fast 4G";
    } else if (network === "Slow 4G" && (mbps < 0.8 || mbps > 2.5)) {
      verified = false;
      reason = "the speed did not match Slow 4G";
    }

    const m = await Metric.create({
      buildPath: b.buildPath,
      loadTimeMs,
      transferBytes,
      decodedBytes: num(b.decodedBytes, 0, 5e9),
      avgFps: num(b.avgFps, 0, 1000),
      minFps: num(b.minFps, 0, 1000),
      low1Fps: num(b.low1Fps, 0, 1000),
      frameCount: num(b.frameCount, 0, 100000),
      avgFrameMs: num(b.avgFrameMs, 0, 100000),
      jsHeapMB: num(b.jsHeapMB, 0, 100000),
      browser: BROWSERS.includes(b.browser) ? b.browser : "Other",
      deviceType: b.deviceType === "mobile" ? "mobile" : "desktop",
      cores: num(b.cores, 1, 512),
      screen: String(b.screen || "").slice(0, 20),
      userAgent: String(b.userAgent || "").slice(0, 300),
      network,
      tester: tester ? tester._id : undefined,
      testerName: tester ? tester.username : undefined,
      verified,
      verifyNote: reason,
    });
    res.status(201).json({ id: m._id, verified, reason, tester: tester ? tester.username : null, testerNote });
  } catch {
    res.status(400).json({ message: "Invalid metric" });
  }
});

// Admin: raw list
router.get("/", protect, adminOnly, async (req, res) => {
  const filter = req.query.buildPath ? { buildPath: req.query.buildPath } : {};
  res.json(await Metric.find(filter).sort({ createdAt: -1 }).limit(500));
});

// Owner of the game or admin can manage a run
async function loadManaged(req, res) {
  const m = await Metric.findById(req.params.id);
  if (!m) { res.status(404).json({ message: "Run not found" }); return null; }
  const game = await Game.findOne({ "builds.path": m.buildPath });
  const ok = req.user.role === "admin" || (game && String(game.createdBy) === req.user.id);
  if (!ok) { res.status(403).json({ message: "Not allowed" }); return null; }
  return { m, game };
}

const runLabel = (game, m) =>
  `${game ? game.title : "deleted game"} (${m.network || "unspecified"}, ${(m.loadTimeMs / 1000).toFixed(1)} s)`;

router.delete("/:id", protect, async (req, res) => {
  try {
    const found = await loadManaged(req, res);
    if (!found) return;
    await found.m.deleteOne();
    await audit.record(req, "run.delete", { type: "run", id: found.m._id, label: runLabel(found.game, found.m) });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ message: "Invalid id" });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const found = await loadManaged(req, res);
    if (!found) return;
    if (!NETS.includes(req.body.network)) return res.status(400).json({ message: "Invalid condition" });
    const before = found.m.network || "unspecified";
    found.m.network = req.body.network;
    await found.m.save();
    await audit.record(req, "run.relabel", { type: "run", id: found.m._id, label: runLabel(found.game, found.m) }, `${before} to ${req.body.network}`);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ message: "Invalid id" });
  }
});

module.exports = router;