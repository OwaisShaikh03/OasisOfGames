
import { Link } from "react-router-dom";
import { HeroScene } from "../components/OasisArt";

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <HeroScene id="home" />

        <div className="hero-inner">
          <p className="eyebrow">
            FOR DEVELOPERS, TESTERS & PLAYERS
          </p>

          <h1 id="hero-title">
            <span>Build. Test. Play.</span>
            <span>Make every game better.</span>
          </h1>

          <p className="lead">
            Oasis of Games brings game developers, testers
            and players together. Upload and improve Unity
            games, test real-world performance, compare
            optimized builds, and discover games you can
            play right in your browser.
          </p>

          <div className="home-hero-actions">
            <Link className="button" to="/games">
              Explore Games <span aria-hidden="true">→</span>
            </Link>

            <Link className="home-secondary-link" to="/learn">
              Discover Oasis <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        className="home-pathways"
        aria-labelledby="pathways-title"
      >
        <div className="home-pathways-heading">
          <p className="eyebrow">
            ONE PLATFORM, THREE EXPERIENCES
          </p>

          <h2 id="pathways-title">
            What brings you to Oasis?
          </h2>

          <p>
            Whether you create games, test them or simply
            enjoy playing, there's a place for you here.
          </p>
        </div>

        <div className="home-pathways-grid">
          <article className="home-path-card">
            <div className="home-path-icon">
              <span aria-hidden="true">✦</span>
            </div>

            <p className="home-path-label">CREATE</p>
            <h3>For Developers</h3>

            <p>
              Upload your Unity games, manage builds and
              discover opportunities to improve performance.
            </p>

            <Link to="/learn" className="home-path-link">
              Explore the platform <span aria-hidden="true">↗</span>
            </Link>
          </article>

          <article className="home-path-card">
            <div className="home-path-icon">
              <span aria-hidden="true">◈</span>
            </div>

            <p className="home-path-label">IMPROVE</p>
            <h3>For Testers</h3>

            <p>
              Test different builds, explore connection
              conditions and help developers understand
              game performance.
            </p>

            <Link to="/learn" className="home-path-link">
              Discover testing <span aria-hidden="true">↗</span>
            </Link>
          </article>

          <article className="home-path-card">
            <div className="home-path-icon">
              <span aria-hidden="true">▶</span>
            </div>

            <p className="home-path-label">DISCOVER</p>
            <h3>For Players</h3>

            <p>
              Explore browser games, check player ratings
              and jump straight into the action.
            </p>

            <Link to="/games" className="home-path-link">
              Browse games <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
