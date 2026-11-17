const fs = require("fs");
const path = require("path");

const MB = 1048576;

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push({ rel: path.relative(base, p).split(path.sep).join("/"), size: fs.statSync(p).size });
  }
  return out;
}

const item = (level, title, detail, fix = "") => ({ level, title, detail, fix });
const fmt = (b) => (b / MB).toFixed(1) + " MB";

// Fast 4G load estimate from this platform's own measurements (8 builds, 12-64 MB)
const estimateFast4g = (bytes) => +(1.66 + 1.05 * (bytes / MB)).toFixed(1);

function buildReport(dir) {
  const files = walk(dir);
  const total = files.reduce((s, f) => s + f.size, 0);
  const inBuild = files.filter((f) => f.rel.startsWith("Build/"));
  const sizeOf = (re) => inBuild.filter((f) => re.test(f.rel)).reduce((s, f) => s + f.size, 0);
  const data = sizeOf(/\.data(\.br|\.gz|\.unityweb)?$/);
  const wasm = sizeOf(/\.wasm(\.br|\.gz|\.unityweb)?$/);

  let compression = "none";
  if (inBuild.some((f) => f.rel.endsWith(".br"))) compression = "brotli";
  else if (inBuild.some((f) => f.rel.endsWith(".gz"))) compression = "gzip";

  const items = [];

  if (!inBuild.length)
    items.push(item("bad", "No Build folder found", "This does not look like a Unity WebGL build.",
      "Upload the zip of the folder Unity created (it contains index.html, Build and TemplateData)."));

  // Compression
  if (compression === "brotli")
    items.push(item("ok", "Brotli compression enabled", "Build files are Brotli-compressed."));
  else if (compression === "gzip")
    items.push(item("warn", "Gzip compression: Brotli is usually smaller",
      "Gzip works everywhere, but Brotli normally compresses Unity builds better.",
      "Player Settings > Publishing Settings > Compression Format = Brotli (needs HTTPS or localhost)."));
  else
    items.push(item("bad", "Build files are not compressed",
      "The full uncompressed size is sent to every player.",
      "Player Settings > Publishing Settings > Compression Format = Brotli. On this platform Brotli cut transfer size by 71-79% in four test games."));

  // Total size
  const sizeText = `Total transfer size: ${fmt(total)}.`;
  if (total > 100 * MB)
    items.push(item("bad", "Very large build", sizeText, "Large builds load slowly on mobile and 4G. Remove unused assets, compress textures and audio."));
  else if (total > 30 * MB)
    items.push(item("warn", "Large build", sizeText, "Try compression, texture and audio compression, and removing unused assets."));
  else
    items.push(item("ok", "Build size is reasonable", sizeText));

  // Asset data
  if (data > 20 * MB && data / total > 0.4)
    items.push(item("warn", "Asset data dominates the build",
      `The .data file is ${fmt(data)} (${Math.round((data / total) * 100)}% of the build).`,
      "Use compressed texture formats, lower texture sizes, compressed audio, and remove unused assets. Consider Addressables for rarely used content."));

  // Code size
  if (wasm > 20 * MB)
    items.push(item("warn", "Large WebAssembly code file",
      `The .wasm file is ${fmt(wasm)}.`,
      "Set Managed Stripping Level to High, enable Strip Engine Code, and remove unused packages and engine modules."));

  // Big loose files outside Build
  const big = files.filter((f) => !f.rel.startsWith("Build/") && f.size > 10 * MB);
  if (big.length)
    items.push(item("warn", "Large files outside the Build folder",
      big.slice(0, 3).map((f) => `${f.rel} (${fmt(f.size)})`).join(", "),
      "Large StreamingAssets files are downloaded on demand and can slow gameplay. Compress or trim them."));

  // Load estimate
  const est = estimateFast4g(total);
  const inRange = total >= 11 * MB && total <= 66 * MB;
  const estDetail =
    `Estimated about ${est} s on a simulated Fast 4G connection (9 Mbps). ` +
    (inRange
      ? "Based on this platform's measurements of four Unity games."
      : "Outside the size range we measured (12-64 MB): treat this as a rough guide.");
  items.push(item(est < 20 ? "ok" : est < 45 ? "warn" : "bad", "Estimated load time", estDetail));

  const counts = { ok: 0, warn: 0, bad: 0 };
  items.forEach((i) => counts[i.level]++);
  return { totalBytes: total, dataBytes: data, wasmBytes: wasm, compression, estimatedFast4gSeconds: est, items, counts };
}

function compareReports(u, o) {
  if (!u || !o) return null;
  const pct = ((u.totalBytes - o.totalBytes) / u.totalBytes) * 100;
  const saved = +(u.estimatedFast4gSeconds - o.estimatedFast4gSeconds).toFixed(1);
  let level = "ok";
  let title = `The optimized build is ${pct.toFixed(1)}% smaller`;
  if (pct <= 0) { level = "bad"; title = "The optimized build is not smaller than the unoptimized one"; }
  else if (pct < 20) { level = "warn"; title = `The optimized build is only ${pct.toFixed(1)}% smaller`; }
  return {
    sizeReductionPct: +pct.toFixed(1),
    estimatedSecondsSavedFast4g: saved,
    item: item(level, title,
      `Estimated time saved on Fast 4G: about ${saved} s.`,
      level === "ok" ? "" : "Check that the optimized build uses Brotli compression and the same content as the unoptimized one."),
  };
}

module.exports = { buildReport, compareReports };