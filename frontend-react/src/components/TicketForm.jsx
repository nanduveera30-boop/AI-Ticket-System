import { useState } from "react";
import { processTicket } from "../api/tickets";
import { BATCH_TICKETS } from "../utils/constants";
import ResultPanel from "./ResultPanel";

export default function TicketForm({ onResult }) {
  const [form, setForm]       = useState({ title: "", description: "", priority: "P2", user_type: "STANDARD" });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [batching, setBatch]  = useState(false);
  const [error, setError]     = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await processTicket({
        title: form.title,
        description: form.description,
        priority: form.priority,
        user_type: form.user_type,
      });
      setResult(data);
      onResult(data, { title: form.title, priority: form.priority, user_type: form.user_type });
      setForm((f) => ({ ...f, title: "", description: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "Request failed. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleBatch() {
    setBatch(true);
    for (const ticket of BATCH_TICKETS) {
      try {
        const data = await processTicket(ticket);
        onResult(data, { title: ticket.title, priority: ticket.priority, user_type: ticket.user_type });
      } catch { /* continue */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    setBatch(false);
  }

  return (
    <section className="form-section">
      <h2>Submit a Ticket</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="text" placeholder="Title" required minLength={3} maxLength={255}
            value={form.title} onChange={set("title")}
          />
          <select value={form.priority} onChange={set("priority")}>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Normal</option>
          </select>
          <select value={form.user_type} onChange={set("user_type")}>
            <option value="STANDARD">STANDARD</option>
            <option value="VIP">VIP</option>
          </select>
        </div>
        <textarea
          placeholder="Description (min 10 chars)" rows={3} required minLength={10}
          value={form.description} onChange={set("description")}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Processing..." : "Process Ticket"}
          </button>
          <button type="button" className="btn-batch" onClick={handleBatch} disabled={batching}>
            {batching ? "Running..." : "Run Batch Simulation"}
          </button>
        </div>
      </form>
      {result && <ResultPanel result={result} />}
    </section>
  );
}
