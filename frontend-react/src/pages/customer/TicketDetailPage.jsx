import { useState, useEffect, useRef, useCallback } from "react";
import { getChatHistory, sendMessage } from "../../api/chat";
import { getTicket, getTicketPrediction } from "../../api/tickets";

const STATUS_CLS = {
  open: "badge-blue", in_progress: "badge-yellow",
  escalated: "badge-red", resolved: "badge-green", closed: "badge-gray",
};
const ACTION_CLS = { AUTO_RESOLVE: "badge-green", SUGGEST: "badge-yellow", ESCALATE: "badge-red" };
const RISK_CLS   = { LOW: "badge-green", HIGH: "badge-red" };

const QUICK_REPLIES = [
  "What's the status of my ticket?",
  "Can you help me troubleshoot this?",
  "This is urgent, I need help now.",
  "Has anyone looked at this yet?",
];

function TypingIndicator() {
  return (
    <div className="chat-bubble bubble-ai">
      <span className="bubble-sender">ResolvAI</span>
      <div className="bubble-text" style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 14px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "rgba(195,192,255,0.8)",
            animation: `wave 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

export default function TicketDetailPage({ ticketId, user, token, onBack }) {
  const [ticket, setTicket]     = useState(null);
  const [prediction, setPred]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [wsReady, setWsReady]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [wsError, setWsError]   = useState(null);

  const wsRef        = useRef(null);
  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const reconnectRef = useRef(null);
  const retryCount   = useRef(0);

  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);
    Promise.all([
      getTicket(ticketId).then(setTicket).catch(() => {}),
      getTicketPrediction(ticketId).then(setPred).catch(() => {}),
      getChatHistory(ticketId).then(setMessages).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [ticketId]);

  // WebSocket with auto-reconnect
  const connectWS = useCallback(() => {
    if (!ticketId || !token) return;
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/^http/, "ws");
    const ws = new WebSocket(`${apiBase}/ws/chat/${ticketId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsReady(true);
      setWsError(null);
      retryCount.current = 0;
    };

    ws.onclose = (e) => {
      setWsReady(false);
      setAiTyping(false);
      // Auto-reconnect with exponential backoff (max 5 attempts)
      if (retryCount.current < 5 && e.code !== 4001 && e.code !== 4004) {
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        reconnectRef.current = setTimeout(connectWS, delay);
      } else if (retryCount.current >= 5) {
        setWsError("Connection lost. Refresh to reconnect.");
      }
    };

    ws.onerror = () => setWsReady(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setAiTyping(false);
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      } catch { /* ignore */ }
    };
  }, [ticketId, token]);

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close(1000);
    };
  }, [connectWS]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping]);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        setAiTyping(true);
        wsRef.current.send(JSON.stringify({ message: text }));
      } else {
        // REST fallback
        const msg = await sendMessage(ticketId, text);
        setMessages(prev => [...prev, msg]);
        setTimeout(() => getChatHistory(ticketId).then(setMessages).catch(() => {}), 1500);
      }
    } catch { /* handled */ }
    finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickReply(q) {
    setInput(q);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (!ticketId) {
    return (
      <div className="cpage">
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: 40, display: "block", margin: "0 auto 12px", color: "var(--outline)" }}>confirmation_number</span>
          <p>No ticket selected.</p>
          {onBack && <button className="btn-primary" style={{ marginTop: 16 }} onClick={onBack}>Back to My Tickets</button>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cpage">
        <div className="loading-state">
          <span className="material-symbols-outlined" style={{ fontSize: 32, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>hourglass_empty</span>
          Loading ticket…
        </div>
      </div>
    );
  }

  return (
    <div className="cpage-wide">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {onBack && (
          <button className="btn-ghost btn-sm" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            My Tickets
          </button>
        )}
        {ticket && (
          <>
            <span style={{ color: "var(--outline-variant)" }}>/</span>
            <span style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>Ticket #{ticket.id}</span>
          </>
        )}
      </div>

      <div className="ticket-detail-layout">
        {/* Left: ticket info */}
        <div>
          <div className="card ticket-info-panel">
            {ticket ? (
              <>
                <div className="ti-header">
                  <span className="ti-id">#{ticket.id}</span>
                  <span className={`badge ${STATUS_CLS[ticket.status] || "badge-gray"}`}>
                    {ticket.status?.replace("_", " ")}
                  </span>
                </div>
                <div className="ti-title">{ticket.title}</div>
                <div className="ti-desc">{ticket.description}</div>

                <div className="ti-meta">
                  {[
                    ["Priority", <span className={`badge ${ticket.priority === "P1" ? "badge-red" : ticket.priority === "P2" ? "badge-yellow" : "badge-gray"}`}>{ticket.priority}</span>],
                    ["Category", ticket.category || "—"],
                    ["Account",  ticket.user_type],
                    ["Submitted", new Date(ticket.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
                  ].map(([label, val]) => (
                    <div className="ti-meta-row" key={label}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* AI Analysis */}
                {prediction ? (
                  <div className="ai-analysis-box">
                    <div className="ai-analysis-title">
                      <span className="material-symbols-outlined" style={{ fontSize: 12, marginRight: 4 }}>psychology</span>
                      AI Analysis
                    </div>
                    <div className="ai-row">
                      <span>Decision</span>
                      <span className={`badge ${ACTION_CLS[prediction.action] || "badge-gray"}`}>
                        {prediction.action?.replace("_", " ")}
                      </span>
                    </div>
                    <div className="ai-row">
                      <span>Risk</span>
                      <span className={`badge ${RISK_CLS[prediction.risk] || "badge-gray"}`}>{prediction.risk}</span>
                    </div>
                    <div className="ai-row">
                      <span>Confidence</span>
                      <strong>{(prediction.confidence * 100).toFixed(1)}%</strong>
                    </div>
                    {prediction.ticket_category && (
                      <div className="ai-row">
                        <span>Category</span>
                        <strong>{prediction.ticket_category}</strong>
                      </div>
                    )}
                    {prediction.ai_explanation && (
                      <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--surface-container-lowest)", borderRadius: "var(--r)", fontSize: 12, color: "var(--on-surface-variant)", lineHeight: 1.6, borderLeft: "2px solid var(--primary-container)" }}>
                        {prediction.ai_explanation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface-container-low)", borderRadius: "var(--r2)", fontSize: 12, color: "var(--on-surface-variant)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_empty</span>
                    AI analysis pending…
                  </div>
                )}

                {/* Attachment */}
                {ticket.attachment_url && (
                  <div style={{ marginTop: 14 }}>
                    <a
                      href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${ticket.attachment_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--primary-container)", fontWeight: 600, textDecoration: "none" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                      View Attachment
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state"><p>Ticket not found.</p></div>
            )}
          </div>
        </div>

        {/* Right: chat */}
        <div className="card chat-panel">
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#fff", fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div>
                <div className="chat-title">ResolvAI Assistant</div>
                <div style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>Powered by Gemini · Knows your ticket</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {wsError && (
                <span style={{ fontSize: 11, color: "var(--error)", fontWeight: 600 }}>{wsError}</span>
              )}
              <span className={`ws-status ${wsReady ? "online" : "offline"}`}>
                {wsReady ? "● Live" : retryCount.current > 0 ? `↻ Reconnecting (${retryCount.current}/5)` : "○ Offline"}
              </span>
            </div>
          </div>

          {/* Context banner */}
          {ticket && messages.length === 0 && (
            <div style={{ padding: "10px 20px", background: "var(--primary-fixed)", borderBottom: "1px solid var(--surface-container-low)", fontSize: 12, color: "var(--on-primary-fixed)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
              AI has full context of: <strong style={{ marginLeft: 4 }}>"{ticket.title}"</strong>
            </div>
          )}

          <div className="chat-messages">
            {messages.length === 0 && !aiTyping && (
              <div className="chat-empty">
                <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", margin: "0 auto 10px", color: "var(--outline)" }}>chat_bubble_outline</span>
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Ask ResolvAI anything</p>
                <p style={{ fontSize: 12, marginBottom: 16 }}>The AI knows your ticket and can help troubleshoot, provide updates, or escalate.</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                  {QUICK_REPLIES.map(q => (
                    <button
                      key={q}
                      className="btn-ghost btn-sm"
                      style={{ fontSize: 11, borderRadius: 100, border: "1px solid var(--outline-variant)" }}
                      onClick={() => handleQuickReply(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isCustomer = m.sender_role === "customer";
              const isAI       = m.is_ai || m.sender_role === "ai";
              const cls        = isCustomer ? "bubble-customer" : isAI ? "bubble-ai" : "bubble-agent";
              const sender     = isCustomer ? "You" : isAI ? "ResolvAI" : "Support Agent";
              return (
                <div key={m.id || i} className={`chat-bubble ${cls}`}>
                  <span className="bubble-sender">{sender}</span>
                  <div className="bubble-text" style={{ whiteSpace: "pre-wrap" }}>{m.message}</div>
                  <span className="bubble-time">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}

            {aiTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              ref={inputRef}
              className="form-input chat-input"
              type="text"
              placeholder="Ask ResolvAI… (Ctrl+Enter to send)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              maxLength={1000}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={sending || !input.trim()}
              title="Send (Ctrl+Enter)"
            >
              {sending
                ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_empty</span>
                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
