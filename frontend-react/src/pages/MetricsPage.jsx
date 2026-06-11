import { useState, useEffect } from "react";
import { getDetailedMetrics } from "../api/tickets";
import { PriorityBar, DonutChart } from "../components/Charts";

export default function MetricsPage({ metrics }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDetailedMetrics()
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Summary stats */}
      <div className="admin-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Summary Metrics</span>
            <span className="badge badge-blue">Live</span>
          </div>
          {[
            ["Total Tickets",    metrics?.total_tickets ?? "—"],
            ["Auto-Resolved",    metrics ? `${metrics.auto_resolved_count} (${metrics.auto_resolved_pct ?? 0}%)` : "—"],
            ["Escalated",        metrics ? `${metrics.escalated_count} (${metrics.escalated_pct ?? 0}%)` : "—"],
            ["Suggested",        metrics?.suggested_count ?? "—"],
            ["Avg Confidence",   metrics ? `${(metrics.avg_confidence * 100).toFixed(2)}%` : "—"],
          ].map(([l, v]) => (
            <div className="system-stat" key={l}>
              <span className="system-stat-label">{l}</span>
              <span className="system-stat-value">{v}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">AI Engine</span>
          </div>
          {loading ? (
            <div className="loading-state" style={{ padding: 20 }}>Loading…</div>
          ) : (
            <>
              {[
                ["FAISS Index Size",  detail?.faiss_index_size ?? "—"],
                ["Risk — HIGH",       detail?.risk_distribution?.HIGH ?? 0],
                ["Risk — LOW",        detail?.risk_distribution?.LOW ?? 0],
              ].map(([l, v]) => (
                <div className="system-stat" key={l}>
                  <span className="system-stat-label">{l}</span>
                  <span className="system-stat-value">{v}</span>
                </div>
              ))}
              {detail?.recent_decisions?.slice(0, 5).map(d => (
                <div className="system-stat" key={d.ticket_id} style={{ fontSize: 12 }}>
                  <span className="system-stat-label">#{d.ticket_id} — {d.decision?.replace("_", " ")}</span>
                  <span className="system-stat-value">{(d.confidence * 100).toFixed(1)}%</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <DonutChart metrics={metrics} />
        {detail?.priority_distribution && (
          <PriorityBar data={detail.priority_distribution} />
        )}
      </div>
    </>
  );
}
