import { ACTION_COLORS, RISK_COLORS } from "../utils/constants";

function Badge({ label, colorMap, fallbackColor = "#8892a4" }) {
  const c = colorMap[label] || { bg: "rgba(136,146,164,.15)", text: fallbackColor };
  return (
    <span className="result-badge" style={{ background: c.bg, color: c.text }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function CategoryTag({ label }) {
  return (
    <span className="category-tag">{label}</span>
  );
}

export default function ResultPanel({ result }) {
  const bd      = result.explanation.confidence_breakdown;
  const matches = result.explanation.similarity_matches;
  const { ticket_category, financial_category, classifier_confidence } = result.explanation;

  return (
    <div className="result-panel">
      {/* Header row */}
      <div className="result-header">
        <Badge label={result.action} colorMap={ACTION_COLORS} />
        <Badge label={result.risk}   colorMap={RISK_COLORS} />
        <span className="conf-label">
          Confidence: <strong>{(result.confidence * 100).toFixed(2)}%</strong>
        </span>
      </div>

      {/* AI Classification tags */}
      <div className="category-row">
        <div className="category-item">
          <span className="cat-label">Ticket Type</span>
          <CategoryTag label={ticket_category} />
        </div>
        <div className="category-item">
          <span className="cat-label">Domain</span>
          <CategoryTag label={financial_category} />
        </div>
        <div className="category-item">
          <span className="cat-label">Model Confidence</span>
          <CategoryTag label={`${(classifier_confidence * 100).toFixed(1)}%`} />
        </div>
      </div>

      <p className="result-reason">{result.explanation.reason}</p>

      {/* Confidence breakdown */}
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

      {/* RAG matches */}
      <div className="matches">
        <h4>Similar Tickets (RAG — FAISS)</h4>
        {matches.length === 0 ? (
          <p className="no-matches">No similar tickets in index yet.</p>
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
