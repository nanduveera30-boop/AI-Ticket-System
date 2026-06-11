import { useState } from "react";
import { useAuth }      from "./hooks/useAuth";
import { useMetrics }   from "./hooks/useMetrics";
import { useTicketLog } from "./hooks/useTicketLog";

// Shared
import LoginForm        from "./components/LoginForm";

// Admin portal
import Sidebar          from "./components/Sidebar";
import Topbar           from "./components/Topbar";
import DashboardPage    from "./pages/DashboardPage";
import TicketsPage      from "./pages/TicketsPage";
import VoicePage        from "./pages/VoicePage";
import AuditPage        from "./pages/AuditPage";
import MetricsPage      from "./pages/MetricsPage";
import AdminPage        from "./pages/AdminPage";

// Customer portal
import CustomerNav      from "./components/CustomerNav";
import RaiseTicketPage  from "./pages/customer/RaiseTicketPage";
import MyTicketsPage    from "./pages/customer/MyTicketsPage";
import TicketDetailPage from "./pages/customer/TicketDetailPage";
import FAQPage          from "./pages/customer/FAQPage";

// ── Admin shell ───────────────────────────────────────────────────────────────
function AdminShell({ user, token, logout }) {
  const { metrics, online, refresh } = useMetrics(10000);
  const { log, confidenceHistory, addEntry } = useTicketLog();
  const [page, setPage] = useState("dashboard");

  function handleResult(result, meta) {
    addEntry(result, meta);
    refresh();
  }

  function renderPage() {
    switch (page) {
      case "dashboard": return <DashboardPage metrics={metrics} confidenceHistory={confidenceHistory} log={log} onResult={handleResult} />;
      case "tickets":   return <TicketsPage />;
      case "voice":     return <VoicePage onResult={handleResult} token={token} />;
      case "audit":     return <AuditPage />;
      case "metrics":   return <MetricsPage metrics={metrics} />;
      case "admin":
        return user?.role === "admin"
          ? <AdminPage />
          : <div className="card"><p style={{ color: "var(--error)", padding: 20 }}>Admin access required.</p></div>;
      default: return <DashboardPage metrics={metrics} confidenceHistory={confidenceHistory} log={log} onResult={handleResult} />;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNav={setPage} user={user} onLogout={logout} />
      <div className="main-content">
        <Topbar page={page} online={online} />
        <div className="page-body">{renderPage()}</div>
      </div>
    </div>
  );
}

// ── Customer shell ────────────────────────────────────────────────────────────
function CustomerShell({ user, token, logout }) {
  const [page, setPage]                 = useState("raise");
  const [openTicketId, setOpenTicketId] = useState(null);

  function handleOpenTicket(id) {
    setOpenTicketId(id);
    setPage("ticket-detail");
  }

  function handleTicketCreated(data, nav) {
    if (nav === "my-tickets") { setPage("my-tickets"); return; }
    if (data?.ticket_id) { setOpenTicketId(data.ticket_id); setPage("ticket-detail"); }
  }

  return (
    <div className="customer-shell">
      <CustomerNav
        page={page}
        onNav={p => { setPage(p); setOpenTicketId(null); }}
        user={user}
        onLogout={logout}
      />
      <main className="customer-main">
        {page === "raise"         && <RaiseTicketPage token={token} onTicketCreated={handleTicketCreated} />}
        {page === "my-tickets"    && <MyTicketsPage onOpenTicket={handleOpenTicket} />}
        {page === "ticket-detail" && <TicketDetailPage ticketId={openTicketId} user={user} token={token} onBack={() => setPage("my-tickets")} />}
        {page === "faq"           && <FAQPage />}
      </main>
    </div>
  );
}

// ── Login portal selector ─────────────────────────────────────────────────────
// Reads ?portal=admin from URL or checks if path contains /admin
function getPortalType() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("portal") === "admin") return "admin";
  if (window.location.pathname.includes("admin")) return "admin";
  return "customer";
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, error: authError, loading: authLoading, login, register, logout } = useAuth();

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!token || !user) {
    const portalType = getPortalType();
    return (
      <LoginForm
        onLogin={login}
        onRegister={portalType === "admin"
          ? (u, e, p, fn) => register(u, e, p, fn, "agent")
          : register
        }
        error={authError}
        loading={authLoading}
        portalType={portalType}
      />
    );
  }

  const role = user?.role;

  // ── Route by role — no URL dependency ────────────────────────────────────
  if (role === "customer") {
    return <CustomerShell user={user} token={token} logout={logout} />;
  }

  if (role === "admin" || role === "agent" || role === "viewer") {
    return <AdminShell user={user} token={token} logout={logout} />;
  }

  // Unknown role fallback
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <p style={{ color: "var(--on-surface-variant)" }}>Unknown role: <strong>{role}</strong></p>
      <button className="btn-primary" onClick={logout}>Sign Out</button>
    </div>
  );
}
