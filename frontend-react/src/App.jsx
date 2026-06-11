import { useState } from "react";
import { useAuth }       from "./hooks/useAuth";
import { useMetrics }    from "./hooks/useMetrics";
import { useTicketLog }  from "./hooks/useTicketLog";
import LoginForm         from "./components/LoginForm";
import Sidebar           from "./components/Sidebar";
import Topbar            from "./components/Topbar";
import DashboardPage     from "./pages/DashboardPage";
import TicketsPage       from "./pages/TicketsPage";
import VoicePage         from "./pages/VoicePage";
import AuditPage         from "./pages/AuditPage";
import MetricsPage       from "./pages/MetricsPage";
import AdminPage         from "./pages/AdminPage";

export default function App() {
  const { token, user, error: authError, loading: authLoading, login, register, logout } = useAuth();
  const { metrics, online, refresh } = useMetrics(10000);
  const { log, confidenceHistory, addEntry } = useTicketLog();
  const [page, setPage] = useState("dashboard");

  function handleResult(result, meta) {
    addEntry(result, meta);
    refresh();
  }

  if (!token) {
    return <LoginForm onLogin={login} onRegister={register} error={authError} loading={authLoading} />;
  }

  function renderPage() {
    switch (page) {
      case "dashboard": return <DashboardPage metrics={metrics} confidenceHistory={confidenceHistory} log={log} onResult={handleResult} />;
      case "tickets":   return <TicketsPage />;
      case "voice":     return <VoicePage onResult={handleResult} token={token} />;
      case "audit":     return <AuditPage />;
      case "metrics":   return <MetricsPage metrics={metrics} />;
      case "admin":     return user?.role === "admin" ? <AdminPage /> : <div className="card" style={{ color: "var(--text3)", padding: 32 }}>Admin access required.</div>;
      default:          return <DashboardPage metrics={metrics} confidenceHistory={confidenceHistory} log={log} onResult={handleResult} />;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNav={setPage} user={user} onLogout={logout} />
      <div className="main-content">
        <Topbar page={page} online={online} />
        <div className="page-body">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
