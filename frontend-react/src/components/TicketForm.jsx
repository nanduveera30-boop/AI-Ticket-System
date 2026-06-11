import { useState } from "react";
import { processTicket, checkDuplicate } from "../api/tickets";
import { BATCH_TICKETS } from "../utils/constants";
import ResultPanel from "./ResultPanel";

const PRIORITIES = [
  { value: "P1", label: "P1 — Critical" },
  { value: "P2", label: "P2 — High" },
  { value: "P3", label: "P3 — Normal" },
];

export default function TicketForm({ onResult }) {
  const [form, setForm]     = useState({ title: "", description: "", priority: "P2", user_type: "STANDARD" });
  const [result, setResult] = useState(null);
  const [duplicate, setDup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batching, setBatch]  = useState(false);
  const [error, setError]     = useState(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null); setDup(null); setResult(null);
    try {
      const dupCheck = await checkDuplicate(form);
      if (dupCheck.is_duplicate) { setDup(dupCheck); setLoading(false); return; }
      const data = await processTicket(form);
      setResult(data);
      onResult(data, { title: form.title, priority: form.priority, user_type: form.user_type });
      setForm(f => ({ ...f, title: "", description: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "Request failed. Is the API running?");
    } finally { setLoading(false); }
  }

  async function handleBatch() {
    setBatch(true);
    for (const t of BATCH_TICKETS) {
      try {
        const data = await processTicket(t);
        onResult(data, { title: t.title, priority: t.priority, user_type: t.user_type });
      } catch { /* continue */ }
      await new Promise(r => setTimeout(r, 250));
    }
    setBatch(false);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Process Ticket</div>
          <div className="card-sub">Duplicate detection + AI classification</div>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={handleBatch} disabled={batching}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>
          {batching ? "Running…" : "Batch Simulation"}
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Issue Title</label>
          <input className="form-input" type="text" placeholder="Brief description of the issue" required minLength={3} maxLength={255} value={form.title} onChange={set("title")} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={set("priority")}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">User Type</label>
            <select className="form-select" value={form.user_type} onChange={set("user_type")}>
              <option value="STANDARD">Standard</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" placeholder="Detailed description (min 10 chars)" required minLength={10} value={form.description} onChange={set("description")} />
        </div>

        {error && <div className="form-error">{error}</div>}

        {duplicate && (
          <div className="duplicate-alert">
            <strong>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              Duplicate Detected
            </strong>
            <p style={{ fontSize: 12, marginBottom: 8 }}>{duplicate.message}</p>
            {duplicate.duplicates.map(d => (
              <div className="duplicate-match" key={d.ticket_id}>
                Ticket #{d.ticket_id} — {d.title} ({(d.similarity * 100).toFixed(1)}% match)
              </div>
            ))}
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button type="button" className="btn-secondary btn-sm" onClick={() => { setDup(null); processTicket(form).then(d => { setResult(d); onResult(d, form); }); }}>Submit Anyway</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setDup(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
            {loading ? "Processing…" : "Process Ticket"}
          </button>
        </div>
      </form>

      {result && <ResultPanel result={result} />}
    </div>
  );
}
