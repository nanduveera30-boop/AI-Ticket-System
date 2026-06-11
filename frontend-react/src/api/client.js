import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ── Auth token injection ──────────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response error normalisation ──────────────────────────────────────────────
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;

    // 401 — clear stale token and reload
    if (error.response?.status === 401 && !config._isRetry) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.reload();
      return Promise.reject(error);
    }

    // Retry on network errors or 5xx (max 2 retries, exponential backoff)
    const isNetworkError = !error.response;
    const isServerError  = error.response?.status >= 500;
    config._retryCount   = config._retryCount || 0;

    if ((isNetworkError || isServerError) && config._retryCount < 2) {
      config._retryCount += 1;
      config._isRetry = true;
      const delay = config._retryCount * 1000; // 1s, 2s
      await new Promise((r) => setTimeout(r, delay));
      return client(config);
    }

    // Normalise error message
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === "string") {
      error.message = detail;
    } else if (Array.isArray(detail)) {
      error.message = detail.map((d) => d.msg).join(", ");
    }

    return Promise.reject(error);
  }
);

export default client;
