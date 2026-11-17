
import { useState } from "react";
import api, { SERVER } from "../api";
import { useAuth } from "../context/AuthContext";

export const mb = (b) => (b / 1048576).toFixed(2) + " MB";
export const thumbOf = (g) => (g.thumbnail ? SERVER + g.thumbnail : "/default-thumb.svg");
export const day = (d) => new Date(d).toLocaleDateString();

export function StatusBadge({ status }) {
  const s = status || "approved";
  return <span className={`badge ${s}`}>{s}</span>;
}

export function BuildBox({ game, version, onDone }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [key, setKey] = useState(0);
  const { user } = useAuth();
  const b = (game.builds || []).find((x) => x.version === version);

  const send = async () => {
  setMsg("");

  if (!file) {
    setMsg("Please choose a ZIP file.");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    setMsg("Builds must be ZIP files.");
    return;
  }

  const maxSize = user?.role === "admin"
    ? 500 * 1024 * 1024
    : 150 * 1024 * 1024;

  if (file.size > maxSize) {
    setMsg(
      `File is too large. Maximum size: ${user?.role === "admin" ? "500" : "150"} MB.`
    );
    return;
  }

  const fd = new FormData();
  fd.append("build", file);

  setBusy(true);
  setProgress(0);

  try {
    await api.post(`/upload/${game._id}/${version}`, fd, {
      timeout: 0,
      onUploadProgress: (p) =>
        setProgress(Math.round((p.loaded * 100) / (p.total || 1))),
    });

    setMsg("Build uploaded successfully.");
    setFile(null);
    setKey((k) => k + 1);
    onDone();
  } catch (err) {
    setMsg(err.response?.data?.message || err.message || "Upload failed.");
  } finally {
    setBusy(false);
  }
  };

  return (
    <div className="buildbox">
      <strong>{version}</strong>
      <div>{b ? `${mb(b.sizeBytes)} · ${b.compression}` : "No build"}</div>
      <div className="row">
        <input key={key} type="file" accept=".zip" disabled={busy}
          onChange={(e) => setFile(e.target.files[0] || null)} />
        <button disabled={!file || busy} onClick={send}>{busy ? `${progress}%` : "Upload"}</button>
      </div>
      {msg && <small>{msg}</small>}
    </div>
  );
}

export function ThumbBox({ game, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [key, setKey] = useState(0);

  const send = async () => {
    const fd = new FormData();
    fd.append("thumbnail", file);
    setBusy(true); setMsg("");
    try {
      await api.post(`/upload/${game._id}/thumbnail`, fd);
      setFile(null); setKey((k) => k + 1);
      onDone();
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="buildbox">
      <strong>Game image</strong>
      <div className="row">
        <input key={key} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
          onChange={(e) => setFile(e.target.files[0] || null)} />
        <button disabled={!file || busy} onClick={send}>{busy ? "..." : "Upload"}</button>
      </div>
      {msg && <small>{msg}</small>}
    </div>
  );
}

export function EditDetails({ game, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    title: game.title, description: game.description || "", category: game.category || "General",
    dimension: game.dimension, complexity: game.complexity || "light", source: game.source || "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api.put(`/games/${game._id}`, form);
      setOpen(false);
      onDone();
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button onClick={() => setOpen(true)}>Edit details</button>;
  return (
    <form onSubmit={save} style={{ maxWidth: "100%", marginTop: 10 }}>
      <input placeholder="Title" value={form.title} onChange={set("title")} required />
      <input placeholder="Description" value={form.description} onChange={set("description")} />
      <input placeholder="Category" value={form.category} onChange={set("category")} />
      <select value={form.dimension} onChange={set("dimension")}>
        <option>2D</option><option>3D</option>
      </select>
      <select value={form.complexity} onChange={set("complexity")}>
        <option>light</option><option>medium</option><option>heavy</option>
      </select>
      <input placeholder="Source / license" value={form.source} onChange={set("source")} />
      <div className="row">
        <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <small className="error">{msg}</small>}
    </form>
  );
}


export function CreateGameForm({ onCreated, note }) {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileKey, setFileKey] = useState(0);
  const [files, setFiles] = useState({
    unoptimized: null,
    optimized: null,
    thumbnail: null,
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
    dimension: "2D",
    complexity: "light",
    source: "",
  });

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!files.unoptimized || !files.optimized) {
      setMsg("Choose both build zips (unoptimized and optimized).");
      return;
    }

    const isAdmin = user?.role === "admin";
    const maxZipSize = (isAdmin ? 500 : 150) * 1024 * 1024;

    for (const name of ["unoptimized", "optimized"]) {
      const file = files[name];

      if (!file.name.toLowerCase().endsWith(".zip")) {
        setMsg(`The ${name} build must be a ZIP file.`);
        return;
      }

      if (file.size > maxZipSize) {
        setMsg(
          `The ${name} build is too large. Maximum size: ${isAdmin ? "500" : "150"} MB.`
        );
        return;
      }
    }

    if (files.thumbnail) {
      const image = files.thumbnail;
      const allowed = [".png", ".jpg", ".jpeg", ".webp"];
      const extension = image.name
        .slice(image.name.lastIndexOf("."))
        .toLowerCase();

      if (!allowed.includes(extension) || !image.type.startsWith("image/")) {
        setMsg("Game image must be PNG, JPG or WebP.");
        return;
      }

      if (image.size > 2 * 1024 * 1024) {
        setMsg("Game image must be under 2 MB.");
        return;
      }
    }

    if (!form.title.trim()) {
      setMsg("Please enter a game title.");
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v.trim()));
    fd.append("unoptimized", files.unoptimized);
    fd.append("optimized", files.optimized);

    if (files.thumbnail) {
      fd.append("thumbnail", files.thumbnail);
    }

    setBusy(true);
    setProgress(0);
    setMsg("Uploading. Keep this page open.");

    try {
      const res = await api.post("/upload/new", fd, {
        timeout: 0,
        onUploadProgress: (p) => {
          setProgress(
            Math.round((p.loaded * 100) / (p.total || 1))
          );
        },
      });

      setForm({
        title: "",
        description: "",
        category: "General",
        dimension: "2D",
        complexity: "light",
        source: "",
      });

      setFiles({
        unoptimized: null,
        optimized: null,
        thumbnail: null,
      });

      setFileKey((k) => k + 1);
      setMsg("Game created successfully with both builds.");
      onCreated(res.data);
    } catch (err) {
      setMsg(
        err.response?.data?.message ||
        err.message ||
        "Upload failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3>Add game</h3>

      {note && <p className="hint">{note}</p>}

      <form onSubmit={create}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={set("title")}
          required
          disabled={busy}
        />

        <input
          placeholder="Description"
          value={form.description}
          onChange={set("description")}
          disabled={busy}
        />

        <input
          placeholder="Category"
          value={form.category}
          onChange={set("category")}
          disabled={busy}
        />

        <select
          value={form.dimension}
          onChange={set("dimension")}
          disabled={busy}
        >
          <option>2D</option>
          <option>3D</option>
        </select>

        <select
          value={form.complexity}
          onChange={set("complexity")}
          disabled={busy}
        >
          <option>light</option>
          <option>medium</option>
          <option>heavy</option>
        </select>

        <input
          placeholder="Source / license"
          value={form.source}
          onChange={set("source")}
          disabled={busy}
        />

        <label>
          Game image (optional: PNG, JPG or WebP, max 2 MB)
          <input
            key={"t" + fileKey}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            disabled={busy}
            onChange={(e) =>
              setFiles({
                ...files,
                thumbnail: e.target.files[0] || null,
              })
            }
          />
        </label>

        <label>
          Unoptimized build (.zip)
          <input
            key={"u" + fileKey}
            type="file"
            accept=".zip"
            disabled={busy}
            onChange={(e) =>
              setFiles({
                ...files,
                unoptimized: e.target.files[0] || null,
              })
            }
          />
        </label>

        <label>
          Optimized build (.zip)
          <input
            key={"o" + fileKey}
            type="file"
            accept=".zip"
            disabled={busy}
            onChange={(e) =>
              setFiles({
                ...files,
                optimized: e.target.files[0] || null,
              })
            }
          />
        </label>

        <button
          type="submit"
          disabled={
            busy ||
            !files.unoptimized ||
            !files.optimized
          }
        >
          {busy
            ? `Uploading ${progress}%`
            : "Create game and upload builds"}
        </button>
      </form>

      {msg && (
        <p role="status" aria-live="polite">
          {msg}
        </p>
      )}
    </div>
  );
}
