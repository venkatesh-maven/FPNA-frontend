import { API_BASE_URL } from "../../config/config";

// One backend endpoint (src/ai_credits/controller.py):
//   GET  /api/v1/ai-credits  full summary for company admins; status + % for others
//   PUT  /api/v1/ai-credits  admin: { warn_threshold_pct }
//   POST /api/v1/ai-credits  admin: { amount_usd, note } -> credit request for the super admin
// PUT and POST return the refreshed summary.
const URL = `${API_BASE_URL}/api/v1/ai-credits`;

const request = async (token, options = {}) => {
  const res = await fetch(URL, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return data;
};

export const fetchAiCredits = (token) => request(token);

export const updateWarnThreshold = (token, warnThresholdPct) =>
  request(token, { method: "PUT", body: JSON.stringify({ warn_threshold_pct: warnThresholdPct }) });

export const requestAiCredits = (token, amountUsd, note) =>
  request(token, { method: "POST", body: JSON.stringify({ amount_usd: amountUsd, note: note || null }) });
