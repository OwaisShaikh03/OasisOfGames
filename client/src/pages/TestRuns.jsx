
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { thumbOf } from "../components/GameParts";

const formatTime = (ms) =>
  ms == null ? "—" : `${(ms / 1000).toFixed(2)} s`;

const formatFps = (fps) =>
  fps == null ? "—" : `${fps.toFixed(1)} FPS`;

const formatMemory = (mb) =>
  mb == null ? "—" : `${mb.toFixed(1)} MB`;

const formatBytes = (bytes) => {
  if (bytes == null) return "—";
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleString() : "—";

function SummaryCard({ label, value, detail, tone, icon }) {
  return (
    <div className={`tr-summary-card ${tone || ""}`}>
      <div className="tr-summary-top">
        <span>{label}</span>
        <span className="tr-summary-icon">{icon}</span>
      </div>
      <strong>{value ?? 0}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function VersionPanel({ title, data, type }) {
  const optimized = type === "optimized";

  return (
    <section className={`tr-version-panel ${optimized ? "optimized" : "unoptimized"}`}>
      <div className="tr-version-heading">
        <div>
          <span className="tr-version-kicker">
            {optimized ? "OPTIMIZED BUILD" : "ORIGINAL BUILD"}
          </span>
          <h4>{title}</h4>
        </div>
        <span className="tr-version-run-count">
          {data.totalRuns} {data.totalRuns === 1 ? "run" : "runs"}
        </span>
      </div>

      <div className="tr-version-counts">
        <span className="tr-count-good">{data.countedRuns} counted</span>
        <span className="tr-count-muted">{data.uncountedRuns} uncounted</span>
      </div>

      <div className="tr-metric-grid">
        <div>
          <small>Average load time</small>
          <strong>{formatTime(data.avgLoadTimeMs)}</strong>
        </div>
        <div>
          <small>Average FPS</small>
          <strong>{formatFps(data.avgFps)}</strong>
        </div>
        <div>
          <small>Average minimum FPS</small>
          <strong>{formatFps(data.avgMinFps)}</strong>
        </div>
        <div>
          <small>1% low FPS</small>
          <strong>{formatFps(data.avgLow1Fps)}</strong>
        </div>
        <div>
          <small>Average JS memory</small>
          <strong>{formatMemory(data.avgHeapMB)}</strong>
        </div>
      </div>

      {data.byNetwork?.length > 0 && (
        <div className="tr-network-breakdown">
          <h5>Performance by connection</h5>
          <div className="tr-network-list">
            {data.byNetwork.map((network) => (
              <div className="tr-network-row" key={network.network}>
                <strong>{network.network}</strong>
                <span>{network.countedRuns} counted / {network.totalRuns} runs</span>
                <span>Load: {formatTime(network.avgLoadTimeMs)}</span>
                <span>FPS: {formatFps(network.avgFps)}</span>
                <span>1% low: {formatFps(network.avgLow1Fps)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalRuns === 0 && (
        <p className="tr-no-data">No runs recorded for this build yet.</p>
      )}
    </section>
  );
}

function RunHistory({ runs }) {
  if (!runs.length) {
    return (
      <div className="tr-history-empty">
        <strong>No run history available</strong>
        <p>Recorded sessions will appear here after testing.</p>
      </div>
    );
  }

  return (
    <div className="tr-history-scroll">
      <table className="tr-history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Build</th>
            <th>Connection</th>
            <th>Load time</th>
            <th>Average FPS</th>
            <th>1% low</th>
            <th>Memory</th>
            <th>Download</th>
            <th>Minimum FPS</th>
            <th>Frames sampled</th>
            <th>Browser / Device</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>{formatDate(run.createdAt)}</td>
              <td>
                <span className={`tr-build-tag ${run.version === "optimized" ? "opt" : "unopt"}`}>
                  {run.version}
                </span>
              </td>
              <td>{run.network}</td>
              <td>{formatTime(run.loadTimeMs)}</td>
              <td>{formatFps(run.avgFps)}</td>
              <td>{formatFps(run.low1Fps)}</td>
              <td>{formatMemory(run.jsHeapMB)}</td>
              <td>{formatBytes(run.transferBytes)}</td>
              <td>{formatFps(run.minFps)}</td>
              <td>{run.frameCount ?? "—"}</td>
              <td>
                {run.browser}
                <small className="tr-table-sub">
                  {run.deviceType}
                  {run.cores ? ` · ${run.cores} cores` : ""}
                </small>
              </td>
              <td>
                {run.verified ? (
                  <span className="tr-result-counted">Counted</span>
                ) : (
                  <span
                    className="tr-result-uncounted"
                    title={run.verifyNote || "Run was not counted"}
                  >
                    Not counted
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameRunCard({ game }) {
  const [expanded, setExpanded] = useState(false);

  const optimized = game.versions.optimized;
  const unoptimized = game.versions.unoptimized;

  return (
    <article className="tr-game-card">
      <div className="tr-game-header">
        <img
          className="tr-game-image"
          src={thumbOf(game)}
          alt={game.title}
        />

        <div className="tr-game-information">
          <div className="tr-game-title-row">
            <h3>{game.title}</h3>
            {game.category && (
              <span className="tr-game-category">{game.category}</span>
            )}
          </div>

          <p>
            By {game.developer}
            {game.dimension ? ` · ${game.dimension}` : ""}
          </p>

          <small>Last tested: {formatDate(game.lastRun)}</small>

          <div className="tr-game-counts">
            <span>{game.totalRuns} total runs</span>
            <span className="tr-count-good">{game.verifiedRuns} counted</span>
            <span className="tr-count-muted">{game.unverifiedRuns} uncounted</span>
          </div>
        </div>

        <Link className="tr-open-game" to={`/games/${game.gameId}`}>
          Open game <span>↗</span>
        </Link>
      </div>

      <div className="tr-version-grid">
        <VersionPanel
          title="Optimized build"
          type="optimized"
          data={optimized}
        />
        <VersionPanel
          title="Unoptimized build"
          type="unoptimized"
          data={unoptimized}
        />
      </div>

      <div className="tr-game-footer">
        <div className="tr-build-total">
          <span className="tr-build-dot optimized-dot" />
          {optimized.totalRuns} optimized
          <span className="tr-build-separator">·</span>
          <span className="tr-build-dot unoptimized-dot" />
          {unoptimized.totalRuns} unoptimized
        </div>

        <button
          className={`tr-history-toggle ${expanded ? "active" : ""}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide run history" : "View run history"}
          <span>{expanded ? "−" : "+"}</span>
        </button>
      </div>

      {expanded && (
        <div className="tr-history">
          <div className="tr-history-heading">
            <div>
              <span className="tr-version-kicker">SESSION DETAILS</span>
              <h4>Individual test runs</h4>
            </div>
            <span>{game.runs.length} recorded sessions</span>
          </div>
          <RunHistory runs={game.runs} />
        </div>
      )}
    </article>
  );
}

export default function TestRuns() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadRuns = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const response = await api.get("/metrics/mine");
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load your test runs."
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const filteredGames = useMemo(() => {
    if (!data) return [];

    const term = search.trim().toLowerCase();
    if (!term) return data.games;

    return data.games.filter((game) =>
      game.title.toLowerCase().includes(term)
    );
  }, [data, search]);

  if (error && !data) {
    return (
      <div className="container tr-page">
        <div className="tr-error">
          <span className="tr-state-icon">!</span>
          <span className="tr-eyebrow">TESTER WORKSPACE</span>
          <h2>Could not load Test Runs</h2>
          <p>{error}</p>
          <button onClick={loadRuns} disabled={refreshing}>
            {refreshing ? "Retrying..." : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container tr-page">
        <div className="tr-loading">
          <span className="tr-loader" />
          <p>Loading your testing activity...</p>
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="container tr-page">
      <header className="tr-hero">
        <div className="tr-hero-copy">
          <span className="tr-eyebrow">TESTER WORKSPACE</span>
          <h1>Test Runs</h1>
          <p>
            Your testing activity, performance results and recorded gameplay
            sessions — all in one place.
          </p>
        </div>

        <button
          className="tr-refresh-button"
          onClick={loadRuns}
          disabled={refreshing}
        >
          <span className={refreshing ? "tr-refresh-icon spinning" : "tr-refresh-icon"}>
            ↻
          </span>
          {refreshing ? "Refreshing..." : "Refresh results"}
        </button>
      </header>

      <section className="tr-summary-section">
        <div className="tr-section-heading">
          <div>
            <span className="tr-eyebrow">YOUR ACTIVITY</span>
            <h2>Testing overview</h2>
          </div>
          <span className="tr-live-label">
            <span /> Personal run history
          </span>
        </div>

        <div className="tr-summary">
          <SummaryCard
            label="Games tested"
            value={summary.gamesTested}
            detail="Different games"
            icon="◈"
          />
          <SummaryCard
            label="Total runs"
            value={summary.totalRuns}
            detail="All recorded sessions"
            icon="▤"
          />
          <SummaryCard
            label="Optimized runs"
            value={summary.optimizedRuns}
            detail="Optimized builds"
            tone="is-optimized"
            icon="↗"
          />
          <SummaryCard
            label="Unoptimized runs"
            value={summary.unoptimizedRuns}
            detail="Original builds"
            tone="is-unoptimized"
            icon="◫"
          />
          <SummaryCard
            label="Counted runs"
            value={summary.verifiedRuns}
            detail="Passed automatic checks"
            tone="is-counted"
            icon="✓"
          />
          <SummaryCard
            label="Uncounted runs"
            value={summary.unverifiedRuns}
            detail="Excluded from averages"
            tone="is-uncounted"
            icon="!"
          />
        </div>
      </section>

      <section className="tr-games-section">
        <div className="tr-section-heading tr-games-heading">
          <div>
            <span className="tr-eyebrow">RECORDED PROJECTS</span>
            <h2>Your tested games</h2>
            <p>
              {data.games.length} different{" "}
              {data.games.length === 1 ? "game" : "games"} in your history.
            </p>
          </div>

          {data.games.length > 0 && (
            <label className="tr-search-wrap">
              <span>⌕</span>
              <input
                className="tr-search"
                type="search"
                placeholder="Search your tested games..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="tr-clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>
          )}
        </div>

        {error && (
          <div className="tr-refresh-error">
            {error} Your previously loaded results are still displayed.
          </div>
        )}

        {data.games.length === 0 ? (
          <div className="tr-empty">
            <span className="tr-empty-icon">◈</span>
            <h3>No test runs recorded yet</h3>
            <p>
              Open a game while logged in as a Tester. Select a build and
              connection, then allow the game to finish loading so its
              performance metrics can be recorded.
            </p>
            <Link to="/">Explore games →</Link>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="tr-empty tr-no-match">
            <h3>No games match your search</h3>
            <p>Try another game title or clear your search.</p>
            <button onClick={() => setSearch("")}>Clear search</button>
          </div>
        ) : (
          <>
            <div className="tr-results-count">
              Showing <strong>{filteredGames.length}</strong> of{" "}
              <strong>{data.games.length}</strong> games
            </div>

            <div className="tr-game-list">
              {filteredGames.map((game) => (
                <GameRunCard key={game.gameId} game={game} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
