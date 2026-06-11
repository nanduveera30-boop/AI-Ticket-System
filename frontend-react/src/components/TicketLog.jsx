const ACTION_CLS = { AUTO_RESOLVE: "badge-green", SUGGEST: "badge-yellow", ESCALATE: "badge-red" };
const RISK_CLS   = { LOW: "badge-green", HIGH: "badge-red" };
const PRI_CLS    = { P1: "badge-red", P2: "badge-yellow", P3: "badge-gray" };

export default function TicketLog({ log }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Live Activity Log</div>
          <div className="card-sub">Session activity — {log.length} tickets</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse-ring 2s infinite" }} />
          Live
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Title</th><th>Priority</th><th>User</th>
              <th>Confidence</th><th>Risk</th><th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>inbox</span>
                  No tickets processed this session.
                </td>
              </tr>
            )}
            {log.map(e => (
              <tr key={`${e.ticket_id}-${e.ts}`}>
                <td className="td-primary" style={{ color: "var(--primary-container)" }}>#{e.ticket_id}</td>
                <td className="td-primary" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</td>
                <td><span className={`badge ${PRI_CLS[e.priority] || "badge-gray"}`}>{e.priority}</span></td>
                <td style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>{e.user_type}</td>
                <td>
                  <div className="conf-bar-wrap">
                    <div className="conf-bar"><div className="conf-bar-fill" style={{ width: `${e.confidence * 100}%` }} /></div>
                    <span style={{ fontSize: 11, color: "var(--on-surface-variant)", minWidth: 36 }}>{(e.confidence * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td><span className={`badge ${RISK_CLS[e.risk] || "badge-gray"}`}>{e.risk}</span></td>
                <td><span className={`badge ${ACTION_CLS[e.action] || "badge-gray"}`}>{e.action.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
