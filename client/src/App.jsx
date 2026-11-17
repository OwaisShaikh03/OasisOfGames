import { useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import Welcome from "./components/Welcome";
import Games from "./pages/Games";
import GameDetail from "./pages/GameDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyGames from "./pages/MyGames";
import MyTests from "./pages/MyTests";
import Profile from "./pages/Profile";
import Learn from "./pages/Learn";
import Admin from "./pages/Admin";
import Compare from "./pages/Compare";
import TestRuns from "./pages/TestRuns";
import Home from "./pages/Home";
import { Mark } from "./components/OasisArt";

const SEEN_KEY = "welcomeSeen";

function firstVisit() {
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function TesterRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  return user.role === "tester"
    ? children
    : <Navigate to="/" replace />;
}

function DeveloperRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  return user.role === "developer" || user.role === "admin"
    ? children
    : <Navigate to="/" />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();

  return user && user.role === "admin"
    ? children
    : <Navigate to="/login" />;
}

export default function App() {
  const { user, logout } = useAuth();
  const [welcome, setWelcome] = useState(firstVisit);

  const closeWelcome = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage may be unavailable.
    }

    setWelcome(false);
  };

  return (
    <>
      {welcome && <Welcome onClose={closeWelcome} />}

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav aria-label="Main">
        <Link className="brand" to="/">
          <Mark size={30} />
          <span>Oasis of Games</span>
        </Link>

        <NavLink to="/" end>
           Home
        </NavLink>

        <NavLink to="/games">
           Games
        </NavLink>

        <NavLink to="/learn">
          Learn
        </NavLink>

        {user?.role === "tester" && (
          <Link to="/test-runs">Test Runs</Link>
        )}

        {user?.role === "admin" && (
          <NavLink to="/admin">
            Admin
          </NavLink>
        )}

        {(user?.role === "developer" || user?.role === "admin") && (
          <NavLink to="/my-games">
            My games
          </NavLink>
        )}

        {(user?.role === "developer" || user?.role === "admin") && (
          <NavLink to="/my-tests">
            My tests
          </NavLink>
        )}

        <div className="right">
          <button
            type="button"
            className="link"
            onClick={() => setWelcome(true)}
          >
            About
          </button>

          {user ? (
            <>
              <Link
                className="me"
                to="/profile"
                title="Your profile"
              >
                <span className="avatar" aria-hidden="true">
                  {user.username.charAt(0).toUpperCase()}
                </span>

                {user.username}

                <span className="role">
                  {user.role}
                </span>
              </Link>

              <button
                type="button"
                className="link"
                onClick={logout}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">
                Log in
              </NavLink>

              <Link className="button" to="/register">
                Create account
              </Link>
            </>
          )}
        </div>
      </nav>

      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Games />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/test-runs"
            element={
            <TesterRoute>
            <TestRuns />
            </TesterRoute>
            }
          />

          <Route
            path="/my-games"
            element={
              <DeveloperRoute>
                <MyGames />
              </DeveloperRoute>
            }
          />

          <Route
            path="/my-tests"
            element={
              <RequireAuth>
                <MyTests />
              </RequireAuth>
            }
          />

          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />

          <Route
            path="/games/:id/compare"
            element={<Compare />}
          />
        </Routes>
      </main>

      <footer className="site-footer">
        <span className="brand">
          <Mark size={22} />
          Oasis of Games
        </span>

        <span>
          Play Unity WebGL games and see how fast they load.
        </span>

        <Link className="spacer" to="/learn">
          How to make a game load faster
        </Link>
      </footer>
    </>
  );
}
