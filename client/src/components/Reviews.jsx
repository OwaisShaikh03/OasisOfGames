import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";
import Pager, { paginate } from "./Pager";
import { Stars, StarPicker } from "./Stars";
import { day } from "./GameParts";

const PAGE_SIZE = 5;
const MAX_TEXT = 500;

export default function Reviews({ gameId, ownerId }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);

  const load = () =>
    api.get(`/reviews/game/${gameId}`)
      .then((r) => {
        setData(r.data);
        const mine = r.data.reviews.find((x) => x.mine);
        setRating(mine ? mine.rating : 0);
        setText(mine ? mine.text : "");
      })
      .catch(() => setError("Could not load ratings and comments"));
  useEffect(() => { load(); }, [gameId, user?.id]);

  const mine = data?.reviews.find((r) => r.mine);
  const isOwner = !!user && !!ownerId && String(ownerId) === String(user.id);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });
    if (!rating) return setMsg({ text: "Choose a star rating first", ok: false });
    setBusy(true);
    try {
      await api.post(`/reviews/game/${gameId}`, { rating, text });
      setMsg({ text: mine ? "Your review was updated" : "Thanks for your review!", ok: true });
      await load();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || "Could not post your review", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/reviews/${toDelete._id}`);
      setToDelete(null);
      setMsg({ text: "", ok: false });
      await load();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || "Could not delete the review", ok: false });
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="hint">Loading ratings...</p>;

  const paged = paginate(data.reviews, page, PAGE_SIZE);

  return (
    <div className="summary" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Player ratings and comments</h3>

      {data.count === 0 ? (
        <p className="hint">No ratings yet. Be the first to share what you think.</p>
      ) : (
        <div className="rating-summary">
          <div style={{ textAlign: "center" }}>
            <div className="avg-number">{data.average.toFixed(1)}</div>
            <Stars value={data.average} big />
            <div className="hint">{data.count} {data.count === 1 ? "rating" : "ratings"}</div>
          </div>
          <div className="dist">
            {[5, 4, 3, 2, 1].map((n) => (
              <div className="dist-row" key={n}>
                <span>{n} ★</span>
                <div className="dist-track">
                  <div className="dist-fill" style={{ width: `${(data.breakdown[n] / data.count) * 100}%` }} />
                </div>
                <span>{data.breakdown[n]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="review-form">
        {!user ? (
          <p>
            <Link to="/login">Log in</Link> or <Link to="/register">create a free account</Link> to rate this game and leave a comment.
          </p>
        ) : isOwner ? (
          <p className="hint">This is your game, so you cannot rate it. You can still read what players say.</p>
        ) : (
          <form onSubmit={submit} style={{ maxWidth: "none" }}>
            <strong>{mine ? "Your review" : "Rate this game"}</strong>
            <StarPicker value={rating} onChange={setRating} />
            <textarea
              placeholder="Add a comment (optional)"
              value={text}
              maxLength={MAX_TEXT}
              rows={3}
              onChange={(e) => setText(e.target.value)}
            />
            <small className="hint">{text.length} / {MAX_TEXT}</small>
            <div className="row">
              <button type="submit" disabled={busy}>{busy ? "Saving..." : mine ? "Update review" : "Post review"}</button>
              {mine && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setToDelete(mine)}>Delete my review</button>}
            </div>
            {msg.text && <div className={msg.ok ? "hint" : "error"}>{msg.text}</div>}
          </form>
        )}
      </div>

      {paged.items.map((r) => (
        <div className="review" key={r._id}>
          <div className="review-head">
            <Stars value={r.rating} />
            <strong>{r.username}</strong>
            {r.mine && <span className="tag">You</span>}
            <small className="hint">{day(r.createdAt)}</small>
            {user?.role === "admin" && !r.mine && (
              <button className="btn-danger small" onClick={() => setToDelete(r)}>Delete</button>
            )}
          </div>
          {r.text && <p>{r.text}</p>}
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onChange={setPage} />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete review?"
        message={toDelete?.mine ? "Your rating and comment will be removed." : `The review by ${toDelete?.username || "this user"} will be removed.`}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}