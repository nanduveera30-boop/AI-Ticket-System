import { useState, useRef } from "react";
import { processTicket, checkDuplicate, uploadAttachment } from "../../api/tickets";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { transcribeAudio } from "../../api/voice";
import VoiceWaveform from "../../components/VoiceWaveform";
import ResultPanel from "../../components/ResultPanel";

const CATEGORIES = [
  { id: "Technical Issue",  icon: "build",        desc: "Bugs, errors, crashes" },
  { id: "Billing Question", icon: "receipt_long",  desc: "Invoices, charges, refunds" },
  { id: "Account Access",   icon: "lock_person",   desc: "Login, password, permissions" },
  { id: "Feature Request",  icon: "lightbulb",     desc: "Suggestions, improvements" },
  { id: "General Inquiry",  icon: "help_outline",  desc: "Questions, information" },
  { id: "Other",            icon: "more_horiz",    desc: "Anything else" },
];

const PRIORITIES = [
  { value: "P1", label: "P1 — Critical" },
  { value: "P2", label: "P2 — High" },
  { value: "P3", label: "P3 — Normal" },
];

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function RaiseTicketPage({ token, onTicketCreated }) {
  const [step, setStep]       = useState(1); // 1=category, 2=details, 3=result
  const [form, setForm]       = useState({
    title: "", description: "", priority: "P2",
    category: "", user_type: "STANDARD", attachment_url: null,
  });
  const [errors, setErrors]     = useState({});
  const [result, setResult]     = useState(null);
  const [duplicate, setDup]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Voice state
  const [voiceMode, setVoice]         = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceApplied, setVoiceApplied] = useState(false);
  const [transcript, setTranscript]   = useState("");
  const [catConfidence, setCatConfidence] = useState(0);
  const fileRef = useRef(null);

  const {
    state: recState, audioBlob, audioUrl, duration,
    error: recErr, analyserNode,
    startRecording, stopRecording, reset: resetRec,
  } = useVoiceRecorder();

  const isRecording  = recState === "recording";
  const hasRecording = recState === "done" && audioBlob;

  const set = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    // Clear field error as user types
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  function validate() {
    const e = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      e.title = "Title must be at least 3 characters.";
    if (!form.description.trim() || form.description.trim().length < 10)
      e.description = "Description must be at least 10 characters.";
    if (!form.category)
      e.category = "Please select a category.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadAttachment(file);
      setForm(f => ({ ...f, attachment_url: data.url }));
    } catch {
      setApiError("File upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Voice: transcribe + fill all fields ──────────────────────────────────
  async function handleVoiceApply() {
    if (!audioBlob) return;
    setTranscribing(true);
    setApiError(null);
    try {
      const data = await transcribeAudio(audioBlob, token);
      const f = data.extracted_fields || {};
      setTranscript(data.transcript || "");

      // Fill every field the AI detected
      setForm(prev => ({
        ...prev,
        title:       f.title       || prev.title,
        description: f.description || prev.description,
        priority:    f.priority    || prev.priority,
        user_type:   f.user_type   || prev.user_type,
        // Always apply AI category — it uses zero-shot classifier
        category:    f.category    || prev.category,
      }));

      // Store confidence for display
      setCatConfidence(f.category_confidence || 0);

      setVoiceApplied(true);
      setVoice(false);
      resetRec();

      // If on step 1 and category detected → jump to step 2
      if (f.category && step === 1) {
        setStep(2);
      }
    } catch (err) {
      setApiError(
        err.response?.data?.detail ||
        "Voice transcription failed. Please try again or type manually."
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError(null);
    setDup(null);
    setResult(null);
    try {
      const dupCheck = await checkDuplicate({ title: form.title, description: form.description });
      if (dupCheck.is_duplicate) { setDup(dupCheck); setLoading(false); return; }
      await submitTicket();
    } catch (err) {
      setApiError(err.response?.data?.detail || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitTicket() {
    const data = await processTicket(form);
    setResult(data);
    setStep(3);
  }

  function handleCategorySelect(cat) {
    setForm(f => ({ ...f, category: cat }));
    setErrors(e => ({ ...e, category: undefined }));
    setStep(2);
  }

  function handleNewTicket() {
    setStep(1);
    setForm({ title: "", description: "", priority: "P2", category: "", user_type: "STANDARD", attachment_url: null });
    setResult(null); setDup(null); setErrors({}); setApiError(null);
    setVoiceApplied(false); setTranscript(""); setCatConfidence(0); resetRec();
  }

  function handleViewTicket() {
    if (onTicketCreated && result) onTicketCreated(result, null);
  }

  // ── Voice Panel (reusable in both steps) ─────────────────────────────────
  function VoicePanel() {
    return (
      <div style={{
        background: "var(--inverse-surface)", borderRadius: "var(--r3)",
        overflow: "hidden", marginBottom: 20,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#818cf8" }}>mic</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--inverse-on-surface)" }}>
              Voice Input
            </span>
            {isRecording && (
              <span style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: "#f87171", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "pulse-ring 1.5s infinite" }} />
                {fmt(duration)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setVoice(false); resetRec(); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Waveform + mic button */}
        <div style={{ padding: "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {/* Mic button */}
          {!hasRecording && (
            <div style={{ position: "relative" }}>
              {isRecording && (
                <>
                  <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "1px solid rgba(79,70,229,0.3)", animation: "ping 2s linear infinite" }} />
                  <div style={{ position: "absolute", inset: -24, borderRadius: "50%", border: "1px solid rgba(79,70,229,0.15)", animation: "ping 3s linear infinite" }} />
                </>
              )}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  width: 72, height: 72, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: isRecording
                    ? "var(--error-container)"
                    : "linear-gradient(135deg, var(--primary-container), var(--primary))",
                  color: isRecording ? "var(--error)" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isRecording ? "none" : "0 8px 24px rgba(53,37,205,0.4)",
                  position: "relative", zIndex: 1, transition: "all 0.2s",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>
                  {isRecording ? "stop" : "mic"}
                </span>
              </button>
            </div>
          )}

          {/* Live waveform */}
          {isRecording && (
            <div style={{ width: "100%", maxWidth: 360, background: "rgba(0,0,0,0.3)", borderRadius: 8, overflow: "hidden" }}>
              <VoiceWaveform analyserNode={analyserNode} active={isRecording} />
            </div>
          )}

          {/* Idle hint */}
          {!isRecording && !hasRecording && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 280 }}>
              Tap the mic and describe your issue. AI will fill in the title, description, priority and category automatically.
            </p>
          )}

          {/* Playback + actions after recording */}
          {hasRecording && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
              <audio controls src={audioUrl} style={{ width: "100%", borderRadius: 8 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleVoiceApply}
                  disabled={transcribing}
                  style={{
                    padding: "10px 20px", borderRadius: "var(--r2)", border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, var(--primary-container), var(--primary))",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 8,
                    boxShadow: "0 4px 12px rgba(53,37,205,0.3)",
                    opacity: transcribing ? 0.7 : 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                    {transcribing ? "hourglass_empty" : "auto_awesome"}
                  </span>
                  {transcribing ? "Analysing…" : "Apply to Form"}
                </button>
                <button
                  type="button"
                  onClick={resetRec}
                  disabled={transcribing}
                  style={{
                    padding: "10px 16px", borderRadius: "var(--r2)", border: "none", cursor: "pointer",
                    background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                    fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                  Re-record
                </button>
              </div>
            </div>
          )}

          {recErr && (
            <p style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.1)", padding: "8px 12px", borderRadius: 8, width: "100%", textAlign: "center" }}>
              {recErr}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Step 1: Category ──────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="cpage">
        <div className="page-header">
          <h1>Submit a Ticket</h1>
          <p>What can we help you with today?</p>
        </div>

        <div className="card">
          <div className="stepper">
            <div className="step"><div className="step-bar active" /><span className="step-label">Category</span></div>
            <div className="step-connector" />
            <div className="step"><div className="step-bar inactive" /><span className="step-label inactive">Details</span></div>
            <div className="step-connector" />
            <div className="step"><div className="step-bar inactive" /><span className="step-label inactive">Result</span></div>
          </div>

          {/* Voice option on step 1 */}
          <div style={{ marginBottom: 20 }}>
            <button
              type="button"
              className={voiceMode ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}
              onClick={() => { setVoice(v => !v); if (!voiceMode) resetRec(); }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mic</span>
              {voiceMode ? "Hide Voice Input" : "Describe with Voice"}
            </button>
            <span style={{ fontSize: 12, color: "var(--on-surface-variant)", marginLeft: 10 }}>
              AI will auto-detect category, title and description
            </span>
          </div>

          {voiceMode && <VoicePanel />}

          {errors.category && (
            <div className="form-error" style={{ marginBottom: 16 }}>{errors.category}</div>
          )}
          {apiError && <div className="form-error" style={{ marginBottom: 16 }}>{apiError}</div>}

          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--on-surface-variant)", marginBottom: 14 }}>
            Or select a category manually
          </div>

          <div className="category-grid">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`cat-card${form.category === c.id ? " selected" : ""}`}
                onClick={() => handleCategorySelect(c.id)}
                type="button"
              >
                <div className="cat-card-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>{c.icon}</span>
                </div>
                <div className="cat-card-name">{c.id}</div>
                <div className="cat-card-desc">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Result ────────────────────────────────────────────────────────
  if (step === 3 && result) {
    return (
      <div className="cpage">
        <div className="page-header">
          <h1>Ticket Submitted</h1>
          <p>Your ticket has been processed by our AI system.</p>
        </div>
        <div className="card">
          <div className="stepper">
            <div className="step"><div className="step-bar active" /><span className="step-label">Category</span></div>
            <div className="step-connector" style={{ background: "var(--primary)" }} />
            <div className="step"><div className="step-bar active" /><span className="step-label">Details</span></div>
            <div className="step-connector" style={{ background: "var(--primary)" }} />
            <div className="step"><div className="step-bar active" /><span className="step-label">Result</span></div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#166534", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--on-surface)" }}>Ticket #{result.ticket_id} Created</div>
              <div style={{ fontSize: 13, color: "var(--on-surface-variant)", marginTop: 2 }}>AI analysis complete</div>
            </div>
          </div>

          <ResultPanel result={result} onContinueChat={handleViewTicket} />

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button className="btn-primary" onClick={handleViewTicket}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              View Ticket & Chat
            </button>
            <button className="btn-secondary" onClick={handleNewTicket}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              New Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Details form ──────────────────────────────────────────────────
  return (
    <div className="cpage-wide">
      <div className="page-header">
        <h1>Ticket Details</h1>
        <p>Describe your issue so we can help you faster.</p>
      </div>

      <div className="raise-layout">
        {/* Left: form */}
        <div className="card">
          <div className="stepper">
            <div className="step">
              <div className="step-bar active" style={{ opacity: 0.4 }} />
              <span className="step-label" style={{ opacity: 0.5, cursor: "pointer" }} onClick={() => setStep(1)}>Category</span>
            </div>
            <div className="step-connector" style={{ opacity: 0.4 }} />
            <div className="step"><div className="step-bar active" /><span className="step-label">Details</span></div>
            <div className="step-connector" />
            <div className="step"><div className="step-bar inactive" /><span className="step-label inactive">Result</span></div>
          </div>

          {/* Category badge + voice toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span className="badge badge-blue" style={{ fontSize: 12, padding: "5px 12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {CATEGORIES.find(c => c.id === form.category)?.icon || "help_outline"}
              </span>
              {form.category}
            </span>
            <button className="btn-ghost btn-sm" onClick={() => setStep(1)}>Change</button>
            <div style={{ marginLeft: "auto" }}>
              <button
                type="button"
                className={voiceMode ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}
                onClick={() => { setVoice(v => !v); if (!voiceMode) resetRec(); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mic</span>
                {voiceMode ? "Hide Voice" : "Voice Input"}
              </button>
            </div>
          </div>

          {/* Voice panel */}
          {voiceMode && <VoicePanel />}

          {/* Voice applied banner */}
          {voiceApplied && !voiceMode && (
            <div style={{
              padding: "14px 16px", background: "var(--primary-fixed)",
              borderRadius: "var(--r2)", marginBottom: 16,
              border: "1px solid rgba(53,37,205,0.15)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary-container)", fontVariationSettings: "'FILL' 1", flexShrink: 0, marginTop: 1 }}>auto_awesome</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--on-primary-fixed)", marginBottom: 6 }}>
                    AI filled your form from voice
                  </div>
                  {/* Detected fields summary */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: transcript ? 8 : 0 }}>
                    {form.category && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: "rgba(53,37,205,0.12)", color: "var(--primary-container)", borderRadius: 100 }}>
                        📂 {form.category} {catConfidence > 0 && `(${(catConfidence * 100).toFixed(0)}%)`}
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: "rgba(53,37,205,0.12)", color: "var(--primary-container)", borderRadius: 100 }}>
                      🎯 {form.priority}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: "rgba(53,37,205,0.12)", color: "var(--primary-container)", borderRadius: 100 }}>
                      👤 {form.user_type}
                    </span>
                  </div>
                  {transcript && (
                    <div style={{ fontSize: 11, color: "var(--on-primary-fixed)", opacity: 0.65, fontStyle: "italic", lineHeight: 1.5 }}>
                      "{transcript.slice(0, 120)}{transcript.length > 120 ? "…" : ""}"
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--on-primary-fixed)", opacity: 0.6, marginTop: 6 }}>
                    Review and edit the fields below before submitting.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceApplied(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--on-primary-fixed)", opacity: 0.5, padding: 2, flexShrink: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Issue Title *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Brief summary of your issue"
                required
                minLength={3}
                maxLength={255}
                value={form.title}
                onChange={set("title")}
                disabled={loading}
                style={errors.title ? { boxShadow: "0 0 0 2px rgba(186,26,26,0.3)" } : {}}
              />
              {errors.title && <span style={{ fontSize: 12, color: "var(--error)" }}>{errors.title}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={set("priority")} disabled={loading}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select className="form-select" value={form.user_type} onChange={set("user_type")} disabled={loading}>
                  <option value="STANDARD">Standard</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <div className="textarea-wrap">
                <textarea
                  className="form-textarea"
                  placeholder="Describe your issue in detail — the more context, the better our AI can help."
                  required
                  minLength={10}
                  maxLength={2000}
                  value={form.description}
                  onChange={set("description")}
                  disabled={loading}
                  style={{ minHeight: 140, ...(errors.description ? { boxShadow: "0 0 0 2px rgba(186,26,26,0.3)" } : {}) }}
                />
                <span className="char-count">{form.description.length}/2000</span>
              </div>
              {errors.description && <span style={{ fontSize: 12, color: "var(--error)" }}>{errors.description}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Attachment (optional)</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span>
                  {uploading ? "Uploading…" : "Attach File"}
                </button>
                {form.attachment_url && (
                  <span style={{ fontSize: 12, color: "var(--primary-container)", fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>check_circle</span> File attached
                  </span>
                )}
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
              </div>
            </div>

            {apiError && <div className="form-error">{apiError}</div>}

            {duplicate && (
              <div className="duplicate-banner">
                <strong>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                  Similar ticket found
                </strong>
                <p style={{ fontSize: 12, color: "var(--on-tertiary-fixed-variant)", marginBottom: 8 }}>{duplicate.message}</p>
                {duplicate.duplicates?.map(d => (
                  <div className="duplicate-match" key={d.ticket_id}>
                    Ticket #{d.ticket_id} — {d.title} ({(d.similarity * 100).toFixed(1)}% match)
                  </div>
                ))}
                <div className="duplicate-banner-actions">
                  <button type="button" className="btn-primary btn-sm"
                    onClick={async () => { setDup(null); setLoading(true); try { await submitTicket(); } catch (err) { setApiError(err.response?.data?.detail || "Submission failed."); } finally { setLoading(false); } }}>
                    Submit Anyway
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setDup(null)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="raise-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)} style={{ marginRight: "auto" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                Back
              </button>
              <button type="submit" className="raise-submit" disabled={loading || uploading}>
                {loading
                  ? <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_empty</span> Processing…</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span> Submit Ticket</>
                }
              </button>
            </div>
          </form>
        </div>

        {/* Right: tips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="insight-card">
            <div className="insight-card-label">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              AI-Powered
            </div>
            <h3>Smart Resolution</h3>
            <p>Our AI analyzes your ticket and automatically routes it to the right team or resolves it instantly.</p>
          </div>

          <div className="tips-card">
            <h4>Tips for faster resolution</h4>
            {[
              { icon: "title",         tip: "Use a clear, specific title that summarizes the issue." },
              { icon: "description",   tip: "Include error messages, steps to reproduce, and what you expected." },
              { icon: "priority_high", tip: "Set priority accurately — P1 for critical, P3 for minor issues." },
            ].map(t => (
              <div className="tip-item" key={t.icon}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary-container)", flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                <p>{t.tip}</p>
              </div>
            ))}
          </div>

          {form.priority === "P1" && (
            <div style={{ background: "var(--error-container)", borderRadius: "var(--r3)", padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--on-error-container)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                P1 Critical
              </div>
              <p style={{ fontSize: 12, color: "var(--on-error-container)", lineHeight: 1.5 }}>
                Critical tickets are escalated immediately to our senior support team.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
