const ACTION_BADGE = {
  AUTO_RESOLVE: "badge-green",
  SUGGEST:      "badge-yellow",
  ESCALATE:     "badge-red",
};
const RISK_BADGE = { LOW: "badge-green", HIGH: "badge-red" };

export default function ResultPanel({ result }) {
  if (!result) return null;
  const bd = result.explanation.confidence_breakdown;
  const { ticket_category, financial_category, classifier_confidence, similarity_matches, reason } = result.explanation;

  return (
    <div className="result-panel">
      <div className="result-header">
        <span className={`badge ${ACTION_BADGE[result.action] || "badge-gray"}`}>{result.action.replace("_", " ")}</span>
        <span className={`badge ${RISK_BADGE[result.risk] || "badge-gray"}`}>{result.risk} RISK</span>
        <span className="conf-value">Confidence: <strong>{(result.confidence * 100).toFixed(2)}%</strong></span>
      </div>

      <div className="category-row">
        <div className="category-item"><span className="cat-label">Category</span><span className="cat-value">{ticket_category}</span></div>
        <div className="category-item"><span className="cat-label">Domain</span><span className="cat-value">{financial_category}</span></div>
        <div className="category-item"><span className="cat-label">Model Score</span><span className="cat-value">{(classifier_confidence * 100).toFixed(1)}%</span></div>
      </div>

      <p className="result-reason">{reason}</p>

      <div className="breakdown-grid">
        {[["Classification", bd.classification_prob], ["Similarity", bd.similarity_score], ["Historical", bd.historical_success], ["Risk Adj.", bd.risk_adjustment]].map(([l, v]) => (
          <div className="breakdown-item" key={l}>
            <div className="b-label">{l}</div>
            <div className="b-val">{(v * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>

      <div className="rag-section">
        <h4>Similar Tickets — RAG</h4>
        {similarity_matches.length === 0
          ? <p style={{ fontSize: 12, color: "var(--text3)" }}>No similar tickets in index yet.</p>
          : similarity_matches.map(m => (
            <div className="rag-match" key={m.ticket_id}>
              <span>#{m.ticket_id} — {m.title}</span>
              <span className="rag-score">{(m.score * 100).toFixed(1)}%</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}
