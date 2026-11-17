import { useEffect } from "react";

export default function ConfirmDialog({
  open, title, message, confirmText = "Delete", busyText = "Deleting...",
  danger = true, busy, children, onConfirm, onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        {children}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? "btn-danger" : ""} onClick={onConfirm} disabled={busy}>
            {busy ? busyText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}