import { gmPct } from "../../calc/economics";
import { variance } from "../../calc/variance";
import { gpPerSalesDollar, pctOf } from "../../calc/metrics";
import { can } from "../../access/accessEngine";
import { SOURCES } from "../../config/dataset";
import { sumExpenses, sumFacts, sumFactsByRep, windowDates } from "./aggregate";
import {
  actualCompareWindows,
  clientDynamics,
  comparisonsFor,
  financialBases,
  gpBridgeView,
  opportunityRow,
  pipelineByStage,
  pipelineSnapshot,
  planStaffing,
  quarterOutlook,
  salesCostTrend,
  segmentTable,
  staffingSnapshot,
  tile,
  trendSeries,
  winLossSummary,
} from "./common";
import { buildExecutiveInsights } from "../../insights/executiveInsights";
import { consolidatedTotals } from "./forecast";
import { compactMoney } from "../../utils/format";

/** A comparison entry for a non-money metric against one other value. */
export const simpleCmp = (basis, label, actual, base, { lowerIsBetter = false, unit } = {}) => {
  if (actual == null || base == null) return null;
  if (unit === "pct") {
    const pp = actual - base;
    return { basis, label, value: base, pp, favorable: pp === 0 ? null : (pp > 0) !== lowerIsBetter };
  }
  const v = variance(actual, base, { lowerIsBetter });
  return v && { basis, label, value: base, abs: v.abs, pct: v.pct, favorable: v.favorable };
};

const compact = (list) => list.filter(Boolean);

export function executiveView(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const basis = ctx.filters.compare;
  const cur = sumFacts(ctx, ctx.currentWindow);
  const bases = financialBases(ctx);
  const pyWin = actualCompareWindows(ctx).py;
  const planBasis = basis === "target" ? "target" : "budget";
  const planLabel = planBasis === "target" ? "Sales Target" : "Budget";

  const staff = staffingSnapshot(ctx, ctx.currentWindow, cur);
  const staffPy = staffingSnapshot(ctx, pyWin, bases.py.totals);
  const staffPlan = planStaffing(bases[planBasis].plan, ctx.planWindow);

  const clients = clientDynamics(ctx, ctx.currentWindow, pyWin);
  const pyRange = windowDates(pyWin, asOf);
  const newWinsPy = ctx.ds.clients.filter((c) => ctx.credit.has(c.id) && c.acquiredDate >= pyRange.from && c.acquiredDate <= pyRange.to).length;
  const churnedPy = ctx.ds.clients.filter((c) => ctx.credit.has(c.id) && c.churnDate && c.churnDate >= pyRange.from && c.churnDate <= pyRange.to).length;

  const pipe = pipelineSnapshot(ctx);
  const exp = sumExpenses(ctx, ctx.currentWindow);
  const expPy = sumExpenses(ctx, pyWin);
  const contribution = cur.gp - exp.total;
  const contributionPy = bases.py.gp - expPy.total;
  const outlook = quarterOutlook(ctx);
  // Consolidated salesperson forecasts (whole books, so not under client filters).
  const submitted = ctx.sliceActive ? null : consolidatedTotals(ctx.reps.map((r) => r.id));
  const trend = trendSeries(ctx);
  const gm = gmPct(cur.gp, cur.revenue);

  const plan = (key) => staffPlan[key];
  const staffCmps = (key, opts = {}) =>
    compact([
      ["budget", "target"].includes(basis) ? simpleCmp(planBasis, planLabel, staff[key], plan(key), opts) : null,
      simpleCmp("py", "Prior Year", staff[key], staffPy[key], opts),
    ]);

  const kpiSections = [
    {
      id: "financial",
      title: "Revenue & gross profit",
      tiles: [
        tile({ key: "revenue", label: "Revenue", value: cur.revenue, comparisons: comparisonsFor(ctx, bases, "revenue", cur.revenue), series: trend.map((t) => t.revenue) }),
        tile({ key: "gp", label: "Gross profit", value: cur.gp, comparisons: comparisonsFor(ctx, bases, "gp", cur.gp), series: trend.map((t) => t.gp) }),
        tile({ key: "gmPct", label: "Gross margin", unit: "pct", value: gm, comparisons: comparisonsFor(ctx, bases, "gm", gm, { unit: "pct" }), series: trend.map((t) => t.gmPct) }),
      ],
    },
    {
      id: "staffing",
      title: "Billable contractors",
      tiles: [
        tile({ key: "activeContractors", label: "Active at period end", unit: "count", value: staff.activeAtEnd, comparisons: compact([simpleCmp("py", "Prior Year", staff.activeAtEnd, staffPy.activeAtEnd)]), sub: `Average active ${Math.round(staff.avgActive)}` }),
        tile({ key: "avgActive", label: "Average active", unit: "count", value: staff.avgActive, comparisons: staffCmps("avgActive") }),
        tile({ key: "starts", label: "Starts", unit: "count", value: staff.starts, comparisons: compact([simpleCmp("py", "Prior Year", staff.starts, staffPy.starts)]), sub: `${staff.redeployed} redeployed` }),
        tile({ key: "ends", label: "Ends", unit: "count", value: staff.ends, lowerIsBetter: true, comparisons: compact([simpleCmp("py", "Prior Year", staff.ends, staffPy.ends, { lowerIsBetter: true })]), sub: `${staff.conversions} converted to permanent` }),
        tile({ key: "billedHours", label: "Billed hours", unit: "hours", value: staff.billedHours, comparisons: staffCmps("billedHours") }),
        tile({ key: "avgBillRate", label: "Average bill rate", unit: "rate", value: staff.avgBillRate, comparisons: staffCmps("avgBillRate") }),
        tile({ key: "avgPayRate", label: "Average pay rate", unit: "rate", value: staff.avgPayRate, lowerIsBetter: true, comparisons: staffCmps("avgPayRate", { lowerIsBetter: true }) }),
        tile({ key: "spreadAfterBurden", label: "Spread after burden", unit: "rate", value: staff.spreadAfterBurden, comparisons: staffCmps("spreadAfterBurden"), sub: "GP per billed hour before other direct costs" }),
      ],
    },
    {
      id: "clients",
      title: "Clients",
      tiles: [
        tile({ key: "newClients", label: "New clients won", unit: "count", value: clients.newWins.length, comparisons: compact([simpleCmp("py", "Prior Year", clients.newWins.length, newWinsPy)]) }),
        tile({ key: "activeClients", label: "Active clients", unit: "count", value: clients.activeClients, comparisons: compact([simpleCmp("py", "Prior Year", clients.activeClients, clients.categories.lost.length + clients.categories.retained.length + clients.categories.expanded.length + clients.categories.contracted.length)]) }),
        tile({ key: "churnedClients", label: "Clients lost", unit: "count", value: clients.churned.length, lowerIsBetter: true, comparisons: compact([simpleCmp("py", "Prior Year", clients.churned.length, churnedPy, { lowerIsBetter: true })]) }),
        tile({ key: "expandingClients", label: "Expanding vs PY", unit: "count", value: clients.categories.expanded.length, sub: `${clients.categories.contracted.length} contracting` }),
      ],
    },
    {
      id: "pipeline",
      title: "Pipeline",
      tiles: [
        tile({ key: "openPipeline", label: "Open pipeline", value: pipe.openRevenue, sub: `${pipe.openCount} open opportunities · expected GP ${compactMoney(pipe.openGp)}` }),
        tile({ key: "weightedPipeline", label: "Weighted pipeline", value: pipe.weightedRevenue, sub: `Weighted GP ${compactMoney(pipe.weightedGp)}` }),
        tile({ key: "coverage", label: "Coverage of remaining FY target", unit: "ratio", value: pipe.coverage, sub: pipe.remainingTarget > 0 ? "Weighted revenue landing this year ÷ target still to go" : `${pipe.fyLabel} target already met` }),
        tile({ key: "winRate", label: "Win rate", unit: "pct", value: pipe.winRate, sub: `${pipe.wonCount} won · ${pipe.lostCount} lost in period` }),
      ],
    },
    {
      id: "economics",
      title: "Sales economics",
      tiles: [
        tile({ key: "salesContribution", label: "Sales contribution", value: contribution, comparisons: compact([simpleCmp("py", "Prior Year", contribution, contributionPy)]), sub: "GP less sales expense (not EBITDA)" }),
        tile({ key: "salesExpenseRatio", label: "Sales expense / revenue", unit: "pct", lowerIsBetter: true, value: pctOf(exp.total, cur.revenue), comparisons: compact([simpleCmp("py", "Prior Year", pctOf(exp.total, cur.revenue), pctOf(expPy.total, bases.py.revenue), { unit: "pct", lowerIsBetter: true })]) }),
        tile({ key: "gpPerSalesDollar", label: "GP per $ of sales expense", unit: "ratio", value: gpPerSalesDollar(cur.gp, exp.total), comparisons: compact([simpleCmp("py", "Prior Year", gpPerSalesDollar(cur.gp, exp.total), gpPerSalesDollar(bases.py.gp, expPy.total))]) }),
      ],
    },
    {
      id: "forecast",
      title: `Current quarter · ${outlook.label}`,
      tiles: [
        tile({
          key: "quarterForecast",
          label: "Quarter revenue outlook",
          value: outlook.fullQuarter.revenue,
          comparisons: compact([
            simpleCmp("pq", `Prior quarter actual`, outlook.fullQuarter.revenue, outlook.priorQuarter.revenue),
            simpleCmp("target", "Sales Target", outlook.fullQuarter.revenue, outlook.target.revenue),
            simpleCmp("forecast", "Finance Forecast (read-only)", outlook.fullQuarter.revenue, outlook.financeForecast.revenue),
          ]),
          sub: outlook.method,
        }),
        tile({
          key: "quarterForecastGp",
          label: "Quarter GP outlook",
          value: outlook.fullQuarter.gp,
          comparisons: compact([
            simpleCmp("pq", "Prior quarter actual", outlook.fullQuarter.gp, outlook.priorQuarter.gp),
            simpleCmp("target", "Sales Target", outlook.fullQuarter.gp, outlook.target.gp),
            simpleCmp("forecast", "Finance Forecast (read-only)", outlook.fullQuarter.gp, outlook.financeForecast.gp),
          ]),
          sub: outlook.method,
        }),
        ...(submitted
          ? [
              tile({
                key: "salesForecast",
                label: "Sales forecast (submissions)",
                value: submitted.forecastRevenue,
                drill: false,
                comparisons: compact([
                  simpleCmp("pq", "Prior quarter actual", submitted.forecastRevenue, submitted.priorQuarterRevenue),
                  simpleCmp("target", "Sales Target", submitted.forecastRevenue, submitted.targetRevenue),
                  simpleCmp("forecast", "Finance Forecast (read-only)", submitted.forecastRevenue, outlook.financeForecast.revenue),
                ]),
                sub: `GP ${compactMoney(submitted.forecastGp)} · ${submitted.submitted} of ${submitted.reps} submitted · ${submitted.confirmed} confirmed by directors`,
              }),
            ]
          : []),
      ],
    },
  ];

  const bridge = gpBridgeView(ctx, { canSeeCostDetail: can(ctx.access, "view_cost_detail") });
  const salesCost = salesCostTrend(ctx, trend);
  const stages = pipelineByStage(pipe, asOf);

  // Team economics for sales-effectiveness insights.
  const byRep = sumFactsByRep(ctx, ctx.currentWindow);
  const expByRep = sumExpenses(ctx, ctx.currentWindow, (e) => e.repId);
  const teams = new Map();
  for (const rep of ctx.reps) {
    const t = teams.get(rep.teamId) || { teamId: rep.teamId, name: ctx.index.teamById.get(rep.teamId).name, revenue: 0, gp: 0, salesExpense: 0, reps: 0 };
    const f = byRep.get(rep.id);
    t.revenue += f?.revenue || 0;
    t.gp += f?.gp || 0;
    t.salesExpense += expByRep.get(rep.id)?.total || 0;
    t.reps += 1;
    teams.set(rep.teamId, t);
  }
  const teamRows = [...teams.values()].map((t) => ({
    ...t,
    contribution: t.gp - t.salesExpense,
    contributionMargin: pctOf(t.gp - t.salesExpense, t.gp),
    gmPct: gmPct(t.gp, t.revenue),
  }));

  const growth = Object.entries(clients.categories).map(([key, list]) => ({
    key,
    label: { new: "New", retained: "Retained", expanded: "Expanded", contracted: "Contracted", lost: "Lost" }[key],
    count: list.length,
    revenue: list.reduce((s, c) => s + c.revenue, 0),
    revenueBase: list.reduce((s, c) => s + c.revenueBase, 0),
    change: list.reduce((s, c) => s + c.change, 0),
    clients: list.slice(0, 40),
  }));

  const geo = {
    region: segmentTable(ctx, "regionId", (k) => ctx.index.regionById.get(k)?.name || k),
    branch: segmentTable(ctx, "branchId", (k) => ctx.index.branchById.get(k)?.name || k),
    vertical: segmentTable(ctx, "verticalId", (k) => ctx.index.verticalById.get(k)?.name || k),
  };

  const curRange = windowDates(ctx.currentWindow, asOf);
  const pipelineRows = pipe.open.map((o) => opportunityRow(ctx, o)).sort((a, b) => b.weightedGp - a.weightedGp);
  const winLoss = winLossSummary(ctx, curRange.from, curRange.to);
  const winLossPy = winLossSummary(ctx, pyRange.from, pyRange.to);

  const model = {
    basisLabel: ctx.compare.label,
    cur, bases, gm, staff, staffPy, clients, pipe, exp, expPy, contribution, contributionPy,
    outlook, bridge, growth, teamRows, newClients: clients.newWins, pipelineRows, winLoss, winLossPy, ctx,
    canSeeCostDetail: can(ctx.access, "view_cost_detail"),
    canSeeCommissions: can(ctx.access, "view_commissions"),
  };

  return {
    data: {
      kpiSections,
      trend,
      bridge,
      salesCost,
      growth,
      pipeline: stages,
      outlook,
      geo,
      teams: teamRows,
      insights: buildExecutiveInsights(model),
    },
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.crm, SOURCES.expenses, SOURCES.plans],
  };
}
