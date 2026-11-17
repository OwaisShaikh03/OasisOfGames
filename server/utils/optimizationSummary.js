const fs = require("fs");
const path = require("path");
const Metric = require("../models/Metric");

const PUBLIC = path.join(__dirname, "..", "public");
const MB = 1048576;

// Fast 4G load estimate from this platform's own measurements (8 builds, 12-64 MB)
const estimate = (bytes) => 1.66 + 1.05 * (bytes / MB);
const mbf = (b) => (b / MB).toFixed(1) + " MB";

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Older games may have no recorded size: measure the folder once
const sizeCache = new Map();
function diskSize(rel) {
  if (sizeCache.has(rel)) return sizeCache.get(rel);
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += fs.statSync(p).size;
    }
  };
  try {
    const dir = path.join(PUBLIC, rel);
    if (fs.existsSync(dir)) walk(dir);
  } catch {}
  sizeCache.set(rel, total);
  return total;
}
const sizeOf = (b) => b.sizeBytes || diskSize(b.path);

const LABELS = { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Needs work" };
const HEADLINES = {
  excellent: "Loads quickly, even on mobile data.",
  good: "Loads reasonably fast on mobile data.",
  fair: "May feel slow on mobile data.",
  poor: "Slow to load. This game needs more optimization.",
};

function summarize(game, byPath) {
  const u = (game.builds || []).find((b) => b.version === "unoptimized");
  const o = (game.builds || []).find((b) => b.version === "optimized");
  if (!u || !o) return null;
  const su = sizeOf(u);
  const so = sizeOf(o);
  if (!su || !so) return null;

  const ru = byPath[u.path] || [];
  const ro = byPath[o.path] || [];
  const tests = Math.min(ru.length, ro.length);
  const measured = tests >= 3;
  const before = measured ? median(ru) : estimate(su);
  const after = measured ? median(ro) : estimate(so);
  const reduction = ((su - so) / su) * 100;
  const speedup = after > 0 ? before / after : 1;

  let rating;
  if (o.compression === "none") rating = "poor";
  else if (after <= 20) rating = "excellent";
  else if (after <= 35) rating = "good";
  else if (after <= 60) rating = "fair";
  else rating = "poor";
  if (reduction < 10 && (rating === "excellent" || rating === "good")) rating = "fair";

  const points = [];
  points.push(
    reduction > 0.5
      ? `The optimized version is ${Math.round(reduction)}% smaller to download (${mbf(so)} instead of ${mbf(su)}).`
      : `The optimized version is not smaller than the original (${mbf(so)}).`
  );
  if (speedup >= 1.2) points.push(`It loads about ${speedup.toFixed(1)} times faster than the original.`);
  points.push(
    o.compression !== "none"
      ? "Compression is on, so players download less data."
      : "Compression is off, so players download more data than they need to."
  );

  return {
    rating,
    ratingLabel: LABELS[rating],
    headline: HEADLINES[rating],
    basis: measured ? "measured" : "estimated",
    tests: measured ? tests : 0,
    size: { before: su, after: so, reductionPct: +reduction.toFixed(1) },
    load: { before: +before.toFixed(1), after: +after.toFixed(1), speedup: +speedup.toFixed(1) },
    points,
    note: measured
      ? `Based on ${tests} test runs per version on a simulated 4G connection.`
      : "Estimated from the download size. Not yet tested on a simulated 4G connection.",
  };
}

// One query for all games: median uses only runs labeled Fast 4G
async function summaries(games) {
  const paths = games.flatMap((g) => (g.builds || []).map((b) => b.path));
  const runs = paths.length
    ? await Metric.find({ network: "Fast 4G", verified: { $ne: false }, buildPath: { $in: paths } }, "buildPath loadTimeMs").lean()
    : [];
  const byPath = {};
  runs.forEach((r) => (byPath[r.buildPath] = byPath[r.buildPath] || []).push(r.loadTimeMs / 1000));
  return games.map((g) => summarize(g, byPath));
}

// Small version of a summary, used on the game lists
function compact(s) {
  return s
    ? {
        rating: s.rating,
        label: s.ratingLabel,
        loadAfter: s.load.after,
        reductionPct: s.size.reductionPct,
        basis: s.basis,
        sizeBefore: s.size.before,
        sizeAfter: s.size.after,
      }
    : null;
}

module.exports = { summaries, compact, sizeOf, median, estimate };