import client from "./client";

export const adminListUsers    = (params) => client.get("/admin/users", { params }).then(r => r.data);
export const adminGetUser      = (id) => client.get(`/admin/users/${id}`).then(r => r.data);
export const adminUpdateUser   = (id, payload) => client.patch(`/admin/users/${id}`, payload).then(r => r.data);
export const adminDeleteUser   = (id) => client.delete(`/admin/users/${id}`).then(r => r.data);
export const adminSystemInfo   = () => client.get("/admin/system").then(r => r.data);
export const adminReindex      = () => client.post("/admin/system/reindex").then(r => r.data);
export const adminAuditLogs    = (params) => client.get("/admin/audit-logs", { params }).then(r => r.data);
export const getMe             = () => client.get("/auth/me").then(r => r.data);
