import { useEffect, useState } from "react";
import api from "../api";

const seconds = (value) => `${Number(value).toFixed(1)} s`;

const formatSize = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "—";
  return `${(value / 1048576).toFixed(1)} MB`;
};

const signedPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (number > 0) return `${Math.round(number)}% smaller`;
  if (number < 0) return `${Math.abs(Math.round(number))}% larger`;
  return "No size change";
};

export default function PerformanceSummary({ gameId }) {
  const [summary, setSummary] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSummary(undefined);
    setError("");

    api
      .get(`/games/${gameId}/summary`)
      .then((response) => {
        if (!cancelled) setSummary(response.data);
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
          setError("Performance information could not be loaded right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (summary === undefined) {
    return (
      <section className="performance-panel performance-loading" aria-live="polite">
        <span className="performance-kicker">PERFORMANCE OVERVIEW</span>
        <div className="performance-loading-line" />
        <p className="hint">Preparing performance summary…</p>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="performance-panel performance-empty">
        <span className="performance-kicker">PERFORMANCE OVERVIEW</span>
        <h3>Performance summary unavailable</h3>
        <p className="hint">
          {error || "Both build versions and their download data are needed before a comparison can be shown."}
        </p>
      </section>
    );
  }

  const before = Number(summary.load?.before) || 0;
  const after = Number(summary.load?.after) || 0;
  const maxLoad = Math.max(before, after, 0.1);
  const reduction = Number(summary.size?.reductionPct) || 0;
  const speedup = Number(summary.load?.speedup) || 0;
  const rating = ["excellent", "good", "fair", "poor"].includes(summary.rating)
    ? summary.rating
    : "fair";
  const isMeasured = summary.basis === "measured";

  return (
    <section className="performance-panel" aria-labelledby="performance-title">
      <div className="performance-topline">
        <div>
          <span className="performance-kicker">PERFORMANCE OVERVIEW</span>
          <h2 id="performance-title">Optimization results</h2>
          <p className="performance-intro">
            A quick look at how the optimized build compares with the original.
          </p>
        </div>
        <span className={`performance-rating ${rating}`}>
          <span className="performance-rating-dot" />
          {summary.ratingLabel || "Performance"}
        </span>
      </div>

      <div className="performance-headline">
        <span className="performance-headline-icon" aria-hidden="true">↗</span>
        <div>
          <strong>{summary.headline || "Build comparison"}</strong>
          <p>{isMeasured ? "Based on recorded test runs" : "Estimated from build download size"}</p>
        </div>
      </div>

      <div className="performance-metrics">
        <article className="performance-metric">
          <span className="performance-metric-label">Optimized load time</span>
          <strong>{seconds(after)}</strong>
          <span className="performance-metric-note">{isMeasured ? "Measured median" : "Estimated on 4G"}</span>
        </article>
        <article className="performance-metric">
          <span className="performance-metric-label">Download size change</span>
          <strong className={reduction > 0 ? "performance-positive" : reduction < 0 ? "performance-negative" : ""}>
            {signedPercent(reduction)}
          </strong>
          <span className="performance-metric-note">
            {formatSize(summary.size?.after)} optimized build
          </span>
        </article>
        <article className="performance-metric">
          <span className="performance-metric-label">Load-time comparison</span>
          <strong>{speedup > 0 ? `${speedup.toFixed(1)}×` : "—"}</strong>
          <span className="performance-metric-note">
            {speedup >= 1.05 ? "Faster than original" : speedup > 0 && speedup <= 0.95 ? "Slower than original" : "Compared with original"}
          </span>
        </article>
      </div>

      <div className="performance-chart-card">
        <div className="performance-chart-heading">
          <div>
            <h3>Loading time</h3>
            <p>Typical 4G connection · lower is better</p>
          </div>
          <span className={`performance-data-basis ${isMeasured ? "measured" : "estimated"}`}>
            {isMeasured ? `${summary.tests || 0} runs / version` : "Estimated"}
          </span>
        </div>

        <div className="performance-bars" role="img" aria-label={`Unoptimized load time ${seconds(before)}; optimized load time ${seconds(after)}`}>
          <div className="performance-bar-row">
            <div className="performance-bar-label">
              <span>Original</span>
              <strong>{seconds(before)}</strong>
            </div>
            <div className="performance-bar-track">
              <span className="performance-bar-fill original" style={{ width: `${Math.max(2, (before / maxLoad) * 100)}%` }} />
            </div>
          </div>
          <div className="performance-bar-row">
            <div className="performance-bar-label">
              <span>Optimized</span>
              <strong>{seconds(after)}</strong>
            </div>
            <div className="performance-bar-track">
              <span className="performance-bar-fill optimized" style={{ width: `${Math.max(2, (after / maxLoad) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="performance-size-comparison">
          <span>Download size</span>
          <strong>{formatSize(summary.size?.before)} <span>→</span> {formatSize(summary.size?.after)}</strong>
        </div>
      </div>

      {Array.isArray(summary.points) && summary.points.length > 0 && (
        <div className="performance-insights">
          <h3>What this means</h3>
          <ul>
            {summary.points.map((point, index) => (
              <li key={`${index}-${point}`}>
                <span aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.note && <p className="performance-footnote">{summary.note}</p>}
    </section>
  );
}
