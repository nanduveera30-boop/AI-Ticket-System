import client from "./client";

export const getChatHistory = (ticketId) =>
  client.get(`/tickets/${ticketId}/chat`).then(r => r.data);

export const sendMessage = (ticketId, message) =>
  client.post(`/tickets/${ticketId}/chat`, { message }).then(r => r.data);

export const getFAQs = (category) =>
  client.get("/faq", { params: category ? { category } : {} }).then(r => r.data);

export const searchFAQs = (q) =>
  client.get("/faq/search", { params: { q } }).then(r => r.data);

export const getMyTickets = (params) =>
  client.get("/my-tickets", { params }).then(r => r.data);

export const updateTicketStatus = (ticketId, status, assignedTo) =>
  client.patch(`/tickets/${ticketId}/status`, { status, assigned_to: assignedTo }).then(r => r.data);
