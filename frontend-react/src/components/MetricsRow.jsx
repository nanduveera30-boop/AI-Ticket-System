const CARDS = [
  { key: "total_tickets",      label: "Total Tickets",   icon: "confirmation_number", iconBg: "var(--surface-container-low)",    iconColor: "var(--primary-container)" },
  { key: "auto_resolved_count",label: "Auto-Resolved",   icon: "auto_awesome",        iconBg: "#dcfce7",                         iconColor: "#166534",                  subKey: "auto_resolved_pct",  subSuffix: "% resolved" },
  { key: "escalated_count",    label: "Escalated",       icon: "warning",             iconBg: "var(--error-container)",          iconColor: "var(--error)",             subKey: "escalated_pct",      subSuffix: "% of total" },
  { key: "suggested_count",    label: "Suggested",       icon: "lightbulb",           iconBg: "var(--tertiary-fixed)",           iconColor: "var(--on-tertiary-fixed-variant)" },
  { key: "avg_confidence",     label: "Avg Confidence",  icon: "analytics",           iconBg: "var(--primary-fixed)",            iconColor: "var(--on-primary-fixed-variant)", isPercent: true },
];

export default function MetricsRow({ metrics }) {
  return (
    <div className="stats-grid">
      {CARDS.map(c => {
        const raw = metrics?.[c.key];
        const value = raw == null ? "—"
          : c.isPercent ? `${(raw * 100).toFixed(1)}%`
          : raw;
        const sub = c.subKey && metrics ? `${metrics[c.subKey] ?? 0}${c.subSuffix}` : null;

        return (
          <div className="stat-card" key={c.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div className="stat-icon" style={{ background: c.iconBg }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.iconColor }}>{c.icon}</span>
              </div>
            </div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
