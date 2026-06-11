const NAV = [
  {
    section: "Operations",
    items: [
      { id: "dashboard",  icon: "▦",  label: "Dashboard" },
      { id: "tickets",    icon: "🎫", label: "Tickets" },
      { id: "voice",      icon: "🎙", label: "Voice Assistant" },
    ],
  },
  {
    section: "Analytics",
    items: [
      { id: "audit",      icon: "📋", label: "Audit Logs" },
      { id: "metrics",    icon: "📊", label: "Metrics" },
    ],
  },
  {
    section: "Administration",
    items: [
      { id: "admin",      icon: "⚙",  label: "Admin Portal", adminOnly: true },
    ],
  },
];

export default function Sidebar({ page, onNav, user, onLogout }) {
  const isAdmin = user?.role === "admin";
  const initials = user?.username?.slice(0, 2).toUpperCase() || "U";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">AI</div>
        <div>
          <div className="sidebar-logo-text">TicketAI</div>
          <div className="sidebar-logo-sub">Resolution System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ section, items }) => {
          const visible = items.filter(i => !i.adminOnly || isAdmin);
          if (!visible.length) return null;
          return (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {visible.map(item => (
                <button
                  key={item.id}
                  className={`nav-item${page === item.id ? " active" : ""}`}
                  onClick={() => onNav(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-username">{user?.username}</div>
            <div className="sidebar-role">{user?.role || "agent"}</div>
          </div>
          <button className="btn-signout" onClick={onLogout} title="Sign out">⏻</button>
        </div>
      </div>
    </aside>
  );
}
