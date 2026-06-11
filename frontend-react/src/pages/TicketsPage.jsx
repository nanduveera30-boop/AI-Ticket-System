import { useState, useEffect } from "react";
import { listTickets, getTicketPrediction } from "../api/tickets";

const PRI_CLS  = { P1: "badge-red", P2: "badge-yellow", P3: "badge-gray" };
const ACT_CLS  = { AUTO_RESOLVE: "badge-green", SUGGEST: "badge-yellow", ESCALATE: "badge-red" };

export default function TicketsPage() {
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [priority, setPriority] = useState("");
  const [skip, setSkip]         = useState(0);
  const LIMIT = 50;

  async function load() {
    setLoading(true);
    try {
      const params = { limit: LIMIT, skip };
      if (priority) params.priority = priority;
      const data = await listTickets(params);
      setTickets(data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [priority, skip]);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">All Tickets</div>
          <div className="card-sub">Browse and inspect tickets from the database</div>
        </div>
        <div className="filters-bar">
          <select className="filter-select" value={priority} onChange={e => { setPriority(e.target.value); setSkip(0); }}>
            <option value="">All Priorities</option>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Normal</option>
          </select>
          <button className="btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Title</th><th>Description</th><th>Priority</th><th>User</th><th>Created</th></tr>
          </thead>
          <tbody>
            {loading && <tr className="empty-row"><td colSpan={6}>Loading…</td></tr>}
            {!loading && tickets.length === 0 && <tr className="empty-row"><td colSpan={6}>No tickets found.</td></tr>}
            {tickets.map(t => (
              <tr key={t.id}>
                <td className="td-primary">#{t.id}</td>
                <td className="td-primary" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text3)", fontSize: 12 }}>{t.description}</td>
                <td><span className={`badge ${PRI_CLS[t.priority] || "badge-gray"}`}>{t.priority}</span></td>
                <td>{t.user_type}</td>
                <td style={{ fontSize: 12, color: "var(--text3)" }}>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="btn-ghost btn-sm" disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - LIMIT))}>← Prev</button>
        <span>Page {Math.floor(skip / LIMIT) + 1}</span>
        <button className="btn-ghost btn-sm" disabled={tickets.length < LIMIT} onClick={() => setSkip(s => s + LIMIT)}>Next →</button>
      </div>
    </div>
  );
}
