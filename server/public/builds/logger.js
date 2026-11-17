(function () {
  // Build path from the URL, e.g. /builds/flap-runner/unopt
  let p = location.pathname;
  const bi = p.indexOf("/builds/");
  if (bi > 0) p = p.slice(bi); // drops the /sim/fast4g prefix
  const buildPath = p.replace(/\/[^/]*\.[^/]*$/, "").replace(/\/$/, "");

  // On-screen overlay
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;top:8px;right:8px;z-index:99999;padding:8px 12px;background:rgba(0,0,0,.75);color:#7CFC9A;font:12px monospace;border-radius:6px;pointer-events:none;white-space:pre";
  box.textContent = "Loading...";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(box));

  function browserName() {
    const u = navigator.userAgent;
    if (/Edg\//.test(u)) return "Edge";
    if (/Firefox\//.test(u)) return "Firefox";
    if (/Chrome\//.test(u)) return "Chrome";
    if (/Safari\//.test(u)) return "Safari";
    return "Other";
  }

  function sampleFrames(durationMs, done) {
    setTimeout(() => {
      const deltas = [];
      const start = performance.now();
      let last = start;
      function tick(now) {
        deltas.push(now - last);
        last = now;
        if (now - start < durationMs) requestAnimationFrame(tick);
        else done(deltas.slice(1));
      }
      requestAnimationFrame(tick);
    }, 2000);
  }

  let finished = false;
  function onLoaded() {
    if (finished) return;
    finished = true;
    const loadTimeMs = Math.round(performance.now());
    box.textContent = "Loaded in " + (loadTimeMs / 1000).toFixed(2) + " s\nMeasuring FPS (10 s)...";

    sampleFrames(10000, (deltas) => {
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const worst = Math.max(...deltas);
      // 1% low: average FPS of the slowest 1% of frames (needs at least 100 frames to mean anything)
      const slowest = [...deltas].sort((a, b) => b - a);
      const k = Math.max(1, Math.ceil(deltas.length * 0.01));
      const slowAvg = slowest.slice(0, k).reduce((a, b) => a + b, 0) / k;

      const files = performance.getEntriesByType("resource").filter((r) => r.name.includes(buildPath));
      const transferBytes = files.reduce((s, r) => s + (r.transferSize || 0), 0);
      const decodedBytes = files.reduce((s, r) => s + (r.decodedBodySize || 0), 0);

      const data = {
        buildPath,
        loadTimeMs,
        transferBytes,
        decodedBytes,
        avgFps: +(1000 / avg).toFixed(1),
        minFps: +(1000 / worst).toFixed(1),
        low1Fps: deltas.length >= 100 ? +(1000 / slowAvg).toFixed(1) : null,
        frameCount: deltas.length,
        avgFrameMs: +avg.toFixed(2),
        jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
        browser: browserName(),
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
        cores: navigator.hardwareConcurrency,
        screen: screen.width + "x" + screen.height,
        userAgent: navigator.userAgent,
        network: new URLSearchParams(location.search).get("net") || "unspecified",
        // Only present when a logged-in tester opened the game; the server checks it
        testerToken: new URLSearchParams(location.search).get("tt") || undefined,
      };

      box.textContent =
        "Load: " + (loadTimeMs / 1000).toFixed(2) + " s\n" +
        "FPS: " + data.avgFps + " (min " + data.minFps + (data.low1Fps ? ", 1% low " + data.low1Fps : "") + ")\n" +
        "Frame: " + data.avgFrameMs + " ms\n" +
        "Size: " + (transferBytes / 1048576).toFixed(2) + " MB over wire\n" +
        "JS heap: " + (data.jsHeapMB ?? "n/a") + " MB";

      fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((r) =>
          r.json().then((j) => {
            const who = j.tester ? " as tester " + j.tester : j.testerNote ? "\n(" + j.testerNote + ")" : "";
            box.textContent += !r.ok
              ? "\nSave failed"
              : (j.verified ? "\nSaved ✓" : "\nSaved, not counted: " + j.reason) + who;
          })
        )
        .catch(() => { box.textContent += "\nSave failed"; });
    });
  }

  let seenLoading = false;
  function check() {
    const bar = document.getElementById("unity-loading-bar");
    if (!bar) return;
    if (getComputedStyle(bar).display !== "none") seenLoading = true;
    else if (seenLoading) onLoaded();
  }
  new MutationObserver(check).observe(document.documentElement, {
    attributes: true, childList: true, subtree: true,
  });
  check();
  window.reportLoaded = onLoaded; // manual hook if a template has no loading bar
})();