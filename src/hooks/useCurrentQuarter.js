import { useState, useEffect, useRef, useCallback } from "react";

// Fiscal quarter ("Q1".."Q4") that `date` falls in, for a fiscal year starting
// in `fiscalYearStartMonth` (1 = Jan … 12 = Dec) — the same rotation
// getQuarterMonths() uses, so the default lines up with the dropdown labels.
export const getCurrentFiscalQuarter = (fiscalYearStartMonth = 1, date = new Date()) => {
  const startIndex = ((fiscalYearStartMonth || 1) - 1 + 12) % 12;
  const monthsIntoFiscalYear = (date.getMonth() - startIndex + 12) % 12;
  return `Q${Math.floor(monthsIntoFiscalYear / 3) + 1}`;
};

// Quarter selector state that opens on the current fiscal quarter. The
// fiscal start month is only a localStorage cache until BudgetYearContext's
// fetch resolves, so the default follows it until the user picks a quarter.
export const useCurrentQuarter = (fiscalYearStartMonth) => {
  const [quarter, setQuarterState] = useState(() => getCurrentFiscalQuarter(fiscalYearStartMonth));
  const userPicked = useRef(false);

  useEffect(() => {
    if (!userPicked.current) setQuarterState(getCurrentFiscalQuarter(fiscalYearStartMonth));
  }, [fiscalYearStartMonth]);

  const setQuarter = useCallback((q) => {
    userPicked.current = true;
    setQuarterState(q);
  }, []);

  return [quarter, setQuarter];
};
