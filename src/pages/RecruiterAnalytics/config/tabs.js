// Tabs of the module, each gated by capability (and mirrored in the sidebar).
// The first four follow the recruiting hierarchy: Recruiting Director,
// Account Manager, Recruiter Lead, Recruiter.
// `filters: false` hides the business filter bar on tabs it doesn't apply to.

export const SALES_ANALYTICS_BASE = "/recruiter-analytics";

export const TABS = [
  { key: "director", path: `${SALES_ANALYTICS_BASE}/director`, label: "Director Overview", any: ["view_executive_analytics"] },
  { key: "account-manager", path: `${SALES_ANALYTICS_BASE}/account-manager`, label: "Account Manager", any: ["view_manager_analytics"] },
  { key: "lead", path: `${SALES_ANALYTICS_BASE}/lead`, label: "Recruiter Lead", any: ["view_team_analytics"] },
  { key: "recruiter", path: `${SALES_ANALYTICS_BASE}/recruiter`, label: "My Performance", any: ["view_own_analytics"] },
  { key: "health", path: `${SALES_ANALYTICS_BASE}/health`, label: "Recruiting Health", any: ["view_executive_analytics", "view_manager_analytics", "view_team_analytics", "view_own_analytics"] },
  { key: "what-if", path: `${SALES_ANALYTICS_BASE}/what-if`, label: "What-If & Forecast", any: ["create_scenario"], filters: false },
  { key: "team-forecast", path: `${SALES_ANALYTICS_BASE}/team-forecast`, label: "Team Forecast", any: ["review_team_forecast"], filters: false },
  { key: "access", path: `${SALES_ANALYTICS_BASE}/access`, label: "Access", any: ["manage_access"], filters: false },
];
