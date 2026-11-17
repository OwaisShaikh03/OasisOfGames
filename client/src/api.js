import axios from "axios";

// Set VITE_API_URL in client/.env (for example the deployed server address)
export const SERVER = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

const api = axios.create({ baseURL: `${SERVER}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server no longer accepts our login (it expired, or the server's secret changed),
// sign out and go to the login page instead of leaving every page empty.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      try { sessionStorage.setItem("sessionExpired", "1"); } catch { /* storage unavailable */ }
      if (!/^\/(login|register)/.test(window.location.pathname)) window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

export default api;