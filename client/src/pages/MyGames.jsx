import { useCallback, useMemo, useState } from "react";
import Tabs from "../components/Tabs";
import GameList from "../components/GameList";
import { CreateGameForm } from "../components/GameParts";

export default function MyGames() {
  const [tab, setTab] = useState("games");
  const [games, setGames] = useState(null);

  const handleGamesLoaded = useCallback((items) => setGames(items), []);

  const summary = useMemo(() => {
    const items = games || [];
    return {
      total: items.length,
      approved: items.filter((game) => game.status === "approved").length,
      pending: items.filter((game) => game.status === "pending").length,
      plays: items.reduce((sum, game) => sum + (Number(game.playCount) || 0), 0),
      runs: items.reduce((sum, game) => sum + (Number(game.testRuns) || 0), 0),
    };
  }, [games]);

  return (
    <div className="container my-games-page">
      <section className="my-games-hero">
        <div className="my-games-hero-copy">
          <span className="my-games-eyebrow">DEVELOPER WORKSPACE</span>
          <h1>My games</h1>
          <p>Manage your submissions, update builds, and keep track of how your games are performing.</p>
        </div>
        <button type="button" onClick={() => setTab("add")}>+ Add a game</button>
      </section>

      <section className="my-games-overview" aria-label="Your game statistics">
        <div className="my-games-stat"><span className="my-games-stat-label">Your games</span><strong>{games ? summary.total : "—"}</strong><small>All submissions</small></div>
        <div className="my-games-stat"><span className="my-games-stat-label">Approved</span><strong>{games ? summary.approved : "—"}</strong><small>Visible on the site</small></div>
        <div className="my-games-stat"><span className="my-games-stat-label">In review</span><strong>{games ? summary.pending : "—"}</strong><small>Awaiting approval</small></div>
        <div className="my-games-stat"><span className="my-games-stat-label">Total plays</span><strong>{games ? summary.plays.toLocaleString() : "—"}</strong><small>{games ? `${summary.runs.toLocaleString()} test runs` : "Across your games"}</small></div>
      </section>

      <div className="my-games-workspace">
        <div className="my-games-section-heading">
          <div>
            <h2>{tab === "games" ? "Your library" : "Create a submission"}</h2>
            <p>{tab === "games" ? "Select Manage on a game to update its builds, image, or details." : "Add your game details and upload both build versions."}</p>
          </div>
          {tab === "games" && games && <span className="my-games-total">{summary.total} {summary.total === 1 ? "game" : "games"}</span>}
        </div>

        <Tabs value={tab} onChange={setTab} tabs={[["games", "My games"], ["add", "Add game"]]} />

        {tab === "add" && (
          <div className="my-games-create-panel">
            <div className="my-games-create-intro">
              <span className="my-games-create-icon" aria-hidden="true">＋</span>
              <div>
                <h3>Upload a new game</h3>
                <p>Your submission includes an unoptimized build and an optimized build so players can compare loading performance.</p>
              </div>
            </div>
            <CreateGameForm
              onCreated={() => setTab("games")}
              note="Limits: up to 3 games, 150 MB per zip. New submissions are reviewed by an admin before appearing publicly. Uploading a new build later sends the game for review again."
            />
          </div>
        )}

        {tab === "games" && (
          <div className="my-games-list">
            <GameList
              path="/games/mine"
              emptyText="You have not uploaded any games yet. Use Add game to create your first submission."
              onGamesLoaded={handleGamesLoaded}
            />
          </div>
        )}
      </div>
    </div>
  );
}
