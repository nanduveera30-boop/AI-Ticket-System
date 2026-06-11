import VoiceAssistant from "../components/VoiceAssistant";

export default function VoicePage({ onResult, token }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Voice Assistant</div>
          <div className="card-sub">Speak your ticket — Whisper transcribes, your model classifies</div>
        </div>
      </div>
      <VoiceAssistant onResult={onResult} token={token} />
    </div>
  );
}
