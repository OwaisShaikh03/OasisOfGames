
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";

function sessionExpired() {
  try {
    return !!sessionStorage.getItem("sessionExpired");
  } catch {
    return false;
  }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired] = useState(sessionExpired);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      return setError("Enter your email and password");
    }

    setBusy(true);

    try {
      await login(email.trim(), password, remember);

      try {
        sessionStorage.removeItem("sessionExpired");
      } catch {
        // Storage may be unavailable.
      }

      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Login failed. Check that the server is running."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      intro="Welcome back. Pick up where you left off and discover something worth playing."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register">Create an account</Link>
        </>
      }
    >
      {expired && (
        <p className="notice" role="status">
          Your session ended, so please log in again.
        </p>
      )}

      <form className="auth-form" onSubmit={submit}>
        <label>
          Email address
          <input
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label className="remember-option">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Keep me signed in for 30 days</span>
        </label>

        <small className="hint">
          Without this, you stay signed in for 1 day.
          Only select this on your own device.
        </small>

        <button
          type="submit"
          className="auth-submit"
          disabled={busy}
        >
          {busy ? "Logging in..." : "Log in"}
        </button>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
      </form>
    </AuthShell>
  );
}
