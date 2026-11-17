
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { day } from "../components/GameParts";

const roleInfo = {
  player: {
    title: "Player",
    description: "Discover games, play and share your experience.",
    links: [{ label: "Explore games", to: "/games" }],
  },
  tester: {
    title: "Tester",
    description: "Play games and help evaluate their performance.",
    links: [
      { label: "Explore games", to: "/games" },
      { label: "My tests", to: "/my-tests" },
    ],
  },
  developer: {
    title: "Developer",
    description: "Upload games, manage builds and review performance.",
    links: [
      { label: "My games", to: "/my-games" },
      { label: "My tests", to: "/my-tests" },
    ],
  },
  admin: {
    title: "Administrator",
    description: "Manage the platform and review submitted games.",
    links: [{ label: "Admin panel", to: "/admin" }],
  },
};

export default function Profile() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [busy, setBusy] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.get("/auth/me")
      .then((r) => {
        if (!cancelled) setMe(r.data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your account. Please refresh the page.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });

    if (!current) {
      setMsg({ text: "Enter your current password.", ok: false });
      return;
    }

    if (next.length < 8) {
      setMsg({ text: "Your new password must be at least 8 characters.", ok: false });
      return;
    }

    if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      setMsg({ text: "Include at least one letter and one number.", ok: false });
      return;
    }

    if (next !== again) {
      setMsg({ text: "The new passwords do not match.", ok: false });
      return;
    }

    setBusy(true);

    try {
      const r = await api.put("/auth/password", {
        currentPassword: current,
        newPassword: next,
      });

      if (r.data.token) {
        localStorage.setItem("token", r.data.token);
      }

      setCurrent("");
      setNext("");
      setAgain("");
      setMsg({ text: "Your password has been changed successfully.", ok: true });
    } catch (err) {
      setMsg({
        text: err.response?.data?.message || "Could not change your password.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="container profile-page">
        <div className="profile-error">
          <h2>Account unavailable</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="container profile-page">
        <div className="profile-loading">
          <div className="profile-spinner" />
          <p>Loading your account...</p>
        </div>
      </main>
    );
  }

  const role = roleInfo[me.role] || roleInfo.player;
  const initial = (me.username || "U").charAt(0).toUpperCase();

  return (
    <main className="container profile-page">
      <div className="profile-heading">
        <div>
          <div className="profile-eyebrow">YOUR OASIS ACCOUNT</div>
          <h1>Account & profile</h1>
          <p>Manage your account details and security settings.</p>
        </div>
        <Link to="/" className="profile-back-link">← Back to home</Link>
      </div>

      <section className="profile-hero">
        <div className="profile-avatar">{initial}</div>

        <div className="profile-hero-info">
          <span className="profile-eyebrow">WELCOME BACK</span>
          <h2>{me.username}</h2>
          <p>{me.email}</p>
        </div>

        <div className="profile-role">
          <span>ACCOUNT ROLE</span>
          <strong>{role.title}</strong>
        </div>
      </section>

      <div className="profile-layout">
        <div className="profile-main-column">
          <section className="profile-panel">
            <div className="profile-panel-heading">
              <div>
                <span className="profile-eyebrow">PERSONAL INFORMATION</span>
                <h2>Account details</h2>
              </div>
              <span className="profile-panel-icon">◎</span>
            </div>

            <div className="profile-details">
              <div className="profile-detail">
                <span>Username</span>
                <strong>{me.username || "—"}</strong>
              </div>
              <div className="profile-detail">
                <span>Email address</span>
                <strong>{me.email || "—"}</strong>
              </div>
              <div className="profile-detail">
                <span>Account type</span>
                <strong>{role.title}</strong>
              </div>
              <div className="profile-detail">
                <span>Member since</span>
                <strong>{me.createdAt ? day(me.createdAt) : "—"}</strong>
              </div>
              <div className="profile-detail">
                <span>Games uploaded</span>
                <strong>{me.games ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className="profile-panel profile-password-panel">
            <div className="profile-panel-heading">
              <div>
                <span className="profile-eyebrow">ACCOUNT SECURITY</span>
                <h2>Change password</h2>
                <p>Choose a strong password to keep your account secure.</p>
              </div>
              <span className="profile-panel-icon">⌑</span>
            </div>

            <form className="profile-password-form" onSubmit={submit}>
              <label>
                Current password
                <input
                  type={showPasswords ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </label>

              <label>
                New password
                <input
                  type={showPasswords ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="Create a new password"
                  autoComplete="new-password"
                />
              </label>

              <label>
                Confirm new password
                <input
                  type={showPasswords ? "text" : "password"}
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  placeholder="Enter the new password again"
                  autoComplete="new-password"
                />
              </label>

              <label className="profile-show-password">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                />
                Show passwords
              </label>

              <div className="profile-password-hint">
                <strong>Password requirements</strong>
                <span>At least 8 characters</span>
                <span>At least one letter and one number</span>
              </div>

              {msg.text && (
                <div className={`profile-message ${msg.ok ? "success" : "failure"}`}>
                  {msg.ok ? "✓" : "!"} {msg.text}
                </div>
              )}

              <button className="profile-save-button" type="submit" disabled={busy}>
                {busy ? "Updating password..." : "Update password"}
              </button>
            </form>
          </section>
        </div>

        <aside className="profile-side-column">
          <section className="profile-panel profile-role-panel">
            <span className="profile-eyebrow">YOUR MEMBERSHIP</span>
            <h2>{role.title}</h2>
            <p>{role.description}</p>
            <div className="profile-role-divider" />
            <span className="profile-small-label">YOUR QUICK LINKS</span>

            {role.links.map((item) => (
              <Link key={item.to} className="profile-quick-link" to={item.to}>
                {item.label}
                <span>↗</span>
              </Link>
            ))}
          </section>

          <section className="profile-security-card">
            <div className="profile-security-icon">✓</div>
            <h3>Keep your account secure</h3>
            <p>
              Never share your password. Use a unique password that you don't
              use on other websites.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
