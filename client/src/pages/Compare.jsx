import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { mb } from "../components/GameParts";
import Tabs from "../components/Tabs";

const f = (x, d = 2) => (x == null ? "-" : Number(x).toFixed(d));
const chg = (p) => (p == null ? "-" : `${p > 0 ? "+" : ""}${p.toFixed(1)}%`);
const pct = (a, b) => (a ? ((b - a) / a) * 100 : null);

function Bars({ title, unit, a, b, digits = 2 }) {
  const max = Math.max(a ?? 0, b ?? 0) || 1;
  const row = (label, val, cls) => (
    <div className="bar-row" key={label}>
      <span className="bar-label">{label}</span>
      <div className="bar-track" role="img" aria-label={`${label}: ${f(val, digits)} ${unit}`}>
        <div className={`bar ${cls}`} style={{ width: `${val == null ? 0 : Math.max(0, Math.min(100, (val / max) * 100))}%` }} />
      </div>
      <span className="bar-value">{f(val, digits)} {unit}</span>
    </div>
  );
  return (
    <div className="bars compare-chart-card">
      <h4>{title}</h4>
      {row("Unoptimized", a, "u")}
      {row("Optimized", b, "o")}
      <div className="compare-chart-legend"><span><i className="legend-baseline" /> Baseline</span><span><i className="legend-optimized" /> Optimized</span></div>
    </div>
  );
}

function verdict(change) {
  if (change == null) return "";
  const x = Math.abs(change).toFixed(1);
  if (Math.abs(change) < 2) return "Load time is about the same.";
  return change < 0 ? `The optimized build loads ${x}% faster.` : `The optimized build loads ${x}% slower.`;
}

// How steady the repeated runs were (coefficient of variation of load time)
function variability(cv) {
  if (cv == null) return "-";
  const pct = `${(cv * 100).toFixed(0)}%`;
  if (cv < 0.05) return `very consistent (${pct})`;
  if (cv < 0.15) return `some variation (${pct})`;
  return `high variation (${pct})`;
}

function testSentence(name, t) {
  if (!t) return null;
  if (t.p == null) return `${name}: every run of each build gave the same value, so a statistical test is not possible.`;
  const p = t.p < 0.001 ? "p < 0.001" : `p = ${t.p.toFixed(3)}`;
  return t.significant
    ? `${name}: the difference is statistically significant (${p}), so it is unlikely to be chance.`
    : `${name}: the difference is not statistically significant (${p}). With these runs it could be chance; more runs would help.`;
}

// Advice drawn from this game's own measured runs
function tipsFor(g, a, sizeChange) {
  const u = a?.unoptimized;
  const o = a?.optimized;
  if (!u || !o) return [["warn", "Run both builds", "Test the unoptimized and the optimized build under this condition to compare them."]];

  const tips = [];
  const fewest = Math.min(u.n, o.n);
  if (fewest < 3)
    tips.push(["warn", "Few runs", `One build has only ${fewest} counted run(s). Take at least 3 of each build before trusting the comparison.`]);

  const cvMax = Math.max(u.load?.cv ?? 0, o.load?.cv ?? 0);
  if (fewest >= 3 && cvMax > 0.15)
    tips.push(["warn", "Load times vary a lot", `Repeated runs differ by about ${(cvMax * 100).toFixed(0)}%. Close other tabs and apps, use a private window, and repeat the test.`]);

  const loadChange = g.change.load;
  if (g.network === "no throttle" && sizeChange != null && sizeChange < -20 && loadChange != null && loadChange > -10)
    tips.push(["warn", "Size savings barely show on a fast connection", "On a local or very fast connection the download takes almost no time. Test on Fast 4G or Slow 4G to see the benefit of a smaller build."]);
  else if (loadChange != null && loadChange <= -10)
    tips.push(["ok", "Loads faster", `The optimized build loads ${Math.abs(loadChange).toFixed(0)}% faster under this condition.`]);
  else if (sizeChange != null && sizeChange < -20 && loadChange != null && loadChange > -2)
    tips.push(["warn", "Smaller build, same load time", "The optimized build is much smaller but not faster. Check that the optimized build is really being served compressed, and that load time is not dominated by code start-up."]);

  const fpsChange = g.change.fps;
  if (fpsChange != null && fpsChange < -5)
    tips.push(["bad", "Frame rate dropped", `Average FPS is ${Math.abs(fpsChange).toFixed(0)}% lower in the optimized build. Check whether stripping or lowered quality settings affected rendering, and compare in the Unity Profiler.`]);
  else if (fpsChange != null && fpsChange > 5)
    tips.push(["ok", "Frame rate improved", `Average FPS is ${fpsChange.toFixed(0)}% higher in the optimized build.`]);

  const lu = u.low1?.mean;
  const lo = o.low1?.mean;
  if (lu && lo && g.change.fps != null) {
    const lowChange = ((lo - lu) / lu) * 100;
    if (lowChange < -10 && g.change.fps > -5)
      tips.push(["warn", "Stutters after optimizing", `Average FPS is similar, but the 1% low is ${Math.abs(lowChange).toFixed(0)}% lower. Look for hitches from garbage collection or assets loading during play.`]);
  }

  const hu = u.heap?.mean;
  const ho = o.heap?.mean;
  if (hu && ho && ho > hu * 1.2)
    tips.push(["warn", "Higher JavaScript heap", `The optimized build uses ${(((ho - hu) / hu) * 100).toFixed(0)}% more JS heap. Check for assets that are now loaded earlier or kept in memory.`]);

  if (!tips.length) tips.push(["ok", "Nothing stands out", "The runs show no obvious problems under this condition."]);
  return tips;
}

const ICON = { ok: "✓", warn: "!", bad: "✗" };

export default function Compare() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [an, setAn] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyRun, setBusyRun] = useState("");
  const latest = useRef(0);

  const load = async () => {
    const req = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const params = { scope };
      const [compareResult, analysisResult] = await Promise.allSettled([
        api.get(`/games/${id}/compare`, { params }),
        api.get(`/analysis/${id}`, { params }),
      ]);
      if (req !== latest.current) return;
      if (compareResult.status === "rejected") {
        setError(compareResult.reason?.response?.data?.message || "Could not load this comparison.");
        setData(null);
        setAn(null);
        return;
      }
      setData(compareResult.value.data);
      setAn(analysisResult.status === "fulfilled"
        ? { ...analysisResult.value.data, scope }
        : null);
    } catch {
      if (req === latest.current) setError("Could not load this comparison.");
    } finally {
      if (req === latest.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => { latest.current += 1; };
    // load is intentionally scoped to the game and selected run group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scope]);

  const download = async () => {
    try {
      const r = await api.get(`/games/${id}/metrics.csv`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data?.title || "game").replace(/[^a-z0-9-_]+/gi, "-")}-runs.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMsg("Could not download the CSV. Please try again.");
    }
  };

  const relabel = async (runId, network) => {
    setBusyRun(runId);
    setMsg("");
    try { await api.put(`/metrics/${runId}`, { network }); await load(); }
    catch { setMsg("Could not change the condition. Please try again."); }
    finally { setBusyRun(""); }
  };

  const removeRun = async (runId) => {
    if (!window.confirm("Delete this run? This cannot be undone.")) return;
    setBusyRun(runId);
    setMsg("");
    try { await api.delete(`/metrics/${runId}`); await load(); }
    catch { setMsg("Could not delete the run. Please try again."); }
    finally { setBusyRun(""); }
  };

  if (loading && !data) return (
    <div className="container compare-page">
      <div className="compare-loading"><span className="compare-loading-dot" /> Loading build comparison…</div>
    </div>
  );

  if (error && !data) return (
    <div className="container compare-page">
      <div className="compare-error" role="alert">
        <span className="compare-eyebrow">BUILD ANALYTICS</span>
        <h2>Comparison unavailable</h2>
        <p>{error}</p>
        <button type="button" onClick={load}>Try again</button>
        <p><Link to={`/games/${id}`}>Back to game</Link></p>
      </div>
    </div>
  );

  if (!data) return null;

  const ub = data.builds.find((b) => b.version === "unoptimized");
  const ob = data.builds.find((b) => b.version === "optimized");
  const analysis = an?.scope === scope ? an : null;
  const outliers = new Set(analysis?.outliers || []);
  const ready = data.scope === scope && !loading;
  const testersTab = scope === "testers";
  const totalRuns = data.groups.reduce((sum, g) => sum + (g.unoptimized?.n || 0) + (g.optimized?.n || 0), 0);
  const countedU = data.groups.reduce((sum, g) => sum + (g.unoptimized?.n || 0), 0);
  const countedO = data.groups.reduce((sum, g) => sum + (g.optimized?.n || 0), 0);
  const loadChanges = data.groups.map((g) => g.change?.load).filter((v) => Number.isFinite(v));
  const avgLoadChange = loadChanges.length ? loadChanges.reduce((a, b) => a + b, 0) / loadChanges.length : null;
  const sizeSaved = data.sizeChange == null ? null : -data.sizeChange;

  return (
    <div className="container compare-page">
      <header className="compare-hero">
        <div className="compare-hero-copy">
          <span className="compare-eyebrow">OASIS PERFORMANCE LAB</span>
          <h1>{data.title}</h1>
          <p>Build comparison <span aria-hidden="true">/</span> Unoptimized vs optimized</p>
          <Link className="compare-back-link" to={`/games/${id}`}>← Back to game</Link>
        </div>
        <div className="compare-hero-badge"><span className="compare-pulse" /> CURRENT DATASET <small>{totalRuns} counted runs</small></div>
      </header>

      <section className="compare-builds" aria-label="Build versions">
        <article className="compare-build-card compare-build-before">
          <div className="compare-build-top"><span className="compare-build-mark">A</span><span className="compare-build-label">BASELINE BUILD</span></div>
          <h2>Unoptimized</h2>
          <strong className="compare-build-size">{ub ? mb(ub.sizeBytes) : "—"}</strong>
          <span className="compare-build-meta">{ub?.compression || "Compression not specified"}</span>
        </article>
        <div className="compare-vs" aria-hidden="true">VS</div>
        <article className="compare-build-card compare-build-after">
          <div className="compare-build-top"><span className="compare-build-mark">B</span><span className="compare-build-label">OPTIMIZED BUILD</span></div>
          <h2>Optimized</h2>
          <strong className="compare-build-size">{ob ? mb(ob.sizeBytes) : "—"}</strong>
          <span className="compare-build-meta">{ob?.compression || "Compression not specified"}</span>
        </article>
      </section>

      <section className="compare-overview" aria-label="Comparison overview">
        <article className="compare-kpi">
          <span className="compare-kpi-label">BUILD SIZE CHANGE</span>
          <strong className={sizeSaved > 0 ? "is-positive" : sizeSaved < 0 ? "is-negative" : ""}>{chg(data.sizeChange)}</strong>
          <small>{sizeSaved > 0 ? `${sizeSaved.toFixed(1)}% smaller after optimization` : sizeSaved < 0 ? `${Math.abs(sizeSaved).toFixed(1)}% larger after optimization` : "Compared with baseline build"}</small>
        </article>
        <article className="compare-kpi">
          <span className="compare-kpi-label">MEAN LOAD CHANGE</span>
          <strong className={avgLoadChange == null ? "" : avgLoadChange < 0 ? "is-positive" : avgLoadChange > 0 ? "is-negative" : ""}>{chg(avgLoadChange)}</strong>
          <small>{avgLoadChange == null ? "Waiting for comparable runs" : avgLoadChange < 0 ? "Mean percentage change across conditions · lower is better" : "Mean percentage change across conditions · lower is better"}</small>
        </article>
        <article className="compare-kpi">
          <span className="compare-kpi-label">COUNTED TEST RUNS</span>
          <strong>{totalRuns}</strong>
          <small>{countedU} baseline <span aria-hidden="true">·</span> {countedO} optimized</small>
        </article>
        <article className="compare-kpi">
          <span className="compare-kpi-label">TEST CONDITIONS</span>
          <strong>{data.groups.length}</strong>
          <small>Network conditions with counted data</small>
        </article>
      </section>

      <section className="compare-section-head">
        <div><span className="compare-eyebrow">MEASUREMENT SCOPE</span><h2>Performance results</h2><p>Switch between all counted runs and runs recorded by testers.</p></div>
        <Tabs value={scope} onChange={setScope} tabs={[["all", "All runs"], ["testers", `Tester runs (${data.testerCount})`]]} />
      </section>

      {loading && <p className="compare-refreshing" role="status">Updating results…</p>}
      {msg && <p className="compare-message" role="status">{msg}</p>}

      {ready && testersTab && (
        <section className="compare-panel">
          <div className="compare-panel-heading"><div><span className="compare-eyebrow">TESTER ACTIVITY</span><h3>Community test coverage</h3></div><span className="compare-count-pill">{data.testers.length} testers</span></div>
          {data.testers.length === 0 ? (
            <p className="compare-empty">No tester runs yet. Ask testers to open this game, choose a connection, and let it load. Their runs appear here under their username.</p>
          ) : (
            <div className="compare-table-wrap"><p className="hint">Only runs made while logged in as a tester are listed here.</p>
              <table><thead><tr><th>Tester</th><th>Runs (counted / total)</th><th>Browsers</th><th>Devices</th><th>Last run</th></tr></thead>
                <tbody>{data.testers.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.counted} / {t.runs}</td><td>{t.browsers.join(", ") || "—"}</td><td>{t.devices.join(", ") || "—"}</td><td>{t.last ? new Date(t.last).toLocaleString() : "—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {ready && data.groups.length === 0 && (
        <div className="compare-empty-state"><span className="compare-empty-icon">⌁</span><h3>No comparison data yet</h3><p>Open both builds, choose a test condition, and let each build finish loading. Counted runs will appear here.</p></div>
      )}

      {ready && data.groups.map((g) => {
        const a = analysis?.groups.find((x) => x.network === g.network);
        const tips = tipsFor(g, a, data.sizeChange);
        const loadU = g.unoptimized?.load?.mean;
        const loadO = g.optimized?.load?.mean;
        const fpsU = g.unoptimized?.fps?.mean;
        const fpsO = g.optimized?.fps?.mean;
        const metricRows = [
          { label: "Load time (mean ± SD)", u: `${f(g.unoptimized?.load?.mean)} ± ${f(g.unoptimized?.load?.sd)} s`, o: `${f(g.optimized?.load?.mean)} ± ${f(g.optimized?.load?.sd)} s`, change: chg(g.change.load) },
          ...(a ? [{ label: "Load time (median, range)", u: `${f(a.unoptimized?.load?.median)} s (${f(a.unoptimized?.load?.min)} to ${f(a.unoptimized?.load?.max)})`, o: `${f(a.optimized?.load?.median)} s (${f(a.optimized?.load?.min)} to ${f(a.optimized?.load?.max)})`, change: "—" }, { label: "Load-time consistency", u: variability(a.unoptimized?.load?.cv), o: variability(a.optimized?.load?.cv), change: "—" }] : []),
          { label: "FPS (mean / median)", u: `${f(g.unoptimized?.fps?.mean, 1)} / ${f(g.unoptimized?.fps?.median, 1)}`, o: `${f(g.optimized?.fps?.mean, 1)} / ${f(g.optimized?.fps?.median, 1)}`, change: chg(g.change.fps) },
          ...(a?.unoptimized?.low1 || a?.optimized?.low1 ? [{ label: "1% low FPS (mean)", u: f(a.unoptimized?.low1?.mean, 1), o: f(a.optimized?.low1?.mean, 1), change: chg(pct(a.unoptimized?.low1?.mean, a.optimized?.low1?.mean)) }] : []),
          { label: "JS heap (mean)", u: `${f(g.unoptimized?.heap?.mean, 1)} MB`, o: `${f(g.optimized?.heap?.mean, 1)} MB`, change: "—" },
        ];
        return (
          <section className="compare-condition" key={g.network}>
            <div className="compare-condition-head"><div><span className="compare-eyebrow">TEST CONDITION</span><h3>{g.network}</h3><p>{g.unoptimized?.n || 0} baseline runs <span>·</span> {g.optimized?.n || 0} optimized runs</p></div><div className="compare-condition-verdict">{verdict(g.change.load)}</div></div>
            <div className="compare-chart-grid">
              <Bars title="Average load time" unit="s" a={loadU} b={loadO} />
              <Bars title="Average frame rate" unit="FPS" a={fpsU} b={fpsO} digits={1} />
            </div>
            <div className="compare-panel compare-metrics-panel">
              <div className="compare-panel-heading"><div><span className="compare-eyebrow">SIDE-BY-SIDE DATA</span><h4>Detailed metrics</h4></div></div>
              <div className="compare-table-wrap"><table className="compare-metrics-table"><thead><tr><th>Metric</th><th>Unoptimized</th><th>Optimized</th><th>Change</th></tr></thead><tbody>{metricRows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.u}</td><td>{r.o}</td><td>{r.change}</td></tr>)}</tbody></table></div>
            </div>
            <div className="compare-insight-grid">
              <div className="compare-panel"><span className="compare-eyebrow">STATISTICAL CHECK</span><h4>Is the difference reliable?</h4>
                {a?.tests?.load || a?.tests?.fps || a?.tests?.low1 ? <>
                  {a.tests.load && <p className={`stat-note ${a.tests.load.significant ? "sig" : "nosig"}`}>{testSentence("Load time", a.tests.load)}</p>}
                  {a.tests.fps && <p className={`stat-note ${a.tests.fps.significant ? "sig" : "nosig"}`}>{testSentence("Average FPS", a.tests.fps)}</p>}
                  {a.tests.low1 && <p className={`stat-note ${a.tests.low1.significant ? "sig" : "nosig"}`}>{testSentence("1% low FPS", a.tests.low1)}</p>}
                  <small className="hint">Welch's t-test uses counted runs. A p-value below 0.05 is commonly treated as statistically significant. This does not measure the practical size of the difference.</small>
                </> : <p className="hint">A significance check needs at least 3 counted runs of each build under this condition.</p>}
              </div>
              <div className="compare-panel"><span className="compare-eyebrow">AUTOMATED REVIEW</span><h4>What your runs suggest</h4>
                {tips.map(([level, title, detail], i) => <div className={`ritem ${level}`} key={i}><span className="ricon">{ICON[level]}</span><div><strong>{title}</strong><div className="rdetail">{detail}</div></div></div>)}
              </div>
            </div>
          </section>
        );
      })}

      {ready && data.canExport && (
        <section className="compare-panel compare-raw-runs">
          <div className="compare-panel-heading"><div><span className="compare-eyebrow">DATA MANAGEMENT</span><h3>Raw test runs</h3><p>Review individual measurements, correct mislabeled conditions, or remove invalid runs.</p></div><button type="button" onClick={download}>Download CSV ↓</button></div>
          <div className="compare-table-wrap"><table><thead><tr><th>Date</th><th>Build</th><th>Condition</th><th>Load</th><th>FPS</th><th>1% low</th><th>Size</th><th>Browser</th>{testersTab && <th>Tester</th>}<th>Counted</th><th>Action</th></tr></thead>
            <tbody>{data.runs.map((r) => <tr key={r._id}><td>{new Date(r.createdAt).toLocaleString()}</td><td><span className={`compare-version-tag ${r.version === "optimized" ? "optimized" : "baseline"}`}>{r.version}</span></td><td><select aria-label={`Network condition for ${r.version} run`} value={r.network} disabled={busyRun === r._id} onChange={(e) => relabel(r._id, e.target.value)}><option>unspecified</option><option>no throttle</option><option>Fast 4G</option><option>Slow 4G</option></select></td><td>{f(r.loadTimeMs / 1000)} s {outliers.has(String(r._id)) && <span className="tag" title="Far from the other runs of this build">outlier</span>}</td><td>{f(r.avgFps, 1)}</td><td>{f(r.low1Fps, 1)}</td><td>{r.transferBytes == null ? "—" : mb(r.transferBytes)}</td><td>{r.browser}</td>{testersTab && <td>{r.testerName || "—"}</td>}<td title={r.note}>{r.verified ? "Yes" : "No"}</td><td><button type="button" className="compare-delete-button" disabled={busyRun === r._id} onClick={() => removeRun(r._id)}>{busyRun === r._id ? "Working…" : "Delete"}</button></td></tr>)}</tbody>
          </table></div>
          {msg && <p className="compare-message" role="status">{msg}</p>}
        </section>
      )}
    </div>
  );
}
