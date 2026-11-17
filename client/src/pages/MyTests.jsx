
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { StatusBadge, mb, thumbOf, day } from "../components/GameParts";
import Pager, { paginate } from "../components/Pager";

const PAGE_SIZE = 5;

const VERDICT = {
  pass: ["pass", "Within budget"],
  fail: ["fail", "Over budget"],
  none: ["none", "No budget set"],
};

function Result({ state }) {
  if (state === "pass") return <span className="mt-result pass-text">PASS</span>;
  if (state === "fail") return <span className="mt-result fail-text">FAIL</span>;
  return <span className="hint">Not set</span>;
}

function History({ id }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;

    api.get(`/games/${id}/compare`)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch(() => {
        if (active) setErr("Could not load run history.");
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (err) return <p className="mt-error">{err}</p>;
  if (!data) return <p className="mt-muted">Loading run history...</p>;

  const runs = Array.isArray(data.runs) ? data.runs.slice(0, 15) : [];

  if (!runs.length) {
    return (
      <div className="mt-history-empty">
        <strong>No test runs yet</strong>
        <p>Open the game and play each version to start recording performance data.</p>
      </div>
    );
  }

  return (
    <div className="mt-history-wrap">
      <div className="mt-table-scroll">
        <table className="mt-table mt-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Build</th>
              <th>Connection</th>
              <th>Load time</th>
              <th>Average FPS</th>
              <th>Counted</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r._id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.version}</td>
                <td>{r.network || "-"}</td>
                <td>
                  {r.loadTimeMs != null
                    ? `${(r.loadTimeMs / 1000).toFixed(1)} s`
                    : "-"}
                </td>
                <td>{r.avgFps ?? "-"}</td>
                <td>
                  {r.verified
                    ? <span className="mt-counted">Yes</span>
                    : <span className="mt-not-counted" title={r.note || "Not counted"}>No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-history-foot">
        Showing the latest {runs.length} runs.
        {" "}
        <Link to={`/games/${id}/compare`}>View full comparison →</Link>
      </p>
    </div>
  );
}

function TestCard({ g, onChanged }) {
  const [size, setSize] = useState(g.budget?.maxSizeMB ?? "");
  const [load, setLoad] = useState(g.budget?.maxLoadSec ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setSize(g.budget?.maxSizeMB ?? "");
    setLoad(g.budget?.maxLoadSec ?? "");
  }, [g.budget?.maxSizeMB, g.budget?.maxLoadSec]);

  const optimized = g.builds?.optimized;
  const unoptimized = g.builds?.unoptimized;
  const check = g.check || {};
  const [verdictClass, verdictLabel] =
    VERDICT[check.overall] || VERDICT.none;

  const save = async (clear = false) => {
    if (!clear) {
      for (const [value, name] of [
        [size, "Size budget"],
        [load, "Load time budget"],
      ]) {
        if (
          value !== "" &&
          (!Number.isFinite(Number(value)) || Number(value) <= 0)
        ) {
          setMsg(`${name} must be a number above 0.`);
          return;
        }
      }
    }

    const body = clear
      ? { maxSizeMB: null, maxLoadSec: null }
      : {
          maxSizeMB: size === "" ? null : Number(size),
          maxLoadSec: load === "" ? null : Number(load),
        };

    setBusy(true);
    setMsg("");

    try {
      await api.put(`/tests/${g._id}/budget`, body);

      if (clear) {
        setSize("");
        setLoad("");
      }

      setMsg("Budget saved successfully.");
      await onChanged();
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not save the budget.");
    } finally {
      setBusy(false);
    }
  };

  const loadText = (build) => {
    if (build?.loadSec == null) return "-";

    return build.basis === "measured"
      ? `${build.loadSec} s · Measured (${build.countedRuns} runs)`
      : `${build.loadSec} s · Estimated from size`;
  };

  return (
    <article className="mt-game-card">
      <div className="mt-game-top">
        <div className="mt-game-identity">
          <img
            className="mt-game-image"
            src={thumbOf(g)}
            alt={g.title}
          />

          <div className="mt-game-info">
            <div className="mt-game-title-row">
              <h3><Link to={`/games/${g._id}`}>{g.title}</Link></h3>
              <StatusBadge status={g.status} />
            </div>
            <p>Added {day(g.createdAt)}</p>
            <Link className="mt-view-game" to={`/games/${g._id}`}>
              View game →
            </Link>
          </div>
        </div>

        <span className={`mt-verdict ${verdictClass}`}>
          <span className="mt-verdict-dot" />
          {verdictLabel}
        </span>
      </div>

      <div className="mt-card-section">
        <div className="mt-section-title">
          <div>
            <span className="mt-eyebrow">BUILD PERFORMANCE</span>
            <h4>Budget comparison</h4>
          </div>
          <span className="mt-section-note">Optimized vs unoptimized</span>
        </div>

        {!optimized ? (
          <div className="mt-no-build">
            <strong>Optimized build not available</strong>
            <p>This game needs an optimized build before its performance can be checked.</p>
          </div>
        ) : (
          <div className="mt-table-scroll">
            <table className="mt-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Your budget</th>
                  <th>Optimized</th>
                  <th>Unoptimized</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mt-metric-name">Download size</td>
                  <td>
                    {g.budget?.maxSizeMB != null
                      ? `Up to ${g.budget.maxSizeMB} MB`
                      : "-"}
                  </td>
                  <td className="mt-optimized-value">
                    {optimized.sizeBytes ? mb(optimized.sizeBytes) : "-"}
                  </td>
                  <td>{unoptimized?.sizeBytes ? mb(unoptimized.sizeBytes) : "-"}</td>
                  <td><Result state={check.size} /></td>
                </tr>
                <tr>
                  <td className="mt-metric-name">Load time · Fast 4G</td>
                  <td>
                    {g.budget?.maxLoadSec != null
                      ? `Up to ${g.budget.maxLoadSec} s`
                      : "-"}
                  </td>
                  <td className="mt-optimized-value">{loadText(optimized)}</td>
                  <td>{loadText(unoptimized)}</td>
                  <td><Result state={check.load} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-budget-editor">
        <div className="mt-section-title">
          <div>
            <span className="mt-eyebrow">YOUR TARGETS</span>
            <h4>Set performance budgets</h4>
          </div>
        </div>

        <p className="mt-editor-description">
          Set the maximum download size and Fast 4G load time you want your optimized build to achieve.
        </p>

        <div className="mt-budget-fields">
          <label>
            <span>Maximum download size</span>
            <div className="mt-input-wrap">
              <input
                type="number"
                min="0.1"
                step="any"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 20"
                disabled={busy}
              />
              <span>MB</span>
            </div>
          </label>

          <label>
            <span>Maximum load time</span>
            <div className="mt-input-wrap">
              <input
                type="number"
                min="0.1"
                step="any"
                value={load}
                onChange={(e) => setLoad(e.target.value)}
                placeholder="e.g. 15"
                disabled={busy}
              />
              <span>Seconds</span>
            </div>
          </label>

          <div className="mt-budget-actions">
            <button disabled={busy} onClick={() => save(false)}>
              {busy ? "Saving..." : "Save budget"}
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => save(true)}
            >
              Clear
            </button>
          </div>
        </div>

        {msg && (
          <p className={`mt-save-message ${msg.includes("successfully") ? "success" : "error"}`}>
            {msg}
          </p>
        )}
      </div>

      <div className="mt-history-toggle">
        <button
          className="mt-history-button"
          onClick={() => setShowHistory((current) => !current)}
          aria-expanded={showHistory}
        >
          <span className="mt-history-button-icon">↗</span>
          <span>
            <strong>Run history</strong>
            <small>Review recorded test sessions for this game</small>
          </span>
          <span className="mt-history-chevron">{showHistory ? "−" : "+"}</span>
        </button>

        {showHistory && (
          <div className="mt-history-content">
            <History id={g._id} />
          </div>
        )}
      </div>
    </article>
  );
}

// Download the budget results as a CSV file.
function exportCsv(games) {
  const q = (value) => {
    let s = String(value ?? "");

    // Prevent spreadsheet formula execution from exported values.
    if (/^[=+\-@]/.test(s)) s = "'" + s;

    return `"${s.replace(/"/g, '""')}"`;
  };

  const head = [
    "game",
    "status",
    "budget_size_mb",
    "budget_load_s",
    "optimized_size_mb",
    "optimized_load_s",
    "load_basis",
    "counted_runs",
    "size_result",
    "load_result",
    "overall",
  ];

  const rows = games.map((g) => {
    const optimized = g.builds?.optimized;

    return [
      g.title,
      g.status,
      g.budget?.maxSizeMB,
      g.budget?.maxLoadSec,
      optimized?.sizeBytes
        ? (optimized.sizeBytes / 1048576).toFixed(2)
        : "",
      optimized?.loadSec,
      optimized?.basis,
      optimized?.countedRuns,
      g.check?.size,
      g.check?.load,
      g.check?.overall,
    ].map(q).join(",");
  });

  const blob = new Blob(
    [[head.join(","), ...rows].join("\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "my-tests.csv";
  a.click();

  URL.revokeObjectURL(url);
}

export default function MyTests() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await api.get("/tests");
      setGames(Array.isArray(response.data) ? response.data : []);
    } catch {
      setError("Could not load your tests. Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="container mt-page">
        <div className="mt-error-state">
          <span className="mt-error-icon">!</span>
          <h2>Unable to load your tests</h2>
          <p>{error}</p>
          <button onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  if (!games) {
    return (
      <div className="container mt-page">
        <div className="mt-loading">
          <span className="mt-loader" />
          <p>Loading your testing dashboard...</p>
        </div>
      </div>
    );
  }

  const withBudget = games.filter((g) => g.check?.overall !== "none");
  const passing = withBudget.filter((g) => g.check?.overall === "pass").length;
  const failing = withBudget.filter((g) => g.check?.overall === "fail").length;
  const withoutBudget = games.length - withBudget.length;
  const passRate = withBudget.length
    ? Math.round((passing / withBudget.length) * 100)
    : 0;

  const paged = paginate(games, page, PAGE_SIZE);

  return (
    <div className="container mt-page">
      <header className="mt-page-header">
        <div>
          <span className="mt-eyebrow">DEVELOPER WORKSPACE</span>
          <h1>My Tests</h1>
          <p>
            Track your games' performance, set optimization targets and review
            recorded test sessions.
          </p>
        </div>

        {games.length > 0 && (
          <button
            className="mt-export-button"
            onClick={() => exportCsv(games)}
          >
            <span>↓</span> Export CSV
          </button>
        )}
      </header>

      {games.length === 0 ? (
        <div className="mt-empty-state">
          <div className="mt-empty-icon">◈</div>
          <span className="mt-eyebrow">NOTHING TO TEST YET</span>
          <h2>Your testing workspace is ready</h2>
          <p>
            Once you add a game, you can set performance budgets and track
            how its optimized build performs.
          </p>
          <Link className="mt-primary-link" to="/my-games">
            Go to My Games →
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-overview">
            <div className="mt-overview-heading">
              <div>
                <span className="mt-eyebrow">AT A GLANCE</span>
                <h2>Performance overview</h2>
              </div>
              <span className="mt-game-count">
                {games.length} {games.length === 1 ? "game" : "games"}
              </span>
            </div>

            <div className="mt-stat-grid">
              <div className="mt-stat-card">
                <span className="mt-stat-label">Total games</span>
                <strong>{games.length}</strong>
                <small>In your workspace</small>
              </div>

              <div className="mt-stat-card is-pass">
                <span className="mt-stat-label">Within budget</span>
                <strong>{passing}</strong>
                <small>Meeting your targets</small>
              </div>

              <div className="mt-stat-card is-fail">
                <span className="mt-stat-label">Over budget</span>
                <strong>{failing}</strong>
                <small>Need optimization</small>
              </div>

              <div className="mt-stat-card is-neutral">
                <span className="mt-stat-label">No budget</span>
                <strong>{withoutBudget}</strong>
                <small>Waiting for targets</small>
              </div>
            </div>

            <div className="mt-progress-panel">
              <div className="mt-progress-copy">
                <div>
                  <strong>Budget success rate</strong>
                  <p>Games meeting their defined performance budgets</p>
                </div>
                <strong className="mt-progress-number">{passRate}%</strong>
              </div>

              <div
                className="mt-progress-track"
                role="progressbar"
                aria-label="Budget success rate"
                aria-valuenow={passRate}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${passRate}%` }} />
              </div>

              <small>
                {passing} of {withBudget.length} games with a budget are within target.
              </small>
            </div>
          </section>

          <section className="mt-games-section">
            <div className="mt-games-heading">
              <div>
                <span className="mt-eyebrow">YOUR PROJECTS</span>
                <h2>Game performance</h2>
                <p>Manage budgets and inspect the results of each game.</p>
              </div>
              <span className="mt-showing-count">
                Showing {paged.items.length} of {games.length}
              </span>
            </div>

            <div className="mt-game-list">
              {paged.items.map((g) => (
                <TestCard key={g._id} g={g} onChanged={load} />
              ))}
            </div>

            <Pager
              page={paged.page}
              pages={paged.pages}
              onChange={setPage}
            />
          </section>
        </>
      )}
    </div>
  );
}
