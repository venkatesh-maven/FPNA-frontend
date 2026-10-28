// Declarative "What to Show" driver map for the guided Custom Report
// Builder. Picking a Primary Metric exposes only the supporting drivers
// that are actually meaningful for it (per the Custom Reports redesign
// spec) instead of one flat list of every field — this is what makes the
// builder feel finance-aware rather than a generic BI field picker.
//
// Only drivers backed by real data are offered. Two drivers named in the
// original spec are intentionally omitted because no data source exists for
// them anywhere in the backend: Gross Margin's "Bill Rate" and "Pay Rate /
// Cost Rate" would need a timesheet/staffing-rate table this app doesn't
// have (GL data has no per-worker billing/pay rate concept).
export const PRIMARY_METRIC_OPTIONS = [
  { field: "Revenue", label: "Revenue" },
  { field: "GrossProfit", label: "Gross Profit" },
  { field: "EBITDA", label: "EBITDA" },
  { field: "NetIncome", label: "Net Income" },
  { field: "OperatingExpense", label: "Operating Expenses" },
  { field: "NetCashChange", label: "Cash Flow" },
];

export const METRIC_DRIVER_MAP = {
  Revenue: {
    drivers: ["Volume", "RatePrice", "Mix"],
    defaultOn: ["Volume", "RatePrice"],
  },
  GrossProfit: {
    drivers: ["Revenue", "CostOfGoodsSold", "Volume", "GrossMarginPercent"],
    defaultOn: ["Revenue", "CostOfGoodsSold"],
  },
  EBITDA: {
    drivers: ["Revenue", "GrossProfit", "OperatingExpense"],
    defaultOn: ["Revenue", "OperatingExpense"],
  },
  NetIncome: {
    drivers: ["Revenue", "CostOfGoodsSold", "OperatingExpense"],
    defaultOn: [],
  },
  OperatingExpense: {
    drivers: ["Volume"],
    defaultOn: [],
  },
  NetCashChange: {
    drivers: ["OperatingCashFlow", "InvestingCashFlow", "FinancingCashFlow"],
    defaultOn: ["OperatingCashFlow"],
  },
};

export function driversFor(primaryMetric) {
  return METRIC_DRIVER_MAP[primaryMetric]?.drivers || [];
}

export function defaultDriversFor(primaryMetric) {
  return METRIC_DRIVER_MAP[primaryMetric]?.defaultOn || [];
}
