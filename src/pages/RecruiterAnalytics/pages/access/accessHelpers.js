// Formatting and style helpers for the Access screen.

export const BTN = {
  primary:
    "inline-flex items-center gap-1.5 rounded-md bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40",
  link: "text-xs font-medium text-sky-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50",
};

export const INPUT = "rounded-md border border-sky-200 bg-white px-2 py-1.5 text-xs text-sky-900 focus:border-sky-500 focus:outline-none";

export const ORG_ROLE_GROUPS = [
  ["executive", "Executives"],
  ["recruiting_director", "Recruiting Directors"],
  ["account_manager", "Account Managers"],
  ["lead", "Recruiter Leads"],
  ["recruiter", "Recruiters"],
  ["finance", "Finance"],
  ["access_admin", "Access administration"],
];

export const fmtDate = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "open";

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const dateRange = (start, end) => (start || end ? `${fmtDate(start)} – ${fmtDate(end)}` : "No dates (always on)");

export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export const groupCapabilities = (caps) =>
  [...new Set(caps.map((c) => c.group))].map((group) => ({ group, items: caps.filter((c) => c.group === group) }));

export const capLabelOf = (caps, id) => caps.find((c) => c.id === id)?.label || id;
