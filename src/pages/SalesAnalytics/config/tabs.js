// Tabs of the module, each gated by capability (and mirrored in the sidebar).
// `filters: false` hides the business filter bar on tabs it doesn't apply to.

export const SALES_ANALYTICS_BASE = "/sales-analytics";

export const TABS = [
  { key: "executive", path: `${SALES_ANALYTICS_BASE}/executive`, label: "Executive Overview", any: ["view_executive_analytics"] },
  { key: "director", path: `${SALES_ANALYTICS_BASE}/director`, label: "Sales Director", any: ["view_team_analytics"] },
  { key: "salesperson", path: `${SALES_ANALYTICS_BASE}/salesperson`, label: "My Performance", any: ["view_own_analytics"] },
  { key: "health", path: `${SALES_ANALYTICS_BASE}/health`, label: "Sales Health", any: ["view_executive_analytics", "view_team_analytics", "view_own_analytics"] },
  { key: "what-if", path: `${SALES_ANALYTICS_BASE}/what-if`, label: "What-If & Forecast", any: ["create_scenario"], filters: false },
  { key: "team-forecast", path: `${SALES_ANALYTICS_BASE}/team-forecast`, label: "Team Forecast", any: ["review_team_forecast"], filters: false },
  { key: "access", path: `${SALES_ANALYTICS_BASE}/access`, label: "Access", any: ["manage_access"], filters: false },
];
