function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card${accent ? ` accent-${accent}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function MetricsRow({ metrics }) {
  return (
    <div className="stats-grid">
      <StatCard label="Total Tickets"  value={metrics?.total_tickets} />
      <StatCard label="Auto-Resolved"  value={metrics?.auto_resolved_count} sub={`${metrics?.auto_resolved_pct ?? 0}% of processed`} accent="green" />
      <StatCard label="Escalated"      value={metrics?.escalated_count}     sub={`${metrics?.escalated_pct ?? 0}% of processed`}     accent="red" />
      <StatCard label="Suggested"      value={metrics?.suggested_count}                                                               accent="blue" />
      <StatCard label="Avg Confidence" value={metrics ? `${(metrics.avg_confidence * 100).toFixed(1)}%` : "—"}                       accent="purple" />
    </div>
  );
}
