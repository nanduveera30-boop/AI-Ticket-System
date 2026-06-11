export default function CustomerNav({ page, onNav, user, onLogout }) {
  const initials = user?.username?.slice(0, 2).toUpperCase() || "U";
  const NAV = [
    { id: "raise",      icon: "add_circle",        label: "Submit Ticket" },
    { id: "my-tickets", icon: "confirmation_number", label: "My Tickets" },
    { id: "faq",        icon: "help",              label: "Help Center" },
  ];

  return (
    <header className="customer-nav">
      <div className="cnav-brand" onClick={() => onNav("raise")}>
        <div className="cnav-brand-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#fff", fontVariationSettings: "'FILL' 1" }}>psychology</span>
        </div>
        <span className="cnav-brand-name">ResolvAI</span>
      </div>

      <nav className="cnav-links">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`cnav-link${page === n.id ? " active" : ""}`}
            onClick={() => onNav(n.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: page === n.id ? "'FILL' 1" : "'FILL' 0" }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="cnav-right">
        <div className="cnav-avatar">{initials}</div>
        <span className="cnav-username">{user?.username}</span>
        <button className="cnav-signout" onClick={onLogout} title="Sign out">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
        </button>
      </div>
    </header>
  );
}
