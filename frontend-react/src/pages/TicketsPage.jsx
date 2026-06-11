import { useState, useEffect } from "react";
import { listTickets } from "../api/tickets";
import { updateTicketStatus } from "../api/chat";

const PRI_CLS = { P1: "badge-red", P2: "badge-yellow", P3: "badge-gray" };
const STA_CLS = { open: "badge-blue", in_progress: "badge-yellow", escalated: "badge-red", resolved: "badge-green", closed: "badge-gray" };
const STATUSES = ["open", "in_progress", "escalated", "resolved", "closed"];

export default function TicketsPage() {
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [priority, setPriority] = useState("");
  const [skip, setSkip]         = useState(0);
  const [updating, setUpdating] = useState(null);
  const [msg, setMsg]           = useState(null);
  const LIMIT = 50;

  async function load() {
    setLoading(true);
    try {
      const params = { limit: LIMIT, skip };
      if (priority) params.priority = priority;
      setTickets(await listTickets(params));
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [priority, skip]);

  async function handleStatusChange(ticketId, status) {
    setUpdating(ticketId);
    try {
      await updateTicketStatus(ticketId, status);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
      setMsg("Status updated");
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg("Failed to update status");
      setTimeout(() => setMsg(null), 2500);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">All Tickets</div>
          <div className="card-sub">Browse, inspect and update ticket status</div>
        </div>
        <div className="filters-bar">
          <select className="filter-select" value={priority} onChange={e => { setPriority(e.target.value); setSkip(0); }}>
            <option value="">All Priorities</option>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Normal</option>
          </select>
          <button className="btn-ghost btn-sm" onClick={load}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "8px 14px", background: "var(--primary-fixed)", color: "var(--on-primary-fixed)", borderRadius: "var(--r)", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
          {msg}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Category</th>
              <th>Priority</th>
              <th>User Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr className="empty-row"><td colSpan={7}>Loading…</td></tr>}
            {!loading && tickets.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>inbox</span>
                  No tickets found.
                </td>
              </tr>
            )}
            {tickets.map(t => (
              <tr key={t.id}>
                <td className="td-primary" style={{ color: "var(--primary-container)" }}>#{t.id}</td>
                <td className="td-primary" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</td>
                <td style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>{t.category || "—"}</td>
                <td><span className={`badge ${PRI_CLS[t.priority] || "badge-gray"}`}>{t.priority}</span></td>
                <td style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>{t.user_type}</td>
                <td>
                  <select
                    className="user-role-select"
                    value={t.status}
                    disabled={updating === t.id}
                    onChange={e => handleStatusChange(t.id, e.target.value)}
                    style={{ minWidth: 110 }}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </td>
                <td style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="btn-ghost btn-sm" disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - LIMIT))}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_left</span> Prev
        </button>
        <span>Page {Math.floor(skip / LIMIT) + 1}</span>
        <button className="btn-ghost btn-sm" disabled={tickets.length < LIMIT} onClick={() => setSkip(s => s + LIMIT)}>
          Next <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
        </button>
      </div>
    </div>
  );
}
