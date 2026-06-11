function Card({ label, value, sub, accent }) {
  return (
    <div className={`metric-card ${accent || ""}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value ?? "—"}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

export default function MetricsRow({ metrics }) {
  return (
    <section className="metrics-row">
      <Card label="Total Tickets"  value={metrics?.total_tickets} />
      <Card label="Auto-Resolved"  value={metrics?.auto_resolved_count} sub={`${metrics?.auto_resolved_pct ?? 0}%`} accent="green" />
      <Card label="Escalated"      value={metrics?.escalated_count}     sub={`${metrics?.escalated_pct ?? 0}%`}     accent="red"   />
      <Card label="Suggested"      value={metrics?.suggested_count}                                                  accent="blue"  />
      <Card label="Avg Confidence" value={metrics ? metrics.avg_confidence.toFixed(3) : "—"}                        accent="purple"/>
    </section>
  );
}
