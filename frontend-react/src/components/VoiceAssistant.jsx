import { useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { processVoiceTicket, transcribeAudio } from "../api/voice";
import VoiceWaveform from "./VoiceWaveform";
import ResultPanel from "./ResultPanel";

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function VoiceAssistant({ onResult, token }) {
  const { state, audioBlob, audioUrl, duration, error, analyserNode, startRecording, stopRecording, reset } = useVoiceRecorder();
  const [transcript, setTranscript] = useState("");
  const [fields, setFields]         = useState(null);
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [apiError, setApiError]     = useState(null);

  const isRecording  = state === "recording";
  const hasRecording = state === "done" && audioBlob;

  async function handlePreview() {
    setLoading(true); setApiError(null);
    try {
      const data = await transcribeAudio(audioBlob, token);
      setTranscript(data.transcript);
      setFields(data.extracted_fields);
    } catch (e) { setApiError(e.response?.data?.detail || "Transcription failed"); }
    finally { setLoading(false); }
  }

  async function handleProcess() {
    setLoading(true); setApiError(null);
    try {
      const data = await processVoiceTicket(audioBlob, token);
      setResult(data);
      if (onResult) onResult(data, { title: data.explanation?.ticket_category || "Voice Ticket", priority: "P2", user_type: "STANDARD" });
    } catch (e) { setApiError(e.response?.data?.detail || "Processing failed"); }
    finally { setLoading(false); }
  }

  function handleReset() {
    reset(); setTranscript(""); setFields(null); setResult(null); setApiError(null);
  }

  return (
    <div className="voice-section">
      {/* Studio canvas — dark panel */}
      <div style={{ background: "var(--inverse-surface)", borderRadius: "var(--r3)", overflow: "hidden", position: "relative" }}>
        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--inverse-on-surface)" }}>Voice Studio</span>
            {isRecording && (
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
                Live Session: {fmt(duration)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#22c55e" }}>security</span>
            End-to-End Encrypted
          </div>
        </div>

        {/* Main studio area */}
        <div style={{ display: "flex", minHeight: 320 }}>
          {/* Center: mic + waveform */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ width: 400, height: 400, background: "rgba(79,70,229,0.06)", borderRadius: "50%", filter: "blur(80px)" }} />
            </div>

            {!result && (
              <>
                <div style={{ marginBottom: 16, textAlign: "center" }}>
                  <span style={{ padding: "6px 16px", background: "rgba(79,70,229,0.15)", color: "#818cf8", borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", border: "1px solid rgba(79,70,229,0.2)" }}>
                    {isRecording ? "Listening Active" : hasRecording ? "Recording Ready" : "Ready to Record"}
                  </span>
                </div>

                <div style={{ position: "relative", marginBottom: 24 }}>
                  {isRecording && (
                    <>
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(79,70,229,0.3)", animation: "ping 3s linear infinite" }} />
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(79,70,229,0.2)", animation: "ping 4s linear infinite" }} />
                    </>
                  )}
                  <button
                    className={isRecording ? "btn-stop" : "btn-record"}
                    style={{ width: 96, height: 96, borderRadius: "50%", fontSize: 14, flexDirection: "column", gap: 4, position: "relative", zIndex: 1 }}
                    onClick={isRecording ? stopRecording : (!hasRecording ? startRecording : undefined)}
                    disabled={hasRecording && !isRecording}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>{isRecording ? "stop" : "mic"}</span>
                  </button>
                </div>

                <div className="voice-visualizer" style={{ width: "100%", maxWidth: 400, background: "transparent" }}>
                  <VoiceWaveform analyserNode={analyserNode} active={isRecording} />
                </div>
              </>
            )}

            {result && <ResultPanel result={result} />}
          </div>

          {/* Right panel: AI insight */}
          {(hasRecording || transcript || result) && (
            <div style={{ width: 260, borderLeft: "1px solid rgba(255,255,255,0.08)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>psychology</span>
                Intelligence Insight
              </div>

              {transcript && (
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Transcript</div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontStyle: "italic" }}>"{transcript}"</p>
                </div>
              )}

              {fields && (
                <div style={{ background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#818cf8", marginBottom: 10 }}>Extracted Fields</div>
                  {[["Category", fields.title], ["Priority", fields.priority], ["User Type", fields.user_type]].map(([k, v]) => v && (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {audioUrl && !result && (
                <audio controls src={audioUrl} style={{ width: "100%", borderRadius: 8 }} />
              )}
            </div>
          )}
        </div>

        {/* Controls footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {!isRecording && !hasRecording && !result && (
            <button className="btn-record" onClick={startRecording}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mic</span>
              Start Recording
            </button>
          )}
          {isRecording && (
            <button className="btn-stop" onClick={stopRecording}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop</span>
              Stop Recording
            </button>
          )}
          {hasRecording && !result && (
            <>
              <button className="btn-preview" onClick={handlePreview} disabled={loading}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>subject</span>
                {loading ? "Transcribing…" : "Preview Transcript"}
              </button>
              <button className="btn-process" onClick={handleProcess} disabled={loading}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>task_alt</span>
                {loading ? "Processing…" : "Process Ticket"}
              </button>
              <button className="btn-reset-voice" onClick={handleReset}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                Re-record
              </button>
            </>
          )}
          {result && (
            <button className="btn-reset-voice" onClick={handleReset}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              New Recording
            </button>
          )}
        </div>
      </div>

      {(error || apiError) && <p className="voice-error">{error || apiError}</p>}
    </div>
  );
}
