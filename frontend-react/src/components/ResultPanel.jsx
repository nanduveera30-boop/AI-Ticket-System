import { useState, useEffect } from "react";
import client from "../api/client";

const ACTION_BADGE = { AUTO_RESOLVE: "badge-green", SUGGEST: "badge-yellow", ESCALATE: "badge-red" };
const RISK_BADGE   = { LOW: "badge-green", HIGH: "badge-red" };
const ACTION_ICON  = { AUTO_RESOLVE: "task_alt", SUGGEST: "lightbulb", ESCALATE: "escalator_warning" };
const ACTION_COLOR = {
  AUTO_RESOLVE: { bg: "#dcfce7", color: "#166534", border: "rgba(22,163,74,0.2)" },
  SUGGEST:      { bg: "var(--tertiary-fixed)", color: "var(--on-tertiary-fixed-variant)", border: "rgba(164,65,0,0.2)" },
  ESCALATE:     { bg: "var(--error-container)", color: "var(--on-error-container)", border: "rgba(186,26,26,0.2)" },
};

export default function ResultPanel({ result, onContinueChat }) {
  const [aiExplanation, setAiExplanation] = useState(null);
  const [loadingExpl, setLoadingExpl]     = useState(false);

  if (!result) return null;

  const bd  = result.explanation?.confidence_breakdown;
  const exp = result.explanation || {};
  const {
    ticket_category, financial_category, classifier_confidence,
    similarity_matches = [], reason, apology_message, suggested_actions = [],
  } = exp;

  const actionStyle = ACTION_COLOR[result.action] || ACTION_COLOR.SUGGEST;

  // Fetch Gemini explanation after render
  useEffect(() => {
    if (!result.ticket_id) return;
    setLoadingExpl(true);
    client.get(`/tickets/${result.ticket_id}/prediction`)
      .then(r => {
        if (r.data.ai_explanation) setAiExplanation(r.data.ai_explanation);
      })
      .catch(() => {})
      .finally(() => setLoadingExpl(false));
  }, [result.ticket_id]);

  return (
    <div className="result-panel">
      {/* Decision banner */}
      <div style={{
        background: actionStyle.bg,
        border: `1px solid ${actionStyle.border}`,
        borderRadius: "var(--r2)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: actionStyle.color, fontVariationSettings: "'FILL' 1" }}>
          {ACTION_ICON[result.action] || "lightbulb"}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: actionStyle.color, letterSpacing: "-0.01em" }}>
            {result.action === "AUTO_RESOLVE" ? "Auto-Resolved" : result.action === "ESCALATE" ? "Escalated to Specialist" : "Agent Review Suggested"}
          </div>
          <div style={{ fontSize: 12, color: actionStyle.color, opacity: 0.8, marginTop: 2 }}>
            {result.action === "AUTO_RESOLVE" && "Our AI resolved this automatically based on similar cases."}
            {result.action === "ESCALATE" && "This ticket requires specialist attention and has been escalated."}
            {result.action === "SUGGEST" && "A support agent will review and respond to your ticket."}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: actionStyle.color }}>{(result.confidence * 100).toFixed(0)}%</div>
          <div style={{ fontSize: 10, color: actionStyle.color, opacity: 0.7, fontWeight: 600, textTransform: "uppercase" }}>Confidence</div>
        </div>
      </div>

      {/* Risk + categories row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span className={`badge ${RISK_BADGE[result.risk] || "badge-gray"}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{result.risk === "HIGH" ? "warning" : "check_circle"}</span>
          {result.risk} RISK
        </span>
        {ticket_category && <span className="badge badge-blue">{ticket_category}</span>}
        {financial_category && <span className="badge badge-gray">{financial_category}</span>}
        {classifier_confidence != null && (
          <span style={{ fontSize: 11, color: "var(--on-surface-variant)", marginLeft: "auto", alignSelf: "center" }}>
            Model: {(classifier_confidence * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* AI Explanation (Gemini) */}
      <div style={{
        background: "var(--surface-container-low)",
        borderRadius: "var(--r2)",
        padding: "14px 16px",
        marginBottom: 14,
        borderLeft: "3px solid var(--primary-container)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-container)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>psychology</span>
          AI Explanation
        </div>
        {loadingExpl ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-container)", opacity: 0.5, animation: `wave 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
            <span style={{ fontSize: 12, color: "var(--on-surface-variant)", marginLeft: 4 }}>Generating explanation…</span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--on-surface)", lineHeight: 1.7 }}>
            {aiExplanation || reason || "Analysis complete."}
          </p>
        )}
      </div>

      {/* Confidence breakdown */}
      {bd && (
        <div className="breakdown-grid" style={{ marginBottom: 14 }}>
          {[
            ["Classification", bd.classification_prob],
            ["Similarity",     bd.similarity_score],
            ["Historical",     bd.historical_success],
            ["Risk Adj.",      bd.risk_adjustment],
          ].map(([l, v]) => (
            <div className="breakdown-item" key={l}>
              <div className="b-label">{l}</div>
              <div className="b-val">{(v * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}

      {/* RAG matches */}
      {similarity_matches.length > 0 && (
        <div className="rag-section" style={{ marginBottom: 14 }}>
          <h4>
            <span className="material-symbols-outlined" style={{ fontSize: 12, marginRight: 4 }}>hub</span>
            Similar Resolved Tickets
          </h4>
          {similarity_matches.map(m => (
            <div className="rag-match" key={m.ticket_id}>
              <span style={{ fontWeight: 600, color: "var(--primary-container)" }}>#{m.ticket_id}</span>
              <span style={{ flex: 1, marginLeft: 8, color: "var(--on-surface-variant)", fontSize: 12 }}>{m.title}</span>
              <span className="rag-score">{(m.score * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Apology message */}
      {apology_message && (
        <div style={{ padding: "12px 16px", background: "var(--primary-fixed)", borderRadius: "var(--r2)", fontSize: 13, color: "var(--on-primary-fixed)", lineHeight: 1.7, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, opacity: 0.7 }}>From our team</div>
          {apology_message}
        </div>
      )}

      {/* Suggested actions */}
      {suggested_actions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--on-surface-variant)", marginBottom: 10 }}>Next Steps</div>
          {suggested_actions.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--primary-fixed)", color: "var(--on-primary-fixed)", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.5 }}>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Continue with chat CTA */}
      {onContinueChat && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "var(--surface-container-low)",
          borderRadius: "var(--r2)",
          border: "1px solid var(--outline-variant)",
          marginTop: 4,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--on-surface)" }}>Have questions about this result?</div>
            <div style={{ fontSize: 12, color: "var(--on-surface-variant)", marginTop: 2 }}>Chat with our AI assistant — it knows your ticket details.</div>
          </div>
          <button
            className="btn-primary"
            onClick={onContinueChat}
            style={{ flexShrink: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
            Continue with Chat
          </button>
        </div>
      )}
    </div>
  );
}
