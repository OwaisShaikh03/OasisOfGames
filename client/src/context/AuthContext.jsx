import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

const ROLES = ["player", "tester", "developer", "admin"];
// Accounts saved by older versions had the role "user"; they count as players
const clean = (u) => (u ? { ...u, role: ROLES.includes(u.role) ? u.role : "player" } : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? clean(JSON.parse(saved)) : null;
  });

  const save = (data) => {
    const u = clean(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  // An admin can change your role at any time. Ask the server for the current one when the
  // site opens, so the menu is right without logging in again.
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api
      .get("/auth/me")
      .then((r) => {
        const fresh = clean({ id: r.data.id, username: r.data.username, email: r.data.email, role: r.data.role });
        localStorage.setItem("user", JSON.stringify(fresh));
        setUser((prev) => (prev ? { ...prev, ...fresh } : prev));
      })
      .catch(() => { /* offline or expired: the normal 401 handling deals with it */ });
  }, []);

  // remember = true keeps you signed in for 30 days instead of 1 day
  const login = async (email, password, remember = false) =>
    save((await api.post("/auth/login", { email, password, remember })).data);

  const register = async (username, email, password, role = "player") =>
    save((await api.post("/auth/register", { username, email, password, role })).data);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);