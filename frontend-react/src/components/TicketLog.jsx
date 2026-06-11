const ACTION_CLS = { AUTO_RESOLVE: "badge-green", SUGGEST: "badge-yellow", ESCALATE: "badge-red" };
const RISK_CLS   = { LOW: "badge-green", HIGH: "badge-red" };
const PRI_CLS    = { P1: "badge-red", P2: "badge-yellow", P3: "badge-gray" };

export default function TicketLog({ log }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Live Ticket Log</div>
          <div className="card-sub">Session activity — {log.length} tickets</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Title</th><th>Priority</th><th>User</th>
              <th>Confidence</th><th>Risk</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && <tr className="empty-row"><td colSpan={7}>No tickets processed this session.</td></tr>}
            {log.map(e => (
              <tr key={`${e.ticket_id}-${e.ts}`}>
                <td className="td-primary">#{e.ticket_id}</td>
                <td className="td-primary" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</td>
                <td><span className={`badge ${PRI_CLS[e.priority] || "badge-gray"}`}>{e.priority}</span></td>
                <td>{e.user_type}</td>
                <td>
                  <div className="conf-bar-wrap">
                    <div className="conf-bar"><div className="conf-bar-fill" style={{ width: `${e.confidence * 100}%` }} /></div>
                    <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 36 }}>{(e.confidence * 100).toFixed(1)}%</span>
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
