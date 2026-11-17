import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import ConfirmDialog from "./ConfirmDialog";
import GameFilters, { applyFilters, sortGames } from "./GameFilters";
import Pager, { paginate } from "./Pager";
import { BuildBox, ThumbBox, EditDetails, StatusBadge, mb, thumbOf, day } from "./GameParts";

const PAGE_SIZE = 8;

function Row({ g, admin, onChanged, onDelete, onApprove }) {
  const [open, setOpen] = useState(false);
  const s = g.summary;

  return (
    <div className="grow">
      <div className="grow-main">
        <img className="grow-thumb" src={thumbOf(g)} alt={g.title} />

        <div className="grow-info">
          <div className="gtitle">
            <Link to={`/games/${g._id}`}>{g.title}</Link>
            <StatusBadge status={g.status} />
            {s && <span className={`rating ${s.rating}`}>{s.label}</span>}
          </div>
          <div className="meta">
            {g.dimension} · {g.complexity} · {g.category}
            {admin && <> · by <strong>{g.createdBy?.username || "unknown"}</strong></>}
            {" · "}{day(g.createdAt)}
          </div>
          {g.status === "rejected" && (
            <small className="error">Rejected{g.rejectReason ? `: ${g.rejectReason}` : ""}</small>
          )}
        </div>

        <div className="grow-stats">
          <div><strong>{g.playCount || 0}</strong><small>Plays</small></div>
          <div><strong>{g.testRuns ?? 0}</strong><small>Test runs</small></div>
          <div>
            <strong>{s ? `${mb(s.sizeBefore)} → ${mb(s.sizeAfter)}` : "-"}</strong>
            <small>Size</small>
          </div>
        </div>

        <div className="grow-actions">
          {admin && g.status && g.status !== "approved" && (
            <button onClick={() => onApprove(g)}>Approve</button>
          )}
          <button className="btn-secondary" onClick={() => setOpen(!open)}>
            {open ? "Close ▴" : "Manage ▾"}
          </button>
        </div>
      </div>

      {open && (
        <div className="grow-panel">
          <div className="panel-grid">
            <BuildBox game={g} version="unoptimized" onDone={onChanged} />
            <BuildBox game={g} version="optimized" onDone={onChanged} />
            <ThumbBox game={g} onDone={onChanged} />
          </div>
          <div className="row">
            <EditDetails game={g} onDone={onChanged} />
            <button className="btn-danger" onClick={() => onDelete(g)}>Delete game</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GameList({ path, admin = false, emptyText = "No games yet.", onGamesLoaded }) {
  const [games, setGames] = useState(null);
  const [q, setQ] = useState("");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () =>
    api.get(path)
      .then((r) => {
        setGames(r.data);
        onGamesLoaded?.(r.data);
      })
      .catch(() => setMsg("Could not load games"));
  useEffect(() => { load(); }, [path, onGamesLoaded]);

  const withReset = (setter) => (v) => { setter(v); setPage(1); };

  const approve = async (g) => {
    try { await api.put(`/admin/games/${g._id}/status`, { status: "approved" }); load(); }
    catch (err) { setMsg(err.response?.data?.message || "Failed"); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/games/${toDelete._id}`);
      setToDelete(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not delete game");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!games) return <p>{msg || "Loading..."}</p>;
  const shown = sortGames(applyFilters(games, q, rating), sort);
  const paged = paginate(shown, page, PAGE_SIZE);

  return (
    <div>
      <GameFilters
        q={q} setQ={withReset(setQ)} rating={rating} setRating={withReset(setRating)}
        sort={sort} setSort={withReset(setSort)} count={shown.length} total={games.length}
      />
      {msg && <p className="error">{msg}</p>}
      {games.length === 0 && <p>{emptyText}</p>}
      {games.length > 0 && shown.length === 0 && <p>No games match your search or filter.</p>}
      <div className="glist">
        {paged.items.map((g) => (
          <Row key={g._id} g={g} admin={admin} onChanged={load} onDelete={setToDelete} onApprove={approve} />
        ))}
      </div>
      <Pager page={paged.page} pages={paged.pages} onChange={setPage} />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete game?"
        message={toDelete ? `"${toDelete.title}", all its build files and all its test runs will be permanently deleted. This cannot be undone.` : ""}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}