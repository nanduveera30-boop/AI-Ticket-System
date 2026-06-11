import VoiceAssistant from "../components/VoiceAssistant";

export default function VoicePage({ onResult, token }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Voice Studio</div>
          <div className="card-sub">Speak your ticket — Whisper transcribes, AI classifies</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--primary-container)", fontWeight: 700 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mic_none</span>
          Vocalis-7B Active
        </span>
      </div>
      <VoiceAssistant onResult={onResult} token={token} />
    </div>
  );
}
