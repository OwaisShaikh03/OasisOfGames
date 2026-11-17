const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Game = require("../models/Game");
const { protect, developerOnly } = require("../middleware/auth");
const audit = require("../utils/audit");

const router = express.Router();
const PUBLIC = path.join(__dirname, "..", "public");
const BUILDS = path.join(PUBLIC, "builds");
const THUMBS = path.join(PUBLIC, "thumbnails");
fs.mkdirSync(THUMBS, { recursive: true });

// Limits for normal users (admins are not limited)
const MAX_USER_GAMES = 3;
const MAX_USER_ZIP = 150 * 1024 * 1024;
const MAX_ENTRIES = 8000;
// Only these file types may appear inside a build. To allow another type, add it here.
const ALLOWED = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".json", ".wasm", ".data", ".br", ".gz", ".unityweb", ".mem", ".symbols",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp",
  ".txt", ".xml", ".csv", ".bin", ".bundle", ".unity3d", ".assetbundle",
  ".mp3", ".ogg", ".wav", ".mp4", ".webm", ".ttf", ".otf", ".woff", ".woff2",
  "", // files without an extension
]);

const upload = multer({
  dest: path.join(__dirname, "..", "tmp"),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === "thumbnail") {
      const ok = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) && file.mimetype.startsWith("image/");
      return cb(ok ? null : new Error("Image must be PNG, JPG or WebP"), ok);
    }
    cb(ext === ".zip" ? null : new Error("Builds must be .zip files"), ext === ".zip");
  },
});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dirNameOf = (v) => (v === "unoptimized" ? "unopt" : "opt");
const folderOf = (game) => `${slug(game.title)}-${String(game._id).slice(-6)}`;
const isAdmin = (u) => u.role === "admin";
const canManage = (u, g) => u.role === "admin" || String(g.createdBy) === u.id;

function dirSize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? dirSize(p) : fs.statSync(p).size);
  }, 0);
}

function detectCompression(dest) {
  const bdir = path.join(dest, "Build");
  if (!fs.existsSync(bdir)) return "none";
  const names = fs.readdirSync(bdir);
  if (names.some((n) => n.endsWith(".br"))) return "brotli";
  if (names.some((n) => n.endsWith(".gz"))) return "gzip";
  return "none";
}

function unpackZip(zipFile, dest) {
  const zip = new AdmZip(zipFile);
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) throw new Error("Too many files in the zip");
  const total = entries.reduce((a, e) => a + e.header.size, 0);
  if (total > 1.5e9) throw new Error("Zip too large when unpacked");

    const bad = entries.find((e) => !e.isDirectory && !ALLOWED.has(path.extname(e.entryName).toLowerCase()));
  if (bad) throw new Error(`File type not allowed in a build: ${bad.entryName}`);

  const idx = entries.find(
    (e) => /(^|\/)index\.html$/.test(e.entryName) && e.entryName.split("/").length <= 2
  );
  if (!idx) throw new Error("index.html not found in the zip");
  const prefix = idx.entryName.slice(0, idx.entryName.length - "index.html".length);

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const e of entries) {
    if (e.isDirectory || !e.entryName.startsWith(prefix)) continue;
    const out = path.join(dest, e.entryName.slice(prefix.length));
    if (!out.startsWith(dest + path.sep)) continue; // block path tricks
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, e.getData());
  }
}

function installBuild(game, version, zipFile) {
  const existing = game.builds.find((b) => b.version === version);
  const rel = existing ? existing.path : `/builds/${folderOf(game)}/${dirNameOf(version)}`;
  const dest = path.join(PUBLIC, rel);
  if (!dest.startsWith(BUILDS + path.sep)) throw new Error("Bad build path");

  unpackZip(zipFile, dest);
  const entry = {
    version,
    path: rel,
    sizeBytes: dirSize(dest),
    compression: detectCompression(dest),
    notes: "",
  };
  game.builds = game.builds.filter((b) => b.version !== version);
  game.builds.push(entry);
  return entry;
}

function saveThumbnail(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error("Image must be under 2 MB");
  const name = crypto.randomBytes(8).toString("hex") + path.extname(file.originalname).toLowerCase();
  fs.renameSync(file.path, path.join(THUMBS, name));
  return `/thumbnails/${name}`;
}

function removeThumbnail(url) {
  if (!url || !url.startsWith("/thumbnails/")) return;
  fs.rmSync(path.join(THUMBS, path.basename(url)), { force: true });
}

// Create a game with BOTH builds and an optional image (any logged-in user)
router.post(
  "/new",
  protect,
  developerOnly,
  upload.fields([
    { name: "unoptimized", maxCount: 1 },
    { name: "optimized", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files || {};
    const tmpFiles = []
      .concat(files.unoptimized || [], files.optimized || [], files.thumbnail || [])
      .map((f) => f.path);
    let game;
    try {
      if (!files.unoptimized || !files.optimized)
        return res.status(400).json({ message: "Both builds (unoptimized and optimized zips) are required" });
      const { title, description, category, dimension, complexity, source } = req.body;
      if (!title || !dimension)
        return res.status(400).json({ message: "Title and dimension are required" });

      if (!isAdmin(req.user)) {
        const owned = await Game.countDocuments({ createdBy: req.user.id });
        if (owned >= MAX_USER_GAMES)
          return res.status(400).json({ message: `You can have at most ${MAX_USER_GAMES} games` });
        if (files.unoptimized[0].size > MAX_USER_ZIP || files.optimized[0].size > MAX_USER_ZIP)
          return res.status(400).json({ message: "Each zip must be under 150 MB" });
      }

      game = new Game({
        title, description, category, dimension, complexity, source,
        createdBy: req.user.id,
        status: isAdmin(req.user) ? "approved" : "pending",
      });
      await game.validate();
      if (files.thumbnail) game.thumbnail = saveThumbnail(files.thumbnail[0]);
      installBuild(game, "unoptimized", files.unoptimized[0].path);
      installBuild(game, "optimized", files.optimized[0].path);
      await game.save();
      await audit.record(req, "game.create", { type: "game", id: game._id, label: game.title },
      game.status === "pending" ? "waiting for approval" : "approved automatically");
      res.status(201).json(game);
    } catch (err) {
      if (game) {
        fs.rmSync(path.join(BUILDS, folderOf(game)), { recursive: true, force: true });
        removeThumbnail(game.thumbnail);
      }
      res.status(400).json({ message: err.message });
    } finally {
      tmpFiles.forEach((p) => fs.rm(p, { force: true }, () => {}));
    }
  }
);

// Set or change the image of a game (owner or admin). Must stay above /:gameId/:version
router.post("/:gameId/thumbnail", protect, upload.single("thumbnail"), async (req, res) => {
  const tmp = req.file && req.file.path;
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    const game = await Game.findById(req.params.gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json({ message: "Not allowed" });
    const old = game.thumbnail;
    game.thumbnail = saveThumbnail(req.file);
    await game.save();
    removeThumbnail(old);
    res.json({ thumbnail: game.thumbnail });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    if (tmp) fs.rm(tmp, { force: true }, () => {});
  }
});

// Upload one build of an existing game (owner or admin)
router.post("/:gameId/:version", protect, developerOnly, upload.single("build"), async (req, res) => {
  const tmpFile = req.file && req.file.path;
  try {
    const { gameId, version } = req.params;
    if (!["unoptimized", "optimized"].includes(version))
      return res.status(400).json({ message: "Version must be unoptimized or optimized" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded (field name: build)" });
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!canManage(req.user, game)) return res.status(403).json({ message: "Not allowed" });
    if (!isAdmin(req.user) && req.file.size > MAX_USER_ZIP)
      return res.status(400).json({ message: "Each zip must be under 150 MB" });

    const entry = installBuild(game, version, tmpFile);
    if (!isAdmin(req.user)) {
      game.status = "pending"; // changed code needs a new review
      game.rejectReason = "";
    }
    await game.save();
    await audit.record(req, "build.upload", { type: "game", id: game._id, label: game.title },
      `${version} build${!isAdmin(req.user) ? ", sent back for approval" : ""}`);
    res.json({ message: "Build uploaded", build: entry, status: game.status });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    if (tmpFile) fs.rm(tmpFile, { force: true }, () => {});
  }
});

// Turn upload errors (wrong file type etc.) into clear messages
router.use((err, req, res, next) => {
  res.status(400).json({ message: err.message });
});

module.exports = router;