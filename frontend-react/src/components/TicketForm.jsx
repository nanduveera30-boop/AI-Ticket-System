import { useState } from "react";
import { processTicket, checkDuplicate } from "../api/tickets";
import { BATCH_TICKETS } from "../utils/constants";
import ResultPanel from "./ResultPanel";

export default function TicketForm({ onResult }) {
  const [form, setForm]         = useState({ title: "", description: "", priority: "P2", user_type: "STANDARD" });
  const [result, setResult]     = useState(null);
  const [duplicate, setDup]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [batching, setBatch]    = useState(false);
  const [error, setError]       = useState(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null); setDup(null); setResult(null);
    try {
      // Check duplicate first
      const dupCheck = await checkDuplicate(form);
      if (dupCheck.is_duplicate) {
        setDup(dupCheck);
        setLoading(false);
        return;
      }
      const data = await processTicket(form);
      setResult(data);
      onResult(data, { title: form.title, priority: form.priority, user_type: form.user_type });
      setForm(f => ({ ...f, title: "", description: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "Request failed. Is the API running?");
    } finally {
      setLoading(false);
    }
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
          <div className="card-title">Submit Ticket</div>
          <div className="card-sub">Duplicate detection + AI classification</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Title</label>
          <input className="form-input" type="text" placeholder="Brief description of the issue" required minLength={3} maxLength={255} value={form.title} onChange={set("title")} />
        </div>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={set("priority")}>
              <option value="P1">P1 — Critical</option>
              <option value="P2">P2 — High</option>
              <option value="P3">P3 — Normal</option>
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
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Description</label>
          <textarea className="form-textarea" placeholder="Detailed description (min 10 chars)" required minLength={10} value={form.description} onChange={set("description")} />
        </div>

        {error && <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>}

        {duplicate && (
          <div className="duplicate-alert" style={{ marginBottom: 12 }}>
            <strong>⚠ Duplicate Detected</strong>
            {duplicate.message}
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
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Processing…" : "Process Ticket"}</button>
          <button type="button" className="btn-secondary" onClick={handleBatch} disabled={batching}>{batching ? "Running…" : "Batch Simulation"}</button>
        </div>
      </form>

      {result && <ResultPanel result={result} />}
    </div>
  );
}
