import { useState } from "react";

export default function LoginForm({ onLogin, onRegister, error, loading }) {
  const [tab, setTab]       = useState("login");
  const [username, setUser] = useState("");
  const [email, setEmail]   = useState("");
  const [password, setPass] = useState("");

  function submit(e) {
    e.preventDefault();
    tab === "login" ? onLogin(username, password) : onRegister(username, email, password);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">AI</div>
          <div>
            <div className="login-brand-name">TicketAI</div>
            <div className="login-brand-sub">Confidence-Governed Resolution</div>
          </div>
        </div>

        <h2 className="login-title">{tab === "login" ? "Welcome back" : "Create account"}</h2>
        <p className="login-sub">{tab === "login" ? "Sign in to your workspace" : "Get started with TicketAI"}</p>

        <div className="login-tabs">
          <button className={`login-tab${tab === "login" ? " active" : ""}`} onClick={() => setTab("login")}>Sign In</button>
          <button className={`login-tab${tab === "register" ? " active" : ""}`} onClick={() => setTab("register")}>Register</button>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="your.username" required value={username} onChange={e => setUser(e.target.value)} />
          </div>
          {tab === "register" && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@company.com" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" required minLength={8} value={password} onChange={e => setPass(e.target.value)} />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
