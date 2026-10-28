// src/context/BudgetMethodologyContext.jsx
// Holds the single active Budget Methodology (Bottom-Up / Top-Down / Hybrid)
// for the Budgeting module — set once per planning cycle on the Budget Setup
// & Guidelines page, read by every other Budget page to decide which
// workflow/screen to render (PRD §6). Real, shared, per-(budget_year,
// company) backend setting (fpna_config.budget_setup_guidelines via
// GET/PATCH /budget/setup/{budgetYear}) — localStorage is only a display
// cache so the UI has something to show before the initial fetch resolves,
// same convention as BudgetYearContext.
import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { BudgetYearContext } from "./BudgetYearContext";
import { API_BASE_URL } from "../config/config";
import { cachedFetch, invalidateReportCache } from "../utils/reportCache";

export const BudgetMethodologyContext = createContext();

export const BUDGET_METHODOLOGIES = ["Bottom-Up", "Top-Down", "Hybrid"];

export default function BudgetMethodologyProvider({ children }) {
  const { token } = useContext(AuthContext);
  const { budgetYear } = useContext(BudgetYearContext);

  // Hybrid is the PRD's recommended default (§6).
  const [methodology, setMethodologyState] = useState(() => {
    const stored = localStorage.getItem("budgetMethodology");
    return BUDGET_METHODOLOGIES.includes(stored) ? stored : "Hybrid";
  });

  useEffect(() => {
    if (!token || !budgetYear) return;
    (async () => {
      try {
        // cachedFetch: BudgetGuidelinesContext hits this same GET on mount
        // too (both providers wrap every route) — dedupes the concurrent
        // duplicate request instead of paying a slow backend call twice.
        const data = await cachedFetch(`${API_BASE_URL}/api/v1/budget/setup/${budgetYear}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (BUDGET_METHODOLOGIES.includes(data.methodology)) {
          setMethodologyState(data.methodology);
          localStorage.setItem("budgetMethodology", data.methodology);
        }
      } catch (err) {
        console.error("Failed to fetch budget methodology:", err);
      }
    })();
  }, [token, budgetYear]);

  const setMethodology = (m) => {
    if (!BUDGET_METHODOLOGIES.includes(m)) return;
    // Update immediately so every Budgeting page re-renders in lockstep;
    // persist to the backend in the background so it's the shared default
    // next time anyone (any device) opens this budget year.
    setMethodologyState(m);
    localStorage.setItem("budgetMethodology", m);
    if (!token || !budgetYear) return;
    fetch(`${API_BASE_URL}/api/v1/budget/setup/${budgetYear}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ methodology: m }),
    })
      // The GET above is cached (see fetch effect) — without this, a page
      // reloaded within the cache TTL would show the pre-save methodology.
      .then(() => invalidateReportCache(`/budget/setup/${budgetYear}`))
      .catch((err) => console.error("Failed to save budget methodology:", err));
  };

  return (
    <BudgetMethodologyContext.Provider value={{ methodology, setMethodology }}>
      {children}
    </BudgetMethodologyContext.Provider>
  );
}
