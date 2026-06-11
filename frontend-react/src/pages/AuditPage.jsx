import { useState, useEffect } from "react";
import { getAuditLogs } from "../api/tickets";

const DEC_CLS  = { AUTO_RESOLVE: "badge-green", SUGGEST: "badge-yellow", ESCALATE: "badge-red" };
const RISK_CLS = { LOW: "badge-green", HIGH: "badge-red" };

export default function AuditPage() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [skip, setSkip]         = useState(0);
  const [decision, setDecision] = useState("");
  const LIMIT = 50;

  async function load() {
    setLoading(true);
    try {
      const params = { limit: LIMIT, skip };
      if (decision) params.decision = decision;
      setLogs(await getAuditLogs(params));
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [skip, decision]);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Audit Logs</div>
          <div className="card-sub">Full decision trail for every processed ticket</div>
        </div>
        <div className="filters-bar">
          <select
            className="filter-select"
            value={decision}
            onChange={e => { setDecision(e.target.value); setSkip(0); }}
          >
            <option value="">All Decisions</option>
            <option value="AUTO_RESOLVE">Auto Resolve</option>
            <option value="SUGGEST">Suggest</option>
            <option value="ESCALATE">Escalate</option>
          </select>
          <button className="btn-ghost btn-sm" onClick={load}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticket</th>
              <th>Input</th>
              <th>Confidence</th>
              <th>Risk</th>
              <th>Decision</th>
              <th>Actor</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr className="empty-row"><td colSpan={8}>Loading…</td></tr>}
            {!loading && logs.length === 0 && (
              <tr className="empty-row">
                <td colSpan={8}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>history_edu</span>
                  No audit logs yet.
                </td>
              </tr>
            )}
            {logs.map(l => (
              <tr key={l.id}>
                <td className="td-primary" style={{ color: "var(--primary-container)" }}>#{l.id}</td>
                <td className="td-primary">#{l.ticket_id}</td>
                <td><div className="audit-input-text" title={l.input_text}>{l.input_text}</div></td>
                <td>
                  <div className="conf-bar-wrap">
                    <div className="conf-bar">
                      <div className="conf-bar-fill" style={{ width: `${l.confidence * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--on-surface-variant)", minWidth: 36 }}>
                      {(l.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td><span className={`badge ${RISK_CLS[l.risk] || "badge-gray"}`}>{l.risk}</span></td>
                <td><span className={`badge ${DEC_CLS[l.decision] || "badge-gray"}`}>{l.decision?.replace("_", " ")}</span></td>
                <td style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>{l.actor || "—"}</td>
                <td style={{ fontSize: 11, color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>
                  {new Date(l.timestamp).toLocaleString()}
                </td>
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
        <button className="btn-ghost btn-sm" disabled={logs.length < LIMIT} onClick={() => setSkip(s => s + LIMIT)}>
          Next <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
        </button>
      </div>
    </div>
  );
}
