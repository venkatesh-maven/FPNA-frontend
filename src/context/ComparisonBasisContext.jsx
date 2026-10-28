// The report comparison basis (Budget / Official Forecast / a scenario),
// remembered per user in localStorage and kept in step across tabs, plus the
// choices available for the selected fiscal year (comparison-bases endpoint).
// Mounted by the P&L Statement for now; it can move up into AllRoutes
// (inside BudgetYearProvider) unchanged when other reports adopt it.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
import { API_BASE_URL } from "../config/config";
import {
  DEFAULT_BASIS, basisStorageKey, normalizeBasisState, readStoredBasis, writeStoredBasis,
} from "../utils/comparisonBasis";

const ComparisonBasisContext = createContext(null);

const FALLBACK = {
  state: DEFAULT_BASIS,
  options: null,
  optionsReady: true,
  fingerprint: null,
  setBasis: () => {},
  refreshOptions: () => {},
};

export function ComparisonBasisProvider({ children }) {
  const { token, selectedYear, userId, currentUser } = useContext(AuthContext);
  const uid = userId || currentUser?.user_id || null;

  const [state, setState] = useState(() => readStoredBasis(uid));
  const [options, setOptions] = useState(null);
  const [optionsReady, setOptionsReady] = useState(false);

  useEffect(() => { setState(readStoredBasis(uid)); }, [uid]);

  const refreshOptions = useCallback(async () => {
    if (!token || !selectedYear) return;
    setOptionsReady(false);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling/${selectedYear}/comparison-bases`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } },
      );
      setOptions(res.ok ? await res.json() : null);
    } catch {
      setOptions(null);
    } finally {
      setOptionsReady(true);
    }
  }, [token, selectedYear]);

  useEffect(() => { refreshOptions(); }, [refreshOptions]);

  // A remembered scenario that no longer exists falls back to the forecast.
  useEffect(() => {
    if (!options) return;
    setState((prev) => {
      const next = normalizeBasisState(prev, options);
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [options]);

  const setBasis = useCallback((next) => {
    setState(next);
    writeStoredBasis(uid, next);
  }, [uid]);

  // Another tab changed the choice.
  useEffect(() => {
    const key = basisStorageKey(uid);
    const onStorage = (e) => { if (e.key === key) setState(readStoredBasis(uid)); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [uid]);

  const value = useMemo(() => ({
    state,
    options,
    optionsReady,
    fingerprint: options?.fingerprint || null,
    setBasis,
    refreshOptions,
  }), [state, options, optionsReady, setBasis, refreshOptions]);

  return <ComparisonBasisContext.Provider value={value}>{children}</ComparisonBasisContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useComparisonBasis() {
  return useContext(ComparisonBasisContext) || FALLBACK;
}
