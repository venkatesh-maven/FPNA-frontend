import { describe, it, expect } from "vitest";
import { getCurrentFiscalQuarter } from "../useCurrentQuarter";
import { getQuarterMonths } from "../../pages/ForecastingOverview/Revenueforecasthelpers";

/*
 * Forecasting pages open on the fiscal quarter that contains today, so the
 * default must follow the company's fiscal-year start month (FY Management).
 */

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const on = (month) => new Date(2026, month - 1, 15);

describe("getCurrentFiscalQuarter", () => {
  it("uses calendar quarters for a January fiscal year", () => {
    expect(getCurrentFiscalQuarter(1, on(1))).toBe("Q1");
    expect(getCurrentFiscalQuarter(1, on(3))).toBe("Q1");
    expect(getCurrentFiscalQuarter(1, on(4))).toBe("Q2");
    expect(getCurrentFiscalQuarter(1, on(9))).toBe("Q3");
    expect(getCurrentFiscalQuarter(1, on(12))).toBe("Q4");
  });

  it("rotates for an April fiscal year", () => {
    expect(getCurrentFiscalQuarter(4, on(4))).toBe("Q1");
    expect(getCurrentFiscalQuarter(4, on(9))).toBe("Q2");
    expect(getCurrentFiscalQuarter(4, on(12))).toBe("Q3");
    expect(getCurrentFiscalQuarter(4, on(1))).toBe("Q4");
    expect(getCurrentFiscalQuarter(4, on(3))).toBe("Q4");
  });

  it("falls back to a January fiscal year when the start month is missing", () => {
    expect(getCurrentFiscalQuarter(undefined, on(5))).toBe("Q2");
    expect(getCurrentFiscalQuarter(0, on(5))).toBe("Q2");
  });

  it("always picks the quarter whose dropdown months include today", () => {
    for (let start = 1; start <= 12; start++) {
      for (let month = 1; month <= 12; month++) {
        const q = getCurrentFiscalQuarter(start, on(month));
        expect(getQuarterMonths(start)[q]).toContain(MONTH_ABBR[month - 1]);
      }
    }
  });
});
