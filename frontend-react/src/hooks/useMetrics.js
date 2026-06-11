import { useState, useEffect, useCallback } from "react";
import { getMetrics, getHealth } from "../api/tickets";
import client from "../api/client";

export function useMetrics(pollInterval = 10000) {
  const [metrics, setMetrics] = useState(null);
  const [online, setOnline]   = useState(null);

  const refresh = useCallback(async () => {
    // Don't poll if no token
    if (!localStorage.getItem("token")) return;
    try {
      const data = await getMetrics();
      setMetrics(data);
      setOnline(true);
    } catch (e) {
      // 401 = token expired — don't crash, just mark offline
      if (e.response?.status === 401) {
        setOnline(false);
      }
      // other errors: keep last metrics, just mark offline
    }
  }, []);

  useEffect(() => {
    // Initial health check
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));

    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { metrics, online, refresh };
}
