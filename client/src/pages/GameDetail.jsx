import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { SERVER } from "../api";
import { useAuth } from "../context/AuthContext";
import BuildReport from "../components/BuildReport";
import PerformanceSummary from "../components/PerformanceSummary";
import Reviews from "../components/Reviews";

// UI choice -> { label saved with the run, server route prefix }
const CONNS = {
  fresh: { label: "no throttle", base: "/sim/fresh" },
  normal: { label: "no throttle", base: "" },
  fast4g: { label: "Fast 4G", base: "/sim/fast4g" },
  slow4g: { label: "Slow 4G", base: "/sim/slow4g" },
};

const CONNECTION_OPTIONS = [
  {
    value: "fresh",
    title: "Fresh download",
    description:
      "Downloads every game file again. Recommended for counted test runs.",
  },
  {
    value: "normal",
    title: "Normal",
    description:
      "May use cached files. Runs are saved but may not count toward performance results.",
  },
  {
    value: "fast4g",
    title: "Fast 4G",
    description: "Simulates a faster mobile connection.",
  },
  {
    value: "slow4g",
    title: "Slow 4G",
    description:
      "Simulates a slower mobile connection. Loading may take several minutes.",
  },
];

export default function GameDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const playerFrameRef = useRef(null);

  const [game, setGame] = useState(null);
  const [version, setVersion] = useState("unoptimized");

  const [conn, setConn] = useState(() => {
    const saved = localStorage.getItem("conn");
    return CONNS[saved] ? saved : "fresh";
  });

  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [frameState, setFrameState] = useState({
    key: "",
    status: "loading",
  });

  // Open the actual game iframe in fullscreen.
  const enterFullscreen = () => {
    const frame = playerFrameRef.current;

    if (frame?.requestFullscreen) {
      frame.requestFullscreen().catch(() => {
        console.warn("Fullscreen could not be opened.");
      });
    }
  };

  useEffect(() => {
    setGame(null);
    setError("");

    api
      .get(`/games/${id}`)
      .then((res) => setGame(res.data))
      .catch(() => setError("Game not found"));
  }, [id]);

  useEffect(() => {
    if (!sessionStorage.getItem("played-" + id)) {
      sessionStorage.setItem("played-" + id, "1");
      api.post(`/games/${id}/play`).catch(() => {});
    }
  }, [id]);

  // Testers receive a short-lived token for the selected build and connection.
  const isTester = user?.role === "tester";
  const tokenKey = `${id}|${version}|${conn}`;

  const [runToken, setRunToken] = useState(null);

  useEffect(() => {
    if (!isTester) return undefined;

    let cancelled = false;

    api
      .get("/metrics/run-token")
      .then((res) => {
        if (!cancelled) {
          setRunToken({ key: tokenKey, token: res.data.token });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRunToken({ key: tokenKey, token: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTester, tokenKey]);

  if (error) {
    return (
      <div className="container game-state">
        <div className="game-state-icon">!</div>
        <h1>Game unavailable</h1>
        <p>{error}</p>
        <Link className="game-back-link" to="/games">
          Back to games
        </Link>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container game-state">
        <div className="game-loading-mark" />
        <h1>Preparing your game</h1>
        <p>Loading game details and player information…</p>
      </div>
    );
  }

  // A tester's game page waits for the code so the first run is not anonymous.
  const sessionReady = !isTester || runToken?.key === tokenKey;

  const testerCode =
    isTester && runToken?.key === tokenKey ? runToken.token : null;

  const canManage =
    !!user &&
    (user.role === "admin" || game.createdBy?._id === user.id);

  const build = game.builds.find((item) => item.version === version);

  const { label: netLabel, base: netBase } = CONNS[conn];

  const selectedConnection = CONNECTION_OPTIONS.find(
    (option) => option.value === conn
  );

  const playerFrameKey = `${build?.path || "no-build"}|${conn}|${version}|${reloadKey}|${testerCode || ""}`;

  const frameStatus =
    frameState.key === playerFrameKey ? frameState.status : "loading";

  const playerStatus = !build
    ? "NO BUILD"
    : !sessionReady
      ? "PREPARING SESSION"
      : frameStatus === "loaded"
        ? "PLAYER READY"
        : frameStatus === "error"
          ? "LOAD ERROR"
          : "LOADING GAME";

  return (
    <div className="container game-detail-page">
      <nav className="game-breadcrumb" aria-label="Breadcrumb">
        <Link to="/games">Games library</Link>
        <span aria-hidden="true">/</span>
        <span>{game.title}</span>
      </nav>

      <header className="game-detail-header">
        <div className="game-detail-heading">
          <div className="game-eyebrow">
            <span className="game-eyebrow-dot" />
            GAME PROFILE
          </div>

          <h1>{game.title}</h1>

          {game.createdBy?.username && (
            <p className="game-author">
              Developed by <strong>{game.createdBy.username}</strong>
            </p>
          )}
        </div>

        <div className="game-facts" aria-label="Game information">
          <span>{game.dimension}</span>
          <span>{game.category}</span>
          <span>{game.complexity}</span>
          <span>Source: {game.source}</span>
        </div>

        <p className="game-detail-description">{game.description}</p>

        {game.status === "pending" && (
          <div className="game-status-note pending">
            <strong>Awaiting approval</strong>
            <span>
              This game is waiting for admin approval. Only you and admins can
              see it.
            </span>
          </div>
        )}

        {game.status === "rejected" && (
          <div className="game-status-note rejected">
            <strong>Game rejected</strong>
            <span>
              {game.rejectReason
                ? `Reason: ${game.rejectReason}`
                : "This game was rejected."}
            </span>
          </div>
        )}
      </header>

      {/* GAME PLAYER */}
      <section className="game-player-section" aria-label="Game player">
        <div className="game-player-topbar">
          <div>
            <div className="game-section-kicker">NOW PLAYING</div>
            <h2>Game player</h2>
          </div>

          {canManage && (
            <Link className="game-compare-link" to={`/games/${id}/compare`}>
              Compare builds <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>

        <div className="game-player-controls">
          <div className="game-build-control">
            <span className="game-control-label">BUILD VERSION</span>

            <div
              className="game-build-options"
              role="group"
              aria-label="Build to play"
            >
              {game.builds.map((item) => (
                <button
                  key={item.version}
                  type="button"
                  className={item.version === version ? "active" : ""}
                  aria-pressed={item.version === version}
                  onClick={() => setVersion(item.version)}
                >
                  {item.version}
                </button>
              ))}
            </div>
          </div>

          <div className="game-connection-control">
            <label className="game-control-label" htmlFor="game-connection">
              CONNECTION PROFILE
            </label>

            <select
              id="game-connection"
              value={conn}
              onChange={(event) => {
                setConn(event.target.value);
                localStorage.setItem("conn", event.target.value);
              }}
            >
              <option value="fresh">Fresh download</option>
              <option value="normal">Normal connection</option>
              <option value="fast4g">Fast 4G simulation</option>
              <option value="slow4g">Slow 4G simulation</option>
            </select>
          </div>
        </div>

        {selectedConnection && (
          <p className="game-connection-help">
            <strong>{selectedConnection.title}:</strong>{" "}
            {selectedConnection.description}
            {conn !== "fresh" && conn !== "normal" && (
              <span> Connection speed is simulated by the site.</span>
            )}
          </p>
        )}

        {isTester && (
          <div className="game-tester-note">
            <strong>Tester session active</strong>
            <span>
              Runs from this page are saved under your username ({user.username}).
              The game's developer can see which testers ran their game.
            </span>
          </div>
        )}

        <div className="game-player-screen">

          {/* TOOLBAR: OUTSIDE THE GAME IFRAME */}
          <div className="game-player-screenbar">
            <span className="game-player-status" aria-live="polite">
              <i /> {playerStatus}
            </span>

            <span>
              {version} · {selectedConnection?.title}
            </span>

            <div className="game-player-actions">
              <button
                type="button"
                className="game-player-fullscreen"
                onClick={enterFullscreen}
                disabled={!build || !sessionReady}
              >
                <span aria-hidden="true">⛶</span>
                Fullscreen
              </button>

              <button
                type="button"
                className="game-player-reload"
                onClick={() => setReloadKey((current) => current + 1)}
                disabled={!build || !sessionReady}
              >
                <span aria-hidden="true">↻</span>
                Reload game
              </button>
            </div>
          </div>

          {/* GAME WINDOW: IFRAME IS BELOW THE TOOLBAR */}
          <div className="game-player-canvas">
            {build && !sessionReady ? (
              <div className="game-player-message" role="status">
                <div className="game-loading-mark" />
                <strong>Preparing your tester session</strong>
                <span>One moment while we prepare this run…</span>
              </div>
            ) : build && frameStatus === "error" ? (
              <div
                className="game-player-message game-player-error"
                role="alert"
              >
                <strong>We couldn’t load this game</strong>
                <span>
                  Check your connection and try reloading the player.
                </span>

                <button
                  type="button"
                  className="game-player-retry"
                  onClick={() => setReloadKey((current) => current + 1)}
                >
                  Try again
                </button>
              </div>
            ) : build ? (
              <iframe
                ref={playerFrameRef}
                key={playerFrameKey}
                title={game.title}
                src={`${SERVER}${netBase}${build.path}/index.html?net=${encodeURIComponent(netLabel)}${testerCode ? `&tt=${encodeURIComponent(testerCode)}` : ""}`}
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                allow="fullscreen"
                allowFullScreen
                onLoad={() =>
                  setFrameState({
                    key: playerFrameKey,
                    status: "loaded",
                  })
                }
                onError={() =>
                  setFrameState({
                    key: playerFrameKey,
                    status: "error",
                  })
                }
                className="player-frame"
              />
            ) : (
              <div className="game-player-message">
                <strong>No build available</strong>
                <span>There is no uploaded build for this version.</span>
              </div>
            )}
          </div>
        </div>

        <div className="game-player-footnote">
          <span>OASIS GAME PLAYER</span>
          <span>
            Changing the build or connection reloads the game.
          </span>
        </div>
      </section>

      {/* PERFORMANCE INSIGHTS */}
      <section className="game-insights-section" aria-label="Game analysis">
        <div className="game-section-heading">
          <div className="game-section-kicker">UNDER THE HOOD</div>
          <h2>Performance insights</h2>
          <p>See how the game performs and where its build can improve.</p>
        </div>

        <PerformanceSummary gameId={id} />

        {canManage && (
          <div className="game-build-report-wrap">
            <BuildReport gameId={id} version={version} />
          </div>
        )}
      </section>

      {/* PLAYER REVIEWS */}
      <section className="game-community-section" aria-label="Player reviews">
        <div className="game-section-heading">
          <div className="game-section-kicker">THE COMMUNITY</div>
          <h2>Player feedback</h2>
          <p>Ratings and comments from people who have played this game.</p>
        </div>

        <Reviews gameId={id} ownerId={game.createdBy?._id} />
      </section>
    </div>
  );
}