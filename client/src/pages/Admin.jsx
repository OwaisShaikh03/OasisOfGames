import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import Tabs from "../components/Tabs";
import GameList from "../components/GameList";
import Pager, { paginate } from "../components/Pager";
import ActivityLog from "../components/ActivityLog";
import { CreateGameForm, mb, thumbOf, day } from "../components/GameParts";

function makeMonthlySeries(items, field = "createdAt", count = 6) {
  const now = new Date();
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString(undefined, { month: "short" }),
      value: 0,
    };
  });
  const byKey = new Map(months.map((month) => [month.key, month]));
  items.forEach((item) => {
    const date = new Date(item?.[field]);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const month = byKey.get(key);
    if (month) month.value += 1;
  });
  return months;
}

function MiniBars({ title, description, data, accent = "teal" }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <section className="admin-panel admin-chart-panel">
      <div className="admin-panel-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <span className="admin-chart-total">{data.reduce((sum, item) => sum + item.value, 0)}</span>
      </div>
      <div className="admin-bars" role="img" aria-label={`${title}: ${data.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
        {data.map((item) => (
          <div className="admin-bar-column" key={item.key}>
            <span className="admin-bar-value">{item.value}</span>
            <div className="admin-bar-track"><span className={`admin-bar-fill ${accent}`} style={{ height: `${Math.max(item.value ? 7 : 0, (item.value / max) * 100)}%` }} /></div>
            <span className="admin-bar-label">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Distribution({ title, description, items, emptyText }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colors = ["lagoon", "amber", "mint", "coral", "violet"];
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h3>{title}</h3><p>{description}</p></div><span className="admin-chart-total">{total}</span></div>
      {total === 0 ? <p className="hint">{emptyText}</p> : (
        <>
          <div className="admin-distribution" role="img" aria-label={`${title}: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
            {items.map((item, index) => item.value > 0 && <span key={item.label} className={colors[index % colors.length]} style={{ width: `${(item.value / total) * 100}%` }} />)}
          </div>
          <ul className="admin-legend">
            {items.map((item, index) => (
              <li key={item.label}><span className={`admin-legend-dot ${colors[index % colors.length]}`} /><span>{item.label}</span><strong>{item.value}</strong><small>{Math.round((item.value / total) * 100)}%</small></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, usersRes, gamesRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/games"),
      ]);
      setData({ stats: statsRes.data, users: usersRes.data, games: gamesRes.data });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load dashboard analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cleanup = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.delete("/admin/orphan-metrics");
      setMsg(`Deleted ${r.data.deleted} orphaned test runs`);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Cleanup failed");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  if (loading && !data) return <div className="admin-dashboard-state" role="status">Loading dashboard analytics…</div>;
  if (error && !data) return <div className="admin-dashboard-state"><p className="error">{error}</p><button onClick={load}>Retry loading dashboard</button></div>;
  if (!data) return null;

  const { stats: s, users, games } = data;
  const roleItems = ["player", "tester", "developer", "admin"].map((role) => ({ label: role[0].toUpperCase() + role.slice(1), value: users.filter((user) => user.role === role).length }));
  const statusItems = ["approved", "pending", "rejected"].map((status) => ({ label: status[0].toUpperCase() + status.slice(1), value: games.filter((game) => (game.status || "approved") === status).length }));
  const categories = [...games.reduce((map, game) => {
    const category = String(game.category || "General").trim() || "General";
    map.set(category, (map.get(category) || 0) + 1);
    return map;
  }, new Map())].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const topGames = [...games].sort((a, b) => (b.testRuns || 0) - (a.testRuns || 0)).filter((game) => (game.testRuns || 0) > 0).slice(0, 5);
  const optimizedGames = games.filter((game) => (game.builds || []).some((build) => build.version === "optimized")).length;
  const userGrowth = makeMonthlySeries(users);
  const gameGrowth = makeMonthlySeries(games);
  const format = (value) => Number(value || 0).toLocaleString();

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-intro">
        <div><span className="admin-eyebrow">PLATFORM OVERVIEW</span><h2>Command centre</h2><p>Live snapshot of your games, community and testing activity.</p></div>
        <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button>
      </div>
      {error && <p className="error" role="alert">{error} Showing the last successfully loaded data.</p>}

      <div className="admin-kpis">
        <article className="admin-kpi"><span className="admin-kpi-icon users">◉</span><span className="admin-kpi-label">Community members</span><strong>{format(s.users)}</strong><small>{roleItems.find((item) => item.label === "Developer")?.value || 0} developers</small></article>
        <article className="admin-kpi"><span className="admin-kpi-icon games">▦</span><span className="admin-kpi-label">Games on platform</span><strong>{format(s.games)}</strong><small>{optimizedGames} with optimized builds</small></article>
        <article className="admin-kpi"><span className="admin-kpi-icon runs">⌁</span><span className="admin-kpi-label">Recorded test runs</span><strong>{format(s.runs)}</strong><small>{format(s.orphans)} orphaned runs</small></article>
        <article className="admin-kpi"><span className="admin-kpi-icon pending">◷</span><span className="admin-kpi-label">Awaiting review</span><strong>{format(s.pending)}</strong><small>{statusItems.find((item) => item.label === "Rejected")?.value || 0} rejected games</small></article>
      </div>

      <div className="admin-chart-grid">
        <MiniBars title="Community growth" description="New accounts created · last six months" data={userGrowth} />
        <MiniBars title="Game submissions" description="Games added · last six months" data={gameGrowth} accent="amber" />
      </div>

      <div className="admin-chart-grid">
        <Distribution title="Game approval status" description="Current moderation pipeline" items={statusItems} emptyText="No games have been submitted yet." />
        <Distribution title="Community roles" description="Account types across the platform" items={roleItems} emptyText="No user accounts found." />
      </div>

      <div className="admin-lower-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h3>Most tested games</h3><p>Ranked by recorded test runs</p></div></div>
          {topGames.length === 0 ? <p className="hint">No test runs have been recorded yet.</p> : <ol className="admin-top-games">{topGames.map((game, index) => <li key={game._id}><span className="admin-rank">{String(index + 1).padStart(2, "0")}</span><span className="admin-game-name">{game.title}<small>{game.category || "General"}</small></span><strong>{format(game.testRuns)} <small>runs</small></strong></li>)}</ol>}
        </section>
        <Distribution title="Game categories" description="Top categories by game count" items={categories} emptyText="No game categories to show." />
      </div>

      <section className="admin-cleanup-panel">
        <div><span className="admin-eyebrow">MAINTENANCE</span><h3>Orphaned test runs</h3><p>These runs belong to builds no game currently uses. They are included in the recorded-run total but do not appear in game reports.</p></div>
        <div className="admin-cleanup-action"><strong>{format(s.orphans)}</strong><button className="btn-danger" disabled={s.orphans === 0 || busy} onClick={() => setConfirm(true)}>Delete orphaned runs</button></div>
        {msg && <p className="hint" role="status">{msg}</p>}
      </section>

      <ConfirmDialog open={confirm} title="Delete orphaned runs?" message={`${s.orphans} test runs that belong to no game will be permanently deleted.`} busy={busy} onConfirm={cleanup} onCancel={() => setConfirm(false)} />
    </div>
  );
}

function Approvals() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await api.get("/admin/games");
      setGames(r.data.filter((g) => g.status === "pending"));
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not load games awaiting approval.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (g, status, why) => {
    setBusy(true);
    setMsg("");
    try {
      await api.put(`/admin/games/${g._id}/status`, { status, reason: why });
      setRejecting(null);
      setReason("");
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to update game status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="approval-section">
      <div className="approval-heading">
        <div>
          <h3>Waiting for approval</h3>
          <p className="hint">
            Review each submission and open the game in a new tab before approving it.
          </p>
        </div>
        <span className="approval-count">{games.length} pending</span>
      </div>

      {msg && <p className="error approval-message">{msg}</p>}
      {loading && <p className="hint">Loading submissions…</p>}

      {!loading && games.length === 0 && !msg && (
        <div className="approval-empty">
          <strong>You're all caught up</strong>
          <p className="hint">There are no games waiting for approval.</p>
        </div>
      )}

      {!loading && games.length > 0 && (
        <div className="approval-grid">
          {games.map((g) => {
            const builds = g.builds || [];
            const unoptimized = builds.find(
              (b) => b.version === "unoptimized"
            );
            const optimized = builds.find(
              (b) => b.version === "optimized"
            );

            return (
              <article className="approval-card" key={g._id}>
                <div className="approval-card-image">
                  <img src={thumbOf(g)} alt={`${g.title} thumbnail`} />
                  <span className="approval-pending-label">
                    Pending review
                  </span>
                </div>

                <div className="approval-card-body">
                  <div className="approval-title-row">
                    <h4>{g.title}</h4>
                    <div className="approval-tags">
                      {g.dimension && (
                        <span className="tag">{g.dimension}</span>
                      )}
                      {g.complexity && (
                        <span className="tag">{g.complexity}</span>
                      )}
                    </div>
                  </div>

                  <p className="approval-byline">
                    Submitted by{" "}
                    <strong>{g.createdBy?.username || "unknown"}</strong>
                    <span> · {day(g.createdAt)}</span>
                  </p>

                  {g.description && (
                    <p className="approval-description">{g.description}</p>
                  )}

                  <div className="approval-source">
                    Source: {g.source || "Not set"}
                  </div>

                  <div className="approval-builds" aria-label="Build information">
                    <div className="approval-build-row">
                      <span>Unoptimized</span>
                      <strong>
                        {unoptimized
                          ? `${mb(unoptimized.sizeBytes)} · ${unoptimized.compression || "Compression n/a"}`
                          : "Not uploaded"}
                      </strong>
                    </div>
                    <div className="approval-build-row">
                      <span>Optimized</span>
                      <strong>
                        {optimized
                          ? `${mb(optimized.sizeBytes)} · ${optimized.compression || "Compression n/a"}`
                          : "Not uploaded"}
                      </strong>
                    </div>
                  </div>

                  <div className="approval-actions">
                    <Link
                      className="approval-open-link"
                      to={`/games/${g._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open game ↗
                    </Link>

                    <div className="approval-decision-actions">
                      <button
                        disabled={busy}
                        onClick={() => decide(g, "approved", "")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => {
                          setRejecting(g);
                          setReason("");
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!rejecting}
        title="Reject game?"
        message={
          rejecting
            ? `Tell the uploader why "${rejecting.title}" was rejected.`
            : ""
        }
        confirmText="Reject"
        busyText="Rejecting..."
        busy={busy}
        onConfirm={() => decide(rejecting, "rejected", reason)}
        onCancel={() => setRejecting(null)}
      >
        <textarea
          placeholder="Reason (optional, shown to the uploader)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={3}
        />
      </ConfirmDialog>
    </section>
  );
}


const USERS_PER_PAGE = 10;

function Users() {
  const [users, setUsers] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState("");

  const load = () => api.get("/admin/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const setRole = async (id, role) => {
    setMsg("");
    try { await api.put(`/admin/users/${id}/role`, { role }); load(); }
    catch (err) { setMsg(err.response?.data?.message || "Failed"); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setMsg("");
    try {
      await api.delete(`/admin/users/${toDelete._id}`);
      setToDelete(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const paged = paginate(users, page, USERS_PER_PAGE);

  return (
    <>
      {msg && <p className="error">{msg}</p>}
      <table>
        <thead>
          <tr><th>Username</th><th>Email</th><th>Role</th><th>Games</th><th>Joined</th><th></th></tr>
        </thead>
        <tbody>
          {paged.items.map((u) => (
            <tr key={u._id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => setRole(u._id, e.target.value)}>
                  <option>player</option><option>tester</option><option>developer</option><option>admin</option>
                </select>
              </td>
              <td>{u.gamesCount}</td>
              <td>{day(u.createdAt)}</td>
              <td><button onClick={() => setToDelete(u)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={paged.page} pages={paged.pages} onChange={setPage} />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete user?"
        message={toDelete ? `${toDelete.username} will lose access. Their games are kept.` : ""}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("dashboard");
  const [scope, setScope] = useState("all");
  return (
    <div className="container">
      <h2>Admin panel</h2>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["dashboard", "Dashboard"],
          ["add", "Add game"],
          ["games", "Games"],
          ["approvals", "Approvals"],
          ["users", "Users"],
          ["activity", "Activity"],
        ]}
      />
      {tab === "dashboard" && <Dashboard />}
      {tab === "add" && <CreateGameForm onCreated={() => setTab("games")} />}
      {tab === "games" && (
        <>
          <Tabs
            value={scope}
            onChange={setScope}
            tabs={[["all", "All games"], ["mine", "Only mine"]]}
          />
          {scope === "all" ? (
            <GameList key="all" path="/admin/games" admin emptyText="No games yet." />
          ) : (
            <GameList key="mine" path="/games/mine" emptyText="You have not uploaded any games yet. Use the Add game tab." />
          )}
        </>
      )}
      {tab === "approvals" && <Approvals />}
      {tab === "users" && <Users />}
      {tab === "activity" && <ActivityLog />}
    </div>
  );
}