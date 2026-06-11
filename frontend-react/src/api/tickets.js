import client from "./client";

export const processTicket = (payload) =>
  client.post("/process-ticket", payload).then((r) => r.data);

export const getMetrics = () =>
  client.get("/metrics").then((r) => r.data);

export const getHealth = () =>
  client.get("/health").then((r) => r.data);
