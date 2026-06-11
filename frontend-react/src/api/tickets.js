import client from "./client";

export const processTicket      = (p) => client.post("/process-ticket", p).then(r => r.data);
export const createTicket       = (p) => client.post("/tickets", p).then(r => r.data);
export const listTickets        = (params) => client.get("/tickets", { params }).then(r => r.data);
export const getTicket          = (id) => client.get(`/tickets/${id}`).then(r => r.data);
export const getTicketPrediction= (id) => client.get(`/tickets/${id}/prediction`).then(r => r.data);
export const checkDuplicate     = (p) => client.post("/tickets/check-duplicate", p).then(r => r.data);
export const getAuditLogs       = (params) => client.get("/audit-logs", { params }).then(r => r.data);
export const getMetrics         = () => client.get("/metrics").then(r => r.data);
export const getDetailedMetrics = () => client.get("/metrics/detailed").then(r => r.data);
export const getHealth          = () => client.get("/health").then(r => r.data);
