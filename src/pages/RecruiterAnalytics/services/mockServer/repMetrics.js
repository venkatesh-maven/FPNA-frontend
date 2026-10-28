// Per-recruiter figures behind the leaderboard, the team KPIs and the lead /
// account manager insights. Money is credited to the recruiter who filled
// each assignment or placement (plans by desk share); counts are distinct.

import { addDays, addMonths, dayOf, daysInMonth, monthRange, monthStart, toYm } from "../../calc/dates";
import { compareWindow, resolvePeriod } from "../../calc/periods";
import { gmPct, perHour } from "../../calc/economics";
import { winRate } from "../../calc/metrics";
import { FISCAL_START_MONTH } from "../../config/dataset";
import { sumExpenses, sumFactsByRep, sumPlansByRep, windowDates } from "./aggregate";
import { daysInStage, elapsedWindow } from "./common";

const AGING_DAYS = 45;
const fullMonths = (months) => months.map((ym) => ({ ym, scale: 1, fraction: 1 }));

/** Distinct contractors per recruiter on a date, and starts / ends per recruiter between two dates. */
function repStaffing(ctx, fromDate, toDate) {
  const active = new Map();
  const activeAtStart = new Map();
  const starts = new Map();
  const ends = new Map();
  const add = (map, repId, v) => {
    if (!map.has(repId)) map.set(repId, new Set());
    map.get(repId).add(v);
  };
  const inc = (map, repId) => map.set(repId, (map.get(repId) || 0) + 1);
  for (const a of ctx.ds.assignments) {
    if (!ctx.assignmentPass(a)) continue;
    const r = a.recruiterId;
    const activeOn = (d) => a.startDate <= d && (!a.actualEndDate || a.actualEndDate >= d);
    if (activeOn(toDate)) add(active, r, a.contractorId);
    if (activeOn(fromDate)) add(activeAtStart, r, a.contractorId);
    if (a.startDate >= fromDate && a.startDate <= toDate) inc(starts, r);
    if (a.actualEndDate && a.actualEndDate >= fromDate && a.actualEndDate <= toDate) inc(ends, r);
  }
  return { active, activeAtStart, starts, ends };
}

/** Per-recruiter run-rate quarter outlook. */
function repQuarter(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const asOfYm = toYm(asOf);
  const opts = { asOf, fiscalStartMonth: FISCAL_START_MONTH };
  const cq = resolvePeriod({ preset: "CQ" }, opts);
  const pq = resolvePeriod({ preset: "PQ" }, opts);
  const last3 = [1, 2, 3].map((i) => addMonths(asOfYm, -i));
  const rrDays = last3.reduce((s, m) => s + daysInMonth(m), 0);
  const remainingDays = daysInMonth(asOfYm) - dayOf(asOf) + cq.months.filter((m) => m > asOfYm).reduce((s, m) => s + daysInMonth(m), 0);
  return {
    cq,
    pq,
    remainingDays,
    actual: sumFactsByRep(ctx, elapsedWindow(cq, false)),
    prior: sumFactsByRep(ctx, fullMonths(pq.months)),
    runRate: sumFactsByRep(ctx, fullMonths(last3)),
    rrDays,
    target: sumPlansByRep(ctx, fullMonths(cq.months), "target"),
  };
}

/** Everything the leaderboard shows, one row per recruiter in view. */
export function buildRepRows(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const opts = { asOf, fiscalStartMonth: FISCAL_START_MONTH };
  const { from, to } = windowDates(ctx.currentWindow, asOf);

  const cur = sumFactsByRep(ctx, ctx.currentWindow);
  const target = sumPlansByRep(ctx, ctx.planWindow, "target");
  const budget = sumPlansByRep(ctx, ctx.planWindow, "budget");
  const pyWin = compareWindow(ctx.period, "py").elapsed.map((e) => ({ ym: e.ym, scale: e.fraction, fraction: e.fraction }));
  const py = sumFactsByRep(ctx, pyWin);

  const ytd = resolvePeriod({ preset: "YTD" }, opts);
  const ytdActual = sumFactsByRep(ctx, elapsedWindow(ytd, false));
  const ytdBudget = sumPlansByRep(ctx, elapsedWindow(ytd, true), "budget");
  const ytdTarget = sumPlansByRep(ctx, elapsedWindow(ytd, true), "target");

  const exp = sumExpenses(ctx, ctx.currentWindow, (e) => e.repId);
  const expPy = sumExpenses(ctx, pyWin, (e) => e.repId);
  const staffing = repStaffing(ctx, from, to);
  const q = repQuarter(ctx);
  const months = ctx.currentWindow.reduce((s, w) => s + w.fraction, 0);

  const opps = ctx.ds.opportunities.filter(ctx.oppPass);
  const byRepOpps = new Map();
  for (const o of opps) {
    if (!byRepOpps.has(o.repId)) byRepOpps.set(o.repId, []);
    byRepOpps.get(o.repId).push(o);
  }

  return ctx.reps.map((rep) => {
    const team = ctx.index.teamById.get(rep.teamId);
    const branch = ctx.index.branchById.get(rep.branchId);
    const c = cur.get(rep.id);
    const t = target.get(rep.id);
    const b = budget.get(rep.id);
    const p = py.get(rep.id);
    const e = exp.get(rep.id) || {};
    const ePy = expPy.get(rep.id) || {};
    const revenue = c?.revenue || 0;
    const gp = c?.gp || 0;
    const salesExpense = e.total || 0;

    const myOpps = byRepOpps.get(rep.id) || [];
    const open = myOpps.filter((o) => o.status === "open");
    const closed = myOpps.filter((o) => o.status !== "open" && o.closeDate >= from && o.closeDate <= to);
    const won = closed.filter((o) => o.status === "won");
    const newLogosWon = won.filter((o) => o.type === "new_logo");
    const largestWon = newLogosWon.reduce((best, o) => (!best || o.expectedRevenue > best.expectedRevenue ? o : best), null);

    // Expense budget: allowances for T&E, commission at plan rate on budget GP, salary as allocated.
    const expenseBudget =
      (rep.travelAllowance + rep.entertainmentAllowance) * months +
      (b?.gp || 0) * rep.commissionPlan.baseRate +
      (e.salary || 0) +
      (e.acquisition || 0);

    const qa = q.actual.get(rep.id);
    const qp = q.prior.get(rep.id);
    const qr = q.runRate.get(rep.id);
    const qt = q.target.get(rep.id);
    const projRev = ((qr?.revenue || 0) / q.rrDays) * q.remainingDays;
    const projGp = ((qr?.gp || 0) / q.rrDays) * q.remainingDays;
    const fqRev = (qa?.revenue || 0) + projRev;
    const fqGp = (qa?.gp || 0) + projGp;

    const ytdA = ytdActual.get(rep.id);
    const ytdB = ytdBudget.get(rep.id);
    const ytdT = ytdTarget.get(rep.id);
    const activeNow = staffing.active.get(rep.id)?.size || 0;
    const activeThen = staffing.activeAtStart.get(rep.id)?.size || 0;

    return {
      repId: rep.id,
      name: rep.name,
      team: team.name,
      teamId: team.id,
      territory: `${branch.name}, ${ctx.index.regionById.get(branch.regionId).name}`,
      vertical: ctx.index.verticalById.get(rep.primaryVerticalId)?.name,

      revenue,
      revenueTarget: t?.revenue || 0,
      revenueVar: revenue - (t?.revenue || 0),
      gp,
      gpTarget: t?.gp || 0,
      gpVar: gp - (t?.gp || 0),
      gmPct: gmPct(gp, revenue),
      gmTarget: gmPct(t?.gp || 0, t?.revenue || 0),
      gpAttainment: t?.gp ? (gp / t.gp) * 100 : null,
      revenuePy: p?.revenue || 0,
      gpPy: p?.gp || 0,
      ytdRevenue: ytdA?.revenue || 0,
      ytdGp: ytdA?.gp || 0,
      ytdRevenueBudget: ytdB?.revenue || 0,
      ytdGpBudget: ytdB?.gp || 0,
      ytdGpOverBudget: (ytdA?.gp || 0) - (ytdB?.gp || 0),
      ytdOverBudget: (ytdA?.revenue || 0) > (ytdB?.revenue || 0) && (ytdA?.gp || 0) > (ytdB?.gp || 0),
      ytdGpAttainment: ytdT?.gp ? ((ytdA?.gp || 0) / ytdT.gp) * 100 : null,

      contractors: activeNow,
      contractorsAtStart: activeThen,
      contractorGrowth: activeNow - activeThen,
      starts: staffing.starts.get(rep.id) || 0,
      ends: staffing.ends.get(rep.id) || 0,
      avgBillRate: perHour(c?.timeRevenue || 0, c?.billedHours || 0),
      avgPayRate: perHour(c?.wages || 0, c?.paidHours || 0),
      billedHours: c?.billedHours || 0,
      paidHours: c?.paidHours || 0,
      billRevenue: c?.timeRevenue || 0,
      payroll: c?.wages || 0,
      spread: perHour((c?.timeRevenue || 0) - (c?.wages || 0), c?.billedHours || 0),
      billRatePy: perHour(p?.timeRevenue || 0, p?.billedHours || 0),
      payRatePy: perHour(p?.wages || 0, p?.paidHours || 0),

      directCost: c?.directCost || 0,
      commission: e.commission || 0,
      commissionApproved: e.commissionApproved || 0,
      commissionPy: ePy.commission || 0,
      travel: e.travel || 0,
      travelPy: ePy.travel || 0,
      entertainment: e.entertainment || 0,
      acquisition: e.acquisition || 0,
      salary: e.salary || 0,
      salesExpense,
      salesExpenseBudget: expenseBudget,
      salesCostOverrun: salesExpense - expenseBudget,
      contribution: gp - salesExpense,
      expensePerGp: gp > 0 ? salesExpense / gp : null,

      newClientsWon: newLogosWon.length,
      largestClientWon: largestWon?.prospectName || null,
      largestClientWonValue: largestWon?.expectedRevenue || 0,
      weightedPipeline: open.reduce((s, o) => s + o.expectedRevenue * o.probability, 0),
      weightedGpPipeline: open.reduce((s, o) => s + o.expectedGp * o.probability, 0),
      winRate: winRate(won.length, closed.length - won.length),
      agingOpportunities: open.filter((o) => daysInStage(o, asOf) > AGING_DAYS).length,
      openOpportunities: open.length,

      priorQuarterRevenue: qp?.revenue || 0,
      priorQuarterGp: qp?.gp || 0,
      quarterActualRevenue: qa?.revenue || 0,
      quarterActualGp: qa?.gp || 0,
      quarterRemainingRevenue: projRev,
      quarterForecastRevenue: fqRev,
      quarterForecastGp: fqGp,
      quarterTargetRevenue: qt?.revenue || 0,
      quarterTargetGp: qt?.gp || 0,
      qoqGrowth: qp?.revenue ? ((fqRev - qp.revenue) / qp.revenue) * 100 : null,
      quarterVsTarget: fqRev - (qt?.revenue || 0),
      forecastStatus: "Not submitted",
      quarterLabel: q.cq.label,
      priorQuarterLabel: q.pq.label,
    };
  });
}

/** Month list for a recruiter's fiscal-year chart. */
export function fiscalYearMonths(ctx) {
  const fy = resolvePeriod({ preset: "FY" }, { asOf: ctx.ds.meta.asOf, fiscalStartMonth: FISCAL_START_MONTH });
  return monthRange(fy.from, fy.to);
}

export const periodStartDate = (ctx) => monthStart(ctx.period.from);
export const daysBefore = (date, n) => addDays(date, -n);
