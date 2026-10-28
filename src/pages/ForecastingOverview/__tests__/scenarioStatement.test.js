import { describe, it, expect } from "vitest";
import {
  allocateQuarterValue, buildStatementMonthly, hierarchyFromMonthly, quarterTotals, toReportLines,
} from "../scenarioStatement";

// Same fixture as the backend's tests/test_scenario_pnl.py, so both sides of
// the scenario statement give the same numbers.
const MONTHS = ["2025-10", "2025-11", "2025-12"];
const BASE = {
  "2025-10": { revenue: 100000, cogs: 30000, payroll: 40000, other_opex: 10000, depreciation: 2000 },
  "2025-11": { revenue: 120000, cogs: 33000, payroll: 40000, other_opex: 11000, depreciation: 2000 },
  "2025-12": { revenue: 90000, cogs: 28000, payroll: 41000, other_opex: 9000, depreciation: 2000 },
};
const RULES = [
  { dependent_line: "cogs", base_pct_of_revenue: 0.35, elasticity_pct: 1.0 },
  { dependent_line: "sales_commission", base_pct_of_revenue: 0.05, elasticity_pct: 1.0 },
  { dependent_line: "shipping_delivery", base_pct_of_revenue: 0.02, elasticity_pct: 0.8 },
];

function drivers(growth = 0) {
  const rev = [];
  const cost = [];
  MONTHS.forEach((m) => {
    const b = BASE[m];
    rev.push(
      { driver_name: "volume", month: m, driver_value: b.revenue / 1000 },
      { driver_name: "selling_price", month: m, driver_value: 1000 },
      { driver_name: "growth_rate", month: m, driver_value: growth },
      { driver_name: "acquisition_rate", month: m, driver_value: 1 },
    );
    cost.push(
      { driver_name: "headcount_cost", month: m, driver_value: b.payroll },
      { driver_name: "cogs", month: m, driver_value: b.cogs },
      { driver_name: "non_people_costs", month: m, driver_value: b.other_opex },
      { driver_name: "capex", month: m, driver_value: b.depreciation },
      { driver_name: "interest", month: m, driver_value: 0 },
    );
  });
  return [rev, cost];
}

const statement = (scn, closed, overrides) => {
  const [baseRev, baseCost] = drivers();
  return buildStatementMonthly(baseRev, baseCost, scn[0], scn[1], RULES, MONTHS, closed, overrides);
};

describe("scenario statement (mirrors forecasting/scenario_pnl.py)", () => {
  it("Base Case equals the base layer — no double-counted COGS", () => {
    const stmt = statement(drivers());
    MONTHS.forEach((m) => {
      const s = stmt.scenario[m];
      const b = BASE[m];
      expect(s.cogs).toBe(b.cogs);
      expect(s.sales_commission).toBe(0);
      expect(s.net_income).toBe(b.revenue - b.cogs - b.payroll - b.other_opex - b.depreciation);
      expect(s).toEqual(stmt.base[m]);
    });
  });

  it("dependent lines follow the revenue change", () => {
    const s = statement(drivers(0.1)).scenario["2025-10"];
    expect(s.revenue).toBe(110000);
    expect(s.cogs).toBe(33000);
    expect(s.sales_commission).toBe(500);
    expect(s.shipping_delivery).toBe(160);
  });

  it("closed months stay at actuals", () => {
    const stmt = statement(drivers(0.25), ["2025-10"]);
    expect(stmt.scenario["2025-10"]).toEqual(stmt.base["2025-10"]);
    expect(stmt.scenario["2025-11"].revenue).toBe(150000);
  });

  it("workspace net equals P&L Statement profit", () => {
    const stmt = statement(drivers(0.05));
    const net = hierarchyFromMonthly(stmt, MONTHS).lines.find((l) => l.key === "net_income").scenario;
    const reportProfit = MONTHS.reduce((t, m) => t + toReportLines(stmt.scenario[m]).net_profit, 0);
    expect(net).toBeCloseTo(reportProfit, 2);
    expect(quarterTotals(stmt.scenario, MONTHS).net_income).toBe(net);
  });

  it("Keep Base and Override decisions", () => {
    const kept = statement(drivers(0.1), [], { cogs: { decision: "kept_base" } });
    MONTHS.forEach((m) => expect(kept.scenario[m].cogs).toBe(BASE[m].cogs));
    const over = statement(drivers(0.1), ["2025-10"], { sales_commission: { decision: "overridden", scenario_value: 9000 } });
    expect(over.scenario["2025-10"].sales_commission).toBe(0);
    expect(MONTHS.reduce((t, m) => t + over.scenario[m].sales_commission, 0)).toBeCloseTo(9000, 2);
  });

  it("report lines: COGS includes D&A, profit = revenue − COGS − OpEx", () => {
    const r = toReportLines(statement(drivers(0.1)).scenario["2025-11"]);
    expect(r.net_profit).toBeCloseTo(r.revenue - r.cost_of_goods_sold - r.operating_expense, 2);
    expect(r.gross_profit).toBeCloseTo(r.revenue - r.cost_of_goods_sold, 2);
  });

  it("allocateQuarterValue adds back to the total", () => {
    expect(allocateQuarterValue(90, [0, 0, 0])).toEqual([30, 30, 30]);
    expect(allocateQuarterValue(100, [3, 1])).toEqual([75, 25]);
  });
});
