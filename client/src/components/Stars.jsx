import { useState } from "react";

// Read-only stars: fills to any value from 0 to 5 (for example 3.5)
export function Stars({ value = 0, big = false }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span
      className={big ? "stars big" : "stars"}
      style={{ "--pct": `${(v / 5) * 100}%` }}
      role="img"
      aria-label={`${v.toFixed(1)} out of 5 stars`}
    >
      ★★★★★
    </span>
  );
}

// Clickable stars for choosing a rating
export function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="star-picker" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= shown ? "on" : ""}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}