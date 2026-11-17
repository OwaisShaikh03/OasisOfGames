import { useEffect, useRef, useState } from "react";
import api from "../api";
import Pager from "./Pager";

// Friendly wording for each action code the server records
const LABELS = {
  "game.create": "Uploaded a game",
  "build.upload": "Uploaded a build",
  "game.update": "Edited game details",
  "game.delete": "Deleted a game",
  "game.approve": "Approved a game",
  "game.reject": "Rejected a game",
  "game.pending": "Set a game back to pending",
  "user.role": "Changed a user's role",
  "user.delete": "Deleted a user",
  "review.delete": "Deleted a review (moderation)",
  "run.delete": "Deleted a test run",
  "run.relabel": "Changed a run's condition",
  "runs.cleanup": "Deleted orphaned runs",
  "account.password": "Changed password",
};

// Keys must match the categories the server understands
const CATEGORIES = [
  ["", "All activity"],
  ["games", "Games"],
  ["users", "Users"],
  ["reviews", "Reviews"],
  ["runs", "Test runs"],
  ["account", "Account"],
];

export default function ActivityLog() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [text, setText] = useState(""); // what is typed in the box
  const [q, setQ] = useState(""); // the search actually sent (after a short pause)
  const [result, setResult] = useState(null); // { key, data, error } of the last answer
  const [tick, setTick] = useState(0); // bumped by the Refresh button
  const latest = useRef(0); // ignores answers that arrive after a newer request
  const sentQ = useRef(""); // the last search text that was applied

  // Wait a moment after typing before searching; a new search starts at page 1
  useEffect(() => {
    const t = setTimeout(() => {
      const next = text.trim();
      if (next !== sentQ.current) {
        sentQ.current = next;
        setPage(1);
        setQ(next);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const key = `${page}|${category}|${q}|${tick}`;
  useEffect(() => {
    const id = ++latest.current;
    api
      .get("/admin/activity", { params: { page, category, q } })
      .then((r) => { if (id === latest.current) setResult({ key, data: r.data, error: "" }); })
      .catch((e) => {
        if (id === latest.current)
          setResult({ key, data: null, error: e.response?.data?.message || "Could not load the activity log" });
      });
  }, [key, page, category, q]);

  const data = result?.data || null;
  const error = result?.error || "";
  const loading = !result || result.key !== key;

  const changeCategory = (value) => {
    setCategory(value);
    setPage(1);
  };

  return (
    <div className="report">
      <h3>Activity</h3>
      <p className="hint">Who did what on the site. Entries are removed automatically after 180 days.</p>

      <div className="filters">
        <select value={category} onChange={(e) => changeCategory(e.target.value)}>
          {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <input
          className="search"
          placeholder="Search by person, game or details"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-secondary" onClick={() => setTick((n) => n + 1)} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {data && !error && (
        data.items.length === 0 ? (
          <p>{category || q ? "No activity matches this filter." : "No activity yet."}</p>
        ) : (
          <>
            <table>
              <thead>
                <tr><th>Time</th><th>Who</th><th>What</th><th>Target</th><th>Details</th></tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a._id}>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>
                      {a.actorName}
                      {a.actorRole === "admin" && <> <span className="tag">admin</span></>}
                    </td>
                    <td>{LABELS[a.action] || a.action}</td>
                    <td>{a.targetLabel || "-"}</td>
                    <td>{a.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="hint">{data.total} {data.total === 1 ? "entry" : "entries"}</small>
            <Pager page={data.page} pages={data.pages} onChange={setPage} />
          </>
        )
      )}
      {!data && !error && <p>Loading...</p>}
    </div>
  );
}