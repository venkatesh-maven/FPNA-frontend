// Monthly scenario P&L statement — mirrors the backend's
// forecasting/scenario_pnl.py (build_statement_monthly, hierarchy_from_monthly)
// so a driver edit in the Scenario Workspace recalculates the P&L instantly,
// client-side. Both sides must stay in sync if the rules change;
// __tests__/scenarioStatement.test.js uses the same fixture numbers as the
// backend's tests/test_scenario_pnl.py.
//
// Rules, per month of the quarter:
//  - Closed months (posted actuals) are actuals in every scenario.
//  - Open months take revenue, payroll, other opex, D&A and interest from the
//    scenario's drivers. COGS, commission and shipping move with the revenue
//    change against the base month (dR), per the dependent rules:
//      cogs       = max(0, cogsRef + (cogsRef / R_base) * elasticity * dR)
//      commission = max(0, basePct * elasticity * dR)
//      shipping   = max(0, basePct * elasticity * dR)
//  - A Keep Base decision uses the base line; an Override spreads its quarter
//    value over the open months.

const REVENUE_DEFAULTS = { volume: 1000, selling_price: 100, growth_rate: 0, acquisition_rate: 1 };

export const ATOMIC_LINES = [
  "revenue", "cogs", "payroll", "sales_commission", "other_opex",
  "shipping_delivery", "depreciation_amortization", "interest_taxes",
];
const COST_LINES = ATOMIC_LINES.filter((k) => k !== "revenue");
export const DEPENDENT_LINES = ["cogs", "sales_commission", "shipping_delivery"];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function monthValues(drivers, month) {
  const out = {};
  (drivers || []).forEach((d) => {
    if (d.month === month) out[d.driver_name] = Number(d.driver_value);
  });
  return out;
}

export function monthRevenue(revenueDrivers, month) {
  const v = { ...REVENUE_DEFAULTS, ...monthValues(revenueDrivers, month) };
  return round2(v.volume * v.selling_price * (1 + v.growth_rate) * v.acquisition_rate);
}

function monthPayroll(costDrivers, month) {
  const v = monthValues(costDrivers, month);
  if (v.headcount != null && v.avg_salary != null) return round2(v.headcount * v.avg_salary);
  return round2(v.headcount_cost || 0);
}

function baseMonth(baseRev, baseCost, month) {
  const v = monthValues(baseCost, month);
  return {
    revenue: monthRevenue(baseRev, month),
    cogs: round2(v.cogs || 0),
    payroll: monthPayroll(baseCost, month),
    sales_commission: 0,
    other_opex: round2(v.non_people_costs || 0),
    shipping_delivery: 0,
    depreciation_amortization: round2(v.capex || 0),
    interest_taxes: round2(v.interest || 0),
  };
}

function withDerived(lines) {
  const out = {};
  ATOMIC_LINES.forEach((k) => { out[k] = round2(lines[k] || 0); });
  out.gross_profit = round2(out.revenue - out.cogs);
  out.ebitda = round2(out.gross_profit - out.payroll - out.sales_commission - out.other_opex - out.shipping_delivery);
  out.ebit = round2(out.ebitda - out.depreciation_amortization);
  out.net_income = round2(out.ebit - out.interest_taxes);
  out.total_cost = round2(COST_LINES.reduce((s, k) => s + out[k], 0));
  return out;
}

// Split `total` across months in proportion to `weights` (equal shares when
// they sum to zero); the parts always add back to `total`.
export function allocateQuarterValue(total, weights) {
  const n = weights.length;
  if (!n) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = sum > 0 ? weights.map((w) => round2((total * w) / sum)) : weights.map(() => round2(total / n));
  parts[n - 1] = round2(total - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts;
}

/**
 * { base: {month: lines}, scenario: {month: lines} } — every line in
 * ATOMIC_LINES plus gross_profit, ebitda, ebit, net_income, total_cost.
 * overrides: { [dependentLine]: { decision: "kept_base" | "overridden", scenario_value } }
 */
export function buildStatementMonthly(baseRev, baseCost, scnRev, scnCost, rules, months, closedMonths = [], overrides = {}) {
  const closed = new Set(closedMonths || []);
  const rulesByLine = {};
  (rules || []).forEach((r) => { rulesByLine[r.dependent_line] = r; });

  const base = {};
  const scenario = {};
  months.forEach((m) => {
    const b = baseMonth(baseRev, baseCost, m);
    base[m] = b;
    if (closed.has(m)) {
      scenario[m] = { ...b };
      return;
    }
    const v = monthValues(scnCost, m);
    const rS = monthRevenue(scnRev, m);
    const rB = b.revenue;
    const dR = rS - rB;
    const cogsRef = v.cogs != null ? v.cogs : b.cogs;
    const lines = {
      revenue: rS,
      payroll: monthPayroll(scnCost, m),
      other_opex: v.non_people_costs || 0,
      depreciation_amortization: v.capex || 0,
      interest_taxes: v.interest || 0,
    };
    const cogsRule = rulesByLine.cogs;
    if (cogsRule) {
      const e = Number(cogsRule.elasticity_pct);
      lines.cogs = rB > 0
        ? Math.max(0, cogsRef + (cogsRef / rB) * e * dR)
        : Math.max(0, cogsRef + Number(cogsRule.base_pct_of_revenue) * e * dR);
    } else {
      lines.cogs = cogsRef;
    }
    ["sales_commission", "shipping_delivery"].forEach((key) => {
      const rule = rulesByLine[key];
      lines[key] = rule ? Math.max(0, Number(rule.base_pct_of_revenue) * Number(rule.elasticity_pct) * dR) : 0;
    });
    scenario[m] = lines;
  });

  const openMonths = months.filter((m) => !closed.has(m));
  DEPENDENT_LINES.forEach((key) => {
    const ov = (overrides || {})[key] || {};
    if (ov.decision === "kept_base") {
      openMonths.forEach((m) => { scenario[m][key] = base[m][key]; });
    } else if (ov.decision === "overridden" && ov.scenario_value != null && openMonths.length) {
      const closedPart = months.filter((m) => closed.has(m)).reduce((s, m) => s + scenario[m][key], 0);
      let weights = openMonths.map((m) => Math.max(0, scenario[m][key]));
      if (weights.reduce((a, b) => a + b, 0) <= 0) weights = openMonths.map((m) => Math.max(0, scenario[m].revenue));
      allocateQuarterValue(Number(ov.scenario_value) - closedPart, weights).forEach((part, i) => {
        scenario[openMonths[i]][key] = part;
      });
    }
  });

  const out = { base: {}, scenario: {} };
  months.forEach((m) => {
    out.base[m] = withDerived(base[m]);
    out.scenario[m] = withDerived(scenario[m]);
  });
  return out;
}

export function quarterTotals(side, months) {
  const keys = [...ATOMIC_LINES, "gross_profit", "ebitda", "ebit", "net_income", "total_cost"];
  const out = {};
  keys.forEach((k) => { out[k] = round2(months.reduce((s, m) => s + side[m][k], 0)); });
  return out;
}

function line(label, key, base, scenario, type, driverKey = null) {
  const variance = round2(scenario - base);
  return {
    key, label, type, driver_key: driverKey,
    base: round2(base), scenario: round2(scenario),
    variance, variance_pct: base ? round2((variance / base) * 100) : 0,
  };
}

/** The workspace P&L: lines, margins and impact summary from quarter totals. */
export function hierarchyFromMonthly(statement, months) {
  const b = quarterTotals(statement.base, months);
  const s = quarterTotals(statement.scenario, months);
  const lines = [
    line("Revenue", "revenue", b.revenue, s.revenue, "driver"),
    line("Cost of Goods Sold", "cogs", b.cogs, s.cogs, "dependent"),
    line("Gross Profit", "gross_profit", b.gross_profit, s.gross_profit, "computed"),
    line("Payroll", "payroll", b.payroll, s.payroll, "driver"),
    line("Sales Commission", "sales_commission", b.sales_commission, s.sales_commission, "dependent"),
    line("Marketing / Other OpEx", "marketing", b.other_opex, s.other_opex, "driver"),
    line("Shipping & Delivery", "shipping_delivery", b.shipping_delivery, s.shipping_delivery, "dependent"),
    line("EBITDA", "ebitda", b.ebitda, s.ebitda, "computed"),
    line("Depreciation & Amortization", "depreciation_amortization", b.depreciation_amortization, s.depreciation_amortization, "driver"),
    line("EBIT", "ebit", b.ebit, s.ebit, "computed"),
    line("Interest & Taxes", "interest_taxes", b.interest_taxes, s.interest_taxes, "driver"),
    line("Net Income", "net_income", b.net_income, s.net_income, "computed"),
  ];
  const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
  const pct = (num, den) => (den ? round2((num / den) * 100) : 0);
  return {
    lines,
    gross_margin_percent: { base_pct: pct(b.gross_profit, b.revenue), scenario_pct: pct(s.gross_profit, s.revenue) },
    ebitda_margin_percent: { base_pct: pct(b.ebitda, b.revenue), scenario_pct: pct(s.ebitda, s.revenue) },
    impact_summary: {
      revenue_impact: byKey.revenue.variance,
      gross_profit_impact: byKey.gross_profit.variance,
      ebitda_impact: byKey.ebitda.variance,
      net_income_impact: byKey.net_income.variance,
      cash_impact: round2(byKey.net_income.variance + byKey.depreciation_amortization.variance),
    },
  };
}

/** One month on the P&L Statement's lines (COGS includes D&A). */
export function toReportLines(lines) {
  const cogs = round2(lines.cogs + lines.depreciation_amortization);
  const opex = round2(lines.payroll + lines.sales_commission + lines.other_opex + lines.shipping_delivery);
  const gross = round2(lines.revenue - cogs);
  return {
    revenue: round2(lines.revenue),
    cost_of_goods_sold: cogs,
    gross_profit: gross,
    operating_expense: opex,
    net_profit: round2(gross - opex),
  };
}

/** Months the backend marked as posted actuals ({ "2025-10": "actual", ... }). */
export function closedMonthsFrom(monthSources, months) {
  return months.filter((m) => (monthSources || {})[m] === "actual");
}
