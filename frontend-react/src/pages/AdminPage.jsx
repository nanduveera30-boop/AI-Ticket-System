import { useState, useEffect } from "react";
import { adminListUsers, adminUpdateUser, adminDeleteUser, adminSystemInfo, adminReindex } from "../api/admin";

export default function AdminPage() {
  const [users, setUsers]     = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [tab, setTab]         = useState("users");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);
  const [msgType, setMsgType] = useState("success"); // success | error

  function flash(text, type = "success") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(null), 3000);
  }

  async function loadUsers() {
    try { setUsers(await adminListUsers()); } catch { /* handled */ }
  }
  async function loadSystem() {
    try { setSysInfo(await adminSystemInfo()); } catch { /* handled */ }
  }

  useEffect(() => { loadUsers(); loadSystem(); }, []);

  async function handleRoleChange(userId, role) {
    try {
      await adminUpdateUser(userId, { role });
      flash(`Role updated to ${role}`);
      loadUsers();
    } catch { flash("Failed to update role", "error"); }
  }

  async function handleToggleActive(userId, current) {
    try {
      await adminUpdateUser(userId, { is_active: !current });
      flash(`User ${current ? "deactivated" : "activated"}`);
      loadUsers();
    } catch { flash("Failed to update user", "error"); }
  }

  async function handleReindex() {
    setLoading(true);
    try {
      const r = await adminReindex();
      flash(r.message || "Reindex complete");
      loadSystem();
    } catch { flash("Reindex failed", "error"); }
    finally { setLoading(false); }
  }

  const db = sysInfo?.database;
  const ai = sysInfo?.ai;

  return (
    <>
      {msg && (
        <div style={{
          background: msgType === "success" ? "#dcfce7" : "var(--error-container)",
          border: `1px solid ${msgType === "success" ? "rgba(22,163,74,.25)" : "rgba(186,26,26,.25)"}`,
          borderRadius: "var(--r2)",
          padding: "10px 14px",
          fontSize: 13,
          color: msgType === "success" ? "#166534" : "var(--on-error-container)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {msgType === "success" ? "check_circle" : "error"}
          </span>
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {["users", "system"].map(t => (
          <button
            key={t}
            className={tab === t ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
            onClick={() => setTab(t)}
            style={{ textTransform: "capitalize" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {t === "users" ? "group" : "settings"}
            </span>
            {t}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">User Management</div>
              <div className="card-sub">Manage roles and access for all users</div>
            </div>
            <button className="btn-ghost btn-sm" onClick={loadUsers}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              Refresh
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>No users found.</td>
                  </tr>
                )}
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-primary" style={{ color: "var(--primary-container)" }}>#{u.id}</td>
                    <td className="td-primary">{u.username}</td>
                    <td style={{ fontSize: 12, color: "var(--on-surface-variant)" }}>{u.email}</td>
                    <td>
                      <select
                        className="user-role-select"
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="admin">admin</option>
                        <option value="agent">agent</option>
                        <option value="customer">customer</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className={`btn-sm ${u.is_active ? "btn-danger" : "btn-secondary"}`}
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System tab */}
      {tab === "system" && (
        <div className="admin-grid">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Database Stats</span>
              <button className="btn-ghost btn-sm" onClick={loadSystem}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              </button>
            </div>
            {db ? [
              ["Total Tickets",     db.total_tickets],
              ["Total Predictions", db.total_predictions],
              ["Total Users",       db.total_users],
              ["Audit Log Entries", db.total_audit_logs],
            ].map(([l, v]) => (
              <div className="system-stat" key={l}>
                <span className="system-stat-label">{l}</span>
                <span className="system-stat-value">{v}</span>
              </div>
            )) : <div className="loading-state" style={{ padding: 20 }}>Loading…</div>}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">AI Engine</span>
            </div>
            {ai ? (
              <>
                {[
                  ["FAISS Index Size",  ai.faiss_index_size],
                  ["Avg Confidence",    `${(ai.avg_confidence * 100).toFixed(2)}%`],
                  ["AUTO_RESOLVE",      ai.action_distribution?.AUTO_RESOLVE ?? 0],
                  ["SUGGEST",           ai.action_distribution?.SUGGEST ?? 0],
                  ["ESCALATE",          ai.action_distribution?.ESCALATE ?? 0],
                  ["Risk HIGH",         ai.risk_distribution?.HIGH ?? 0],
                  ["Risk LOW",          ai.risk_distribution?.LOW ?? 0],
                ].map(([l, v]) => (
                  <div className="system-stat" key={l}>
                    <span className="system-stat-label">{l}</span>
                    <span className="system-stat-value">{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 16 }}>
                  <button className="btn-secondary" onClick={handleReindex} disabled={loading}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                    {loading ? "Reindexing…" : "Rebuild FAISS Index"}
                  </button>
                </div>
              </>
            ) : <div className="loading-state" style={{ padding: 20 }}>Loading…</div>}
          </div>
        </div>
      )}
    </>
  );
}
