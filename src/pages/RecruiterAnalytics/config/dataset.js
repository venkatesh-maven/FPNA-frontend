// Sample-data anchor for Staffing Recruiter Analytics. Everything in the module
// runs on a seeded mock staffing dataset until the backend exists; fixing the
// as-of date keeps reviews and tests looking at the same numbers.

// Same seed as the Sales Analytics sample, so both modules describe one company.
export const DATASET_SEED = "fpna-sales-performance";
export const DATASET_VERSION = 1;
export const DATASET_AS_OF = "2026-10-16"; // last timesheet week-end loaded
export const DATASET_START_YM = "2024-01";
export const FISCAL_START_MONTH = 1; // calendar fiscal year
export const DATASET_CURRENCY = "USD";

export const SOURCES = {
  billing: "Timesheets & billing (sample)",
  payroll: "Payroll & burden (sample)",
  crm: "ATS job orders (sample)",
  expenses: "Expense management (sample)",
  commission: "Commission plan (sample)",
  plans: "Budget, Recruiting Target, Board Plan & Finance Forecast (sample)",
};

// Simulated network delay for the mock service; tests switch it off.
export const MOCK_LATENCY_MS = { min: 120, max: 280 };
