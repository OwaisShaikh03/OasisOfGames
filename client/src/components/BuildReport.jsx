import { useEffect, useState } from "react";
import api from "../api";

const icon = { ok: "✓", warn: "!", bad: "✗" };

function Row({ it }) {
  return (
    <div className={`ritem ${it.level}`}>
      <span className="ricon">{icon[it.level]}</span>
      <div>
        <strong>{it.title}</strong>
        <div className="rdetail">{it.detail}</div>
        {it.fix && <div className="rfix">Fix: {it.fix}</div>}
      </div>
    </div>
  );
}

export default function BuildReport({ gameId, version }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(null); setFailed(false);
    api.get(`/games/${gameId}/report`).then((r) => setData(r.data)).catch(() => setFailed(true));
  }, [gameId]);

  if (failed) return null;
  if (!data) return <p className="hint">Analyzing build...</p>;
  const r = data.builds[version];
  if (!r) return null;

  return (
    <div className="report">
      <h3>Build report: {version}</h3>
      <div className="chips">
        <span className="chip ok">{r.counts.ok} passed</span>
        <span className="chip warn">{r.counts.warn} warnings</span>
        <span className="chip bad">{r.counts.bad} problems</span>
      </div>
      {r.items.map((it, i) => <Row key={i} it={it} />)}
      {data.comparison && (
        <>
          <h4>Compared with the other build</h4>
          <Row it={data.comparison.item} />
        </>
      )}
    </div>
  );
}