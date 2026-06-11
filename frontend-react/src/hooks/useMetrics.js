import { useState, useEffect, useCallback } from "react";
import { getMetrics, getHealth } from "../api/tickets";

export function useMetrics(pollInterval = 10000) {
  const [metrics, setMetrics] = useState(null);
  const [online, setOnline]   = useState(null); // null = checking

  const refresh = useCallback(async () => {
    try {
      const data = await getMetrics();
      setMetrics(data);
    } catch {
      // API might not be up yet
    }
  }, []);

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));

    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { metrics, online, refresh };
}
