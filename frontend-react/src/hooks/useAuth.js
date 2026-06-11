import { useState, useCallback } from "react";
import client from "../api/client";

export function useAuth() {
  const [token, setToken]     = useState(() => localStorage.getItem("token") || null);
  const [user, setUser]       = useState(() => {
    try {
      const u = localStorage.getItem("user");
      if (!u) return null;
      const parsed = JSON.parse(u);
      // If stored user has no role, it's stale — force re-login
      if (!parsed?.role) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);

  // Restore auth header on mount
  if (token && user) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  const fetchMe = useCallback(async () => {
    const res = await client.get("/auth/me");
    return res.data; // { id, username, email, role, full_name, is_active }
  }, []);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.post("/auth/token", { username, password });
      const { access_token } = res.data;
      client.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      localStorage.setItem("token", access_token);

      // Fetch full profile to get role
      const profile = await client.get("/auth/me").then(r => r.data);
      localStorage.setItem("user", JSON.stringify(profile));
      setToken(access_token);
      setUser(profile);
      return true;
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.error || "Invalid credentials");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username, email, password, fullName = "", role = "customer") => {
    setLoading(true);
    setError(null);
    try {
      await client.post("/auth/register", { username, email, password, role, full_name: fullName });
      return await login(username, password);
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.error || "Registration failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete client.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  }, []);

  return { token, user, error, loading, login, register, logout };
}
