export default function Header({ online }) {
  const label  = online === null ? "Checking..." : online ? "API Online" : "API Offline";
  const cls    = online === null ? "badge" : online ? "badge ok" : "badge err";
  return (
    <header className="app-header">
      <h1>Confidence-Governed AI Ticket Resolution</h1>
      <span className={cls}>{label}</span>
    </header>
  );
}
