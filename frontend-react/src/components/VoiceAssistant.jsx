import { useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { processVoiceTicket, transcribeAudio } from "../api/voice";
import VoiceWaveform from "./VoiceWaveform";
import ResultPanel from "./ResultPanel";

const MIC_ICON  = "🎙";
const STOP_ICON = "⏹";
const SEND_ICON = "⚡";
const RESET_ICON = "↺";

function formatDuration(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function VoiceAssistant({ onResult, token }) {
  const {
    state, audioBlob, audioUrl, duration, error,
    analyserNode, startRecording, stopRecording, reset,
  } = useVoiceRecorder();

  const [transcript, setTranscript]   = useState("");
  const [fields, setFields]           = useState(null);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [apiError, setApiError]       = useState(null);
  const [mode, setMode]               = useState("preview"); // preview | auto

  const isRecording  = state === "recording";
  const hasRecording = state === "done" && audioBlob;

  async function handlePreview() {
    if (!audioBlob) return;
    setLoading(true);
    setApiError(null);
    try {
      const data = await transcribeAudio(audioBlob, token);
      setTranscript(data.transcript);
      setFields(data.extracted_fields);
    } catch (e) {
      setApiError(e.response?.data?.detail || "Transcription failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleProcess() {
    if (!audioBlob) return;
    setLoading(true);
    setApiError(null);
    try {
      const data = await processVoiceTicket(audioBlob, token);
      setResult(data);
      if (onResult) onResult(data, {
        title: data.explanation?.ticket_category || "Voice Ticket",
        priority: "P2",
        user_type: "STANDARD",
      });
    } catch (e) {
      setApiError(e.response?.data?.detail || "Processing failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    reset();
    setTranscript("");
    setFields(null);
    setResult(null);
    setApiError(null);
  }

  return (
    <section className="voice-section">
      <div className="voice-header">
        <h2>{MIC_ICON} Voice Assistant</h2>
        <p className="voice-subtitle">
          Speak your ticket — Whisper AI transcribes it, your model classifies it.
        </p>
      </div>

      {/* Waveform */}
      <div className="voice-visualizer">
        <VoiceWaveform analyserNode={analyserNode} active={isRecording} />
        {isRecording && (
          <span className="recording-badge">
            <span className="rec-dot" /> REC {formatDuration(duration)}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="voice-controls">
        {!isRecording && !hasRecording && (
          <button className="btn-record" onClick={startRecording}>
            {MIC_ICON} Start Recording
          </button>
        )}

        {isRecording && (
          <button className="btn-stop" onClick={stopRecording}>
            {STOP_ICON} Stop Recording
          </button>
        )}

        {hasRecording && !result && (
          <>
            <button className="btn-preview" onClick={handlePreview} disabled={loading}>
              {loading ? "Transcribing..." : "Preview Transcript"}
            </button>
            <button className="btn-process" onClick={handleProcess} disabled={loading}>
              {loading ? "Processing..." : `${SEND_ICON} Process Ticket`}
            </button>
            <button className="btn-reset-voice" onClick={handleReset}>
              {RESET_ICON} Re-record
            </button>
          </>
        )}

        {result && (
          <button className="btn-reset-voice" onClick={handleReset}>
            {RESET_ICON} New Recording
          </button>
        )}
      </div>

      {/* Audio playback */}
      {audioUrl && !result && (
        <audio controls src={audioUrl} className="voice-playback" />
      )}

      {/* Error */}
      {(error || apiError) && (
        <p className="voice-error">{error || apiError}</p>
      )}

      {/* Transcript preview */}
      {transcript && !result && (
        <div className="transcript-box">
          <div className="transcript-label">Transcript</div>
          <p className="transcript-text">"{transcript}"</p>
          {fields && (
            <div className="extracted-fields">
              <div className="ef-label">Extracted Fields</div>
              <div className="ef-grid">
                <div><span className="ef-key">Title</span><span className="ef-val">{fields.title}</span></div>
                <div><span className="ef-key">Priority</span><span className="ef-val">{fields.priority}</span></div>
                <div><span className="ef-key">User Type</span><span className="ef-val">{fields.user_type}</span></div>
              </div>
              <button className="btn-process" onClick={handleProcess} disabled={loading} style={{marginTop: "12px"}}>
                {loading ? "Processing..." : `${SEND_ICON} Confirm & Process`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && <ResultPanel result={result} />}
    </section>
  );
}
