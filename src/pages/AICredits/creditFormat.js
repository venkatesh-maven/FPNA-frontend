// Pure display helpers for the AI credit page and chat badge.

export const STATUS = {
  ok: { label: "Healthy", tone: "text-emerald-700 bg-emerald-50 border-emerald-200", bar: "bg-emerald-500", icon: "✓" },
  low: { label: "Running low", tone: "text-amber-800 bg-amber-50 border-amber-200", bar: "bg-amber-500", icon: "!" },
  exhausted: { label: "Used up", tone: "text-red-700 bg-red-50 border-red-200", bar: "bg-red-500", icon: "✕" },
};

export const statusInfo = (status) => STATUS[status] || STATUS.exhausted;

export const REQUEST_STATUS = {
  pending: { label: "Waiting for approval", tone: "text-amber-800 bg-amber-50 border-amber-200" },
  granted: { label: "Approved", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  rejected: { label: "Rejected", tone: "text-gray-600 bg-gray-50 border-gray-200" },
};

export const requestStatusInfo = (status) => REQUEST_STATUS[status] || REQUEST_STATUS.pending;

export const GRANT_SOURCE = {
  starting: "Starting credits",
  request: "Approved request",
  manual: "Added by support",
};

export const grantSourceLabel = (source) => GRANT_SOURCE[source] || source;

// Costs per call are fractions of a cent, so small amounts keep more decimals.
export const formatUsd = (value) => {
  const n = Number(value) || 0;
  const digits = n !== 0 && Math.abs(n) < 1 ? 4 : 2;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

export const formatPct = (value) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);

export const formatInt = (value) => (Number(value) || 0).toLocaleString("en-US");

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

// "2026-11-04" -> "Nov 4" without a timezone shift (the dates are UTC days).
export const formatDay = (isoDate) => {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return String(isoDate);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

// Perplexity itself refusing calls: a platform problem, not the company's balance.
export const PROVIDER_ISSUE_TEXT = {
  insufficient_quota: "AI credits are used up on the AI provider account, so AI features are paused. They'll work again as soon as the account is topped up.",
  rate_limited: "The AI service is busy right now. Please try again in a minute.",
  invalid_key: "The AI service is temporarily unavailable on our side. Please contact support.",
};

export const providerIssueText = (code) =>
  code ? PROVIDER_ISSUE_TEXT[code] || "The last AI call failed on the provider side. Please try again later." : null;

// What the chat badge shows: admins always see the %, everyone else only
// when credits are low or gone. Returns null to show nothing.
export const badgeFor = (summary, isAdmin) => {
  if (!summary) return null;
  const { status, remaining_pct: pct, has_pending_request: pending } = summary;
  if (status === "exhausted") {
    if (pending) return { status, text: "AI credits used up · request pending" };
    return { status, text: isAdmin ? "AI credits used up · request more" : "AI credits used up — ask your admin" };
  }
  if (status === "low") return { status, text: `AI credits low · ${formatPct(pct)} left` };
  if (!isAdmin) return null;
  return { status, text: `${formatPct(pct)} credits left` };
};

// Top-header pill: just the % left, with a plain-language tooltip.
export const headerPillFor = (summary) => {
  if (!summary || summary.remaining_pct === null || summary.remaining_pct === undefined) return null;
  const pct = Math.round(summary.remaining_pct);
  const titles = {
    ok: `${pct}% of your AI credits left`,
    low: `AI credits running low: ${pct}% left`,
    exhausted: summary.has_pending_request
      ? "AI credits used up. A request for more is waiting for approval."
      : "AI credits used up. AI features are paused until more are added.",
  };
  return {
    text: `AI credits ${pct}%`,
    title: titles[summary.status] || titles.exhausted,
  };
};

// Validates the request form (pure). Returns an error message or null.
export const validateRequest = (amountText) => {
  const n = Number(amountText);
  if (String(amountText).trim() === "" || !Number.isFinite(n)) return "Enter an amount in USD.";
  if (n <= 0) return "Amount must be more than $0.";
  if (n > 10000) return "The most you can request at once is $10,000.";
  return null;
};
