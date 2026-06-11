import { useState, useEffect } from "react";
import { adminListUsers, adminUpdateUser, adminDeleteUser, adminSystemInfo, adminReindex } from "../api/admin";

export default function AdminPage() {
  const [users, setUsers]       = useState([]);
  const [sysInfo, setSysInfo]   = useState(null);
  const [tab, setTab]           = useState("users");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

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
      setMsg(`Role updated to ${role}`);
      loadUsers();
    } catch { setMsg("Failed to update role"); }
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleToggleActive(userId, current) {
    try {
      await adminUpdateUser(userId, { is_active: !current });
      setMsg(`User ${current ? "deactivated" : "activated"}`);
      loadUsers();
    } catch { setMsg("Failed to update user"); }
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleReindex() {
    setLoading(true);
    try {
      const r = await adminReindex();
      setMsg(r.message);
    } catch { setMsg("Reindex failed"); }
    finally { setLoading(false); }
    setTimeout(() => setMsg(null), 4000);
  }

  const db = sysInfo?.database;
  const ai = sysInfo?.ai;

  return (
    <>
      {msg && (
        <div style={{ background: "var(--green-bg)", border: "1px solid rgba(22,163,74,.25)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, color: "var(--green)", marginBottom: 4 }}>
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {["users", "system"].map(t => (
          <button key={t} className={tab === t ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">User Management</div><div className="card-sub">Manage roles and access</div></div>
            <button className="btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.length === 0 && <tr className="empty-row"><td colSpan={7}>No users found.</td></tr>}
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-primary">#{u.id}</td>
                    <td className="td-primary">{u.username}</td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>{u.email}</td>
                    <td>
                      <select
                        className="user-role-select"
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="admin">admin</option>
                        <option value="agent">agent</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text3)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
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
            <div className="card-header"><span className="card-title">Database</span></div>
            {db && [
              ["Total Tickets",     db.total_tickets],
              ["Total Predictions", db.total_predictions],
              ["Total Users",       db.total_users],
              ["Audit Log Entries", db.total_audit_logs],
            ].map(([l, v]) => (
              <div className="system-stat" key={l}>
                <span className="system-stat-label">{l}</span>
                <span className="system-stat-value">{v}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">AI Engine</span></div>
            {ai && [
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
                {loading ? "Reindexing…" : "↻ Rebuild FAISS Index"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
