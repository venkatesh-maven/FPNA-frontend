// src/context/FinancialYearContext.js
import { createContext, useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "./AuthContext";

export const FinancialYearContext = createContext();

export default function FinancialYearProvider({ children }) {
  // AuthContext already fetches this exact company's financial years (same
  // /financial_year endpoint) on login/mount. This provider used to fetch
  // it AGAIN independently — against a live backend where that endpoint
  // was measured taking 8-12s per call (see the connection-pooling fix in
  // core/database.py), every page paid that cost twice for identical data.
  // Reuse AuthContext.years instead of re-fetching; keep this provider's
  // own default-selection logic (first year, not AuthContext's "latest
  // year" default) exactly as it was so displayed data doesn't change.
  const { years } = useContext(AuthContext);

  const [selectedYear, setSelectedYear] = useState("");

  useEffect(() => {
    if (!selectedYear && years.length > 0) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const contextValue = useMemo(
    () => ({ years, selectedYear, setSelectedYear }),
    [years, selectedYear]
  );

  return (
    <FinancialYearContext.Provider value={contextValue}>
      {children}
    </FinancialYearContext.Provider>
  );
}
