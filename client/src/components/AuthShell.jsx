
import { HeroScene, Mark } from "./OasisArt";

export default function AuthShell({
  title,
  intro,
  children,
  footer,
}) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <HeroScene id="auth" view="600 0 600 460" />

        <div className="auth-brand">
          <Mark size={32} />
          <span>Oasis of Games</span>
        </div>

        <div className="auth-aside-copy">
          <p className="eyebrow">A WORLD OF GAMES</p>
          <h2>Find your next favourite.</h2>
          <p>{intro}</p>
        </div>

        <div className="auth-aside-bottom">
          PLAY · TEST · CREATE
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Mark size={28} />
          <span>Oasis of Games</span>
        </div>

        <div className="auth-form-heading">
          <p className="eyebrow">WELCOME TO THE OASIS</p>
          <h1>{title}</h1>
        </div>

        {children}

        {footer && (
          <p className="auth-alt">{footer}</p>
        )}
      </section>
    </div>
  );
}
