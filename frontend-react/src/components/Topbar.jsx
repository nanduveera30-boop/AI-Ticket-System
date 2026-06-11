const PAGE_TITLES = {
  dashboard: "Dashboard",
  tickets:   "Tickets",
  voice:     "Voice Assistant",
  audit:     "Audit Logs",
  metrics:   "Metrics",
  admin:     "Admin Portal",
};

export default function Topbar({ page, online }) {
  const isOnline = online === true;
  const isChecking = online === null;

  return (
    <div className="topbar">
      <span className="topbar-title">{PAGE_TITLES[page] || "Dashboard"}</span>
      <div className="topbar-status">
        <span className={`status-dot${isOnline ? " online" : isChecking ? "" : " offline"}`} />
        <span>{isChecking ? "Connecting..." : isOnline ? "API Online" : "API Offline"}</span>
      </div>
    </div>
  );
}
