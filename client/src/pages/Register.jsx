
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCOUNT_TYPES = [
  {
    value: "player",
    label: "Player",
    description: "Play games, rate them and leave comments.",
    symbol: "P",
  },
  {
    value: "tester",
    label: "Tester",
    description: "Test games and contribute performance runs.",
    symbol: "T",
  },
  {
    value: "developer",
    label: "Developer",
    description: "Upload Unity WebGL games for admin review.",
    symbol: "D",
  },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("player");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const problem = () => {
    if (!USERNAME_RE.test(username.trim())) {
      return "Username must be 3-30 characters: letters, numbers or underscore";
    }

    if (!EMAIL_RE.test(email.trim())) {
      return "Enter a valid email address";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password needs at least one letter and one number";
    }

    return "";
  };

  const submit = async (e) => {
    e.preventDefault();

    const validationError = problem();

    if (validationError) {
      return setError(validationError);
    }

    setError("");
    setBusy(true);

    try {
      await register(
        username.trim(),
        email.trim(),
        password,
        role
      );

      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Registration failed. Check that the server is running."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      intro="Play, test or share games. Choose your path and become part of the Oasis."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="auth-form register-form" onSubmit={submit}>
        <label>
          Username
          <input
            type="text"
            placeholder="Choose a username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
          />
        </label>

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
            placeholder="Create a password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <small className="hint">
          At least 8 characters, including one letter and one number.
        </small>

        <fieldset className="account-type">
          <legend>Choose your account type</legend>

          <div className="account-options">
            {ACCOUNT_TYPES.map((account) => (
              <label
                key={account.value}
                className={`account-option ${
                  role === account.value ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={account.value}
                  checked={role === account.value}
                  onChange={() => setRole(account.value)}
                />

                <span className="account-symbol" aria-hidden="true">
                  {account.symbol}
                </span>

                <span className="account-copy">
                  <strong>{account.label}</strong>
                  <small>{account.description}</small>
                </span>
              </label>
            ))}
          </div>

          <small className="hint">
            Only an admin can change your account type after registration.
          </small>
        </fieldset>

        <button
          type="submit"
          className="auth-submit"
          disabled={busy}
        >
          {busy ? "Creating account..." : "Create account"}
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
