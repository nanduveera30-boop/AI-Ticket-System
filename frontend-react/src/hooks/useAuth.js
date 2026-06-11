import { useState, useCallback } from "react";
import client from "../api/client";

export function useAuth() {
  const [token, setToken]   = useState(() => localStorage.getItem("token") || null);
  const [user, setUser]     = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.post("/auth/token", { username, password });
      const { access_token } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify({ username }));
      setToken(access_token);
      setUser({ username });
      // Set default auth header
      client.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      return true;
    } catch (e) {
      setError(e.response?.data?.error || "Invalid credentials");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      await client.post("/auth/register", { username, email, password, role: "agent" });
      return await login(username, password);
    } catch (e) {
      setError(e.response?.data?.error || "Registration failed");
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

  // Restore header on mount
  if (token) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  return { token, user, error, loading, login, register, logout };
}
