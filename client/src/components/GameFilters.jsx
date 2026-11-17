
const RATINGS = [
  ["all", "Rating: All"],
  ["excellent", "Rating: Excellent"],
  ["good", "Rating: Good"],
  ["fair", "Rating: Fair"],
  ["poor", "Rating: Needs work"],
  ["none", "Rating: Not rated"],
];

const ORDER = {
  excellent: 0,
  good: 1,
  fair: 2,
  poor: 3,
};

export function applyFilters(list, q, rating) {
  const term = q.trim().toLowerCase();

  return list.filter((game) => {
    if (term) {
      const searchableText = [
        game.title,
        game.description,
        game.category,
        game.createdBy?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(term)) {
        return false;
      }
    }

    if (
      rating !== "all" &&
      (game.summary?.rating || "none") !== rating
    ) {
      return false;
    }

    return true;
  });
}

export function sortGames(list, sort) {
  const result = [...list];

  if (sort === "best") {
    result.sort(
      (a, b) =>
        (ORDER[a.summary?.rating] ?? 9) -
          (ORDER[b.summary?.rating] ?? 9) ||
        (a.summary?.loadAfter ?? 1e9) -
          (b.summary?.loadAfter ?? 1e9)
    );
  }

  return result;
}

export default function GameFilters({
  q,
  setQ,
  rating,
  setRating,
  sort,
  setSort,
  count,
  total,
  hideSearch = false,
}) {
  return (
    <div className="filters">
      {!hideSearch && (
        <input
          className="search"
          aria-label="Search games"
          placeholder="Search by title, category or creator"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      )}

      <select
        aria-label="Filter games by optimization rating"
        value={rating}
        onChange={(event) => setRating(event.target.value)}
      >
        {RATINGS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Sort games"
        value={sort}
        onChange={(event) => setSort(event.target.value)}
      >
        <option value="new">Sort: Newest</option>
        <option value="best">Sort: Best optimized</option>
      </select>

      <small className="hint">
        {count} of {total} games
      </small>
    </div>
  );
}
