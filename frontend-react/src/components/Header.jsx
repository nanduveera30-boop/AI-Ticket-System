export default function Header({ online, user, onLogout }) {
  const label = online === null ? "Checking..." : online ? "API Online" : "API Offline";
  const cls   = online === null ? "badge" : online ? "badge ok" : "badge err";

  return (
    <header className="app-header">
      <h1>Confidence-Governed AI Ticket Resolution</h1>
      <div className="header-right">
        <span className={cls}>{label}</span>
        {user && (
          <>
            <span className="header-user">👤 {user.username}</span>
            <button className="btn-logout" onClick={onLogout}>Sign Out</button>
          </>
        )}
      </div>
    </header>
  );
}
