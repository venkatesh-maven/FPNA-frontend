import { gmPct, perHour } from "../../calc/economics";
import { pctOf } from "../../calc/metrics";
import { compareWindow } from "../../calc/periods";
import { SOURCES } from "../../config/dataset";
import { averageActive, expenseRows, sumExpenses, sumFacts, sumPlans, windowDates } from "./aggregate";
import {
  comparisonsFor,
  financialBases,
  opportunityRow,
  pipelineSnapshot,
  quarterOutlook,
  staffingSnapshot,
  tile,
} from "./common";
import { simpleCmp } from "./executive";
import { can } from "../../access/accessEngine";
import { buildRepRows, fiscalYearMonths } from "./repMetrics";
import { buildDirectorInsights } from "../../insights/directorInsights";
import { consolidate } from "./forecast";

const FORECAST_STATUS = { missing: "Not submitted", submitted: "Submitted", returned: "Returned", confirmed: "Confirmed" };
import { compactMoney, money } from "../../utils/format";

const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
const compact = (l) => l.filter(Boolean);

/** Client-level performance and rate/cost rows for the reps in view. */
function clientRows(ctx) {
  const cur = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
  const budget = sumPlans(ctx, ctx.planWindow, "budget", (p) => p.clientId);
  const active = averageActive(ctx, ctx.currentWindow, (f) => f.clientId);
  const acquisition = new Map();
  for (const e of expenseRows(ctx, ctx.currentWindow, (x) => x.category === "acquisition" && x.clientId)) {
    acquisition.set(e.clientId, (acquisition.get(e.clientId) || 0) + e.amount);
  }
  const rows = [];
  for (const [clientId, t] of cur) {
    const c = ctx.index.clientById.get(clientId);
    const owners = c.owners.filter((o) => ctx.repSet.has(o.repId));
    const b = budget.get(clientId);
    const commissionEst = Math.max(0, t.gp) * 0.08;
    rows.push({
      clientId,
      client: c.name,
      owner: owners.map((o) => `${ctx.index.repById.get(o.repId).name}${o.share < 1 ? ` (${Math.round(o.share * 100)}%)` : ""}`).join(", "),
      vertical: ctx.index.verticalById.get(c.verticalId)?.name,
      revenue: t.revenue,
      gp: t.gp,
      gmPct: gmPct(t.gp, t.revenue),
      gpBudget: b?.gp ?? null,
      gpBudgetVar: b ? t.gp - b.gp : null,
      contractors: active.get(clientId) || 0,
      billedHours: t.billedHours,
      avgBillRate: perHour(t.timeRevenue, t.billedHours),
      avgPayRate: perHour(t.wages, t.paidHours),
      burden: t.burden,
      otherDirect: t.odc,
      directCost: t.directCost,
      contribution: t.gp - commissionEst - (acquisition.get(clientId) || 0),
    });
  }
  return rows.sort((a, b) => b.gp - a.gp);
}

export function directorView(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const reps = buildRepRows(ctx);
  // Salespeople's submitted forecasts replace the run-rate, unless client filters slice their book.
  const forecast = ctx.sliceActive ? null : new Map(consolidate(reps.map((r) => r.repId)).map((f) => [f.repId, f]));
  if (forecast) {
    for (const r of reps) {
      const f = forecast.get(r.repId);
      Object.assign(r, {
        quarterRemainingRevenue: f.remainingRevenue,
        quarterForecastRevenue: f.forecastRevenue,
        quarterForecastGp: f.forecastGp,
        qoqGrowth: f.qoqGrowth,
        quarterVsTarget: f.forecastRevenue - r.quarterTargetRevenue,
        forecastStatus: f.version ? `${FORECAST_STATUS[f.status]} (v${f.version})` : FORECAST_STATUS.missing,
      });
    }
  }
  const submittedCount = forecast ? [...forecast.values()].filter((f) => f.status !== "missing").length : 0;
  const confirmedCount = forecast ? [...forecast.values()].filter((f) => f.status === "confirmed").length : 0;
  const teamQuarter = forecast
    ? { revenue: sum(reps, "quarterForecastRevenue"), gp: sum(reps, "quarterForecastGp") }
    : null;
  const cur = sumFacts(ctx, ctx.currentWindow);
  const bases = financialBases(ctx);
  const gm = gmPct(cur.gp, cur.revenue);
  const staff = staffingSnapshot(ctx, ctx.currentWindow, cur);
  const pipe = pipelineSnapshot(ctx);
  const outlook = quarterOutlook(ctx);
  const exp = sumExpenses(ctx, ctx.currentWindow);
  const pyWin = compareWindow(ctx.period, "py").elapsed.map((e) => ({ ym: e.ym, scale: e.fraction, fraction: e.fraction }));
  const expPy = sumExpenses(ctx, pyWin);
  const repCount = Math.max(1, reps.length);
  const gpTarget = sum(reps, "gpTarget");
  const months = ctx.currentWindow.reduce((s, w) => s + w.fraction, 0);
  const teAllowance = reps.reduce((s, r) => {
    const rep = ctx.index.repById.get(r.repId);
    return s + (rep.travelAllowance + rep.entertainmentAllowance) * months;
  }, 0);
  const commissionBudget = sum(reps, "salesExpenseBudget") - teAllowance - sum(reps, "salary") - sum(reps, "acquisition");

  const kpiSections = [
    {
      id: "team-financial",
      title: "Team performance",
      tiles: [
        tile({ key: "revenue", label: "Team revenue", value: cur.revenue, comparisons: comparisonsFor(ctx, bases, "revenue", cur.revenue) }),
        tile({ key: "gp", label: "Team GP", value: cur.gp, comparisons: comparisonsFor(ctx, bases, "gp", cur.gp) }),
        tile({ key: "gmPct", label: "Gross margin", unit: "pct", value: gm, comparisons: comparisonsFor(ctx, bases, "gm", gm, { unit: "pct" }) }),
        tile({ key: "quotaAttainment", label: "GP quota attainment", unit: "pct", value: pctOf(cur.gp, gpTarget), sub: `YTD ${Math.round(pctOf(sum(reps, "ytdGp"), sum(reps, "ytdGpBudget")) || 0)}% of YTD budget GP` }),
        tile({ key: "salesContribution", label: "Team sales contribution", value: cur.gp - exp.total, comparisons: compact([simpleCmp("py", "Prior Year", cur.gp - exp.total, bases.py.gp - expPy.total)]), sub: "GP less sales expense (not EBITDA)" }),
      ],
    },
    {
      id: "team-costs",
      title: "Sales costs",
      tiles: [
        tile({ key: "commission", label: "Commissions", value: exp.commission, lowerIsBetter: true, comparisons: compact([simpleCmp("budget", "Plan", exp.commission, commissionBudget, { lowerIsBetter: true }), simpleCmp("py", "Prior Year", exp.commission, expPy.commission, { lowerIsBetter: true })]), sub: `${money(exp.commission / repCount)} per rep · ${Math.round(pctOf(exp.commission, cur.gp) || 0)}% of GP` }),
        tile({ key: "travel", label: "Travel", value: exp.travel, lowerIsBetter: true, comparisons: compact([simpleCmp("py", "Prior Year", exp.travel, expPy.travel, { lowerIsBetter: true })]), sub: `${money(exp.travel / repCount)} per rep · ${(pctOf(exp.travel, cur.gp) || 0).toFixed(1)}% of GP` }),
        tile({ key: "entertainment", label: "Client entertainment", value: exp.entertainment, lowerIsBetter: true, comparisons: compact([simpleCmp("py", "Prior Year", exp.entertainment, expPy.entertainment, { lowerIsBetter: true })]), sub: `${money(exp.entertainment / repCount)} per rep · ${(pctOf(exp.entertainment, cur.gp) || 0).toFixed(1)}% of GP` }),
        tile({ key: "tAndE", label: "T&E vs allowance", value: exp.travel + exp.entertainment, lowerIsBetter: true, comparisons: compact([simpleCmp("budget", "Allowance", exp.travel + exp.entertainment, teAllowance, { lowerIsBetter: true })]), sub: "Travel plus client entertainment" }),
      ],
    },
    {
      id: "team-staffing",
      title: "Billable contractors",
      tiles: [
        tile({ key: "activeContractors", label: "Active at period end", unit: "count", value: staff.activeAtEnd, sub: `Average active ${Math.round(staff.avgActive)}` }),
        tile({ key: "starts", label: "Starts", unit: "count", value: staff.starts, sub: `${staff.ends} ends · net ${staff.netChange >= 0 ? "+" : ""}${staff.netChange}` }),
        tile({ key: "avgBillRate", label: "Average bill rate", unit: "rate", value: staff.avgBillRate }),
        tile({ key: "avgPayRate", label: "Average pay rate", unit: "rate", value: staff.avgPayRate, lowerIsBetter: true }),
      ],
    },
    {
      id: "team-pipeline",
      title: "Pipeline & forecast",
      tiles: [
        tile({ key: "newClients", label: "New clients won", unit: "count", value: sum(reps, "newClientsWon") }),
        tile({ key: "weightedPipeline", label: "Weighted pipeline", value: pipe.weightedRevenue, sub: `Weighted GP ${compactMoney(pipe.weightedGp)} · coverage ${pipe.coverage != null ? `${pipe.coverage.toFixed(2)}×` : "n/a"}` }),
        tile({ key: "winRate", label: "Win rate", unit: "pct", value: pipe.winRate, sub: `${pipe.wonCount} won · ${pipe.lostCount} lost` }),
        tile({
          key: "teamForecast",
          label: `Team forecast · ${outlook.label}`,
          value: teamQuarter ? teamQuarter.revenue : outlook.fullQuarter.revenue,
          comparisons: compact([
            simpleCmp("pq", "Prior quarter actual", teamQuarter ? teamQuarter.revenue : outlook.fullQuarter.revenue, outlook.priorQuarter.revenue),
            simpleCmp("target", "Sales Target", teamQuarter ? teamQuarter.revenue : outlook.fullQuarter.revenue, outlook.target.revenue),
          ]),
          sub: teamQuarter
            ? `${submittedCount} of ${reps.length} submitted · ${confirmedCount} confirmed · system baseline for the rest`
            : "System run-rate (submissions cover whole books, so they aren't shown under client filters)",
        }),
      ],
    },
  ];

  const clients = clientRows(ctx);
  const { from, to } = windowDates(ctx.currentWindow, asOf);
  const newWins = ctx.ds.opportunities
    .filter((o) => ctx.oppPass(o) && o.type === "new_logo" && o.status === "won" && o.wonDate >= from && o.wonDate <= to)
    .map((o) => {
      const firstFact = (ctx.index.factsByClient.get(o.clientId) || []).filter((f) => f.kind === "time").map((f) => f.ym).sort()[0];
      return { ...opportunityRow(ctx, o), winDate: o.wonDate, firstBilledMonth: firstFact || null };
    })
    .sort((a, b) => b.expectedGp - a.expectedGp);
  const slippage = ctx.ds.opportunities
    .filter((o) => ctx.oppPass(o) && o.status === "open" && o.pushes.length > 0)
    .map((o) => opportunityRow(ctx, o))
    .sort((a, b) => b.weightedGp - a.weightedGp);

  // Client bill / pay rate moves against the same period last year, and their effect on GP.
  const curByClient = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
  const pyByClient = sumFacts(ctx, pyWin, (f) => f.clientId);
  const rateMoves = [];
  for (const [clientId, c] of curByClient) {
    const p = pyByClient.get(clientId);
    if (!p || !c.billedHours || !p.billedHours) continue;
    const bill = perHour(c.timeRevenue, c.billedHours);
    const billPy = perHour(p.timeRevenue, p.billedHours);
    const pay = perHour(c.wages, c.billedHours);
    const payPy = perHour(p.wages, p.billedHours);
    const u = c.wages ? c.burden / c.wages : 0;
    const gpEffect = ((bill - billPy) - (pay - payPy) * (1 + u)) * c.billedHours;
    rateMoves.push({
      clientId,
      client: ctx.index.clientById.get(clientId).name,
      avgBillRate: bill,
      billRatePy: billPy,
      avgPayRate: perHour(c.wages, c.paidHours),
      payRatePy: perHour(p.wages, p.paidHours),
      gpEffect,
      gmPct: gmPct(c.gp, c.revenue),
      gmPy: gmPct(p.gp, p.revenue),
      gmChange: gmPct(c.gp, c.revenue) - gmPct(p.gp, p.revenue),
    });
  }
  rateMoves.sort((a, b) => Math.abs(b.gpEffect) - Math.abs(a.gpEffect));

  // Assignments ending in the next 60 days per rep: extension and redeployment levers.
  const soon = new Map();
  const horizon = new Date(Date.parse(asOf) + 60 * 86400000).toISOString().slice(0, 10);
  for (const a of ctx.ds.assignments) {
    if (a.actualEndDate || a.plannedEndDate > horizon || !ctx.assignmentPass(a)) continue;
    for (const o of ctx.index.clientById.get(a.clientId).owners) if (ctx.repSet.has(o.repId)) soon.set(o.repId, (soon.get(o.repId) || 0) + 1);
  }
  for (const r of reps) r.endingSoon = soon.get(r.repId) || 0;

  const openDeals = pipe.open.map((o) => opportunityRow(ctx, o)).sort((x, y) => y.weightedGp - x.weightedGp);
  const model = { reps, clients, newWins, ctx, cur, bases, rateMoves, months, openDeals };
  return {
    data: {
      teams: [...new Set(reps.map((r) => r.team))],
      kpiSections,
      leaderboard: reps,
      tables: {
        clientPerformance: clients,
        newClientWins: newWins,
        repExpenses: reps.map((r) => ({
          repId: r.repId, name: r.name, team: r.team, commission: r.commission, travel: r.travel, entertainment: r.entertainment,
          acquisition: r.acquisition, salary: r.salary, salesExpense: r.salesExpense, expensePerGp: r.expensePerGp,
          contribution: r.contribution, gp: r.gp,
        })),
        pipelineSlippage: slippage,
        staffingRateCost: clients.map((c) => ({
          clientId: c.clientId, client: c.client, owner: c.owner, billedHours: c.billedHours, avgBillRate: c.avgBillRate,
          avgPayRate: c.avgPayRate, burden: c.burden, otherDirect: c.otherDirect, gp: c.gp, gmPct: c.gmPct,
        })),
        teamForecast: reps.map((r) => ({
          repId: r.repId, name: r.name, team: r.team, priorQuarterRevenue: r.priorQuarterRevenue, priorQuarterGp: r.priorQuarterGp,
          quarterActualRevenue: r.quarterActualRevenue, quarterRemainingRevenue: r.quarterRemainingRevenue,
          quarterForecastRevenue: r.quarterForecastRevenue, quarterForecastGp: r.quarterForecastGp, qoqGrowth: r.qoqGrowth,
          quarterVsTarget: r.quarterVsTarget, forecastStatus: r.forecastStatus,
        })),
      },
      quarter: { label: outlook.label, priorLabel: outlook.priorLabel },
      insights: buildDirectorInsights(model),
    },
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.crm, SOURCES.expenses, SOURCES.commission, SOURCES.plans],
  };
}

/** One rep in the director's drawer: headline figures, months, clients, expenses, deals. */
export function repSummaryView(ctx, { repId }) {
  const row = buildRepRows(ctx).find((r) => r.repId === repId);
  const fyMonths = fiscalYearMonths(ctx);
  const asOfYm = ctx.ds.meta.asOfYm;
  const win = fyMonths.filter((m) => m <= asOfYm).map((ym) => ({ ym, scale: 1, fraction: 1 }));
  const actual = sumFacts(ctx, win, (f) => f.ym);
  const target = sumPlans(ctx, fyMonths.map((ym) => ({ ym, scale: 1, fraction: 1 })), "target", (p) => p.ym);
  const monthly = fyMonths.map((ym) => ({
    ym,
    revenue: actual.get(ym)?.revenue ?? null,
    gp: actual.get(ym)?.gp ?? null,
    revenueTarget: target.get(ym)?.revenue ?? null,
    gpTarget: target.get(ym)?.gp ?? null,
  }));
  // Transactions carry neutral keys, so restricted categories are dropped here rather than masked.
  const allowed = (e) => can(ctx.access, e.category === "commission" ? "view_commissions" : "view_cost_detail");
  const expenses = expenseRows(ctx, ctx.currentWindow, allowed).map((e) => ({
    id: e.id, ym: e.ym, category: e.category, status: e.status, amount: e.amount, memo: e.memo,
  }));
  const opps = ctx.ds.opportunities.filter((o) => ctx.oppPass(o) && o.status === "open").map((o) => opportunityRow(ctx, o));
  return {
    data: { rep: row, monthly, clients: clientRows(ctx), expenses, openOpportunities: opps },
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.billing, SOURCES.crm, SOURCES.expenses, SOURCES.plans],
  };
}
