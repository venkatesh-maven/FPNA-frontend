// Every common filter from the spec: its state key, URL key, type, default
// and which data each one narrows (so a footer can say which filters a view
// does not use).

export const FILTER_FIELDS = [
  { key: "period", url: "p", type: "single", default: "QTD", group: "period" },
  { key: "from", url: "pf", type: "single", default: "", group: "period" },
  { key: "to", url: "pt", type: "single", default: "", group: "period" },
  { key: "compare", url: "cmp", type: "single", default: "budget", group: "period" },

  { key: "bu", url: "bu", type: "multi", label: "Business unit", group: "hierarchy", options: "businessUnits" },
  { key: "region", url: "rg", type: "multi", label: "Region", group: "hierarchy", options: "regions" },
  { key: "branch", url: "br", type: "multi", label: "Branch", group: "hierarchy", options: "branches" },
  { key: "vertical", url: "vt", type: "multi", label: "Vertical", group: "hierarchy", options: "verticals" },
  { key: "serviceLine", url: "sl", type: "multi", label: "Service line", group: "hierarchy", options: "serviceLines" },

  { key: "director", url: "dir", type: "multi", label: "Sales director", group: "people", options: "directors" },
  { key: "team", url: "tm", type: "multi", label: "Team", group: "people", options: "teams" },
  { key: "rep", url: "rep", type: "multi", label: "Salesperson / account owner", group: "people", options: "reps" },

  { key: "client", url: "cl", type: "multi", label: "Client", group: "accounts", options: "clients" },
  { key: "clientType", url: "ct", type: "single", default: "all", label: "Client type", group: "accounts", options: "clientTypes" },

  { key: "placementType", url: "plt", type: "multi", label: "Placement type", group: "staffing", options: "placementTypes" },
  { key: "assignmentStatus", url: "as", type: "single", default: "all", label: "Assignment status", group: "staffing", options: "assignmentStatuses" },

  { key: "oppStatus", url: "os", type: "multi", label: "Opportunity status", group: "pipeline", options: "oppStatuses" },
  { key: "stage", url: "st", type: "multi", label: "Stage", group: "pipeline", options: "stages" },
  { key: "probBand", url: "pb", type: "multi", label: "Probability band", group: "pipeline", options: "probBands" },
  { key: "expectedStart", url: "es", type: "single", default: "", label: "Expected start month", group: "pipeline", options: "months" },

  { key: "directCost", url: "dc", type: "multi", label: "Direct cost category", group: "cost", options: "directCostCategories" },
  { key: "salesExpense", url: "se", type: "multi", label: "Sales expense category", group: "cost", options: "salesExpenseCategories" },
  { key: "commissionStatus", url: "cs", type: "multi", label: "Commission status", group: "cost", options: "commissionStatuses" },

  { key: "scenario", url: "scn", type: "single", default: "actual", label: "Scenario", group: "scenario", options: "scenarios" },
];

export const FILTER_GROUPS = [
  { id: "hierarchy", label: "Hierarchy" },
  { id: "people", label: "People" },
  { id: "accounts", label: "Accounts" },
  { id: "staffing", label: "Staffing" },
  { id: "pipeline", label: "Pipeline" },
  { id: "cost", label: "Cost" },
  { id: "scenario", label: "Scenario" },
];

export const DEFAULT_FILTERS = Object.fromEntries(
  FILTER_FIELDS.map((f) => [f.key, f.type === "multi" ? [] : f.default])
);

// Filters that narrow each kind of data. Anything else active is "not applied" there.
export const APPLIES_TO = {
  actuals: ["bu", "region", "branch", "vertical", "serviceLine", "director", "team", "rep", "client", "clientType", "placementType", "assignmentStatus"],
  plans: ["bu", "region", "branch", "vertical", "serviceLine", "director", "team", "rep", "client", "clientType"],
  pipeline: ["bu", "region", "branch", "vertical", "director", "team", "rep", "client", "oppStatus", "stage", "probBand", "expectedStart"],
  expenses: ["region", "branch", "director", "team", "rep", "salesExpense", "commissionStatus"],
  costDetail: ["directCost"],
};

// Filters on client attributes; with any of these active, a rep's sales
// expense is allocated to the filtered clients by GP share.
export const CLIENT_SLICE_FILTERS = ["bu", "vertical", "serviceLine", "client", "clientType", "placementType", "assignmentStatus"];

export const isActive = (filters, key) => {
  const field = FILTER_FIELDS.find((f) => f.key === key);
  const v = filters[key];
  if (!field) return false;
  return field.type === "multi" ? Array.isArray(v) && v.length > 0 : v != null && v !== field.default;
};

export const activeFilterKeys = (filters) =>
  FILTER_FIELDS.filter((f) => f.group !== "period" && isActive(filters, f.key)).map((f) => f.key);

export const STATIC_OPTIONS = {
  clientTypes: [
    { id: "all", name: "All clients" },
    { id: "new", name: "New (won in last 12 months)" },
    { id: "existing", name: "Existing" },
  ],
  placementTypes: [
    { id: "contract", name: "Contract" },
    { id: "c2h", name: "Contract-to-hire" },
    { id: "direct", name: "Direct hire" },
  ],
  assignmentStatuses: [
    { id: "all", name: "All assignments" },
    { id: "active", name: "Active" },
    { id: "ended", name: "Ended" },
  ],
  oppStatuses: [
    { id: "open", name: "Open" },
    { id: "won", name: "Won" },
    { id: "lost", name: "Lost" },
  ],
  stages: ["Prospect", "Qualified", "Proposal", "Negotiation"].map((s) => ({ id: s, name: s })),
  probBands: [
    { id: "0-25", name: "0–25%" },
    { id: "25-50", name: "25–50%" },
    { id: "50-75", name: "50–75%" },
    { id: "75-100", name: "75–100%" },
  ],
  directCostCategories: [
    { id: "wages", name: "Contractor wages" },
    { id: "payroll_taxes", name: "Payroll taxes (FICA, FUTA, SUTA)" },
    { id: "workers_comp", name: "Workers' comp" },
    { id: "benefits", name: "Benefits" },
    { id: "other_direct", name: "Other direct costs" },
  ],
  salesExpenseCategories: [
    { id: "commission", name: "Commissions" },
    { id: "travel", name: "Travel" },
    { id: "entertainment", name: "Client entertainment" },
    { id: "acquisition", name: "Client acquisition" },
    { id: "salary", name: "Salary & benefits allocation" },
  ],
  commissionStatuses: [
    { id: "approved", name: "Approved / payable" },
    { id: "earned", name: "Earned / accrued" },
  ],
  scenarios: [{ id: "actual", name: "Actual" }],
};
