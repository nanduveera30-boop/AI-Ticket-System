import { ACTION_COLORS, RISK_COLORS } from "../utils/constants";

function Tag({ label, colorMap }) {
  const c = colorMap[label] || {};
  return (
    <span className="tag" style={{ background: c.bg, color: c.text }}>
      {label.replace("_", " ")}
    </span>
  );
}

export default function TicketLog({ log }) {
  return (
    <section className="log-section">
      <h2>Live Ticket Log</h2>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Title</th><th>Priority</th>
            <th>User</th><th>Confidence</th><th>Risk</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {log.length === 0 && (
            <tr><td colSpan={7} className="empty-log">No tickets processed yet.</td></tr>
          )}
          {log.map((entry) => (
            <tr key={`${entry.ticket_id}-${entry.ts}`}>
              <td>#{entry.ticket_id}</td>
              <td>{entry.title}</td>
              <td>{entry.priority}</td>
              <td>{entry.user_type}</td>
              <td>{(entry.confidence * 100).toFixed(2)}%</td>
              <td><Tag label={entry.risk}   colorMap={RISK_COLORS}   /></td>
              <td><Tag label={entry.action} colorMap={ACTION_COLORS} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
