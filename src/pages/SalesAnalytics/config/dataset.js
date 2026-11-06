// Dataset anchor for Staffing Sales Analytics. The module starts on a seeded
// sample (which tests use, so they always see the same numbers); the live
// dataset from the server replaces these values once it has loaded. They are
// `let` exports, so every module that imports them sees the live values.

export const DATASET_SEED = "fpna-sales-performance";
export const DATASET_VERSION = 1;
export let DATASET_AS_OF = "2026-10-16"; // last timesheet week-end loaded
export let DATASET_START_YM = "2024-01";
export let FISCAL_START_MONTH = 1; // calendar fiscal year
export const DATASET_CURRENCY = "USD";

export const SOURCES = {
  billing: "Timesheets & billing (sample)",
  payroll: "Payroll & burden (sample)",
  crm: "CRM opportunities (sample)",
  expenses: "Expense management (sample)",
  commission: "Commission plan (sample)",
  plans: "Budget, Sales Target, Board Plan & Finance Forecast (sample)",
};

/** Points the module at the live dataset: its date, first month, fiscal year and real sources. */
export function applyLiveConfig({ asOf, startYm, fiscalStartMonth }) {
  DATASET_AS_OF = asOf;
  DATASET_START_YM = startYm;
  FISCAL_START_MONTH = fiscalStartMonth || 1;
  Object.assign(SOURCES, {
    billing: "General ledger revenue & COGS",
    payroll: "General ledger (Sales payroll)",
    crm: "CRM opportunities",
    expenses: "General ledger (Sales salaries & travel)",
    commission: "Commission (not loaded)",
    plans: "Uploaded budget & Revenue Forecasting",
  });
}

// Simulated network delay for the mock service; tests switch it off.
export const MOCK_LATENCY_MS = { min: 120, max: 280 };
