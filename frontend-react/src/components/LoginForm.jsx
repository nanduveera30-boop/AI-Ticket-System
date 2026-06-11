import { useState } from "react";

export default function LoginForm({ onLogin, onRegister, error, loading, portalType = "customer" }) {
  const [tab, setTab]       = useState("login");
  const [username, setUser] = useState("");
  const [email, setEmail]   = useState("");
  const [password, setPass] = useState("");
  const [fullName, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const isCustomer = portalType === "customer";

  function validateForm() {
    const e = {};
    if (!username.trim()) e.username = "Username is required.";
    if (tab === "register") {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Valid email required.";
      if (password.length < 8) e.password = "Password must be at least 8 characters.";
    } else {
      if (!password) e.password = "Password is required.";
    }
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(e) {
    e.preventDefault();
    if (!validateForm()) return;
    if (tab === "login") {
      onLogin(username, password);
    } else {
      onRegister(username, email, password, fullName);
    }
  }

  return (
    <div className="login-page">
      {/* Left hero panel */}
      <div className="login-left">
        <div className="login-left-pattern" />
        <div className="ll-brand">
          <div className="ll-brand-icon">
            <span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 20, fontVariationSettings: "'FILL' 1" }}>psychology</span>
          </div>
          <div>
            <div className="ll-brand-name">ResolvAI</div>
            <div className="ll-brand-sub">Precision Curator</div>
          </div>
        </div>

        <div className="ll-content">
          <h1 className="ll-headline">
            {isCustomer ? "Get support, faster than ever" : "Resolve faster with AI confidence"}
          </h1>
          <p className="ll-tagline">
            {isCustomer
              ? "Submit and track your support requests with AI-powered resolution. Get answers instantly."
              : "Enterprise-grade ticket resolution powered by neural intelligence and real-time analytics."}
          </p>
          <div className="ll-features">
            {(isCustomer ? [
              { icon: "send",           title: "Easy Submission",    desc: "Submit tickets via text or voice in seconds." },
              { icon: "track_changes",  title: "Real-time Tracking", desc: "Follow your ticket status every step of the way." },
              { icon: "chat",           title: "Live Chat Support",  desc: "Chat directly with our AI and support agents." },
            ] : [
              { icon: "auto_awesome",   title: "Auto Resolution",    desc: "Automated handling of tier-one queries with high accuracy." },
              { icon: "keyboard_voice", title: "Voice Input",        desc: "Transcribe and analyze customer calls in real-time." },
              { icon: "insights",       title: "Real-time Analytics",desc: "Dynamic dashboards visualizing system performance." },
            ]).map(f => (
              <div className="ll-feat" key={f.title}>
                <div className="ll-feat-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{f.icon}</span>
                </div>
                <div>
                  <div className="ll-feat-title">{f.title}</div>
                  <div className="ll-feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ll-footer">© 2025 ResolvAI Intelligence Systems</div>
      </div>

      {/* Right form panel */}
      <div className="login-right">
        <div className="lf-wrap">
          <div className="lf-mobile-brand">
            <div className="lf-mobile-brand-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#fff", fontVariationSettings: "'FILL' 1" }}>psychology</span>
            </div>
            <div className="lf-mobile-brand-name">ResolvAI</div>
          </div>

          <div className="lf-card">
            <h2 className="lf-title">{tab === "login" ? "Welcome back" : "Create account"}</h2>
            <p className="lf-sub">
              {tab === "login"
                ? `Sign in to your ${isCustomer ? "support" : "admin"} account`
                : "Get started with ResolvAI today"}
            </p>

            {isCustomer && (
              <div className="lf-tabs">
                <button className={`lf-tab${tab === "login" ? " active" : ""}`} onClick={() => { setTab("login"); setFieldErrors({}); }}>Sign In</button>
                <button className={`lf-tab${tab === "register" ? " active" : ""}`} onClick={() => { setTab("register"); setFieldErrors({}); }}>Register</button>
              </div>
            )}

            <form className="lf-form" onSubmit={submit} noValidate>
              {tab === "register" && isCustomer && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="lf-input-wrap">
                    <span className="lf-input-icon material-symbols-outlined">person</span>
                    <input className="lf-input" type="text" placeholder="Your full name" value={fullName} onChange={e => setName(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="lf-input-wrap">
                  <span className="lf-input-icon material-symbols-outlined">account_circle</span>
                  <input
                    className="lf-input"
                    type="text"
                    placeholder="your.username"
                    required
                    value={username}
                    onChange={e => { setUser(e.target.value); setFieldErrors(fe => ({ ...fe, username: undefined })); }}
                    style={fieldErrors.username ? { boxShadow: "0 0 0 2px rgba(186,26,26,0.3)" } : {}}
                  />
                </div>
                {fieldErrors.username && <span style={{ fontSize: 12, color: "var(--error)" }}>{fieldErrors.username}</span>}
              </div>

              {tab === "register" && (
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div className="lf-input-wrap">
                    <span className="lf-input-icon material-symbols-outlined">mail</span>
                    <input
                      className="lf-input"
                      type="email"
                      placeholder="name@company.com"
                      required
                      value={email}
                      onChange={e => { setEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: undefined })); }}
                      style={fieldErrors.email ? { boxShadow: "0 0 0 2px rgba(186,26,26,0.3)" } : {}}
                    />
                  </div>
                  {fieldErrors.email && <span style={{ fontSize: 12, color: "var(--error)" }}>{fieldErrors.email}</span>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="lf-input-wrap">
                  <span className="lf-input-icon material-symbols-outlined">lock</span>
                  <input
                    className="lf-input"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => { setPass(e.target.value); setFieldErrors(fe => ({ ...fe, password: undefined })); }}
                    style={{ paddingRight: 40, ...(fieldErrors.password ? { boxShadow: "0 0 0 2px rgba(186,26,26,0.3)" } : {}) }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--outline)", padding: 4 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPass ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                {fieldErrors.password && <span style={{ fontSize: 12, color: "var(--error)" }}>{fieldErrors.password}</span>}
              </div>

              {error && <div className="lf-error">{error}</div>}

              <button type="submit" className="lf-submit" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : tab === "login" ? "Sign In" : "Create Account"}
                {!loading && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>}
              </button>
            </form>

            {isCustomer && (
              <>
                <div className="lf-divider">
                  <div className="lf-divider-line" />
                  <span className="lf-divider-text">Admin Access</span>
                  <div className="lf-divider-line" />
                </div>
                <div className="lf-footer">
                  Support agent? <a href="/?portal=admin">Admin login →</a>
                </div>
              </>
            )}

            {!isCustomer && (
              <div className="lf-footer" style={{ marginTop: 12 }}>
                Customer? <a href="/">Customer portal →</a>
              </div>
            )}

            <div className="lf-footer" style={{ marginTop: isCustomer ? 8 : 20 }}>
              By signing in, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
