import { useState, useCallback } from "react";

export function useTicketLog() {
  const [log, setLog]                   = useState([]);
  const [confidenceHistory, setHistory] = useState([]);

  const addEntry = useCallback((result, meta) => {
    setLog((prev) => [{ ...result, ...meta, ts: Date.now() }, ...prev]);
    setHistory((prev) => {
      const next = [...prev, { id: result.ticket_id, conf: result.confidence }];
      return next.length > 30 ? next.slice(-30) : next;
    });
  }, []);

  return { log, confidenceHistory, addEntry };
}
