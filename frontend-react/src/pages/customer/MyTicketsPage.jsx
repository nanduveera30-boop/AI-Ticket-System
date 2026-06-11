import { useState, useEffect } from "react";
import { getMyTickets } from "../../api/chat";

const STATUS_CLS = {
  open:        "badge-blue",
  in_progress: "badge-yellow",
  escalated:   "badge-red",
  resolved:    "badge-green",
  closed:      "badge-gray",
};
const PRI_CLS = { P1: "badge-red", P2: "badge-yellow", P3: "badge-gray" };

const STATUS_LABELS = {
  "":           "All",
  open:         "Open",
  in_progress:  "In Progress",
  escalated:    "Escalated",
  resolved:     "Resolved",
  closed:       "Closed",
};

export default function MyTicketsPage({ onOpenTicket }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("");
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    getMyTickets({ limit: 100 })
      .then(setTickets)
      .catch(() => setError("Failed to load tickets. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? tickets.filter(t => t.status === filter) : tickets;

  const counts = Object.fromEntries(
    Object.keys(STATUS_LABELS).map(s => [s, s === "" ? tickets.length : tickets.filter(t => t.status === s).length])
  );

  return (
    <div className="cpage-wide">
      <div className="page-header">
        <h1>My Tickets</h1>
        <p>Track the status of all your support requests.</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {[
          { key: "open",        label: "Open",        color: "var(--primary-container)", bg: "var(--primary-fixed)" },
          { key: "in_progress", label: "In Progress",  color: "var(--on-tertiary-fixed-variant)", bg: "var(--tertiary-fixed)" },
          { key: "escalated",   label: "Escalated",   color: "var(--error)", bg: "var(--error-container)" },
          { key: "resolved",    label: "Resolved",    color: "#166534", bg: "#dcfce7" },
        ].map(s => (
          <div
            key={s.key}
            style={{ background: s.bg, borderRadius: "var(--r3)", padding: "14px 16px", cursor: "pointer", border: filter === s.key ? `2px solid ${s.color}` : "2px solid transparent" }}
            onClick={() => setFilter(filter === s.key ? "" : s.key)}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{counts[s.key] || 0}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
            {filter && <span style={{ fontWeight: 400, color: "var(--on-surface-variant)", marginLeft: 6 }}>— {STATUS_LABELS[filter]}</span>}
          </span>
          <div className="filters-bar">
            {Object.entries(STATUS_LABELS).map(([s, label]) => (
              <button
                key={s}
                className={`filter-btn${filter === s ? " active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

        {loading && (
          <div className="loading-state">
            <span className="material-symbols-outlined" style={{ fontSize: 32, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>hourglass_empty</span>
            Loading your tickets…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--outline)" }}>inbox</span>
            </div>
            <p>{filter ? `No ${STATUS_LABELS[filter].toLowerCase()} tickets.` : "You haven't submitted any tickets yet."}</p>
            {!filter && (
              <p style={{ marginTop: 8, fontSize: 12 }}>Submit your first ticket to get started.</p>
            )}
          </div>
        )}

        <div className="ticket-cards">
          {filtered.map(t => (
            <div
              key={t.id}
              className="ticket-card"
              onClick={() => onOpenTicket(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && onOpenTicket(t.id)}
            >
              <div className="tc-header">
                <span className="tc-id">#{t.id}</span>
                <span className={`badge ${STATUS_CLS[t.status] || "badge-gray"}`}>{t.status?.replace("_", " ")}</span>
                <span className={`badge ${PRI_CLS[t.priority] || "badge-gray"}`}>{t.priority}</span>
                {t.category && (
                  <span className="badge badge-gray" style={{ marginLeft: "auto" }}>{t.category}</span>
                )}
              </div>
              <div className="tc-title">{t.title}</div>
              <div className="tc-desc">{t.description?.slice(0, 120)}{t.description?.length > 120 ? "…" : ""}</div>
              <div className="tc-footer">
                <span>{t.user_type}</span>
                <span>{new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
