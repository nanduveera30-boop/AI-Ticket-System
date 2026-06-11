import { ACTION_COLORS, RISK_COLORS } from "../utils/constants";

function Badge({ label, colorMap }) {
  const c = colorMap[label] || {};
  return (
    <span className="result-badge" style={{ background: c.bg, color: c.text }}>
      {label.replace("_", " ")}
    </span>
  );
}

export default function ResultPanel({ result }) {
  const bd = result.explanation.confidence_breakdown;
  const matches = result.explanation.similarity_matches;

  return (
    <div className="result-panel">
      <div className="result-header">
        <Badge label={result.action} colorMap={ACTION_COLORS} />
        <Badge label={result.risk}   colorMap={RISK_COLORS} />
        <span className="conf-label">
          Confidence: {(result.confidence * 100).toFixed(2)}%
        </span>
      </div>

      <p className="result-reason">{result.explanation.reason}</p>

      <div className="breakdown">
        {[
          ["Classification", bd.classification_prob],
          ["Similarity",     bd.similarity_score],
          ["Historical",     bd.historical_success],
          ["Risk Adj.",      bd.risk_adjustment],
        ].map(([label, val]) => (
          <div className="breakdown-item" key={label}>
            <div className="b-label">{label}</div>
            <div className="b-val">{(val * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>

      <div className="matches">
        <h4>Similar Tickets (RAG)</h4>
        {matches.length === 0 ? (
          <p className="no-matches">No similar tickets yet.</p>
        ) : (
          matches.map((m) => (
            <div className="match-row" key={m.ticket_id}>
              <span>#{m.ticket_id} — {m.title}</span>
              <span>{(m.score * 100).toFixed(1)}% match</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
