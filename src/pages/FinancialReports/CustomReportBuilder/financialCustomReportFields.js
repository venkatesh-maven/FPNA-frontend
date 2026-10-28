// Field vocabulary for the Financial Reports Custom Report Builder. These
// field names must match the JSON keys returned by the backend endpoint
// (FPNA-Backend src/financial/controller.py::custom_report_data,
// GET /company/financial/custom_report/{year}/{currency}) exactly — the
// endpoint's SELECT list is written to produce these same keys, so no
// mapping layer is needed between the API response and the report builder's
// checkbox panel / colDef generation (financialCustomReportColumnDefs.js).
//
// The metrics below (beyond the original catch-all "Amount") mirror the
// exact bucketing rules the Profit & Loss and Cash Flow Statement pages
// already use (same account_type/account_name rules, see the backend
// endpoint's comments) — so "Revenue"/"Gross Profit"/"Operating Cash Flow"
// here match what those pages would show for the same scope. Each is a
// per-row additive component, so any combination of dimensions/metrics a
// user checks aggregates correctly.
//
// "Budget" is deliberately not included as a dimension/metric here: it's a
// separate concept (Compare With -> Budget, see financialCustomReportCompare.js)
// backed by its own endpoint (/custom_report/budget/{year}/{currency}),
// because fpna_landing.finance_budget_data has no customer/product
// breakdown — only Entity/Department/CostCenter — so it can't be folded
// into this row-level field list. Balance Sheet, Fixed Asset, and Sales
// Funnel metrics are also excluded — those pages read from entirely
// different tables (a legacy per-tenant GL model, a dedicated fixed-asset
// register, and the CRM opportunities table respectively), not the GL
// transaction join this endpoint is built on, so adding them here would
// mean a second, unrelated data pipeline rather than extending this one.
//
// `aggregation` tells financialCustomReportAggregate.js how to combine a
// metric across rows/groups:
//   "additive" (default) — summed (or avg/min/max'd per the chosen agg
//     func) directly, like Revenue or Volume.
//   "ratio" — a ratio of two additive components (e.g. Revenue/Volume),
//     computed AFTER those components are summed at each group/node —
//     never summed directly. See `numerator`/`denominator`.
//   "share" — a row's share of a base metric's grand total across the
//     *entire currently filtered dataset* (e.g. this row's Revenue as % of
//     total Revenue), precomputed per-row before aggregation, then summed
//     like any additive metric. See `shareOf`.
export const FINANCIAL_CUSTOM_REPORT_FIELD_DEFS = [
  { field: "Entity", label: "Entity", type: "dimension" },
  { field: "Department", label: "Department", type: "dimension" },
  { field: "CostCenter", label: "Cost Center", type: "dimension" },
  { field: "Category", label: "Category", type: "dimension" },
  { field: "Customer", label: "Customer", type: "dimension" },
  { field: "Product", label: "Product", type: "dimension" },
  { field: "Month", label: "Month", type: "dimension" },

  { field: "Amount", label: "Amount (All Categories)", type: "metric" },

  // Profit & Loss metrics (report.py::_pnl_report_compute)
  { field: "Revenue", label: "Revenue", type: "metric" },
  { field: "CostOfGoodsSold", label: "Cost of Goods Sold", type: "metric" },
  { field: "OperatingExpense", label: "Operating Expense", type: "metric" },
  { field: "GrossProfit", label: "Gross Profit", type: "metric" },
  { field: "NetIncome", label: "Net Income", type: "metric" },

  // EBITDA is not a stored line item anywhere in this app — the AI
  // assistant's own system prompt (src/ai/assistant_controller.py:~1131)
  // already documents the house approximation: Revenue - COGS - Operating
  // Expense, identical to NetIncome above. Offered as its own metric here
  // purely for finance-user framing/labeling; the value will always match
  // Net Income for the same scope.
  { field: "EBITDA", label: "EBITDA (approximate)", type: "metric" },

  // Cash Flow Statement metrics (report.py::_cashflow_report_compute)
  { field: "OperatingCashFlow", label: "Operating Cash Flow", type: "metric" },
  { field: "InvestingCashFlow", label: "Investing Cash Flow", type: "metric" },
  { field: "FinancingCashFlow", label: "Financing Cash Flow", type: "metric" },
  { field: "NetCashChange", label: "Net Cash Change", type: "metric" },

  // Volume: count of GL transaction lines in a group (COUNT(*), not tied to
  // any account_type/account_name bucket), so it's computed the same way
  // regardless of which department/category/etc. the rows belong to —
  // check Department (or any dimension) alongside it to compare
  // transaction volume across departments on equal footing. Not a currency
  // amount, so it's formatted as a plain count.
  { field: "Volume", label: "Volume", type: "metric", format: "count" },

  // Rate/Price: average revenue per transaction line (Revenue ÷ Volume) —
  // a true ratio, not additive. Replaces the old, differently-named "Rate"
  // field (which was actually a Volume-mix percentage, not a price).
  {
    field: "RatePrice",
    label: "Rate / Price (Revenue ÷ Volume)",
    type: "metric",
    format: "currency",
    aggregation: "ratio",
    numerator: "Revenue",
    denominator: "Volume",
  },

  // Mix: this row's Revenue as a percentage of total Revenue across the
  // currently filtered dataset — computed client-side (see
  // financialCustomReportAggregate.js's attachShareMetrics), same
  // additive-share technique the old "Rate" field used for Volume.
  {
    field: "Mix",
    label: "Mix (% of Total Revenue)",
    type: "metric",
    format: "percent",
    aggregation: "share",
    shareOf: "Revenue",
  },

  // Gross Margin %: Gross Profit ÷ Revenue — a ratio, computed the same
  // post-aggregation way as Rate/Price.
  {
    field: "GrossMarginPercent",
    label: "Gross Margin %",
    type: "metric",
    format: "percent",
    aggregation: "ratio",
    numerator: "GrossProfit",
    denominator: "Revenue",
    percentRatio: true,
  },
];
