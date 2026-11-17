const express = require("express");
const fs = require("fs");
const path = require("path");


const ROOT = path.join(__dirname, "..", "public", "builds");
const TAG = '<script src="/builds/logger.js"></script>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withLogger = (html) =>
  html.includes("/builds/logger.js") ? html : html.replace("</body>", TAG + "</body>");

// Content headers for Unity's compressed files
function typeHeaders(res, rel) {
  if (rel.endsWith(".br")) res.set("Content-Encoding", "br");
  else if (rel.endsWith(".gz")) res.set("Content-Encoding", "gzip");
  const base = rel.replace(/\.(br|gz)$/, "");
  if (base.endsWith(".wasm")) res.type("application/wasm");
  else if (base.endsWith(".js")) res.type("application/javascript");
  else if (base.endsWith(".data")) res.type("application/octet-stream");
}

// Normal connection: index.html gets the logger, everything else is static.
// With { fresh: true } nothing is cached by the browser, so every run is a full download.
function plain({ fresh = false } = {}) {
  const r = express.Router();
  if (fresh) {
    r.use((req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    });
  }
  r.use((req, res, next) => {
    let p = req.path;
    if (p.endsWith("/")) p += "index.html";
    if (!p.endsWith("/index.html")) return next();
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) return next();
    fs.readFile(file, "utf8", (err, html) => {
      if (err) return next();
      res.type("html").send(withLogger(html));
    });
  });
  r.use(
    (req, res, next) => {
      typeHeaders(res, req.path);
      next();
    },
    express.static(ROOT, fresh ? { etag: false, lastModified: false } : {})
  );
  return r;
}

// Resolves true once the response has drained (safe to keep writing), or false if the client
// closed the connection first. Every listener it adds is removed again when the wait ends, so
// repeated backpressure waits never pile up on the same response.
function waitForDrainOrClose(res) {
  return new Promise((resolve, reject) => {
    if (res.destroyed || res.writableEnded) return resolve(false);

    const cleanup = () => {
      res.removeListener("drain", onDrain);
      res.removeListener("close", onClose);
      res.removeListener("error", onError);
    };
    const onDrain = () => { cleanup(); resolve(true); };
    const onClose = () => { cleanup(); resolve(false); };
    const onError = (err) => { cleanup(); reject(err); };

    res.once("drain", onDrain);
    res.once("close", onClose);
    res.once("error", onError);
  });
}

// Simulated connection: limited shared bandwidth, added latency, never cached
function simulated({ mbps, latencyMs }) {
  const bps = (mbps * 1e6) / 8;
  const free = new Map(); // per client: when the "link" is next free
    // An entry whose time has passed behaves the same as no entry, so expired ones can go
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, t] of free) if (t <= now) free.delete(ip);
  }, 60 * 1000);
  sweep.unref(); // never keeps the process alive on its own

  return async (req, res, next) => {
    try {
      let rel = decodeURIComponent(req.path);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT + path.sep)) return next();
      const st = await fs.promises.stat(file).catch(() => null);
      if (!st || !st.isFile()) return next();

      res.set("Cache-Control", "no-store");
      await sleep(latencyMs);

      if (rel.endsWith("/index.html")) {
        const html = withLogger(await fs.promises.readFile(file, "utf8"));
        return res.type("html").send(html);
      }

      typeHeaders(res, rel);
      res.set("Content-Length", st.size);
      const key = req.ip;
      const rs = fs.createReadStream(file, { highWaterMark: 16 * 1024 });
      res.on("close", () => rs.destroy());

      for await (const chunk of rs) {
        const now = Date.now();
        const start = Math.max(now, free.get(key) || 0);
        free.set(key, start + (chunk.length / bps) * 1000);
        if (start > now) await sleep(start - now);
        if (res.destroyed) return;
        if (!res.write(chunk)) {
          const canContinue = await waitForDrainOrClose(res);
          if (!canContinue) return; // client left: stop, the for-await exit destroys the file stream
        }
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) next(err);
      else res.destroy();
    }
  };
}

module.exports = { plain, simulated };