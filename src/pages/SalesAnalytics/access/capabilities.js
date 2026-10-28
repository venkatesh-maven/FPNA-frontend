// Capability-based access for Sales Performance Analytics. Role templates,
// per-user exceptions and delegations are configuration, not code, so the
// Access screen (Phase 3) can change them. This is a client-side stand-in:
// the real API must enforce the same rules server-side on every query.

export const CAPABILITIES = [
  { id: "view_executive_analytics", label: "View executive analytics", group: "Analytics" },
  { id: "view_team_analytics", label: "View team analytics", group: "Analytics" },
  { id: "view_own_analytics", label: "View own / salesperson analytics", group: "Analytics" },
  { id: "view_cost_detail", label: "View direct-cost & sales-expense detail", group: "Sensitive data" },
  { id: "view_commissions", label: "View commissions", group: "Sensitive data" },
  { id: "create_scenario", label: "Create & save What-If scenarios", group: "Planning" },
  { id: "edit_own_forecast", label: "Edit own sales forecast", group: "Planning" },
  { id: "review_team_forecast", label: "Review team forecasts", group: "Planning" },
  { id: "confirm_team_forecast", label: "Confirm team forecast", group: "Planning" },
  { id: "push_forecast_to_forecasting", label: "Send confirmed forecast to Forecasting", group: "Planning" },
  { id: "export_data", label: "Export data", group: "Data" },
  { id: "manage_access", label: "Manage roles & access", group: "Administration" },
];

export const CAPABILITY_IDS = CAPABILITIES.map((c) => c.id);

/**
 * Field-level protection. Without the capability these fields come back
 * empty and are shown as "Restricted" — on screen and in exports.
 */
export const MASKED_FIELDS_BY_CAPABILITY = {
  view_cost_detail: [
    "payRate", "avgPayRate", "payRatePy", "payRateBase", "spread", "spreadAfterBurden", "wages", "burden", "burdenRate",
    "payrollTaxes", "workersComp", "benefits", "salary", "travel", "travelPy", "entertainment", "entertainmentPy",
    "acquisition", "travelAllowance", "entertainmentAllowance", "tAndE", "tAndEAllowance",
  ],
  view_commissions: [
    "commission", "commissionPy", "commissionEarned", "commissionApproved", "commissionAccrued", "commissionProjected",
    "commissionUpside", "commissionExpense",
  ],
};

export const ROLE_IDS = ["executive", "director", "salesperson", "finance", "access_admin"];

export const DEFAULT_ACCESS_CONFIG = {
  version: 1,
  roles: {
    executive: {
      label: "Executive",
      scope: "all",
      capabilities: [
        "view_executive_analytics", "view_team_analytics", "view_own_analytics", "view_cost_detail",
        "view_commissions", "create_scenario", "review_team_forecast", "export_data",
      ],
    },
    director: {
      label: "Sales Director",
      scope: "teams",
      capabilities: [
        "view_team_analytics", "view_own_analytics", "view_cost_detail", "view_commissions", "create_scenario",
        "review_team_forecast", "confirm_team_forecast", "push_forecast_to_forecasting", "export_data",
      ],
    },
    salesperson: {
      label: "Salesperson",
      scope: "own",
      capabilities: ["view_own_analytics", "view_cost_detail", "view_commissions", "create_scenario", "edit_own_forecast", "export_data"],
    },
    finance: {
      label: "Finance",
      scope: "all",
      capabilities: ["view_executive_analytics", "view_team_analytics", "view_own_analytics", "view_cost_detail", "export_data"],
    },
    access_admin: {
      label: "Access Admin",
      scope: "none",
      // Administering access does not grant business-data visibility.
      capabilities: ["manage_access"],
    },
  },
  // Role per person id; people without an entry get their org role.
  assignments: {},
  // Per-person exceptions: { grant: [...], deny: [...] }
  userOverrides: {
    R07: { grant: [], deny: ["view_cost_detail"], note: "Cost detail withheld (sample restricted account)" },
  },
  // { id, fromUserId, toUserId, capabilities, scopeTeamIds, startDate, endDate, reason }
  delegations: [],
};
