
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api, { SERVER } from "../api";
import GameFilters, {
  applyFilters,
  sortGames,
} from "../components/GameFilters";
import Pager, { paginate } from "../components/Pager";
import { Stars } from "../components/Stars";

const PAGE_SIZE = 12;

const waitWidth = (seconds) =>
  Math.max(6, Math.min(100, Math.round((seconds / 60) * 100)));

export default function Games() {
  const [games, setGames] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [ratings, setRatings] = useState({});
  const [q, setQ] = useState("");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    api
      .get("/games")
      .then((res) => {
        if (active) setGames(res.data);
      })
      .catch(() => {
        if (active) setGames([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    api
      .get("/reviews/stats")
      .then((res) => {
        if (active) setRatings(res.data);
      })
      .catch(() => {
        // Ratings are optional.
      });

    return () => {
      active = false;
    };
  }, []);

  const withReset = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const shown = sortGames(
    applyFilters(games, q, rating),
    sort
  );

  const paged = paginate(shown, page, PAGE_SIZE);

  return (
    <div className="container games-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE COLLECTION</p>
          <h1>Explore games</h1>
          <p className="section-subtitle">
            Discover browser games, find your next favourite
            and see how they perform.
          </p>
        </div>
      </div>

      <GameFilters
        q={q}
        setQ={withReset(setQ)}
        rating={rating}
        setRating={withReset(setRating)}
        sort={sort}
        setSort={withReset(setSort)}
        count={shown.length}
        total={games.length}
      />

      {paged.items.length > 0 && (
        <div className="tiles">
          {paged.items.map((game) => {
            const review = ratings[game._id];

            return (
              <article className="tile" key={game._id}>
                <Link
                  className="tile-thumb"
                  to={`/games/${game._id}`}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <img
                    src={
                      game.thumbnail
                        ? SERVER + game.thumbnail
                        : "/default-thumb.svg"
                    }
                    alt=""
                    loading="lazy"
                  />

                  {game.summary && (
                    <span
                      className={`rating ${game.summary.rating}`}
                    >
                      {game.summary.label}
                    </span>
                  )}
                </Link>

                <div className="tile-body">
                  <h3>
                    <Link to={`/games/${game._id}`}>
                      {game.title}
                    </Link>
                  </h3>

                  <p className="tile-desc">
                    {game.description}
                  </p>

                  <ul className="facts" aria-label="Game details">
                    <li>{game.dimension}</li>
                    <li>{game.category}</li>
                    <li>{game.complexity}</li>
                  </ul>

                  <div className="tile-foot">
                    {game.createdBy?.username && (
                      <span className="tile-by">
                        By {game.createdBy.username}
                      </span>
                    )}

                    <div className="card-rating">
                      {review ? (
                        <>
                          <Stars value={review.avg} />
                          <span>
                            {review.avg.toFixed(1)}
                            {" "}({review.count})
                          </span>
                        </>
                      ) : (
                        <span>No player ratings yet</span>
                      )}
                    </div>

                    {game.summary && (
                      <div className="level">
                        <div
                          className="level-track"
                          role="img"
                          aria-label={`Loads in about ${Math.round(
                            game.summary.loadAfter
                          )} seconds on 4G`}
                        >
                          <span
                            className={game.summary.rating}
                            style={{
                              width: `${waitWidth(
                                game.summary.loadAfter
                              )}%`,
                            }}
                          />
                        </div>

                        <span>
                          About {Math.round(game.summary.loadAfter)}
                          {" "}s to load on 4G
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loaded && (
        <p className="empty" role="status">
          Loading games...
        </p>
      )}

      {loaded && games.length === 0 && (
        <p className="empty">
          No games here yet. Check back soon.
        </p>
      )}

      {games.length > 0 && shown.length === 0 && (
        <p className="empty">
          No games match your search. Try a different word,
          or set the rating filter back to All.
        </p>
      )}

      <Pager
        page={paged.page}
        pages={paged.pages}
        onChange={setPage}
      />
    </div>
  );
}
