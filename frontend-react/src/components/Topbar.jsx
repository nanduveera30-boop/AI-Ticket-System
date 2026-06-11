const PAGE_TITLES = {
  dashboard: "Intelligence Overview",
  tickets:   "All Tickets",
  voice:     "Voice Studio",
  audit:     "Audit Logs",
  metrics:   "AI Insights",
  admin:     "Admin Panel",
};

export default function Topbar({ page, online }) {
  const isOnline   = online === true;
  const isChecking = online === null;

  return (
    <div className="topbar">
      <div>
        <span className="topbar-title">{PAGE_TITLES[page] || "Dashboard"}</span>
      </div>
      <div className="topbar-status">
        <span className={`status-dot${isOnline ? " online" : isChecking ? "" : " offline"}`} />
        <span>{isChecking ? "Connecting…" : isOnline ? "API Online" : "API Offline"}</span>
        {isOnline && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8, fontSize: 11, color: "var(--primary-container)", fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>security</span>
            Encrypted
          </span>
        )}
      </div>
    </div>
  );
}
