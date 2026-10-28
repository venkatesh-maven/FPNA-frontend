// src/context/BudgetGuidelinesContext.jsx
// Holds the CFO-defined Budget Guidelines (PRD §7) plus the rest of the
// Annual Budget Setup fields (planning frequency, active version,
// board-approval toggle, strategic initiatives) — everything on the Budget
// Setup & Guidelines page except Budget Methodology, which has its own
// context (BudgetMethodologyContext) because it applies instantly and is
// read live by every other Budgeting page. These fields are staged locally
// as the user edits them and only written to the backend
// (fpna_config.budget_setup_guidelines via GET/PATCH
// /budget/setup/{budgetYear}) when saveGuidelines() is called — mirroring
// the Budget Setup & Guidelines page's own "Save" button, so a numeric
// field's onChange doesn't fire a network request on every keystroke.
import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { BudgetYearContext } from "./BudgetYearContext";
import { API_BASE_URL } from "../config/config";
import { cachedFetch, invalidateReportCache } from "../utils/reportCache";

export const BudgetGuidelinesContext = createContext();

export const DEFAULT_GUIDELINES = {
  // Revenue guidelines
  revGrowthTarget: 12,
  priceIncrease: 4,
  newCustomerTarget: 35,
  retentionTarget: 92,
  crossSellGoal: 15,
  // Expense guidelines
  payrollGrowthLimit: 6,
  hiringFreeze: false,
  travelReduction: 10,
  softwareConsolidation: true,
  marketingInvestment: 8,
  // Capital guidelines
  capexLimit: 900000,
  techInvestment: 350000,
  officeExpansion: false,
  assetReplacement: 180000,
};

const DEFAULT_INITIATIVES = ["Digital Transformation", "AI Investments"];

export default function BudgetGuidelinesProvider({ children }) {
  const { token } = useContext(AuthContext);
  const { budgetYear } = useContext(BudgetYearContext);

  const [guidelines, setGuidelinesState] = useState(DEFAULT_GUIDELINES);
  const [frequency, setFrequencyState] = useState("Monthly");
  const [activeVersion, setActiveVersionState] = useState("Working Draft");
  const [boardApprovalOptional, setBoardApprovalOptionalState] = useState(true);
  const [initiatives, setInitiativesState] = useState(DEFAULT_INITIATIVES);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !budgetYear) return;
    setLoaded(false);
    (async () => {
      try {
        // cachedFetch (not raw fetch): BudgetMethodologyContext hits this
        // exact same GET /budget/setup/{year} URL on mount too — both
        // providers wrap every route, so a live backend measured at 8-12s
        // for this style of endpoint was getting paid twice per page load.
        // cachedFetch dedupes concurrent requests to the same URL.
        const data = await cachedFetch(`${API_BASE_URL}/api/v1/budget/setup/${budgetYear}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGuidelinesState({ ...DEFAULT_GUIDELINES, ...(data.guidelines || {}) });
        setFrequencyState(data.frequency || "Monthly");
        setActiveVersionState(data.active_version || "Working Draft");
        setBoardApprovalOptionalState(data.board_approval_optional ?? true);
        setInitiativesState(data.initiatives && data.initiatives.length ? data.initiatives : DEFAULT_INITIATIVES);
      } catch (err) {
        console.error("Failed to fetch budget setup guidelines:", err);
      } finally {
        setLoaded(true);
      }
    })();
  }, [token, budgetYear]);

  const setGuideline = (key, value) => setGuidelinesState((prev) => ({ ...prev, [key]: value }));

  // `skipGuidelines`: the Revenue/Expense/Capital Guidelines cards have their
  // own approval workflow (Budget Setup & Guidelines page) — once they're
  // past Draft, the page passes this so a Save that only touched Planning
  // Frequency/Org Structure/etc. doesn't get 403'd by the backend's
  // guidelines-specific stage gate (PATCH /budget/setup/{year} only enforces
  // that gate when the `guidelines` key is present in the body at all).
  const saveGuidelines = async ({ skipGuidelines = false } = {}) => {
    if (!token || !budgetYear) throw new Error("Not ready to save yet.");
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/budget/setup/${budgetYear}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          frequency,
          active_version: activeVersion,
          board_approval_optional: boardApprovalOptional,
          initiatives,
          ...(skipGuidelines ? {} : { guidelines }),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to save Budget Setup & Guidelines.");
      }
      const data = await res.json();
      setGuidelinesState({ ...DEFAULT_GUIDELINES, ...(data.guidelines || {}) });
      setFrequencyState(data.frequency);
      setActiveVersionState(data.active_version);
      setBoardApprovalOptionalState(data.board_approval_optional);
      setInitiativesState(data.initiatives);
      // The GET above is cached (see fetch effect) — without this, a page
      // reloaded within the cache TTL would show what was just overwritten.
      invalidateReportCache(`/budget/setup/${budgetYear}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BudgetGuidelinesContext.Provider value={{
      guidelines, setGuideline,
      frequency, setFrequency: setFrequencyState,
      activeVersion, setActiveVersion: setActiveVersionState,
      boardApprovalOptional, setBoardApprovalOptional: setBoardApprovalOptionalState,
      initiatives, setInitiatives: setInitiativesState,
      loaded, saving, saveGuidelines,
    }}>
      {children}
    </BudgetGuidelinesContext.Provider>
  );
}
