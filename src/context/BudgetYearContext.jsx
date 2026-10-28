// src/context/BudgetYearContext.js
// Holds the single active Fiscal Year (and forward-looking Budget Year,
// = fiscalYear + 1) for the whole app. This is the real source of truth,
// set from Settings & Customization -> FY Management (or the Dashboard
// header, which writes through it too): it drives Budgeting, Forecasting,
// and — via the one-way sync effect below — AuthContext.selectedYear,
// which Financial Reports/Dashboard/alerts/KPI pages read.
// Both budgetYear and fiscalYearStartMonth are real, company-wide settings
// persisted on the backend (companies.current_budget_year /
// companies.fiscal_year_start_month) — localStorage is only a display cache
// so the UI has something to show before the initial fetch resolves.
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { AuthContext } from "./AuthContext";
import { API_BASE_URL } from "../config/config";
import { invalidateReportCache } from "../utils/reportCache";

export const BudgetYearContext = createContext();

export default function BudgetYearProvider({ children }) {
  const { token, selectedYear, setSelectedYear } = useContext(AuthContext);

  const [budgetYear, setBudgetYearState] = useState(() => {
    const stored = localStorage.getItem("budgetYear");
    return stored ? parseInt(stored, 10) : new Date().getFullYear() + 1;
  });

  // 1 = January … 12 = December. Lets a company whose fiscal year doesn't
  // start in January (e.g. April or July) say so.
  const [fiscalYearStartMonth, setFiscalYearStartMonthState] = useState(() => {
    const stored = localStorage.getItem("fiscalYearStartMonth");
    return stored ? parseInt(stored, 10) : 1;
  });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/company/financial/current_budget_year`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.current_budget_year) {
          setBudgetYearState(data.current_budget_year);
          localStorage.setItem("budgetYear", data.current_budget_year);
        }
      } catch (err) {
        console.error("Failed to fetch current_budget_year:", err);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/company/financial/fiscal_year_start_month`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.fiscal_year_start_month) {
          setFiscalYearStartMonthState(data.fiscal_year_start_month);
          localStorage.setItem("fiscalYearStartMonth", data.fiscal_year_start_month);
        }
      } catch (err) {
        console.error("Failed to fetch fiscal_year_start_month:", err);
      }
    })();
  }, [token]);

  const setBudgetYear = useCallback((year) => {
    // Update immediately so every Budgeting page re-renders in lockstep;
    // persist to the backend in the background so it's the shared default
    // next time anyone (any device) opens the app.
    setBudgetYearState(year);
    localStorage.setItem("budgetYear", year);
    // Financial Reports pages (P&L, Balance Sheet, etc.) cache API responses
    // for up to an hour keyed by URL (see utils/reportCache.js) — that cache
    // has no way to know the active year just changed, so without this it
    // keeps serving whatever year was cached before this change.
    invalidateReportCache();
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/company/financial/current_budget_year`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_budget_year: year }),
    }).catch((err) => console.error("Failed to save current_budget_year:", err));
  }, [token]);

  const setFiscalYearStartMonth = useCallback(async (month) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/company/financial/fiscal_year_start_month`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fiscal_year_start_month: month }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || "Failed to save fiscal year start month");
    }
    const data = await res.json();
    setFiscalYearStartMonthState(data.fiscal_year_start_month);
    localStorage.setItem("fiscalYearStartMonth", data.fiscal_year_start_month);
    // Same reason as setBudgetYear: this changes which months fall in the
    // active fiscal year for the SAME year label, so any Financial Reports
    // response cached under the old start month is now wrong.
    invalidateReportCache();
  }, [token]);

  // Reporting/forecast year: the FY label users think in terms of
  // ("FY2025"). budgetYear is always fiscalYear + 1 (the year you're
  // budgeting FOR) — this relationship is invariant, independent of
  // fiscalYearStartMonth.
  const fiscalYear = budgetYear - 1;

  const setFiscalYear = useCallback((year) => {
    // Route every fiscal-year write (FY Management, Dashboard header)
    // through setBudgetYear so there's a single persistence path.
    setBudgetYear(year + 1);
  }, [setBudgetYear]);

  // Push fiscalYear into AuthContext.selectedYear so it becomes the single
  // source of truth for Financial Reports/alerts/KPI pages, which only
  // ever read AuthContext.selectedYear. One direction only — AuthContext
  // can't read BudgetYearContext (it's an ancestor), so there's no cycle;
  // the equality guard just avoids a redundant re-render once they match.
  useEffect(() => {
    if (selectedYear === fiscalYear) return;
    setSelectedYear(fiscalYear);
  }, [fiscalYear, selectedYear, setSelectedYear]);

  const contextValue = useMemo(() => ({
    budgetYear, setBudgetYear,
    fiscalYear, setFiscalYear,
    fiscalYearStartMonth, setFiscalYearStartMonth,
  }), [budgetYear, setBudgetYear, fiscalYear, setFiscalYear, fiscalYearStartMonth, setFiscalYearStartMonth]);

  return (
    <BudgetYearContext.Provider value={contextValue}>
      {children}
    </BudgetYearContext.Provider>
  );
}
