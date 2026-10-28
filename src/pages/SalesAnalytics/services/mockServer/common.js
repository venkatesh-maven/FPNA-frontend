// Metric builders shared by the Executive, Director and Salesperson views.

import { compareLabel, compareWindow, resolvePeriod } from "../../calc/periods";
import { addMonths, dayOf, daysInMonth, formatYmShort, monthDiff, monthRange, monthStart, toYm } from "../../calc/dates";
import { gmPct, perHour } from "../../calc/economics";
import { ppDelta, variance } from "../../calc/variance";
import { coverage, winRate } from "../../calc/metrics";
import { gpBridge, twoFactorBridge } from "../../calc/bridge";
import { roundPreservingSum } from "../../calc/rounding";
import { FISCAL_START_MONTH } from "../../config/dataset";
import {
  activeContractorsOn,
  averageActive,
  expenseAllocation,
  movements,
  sumExpenses,
  sumFacts,
  sumPlans,
  windowDates,
} from "./aggregate";

export const PLAN_BASES = ["budget", "target", "board", "forecast"];

const asOfOf = (ctx) => ctx.ds.meta.asOf;
const fullMonths = (months) => months.map((ym) => ({ ym, scale: 1, fraction: 1 }));
export const elapsedWindow = (period, scaleByFraction) =>
  period.elapsed.map((e) => ({ ym: e.ym, scale: scaleByFraction ? e.fraction : 1, fraction: e.fraction }));

/** PY and prior-period windows for the current period (always available as secondary comparisons). */
export function actualCompareWindows(ctx) {
  const w = (basis) => compareWindow(ctx.period, basis).elapsed.map((e) => ({ ym: e.ym, scale: e.fraction, fraction: e.fraction }));
  return { py: w("py"), pp: w("pp") };
}

/** Revenue / GP / GM for every comparison basis over the current period. */
export function financialBases(ctx) {
  const out = {};
  for (const b of PLAN_BASES) {
    const t = sumPlans(ctx, ctx.planWindow, b);
    out[b] = { revenue: t.revenue, gp: t.gp, plan: t };
  }
  const win = actualCompareWindows(ctx);
  for (const b of ["py", "pp"]) {
    const t = sumFacts(ctx, win[b]);
    out[b] = { revenue: t.revenue, gp: t.gp, totals: t, window: win[b] };
  }
  for (const k of Object.keys(out)) out[k].gm = gmPct(out[k].gp, out[k].revenue);
  return out;
}

const defaultOrder = (selected) => [selected, ...["budget", "board", "py"].filter((b) => b !== selected)];

/** Comparison entries for a tile: $ and % variance, or pp for percentages. */
export function comparisonsFor(ctx, bases, metric, actual, { unit = "money", lowerIsBetter = false, only } = {}) {
  return (only || defaultOrder(ctx.filters.compare))
    .map((b) => {
      const v = bases[b]?.[metric];
      if (v == null || actual == null) return null;
      if (unit === "pct") {
        const d = ppDelta(actual, v);
        return d && { basis: b, label: compareLabel(b), value: v, pp: d.pp, favorable: d.pp === 0 ? null : (d.pp > 0) !== lowerIsBetter };
      }
      const d = variance(actual, v, { lowerIsBetter });
      return d && { basis: b, label: compareLabel(b), value: v, abs: d.abs, pct: d.pct, favorable: d.favorable };
    })
    .filter(Boolean);
}

/** A KPI tile. `key` doubles as the field name masking checks. */
export const tile = (t) => ({ unit: "money", comparisons: [], lowerIsBetter: false, drill: true, ...t });

/** Contractor counts, movements, hours and hours-weighted rates for a window. */
export function staffingSnapshot(ctx, window, totals) {
  const { from, to } = windowDates(window, asOfOf(ctx));
  const mv = movements(ctx, from, to);
  return {
    activeAtEnd: activeContractorsOn(ctx, to).size,
    avgActive: averageActive(ctx, window),
    starts: mv.starts,
    ends: mv.ends,
    netChange: mv.starts - mv.ends,
    redeployed: mv.redeployed,
    conversions: mv.conversions,
    earlyEnds: mv.earlyEnds,
    billedHours: totals.billedHours,
    paidHours: totals.paidHours,
    avgBillRate: perHour(totals.timeRevenue, totals.billedHours),
    avgPayRate: perHour(totals.wages, totals.paidHours),
    spread: perHour(totals.timeRevenue - totals.wages, totals.billedHours),
    spreadAfterBurden: perHour(totals.timeRevenue - totals.wages - totals.burden, totals.billedHours),
    burdenRate: totals.wages ? (totals.burden / totals.wages) * 100 : null,
  };
}

/** Plan-side staffing drivers (budget / target carry contractors, hours and rates). */
export function planStaffing(plan, window) {
  const fractions = window.reduce((s, w) => s + w.fraction, 0);
  return {
    avgActive: fractions ? plan.N / fractions : null,
    billedHours: plan.H,
    avgBillRate: perHour(plan.R, plan.H),
    avgPayRate: perHour(plan.W, plan.H),
    spread: perHour(plan.R - plan.W, plan.H),
    spreadAfterBurden: perHour(plan.R - plan.W - plan.burden, plan.H),
  };
}

const clientName = (ctx, id) => ctx.index.clientById.get(id)?.name || id;

/** New / retained / expanded / contracted / lost clients against a base window (±5% = retained). */
export function clientDynamics(ctx, currentWindow, baseWindow) {
  const cur = sumFacts(ctx, currentWindow, (f) => f.clientId);
  const base = sumFacts(ctx, baseWindow, (f) => f.clientId);
  const { from, to } = windowDates(currentWindow, asOfOf(ctx));
  const categories = { new: [], retained: [], expanded: [], contracted: [], lost: [] };
  for (const id of new Set([...cur.keys(), ...base.keys()])) {
    const c1 = cur.get(id);
    const c0 = base.get(id);
    const r1 = c1?.revenue || 0;
    const r0 = c0?.revenue || 0;
    let cat;
    if (r0 <= 0 && r1 > 0) cat = "new";
    else if (r1 <= 0 && r0 > 0) cat = "lost";
    else if (r1 <= 0 && r0 <= 0) continue;
    else if (r1 > r0 * 1.05) cat = "expanded";
    else if (r1 < r0 * 0.95) cat = "contracted";
    else cat = "retained";
    categories[cat].push({
      clientId: id, name: clientName(ctx, id), revenue: r1, revenueBase: r0, change: r1 - r0, gp: c1?.gp || 0, gpBase: c0?.gp || 0,
    });
  }
  for (const list of Object.values(categories)) list.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const inScope = (c) => ctx.credit.has(c.id);
  const newWins = ctx.ds.clients.filter((c) => inScope(c) && c.acquiredDate >= from && c.acquiredDate <= to);
  const churned = ctx.ds.clients.filter((c) => inScope(c) && c.churnDate && c.churnDate >= from && c.churnDate <= to);
  return {
    activeClients: [...cur.values()].filter((t) => t.revenue > 0).length,
    newWins,
    churned,
    categories,
  };
}

/** Months of an open deal's revenue that land inside the fiscal year. */
const revenueInYear = (o, fyLastYm) => {
  const startYm = toYm(o.expectedStart);
  if (startYm > fyLastYm) return 0;
  const months = Math.min(o.durationMonths, monthDiff(startYm, fyLastYm) + 1);
  return (o.expectedRevenue / Math.min(12, o.durationMonths)) * months;
};

/** Open pipeline, weighted pipeline, coverage of the remaining FY target and period win rate. */
export function pipelineSnapshot(ctx) {
  const asOf = asOfOf(ctx);
  const opps = ctx.ds.opportunities.filter(ctx.oppPass);
  const open = opps.filter((o) => o.status === "open");
  const from = monthStart(ctx.period.from);
  const to = ctx.endDate;
  const closed = opps.filter((o) => o.status !== "open" && o.closeDate >= from && o.closeDate <= to);
  const won = closed.filter((o) => o.status === "won");
  const lost = closed.filter((o) => o.status === "lost");

  const fy = resolvePeriod({ preset: "FY" }, { asOf, fiscalStartMonth: FISCAL_START_MONTH });
  const fyTarget = sumPlans(ctx, fullMonths(fy.months), "target");
  const fyActual = sumFacts(ctx, elapsedWindow(fy, false));
  const remainingTarget = fyTarget.revenue - fyActual.revenue;
  const weightedInYear = open.reduce((s, o) => s + revenueInYear(o, fy.to) * o.probability, 0);

  const sum = (list, f) => list.reduce((s, o) => s + f(o), 0);
  return {
    open,
    won,
    lost,
    openCount: open.length,
    openRevenue: sum(open, (o) => o.expectedRevenue),
    openGp: sum(open, (o) => o.expectedGp),
    weightedRevenue: sum(open, (o) => o.expectedRevenue * o.probability),
    weightedGp: sum(open, (o) => o.expectedGp * o.probability),
    wonCount: won.length,
    lostCount: lost.length,
    wonRevenue: sum(won, (o) => o.expectedRevenue),
    newLogoWins: won.filter((o) => o.type === "new_logo").length,
    winRate: winRate(won.length, lost.length),
    weightedInYear,
    remainingTarget,
    coverage: coverage(weightedInYear, remainingTarget),
    fyLabel: fy.label,
  };
}

/**
 * Current-quarter outlook on a system run-rate (last three complete months'
 * daily revenue and GP, carried over the quarter's remaining days), against
 * the prior quarter's actual, the quarter target and Finance's forecast.
 */
export function quarterOutlook(ctx) {
  const asOf = asOfOf(ctx);
  const asOfYm = toYm(asOf);
  const opts = { asOf, fiscalStartMonth: FISCAL_START_MONTH };
  const cq = resolvePeriod({ preset: "CQ" }, opts);
  const pq = resolvePeriod({ preset: "PQ" }, opts);
  const actual = sumFacts(ctx, elapsedWindow(cq, false));
  const prior = sumFacts(ctx, fullMonths(pq.months));
  const last3 = [1, 2, 3].map((i) => addMonths(asOfYm, -i));
  const rr = sumFacts(ctx, fullMonths(last3));
  const rrDays = last3.reduce((s, m) => s + daysInMonth(m), 0);
  const remainingDays = daysInMonth(asOfYm) - dayOf(asOf) + cq.months.filter((m) => m > asOfYm).reduce((s, m) => s + daysInMonth(m), 0);
  const projected = { revenue: (rr.revenue / rrDays) * remainingDays, gp: (rr.gp / rrDays) * remainingDays };
  const full = { revenue: actual.revenue + projected.revenue, gp: actual.gp + projected.gp };
  const target = sumPlans(ctx, fullMonths(cq.months), "target");
  const finance = sumPlans(ctx, fullMonths(cq.months), "forecast");
  return {
    label: cq.label,
    priorLabel: pq.label,
    actualToDate: { revenue: actual.revenue, gp: actual.gp },
    projectedRemaining: projected,
    fullQuarter: full,
    priorQuarter: { revenue: prior.revenue, gp: prior.gp },
    target: { revenue: target.revenue, gp: target.gp },
    financeForecast: { revenue: finance.revenue, gp: finance.gp },
    qoq: variance(full.revenue, prior.revenue),
    qoqGp: variance(full.gp, prior.gp),
    targetGap: { revenue: full.revenue - target.revenue, gp: full.gp - target.gp },
    remainingDays,
    method: "System run-rate",
    methodNote: "Last three complete months' daily run-rate carried over the quarter's remaining days. Salesperson forecast submissions are not available yet.",
  };
}

/** Twelve months to the period end: actual vs the comparison basis. */
export function trendSeries(ctx) {
  const asOf = asOfOf(ctx);
  const asOfYm = toYm(asOf);
  const endYm = toYm(ctx.endDate);
  const frac = dayOf(asOf) / daysInMonth(asOfYm);
  const window = monthRange(addMonths(endYm, -11), endYm).map((ym) => ({ ym, scale: 1, fraction: ym === asOfYm ? frac : 1 }));
  const actual = sumFacts(ctx, window, (f) => f.ym);
  const basis = ctx.filters.compare;
  let cmp;
  if (PLAN_BASES.includes(basis)) {
    cmp = sumPlans(ctx, window.map((w) => ({ ...w, scale: w.fraction })), basis, (p) => p.ym);
  } else {
    const shift = basis === "py" ? -12 : -(ctx.period.lengthMonths || 1);
    const cw = window.map((w) => ({ ym: addMonths(w.ym, shift), scale: w.fraction, fraction: w.fraction, mapsTo: w.ym }));
    const raw = sumFacts(ctx, cw, (f) => f.ym);
    cmp = new Map(cw.map((w) => [w.mapsTo, raw.get(w.ym)]));
  }
  const inPeriod = new Set(ctx.period.elapsed.map((e) => e.ym));
  return window.map(({ ym }) => {
    const a = actual.get(ym);
    const c = cmp.get(ym);
    return {
      ym,
      label: formatYmShort(ym),
      revenue: a?.revenue || 0,
      gp: a?.gp || 0,
      gmPct: gmPct(a?.gp || 0, a?.revenue || 0),
      cmpRevenue: c ? c.revenue : null,
      cmpGp: c ? c.gp : null,
      cmpGmPct: c ? gmPct(c.gp, c.revenue) : null,
      inPeriod: inPeriod.has(ym),
      partial: ym === asOfYm,
    };
  });
}

const segmentsFromFacts = (map) =>
  new Map([...map].map(([k, t]) => [k, { H: t.billedHours, N: t.N, R: t.timeRevenue, W: t.wages, burden: t.burden }]));
const segmentsFromPlans = (map) => new Map([...map].map(([k, t]) => [k, { H: t.H, N: t.N, R: t.R, W: t.W, burden: t.burden }]));
const sumKey = (map, key) => [...map.values()].reduce((s, t) => s + t[key], 0);

/**
 * GP variance bridge against the selected basis. Budget / Sales Target carry
 * drivers, so the bridge runs by vertical; Prior Year / Prior Period run by
 * client; Board Plan and Finance Forecast have no drivers, so they split into
 * revenue volume and margin rate only. Without cost-detail access, pay rate
 * and burden are shown together as direct labor cost.
 */
export function gpBridgeView(ctx, { canSeeCostDetail = true } = {}) {
  const basis = ctx.filters.compare;
  const verticalOf = (f) => ctx.index.clientById.get(f.clientId).verticalId;
  let result;
  let method;
  let segmentKey;
  let segments = [];

  if (basis === "budget" || basis === "target") {
    segmentKey = "vertical";
    const cur = sumFacts(ctx, ctx.currentWindow, verticalOf);
    const base = sumPlans(ctx, ctx.planWindow, basis, (p) => p.verticalId);
    result = gpBridge(
      { segments: segmentsFromPlans(base), odc: sumKey(base, "odc"), fees: sumKey(base, "fees") },
      { segments: segmentsFromFacts(cur), odc: sumKey(cur, "odc"), fees: sumKey(cur, "fees") }
    );
    method = `Drivers by vertical against ${compareLabel(basis)}`;
    segments = segmentRows(cur, base, (k) => ctx.index.verticalById.get(k)?.name || k, true);
  } else if (basis === "py" || basis === "pp") {
    segmentKey = "client";
    const cur = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
    const base = sumFacts(ctx, ctx.compareWindow, (f) => f.clientId);
    result = gpBridge(
      { segments: segmentsFromFacts(base), odc: sumKey(base, "odc"), fees: sumKey(base, "fees") },
      { segments: segmentsFromFacts(cur), odc: sumKey(cur, "odc"), fees: sumKey(cur, "fees") }
    );
    method = `Drivers by client against ${compareLabel(basis)}`;
    segments = segmentRows(cur, base, (k) => clientName(ctx, k), false);
  } else {
    segmentKey = null;
    const cur = sumFacts(ctx, ctx.currentWindow);
    const base = sumPlans(ctx, ctx.planWindow, basis);
    result = twoFactorBridge({ revenue: base.revenue, gp: base.gp }, { revenue: cur.revenue, gp: cur.gp });
    method = `${compareLabel(basis)} has no driver detail, so the bridge splits revenue volume and margin rate`;
  }

  let steps = result.steps;
  if (!canSeeCostDetail) {
    const pay = steps.find((s) => s.key === "payRate");
    const burden = steps.find((s) => s.key === "burden");
    if (pay && burden) {
      steps = steps
        .filter((s) => s.key !== "burden")
        .map((s) => (s.key === "payRate" ? { key: "directLabor", label: "Direct labor cost", amount: pay.amount + burden.amount } : s));
    }
  }

  // Whole dollars that still add up: start + steps = end exactly.
  const start = Math.round(result.baseGp);
  const end = Math.round(result.currentGp);
  const rounded = roundPreservingSum(steps.map((s) => s.amount));
  const drift = end - start - rounded.reduce((s, v) => s + v, 0);
  if (rounded.length) rounded[rounded.length - 1] += drift;

  return {
    basis,
    basisLabel: compareLabel(basis),
    method,
    segmentKey,
    start: { label: `${compareLabel(basis)} GP`, amount: start },
    end: { label: "Actual GP", amount: end },
    steps: steps.map((s, i) => ({ key: s.key, label: s.label, amount: rounded[i] })),
    segments,
  };
}

function segmentRows(cur, base, nameOf, isPlan) {
  const keys = new Set([...cur.keys(), ...base.keys()]);
  const rows = [];
  for (const k of keys) {
    const c = cur.get(k);
    const b = base.get(k);
    const bH = isPlan ? b?.H : b?.billedHours;
    const bR = isPlan ? b?.R : b?.timeRevenue;
    const bW = isPlan ? b?.W : b?.wages;
    rows.push({
      key: k,
      name: nameOf(k),
      hours: c?.billedHours || 0,
      hoursBase: bH || 0,
      avgBillRate: perHour(c?.timeRevenue || 0, c?.billedHours || 0),
      billRateBase: perHour(bR || 0, bH || 0),
      avgPayRate: perHour(c?.wages || 0, c?.billedHours || 0),
      payRateBase: perHour(bW || 0, bH || 0),
      gp: c?.gp || 0,
      gpBase: b?.gp || 0,
      gpChange: (c?.gp || 0) - (b?.gp || 0),
    });
  }
  return rows.sort((a, b) => Math.abs(b.gpChange) - Math.abs(a.gpChange));
}

/** Monthly GP, sales expense by category and contribution for the trend months. */
export function salesCostTrend(ctx, trendMonths) {
  const window = trendMonths.map((m) => ({ ym: m.ym, scale: 1, fraction: m.partial ? 0 : 1 }));
  const allocation = expenseAllocation(ctx, window);
  const exp = sumExpenses(ctx, window, (e) => e.ym, allocation);
  return trendMonths.map((m) => {
    const e = exp.get(m.ym) || { commission: 0, travel: 0, entertainment: 0, acquisition: 0, salary: 0, total: 0 };
    return {
      ym: m.ym,
      label: m.label,
      gp: m.gp,
      commission: e.commission,
      travel: e.travel,
      entertainment: e.entertainment,
      acquisition: e.acquisition,
      salary: e.salary,
      salesExpense: e.total,
      contribution: m.gp - e.total,
      inPeriod: m.inPeriod,
    };
  });
}

/**
 * Revenue, GP, contribution and contractors by a client attribute (region,
 * branch, vertical) with the comparison basis. Sales expense is allocated to
 * segments by each rep's GP share in them.
 */
export function segmentTable(ctx, attr, nameOf) {
  const keyOfClient = (clientId) => ctx.index.clientById.get(clientId)[attr];
  const cur = sumFacts(ctx, ctx.currentWindow, (f) => keyOfClient(f.clientId));
  const basis = ctx.filters.compare;
  const cmp = PLAN_BASES.includes(basis)
    ? sumPlans(ctx, ctx.planWindow, basis, (p) => (attr === "serviceLineId" ? p.serviceLineId : p[attr]))
    : sumFacts(ctx, ctx.compareWindow, (f) => keyOfClient(f.clientId));
  const active = averageActive(ctx, ctx.currentWindow, (f) => keyOfClient(f.clientId));

  // Rep expense spread over segments by the rep's GP in each.
  const repSeg = new Map();
  const repTotal = new Map();
  for (const { ym, scale } of ctx.currentWindow) {
    for (const f of ctx.index.factsByYm.get(ym) || []) {
      if (!ctx.factPass(f)) continue;
      const seg = keyOfClient(f.clientId);
      for (const o of ctx.index.clientById.get(f.clientId).owners) {
        if (!ctx.repSet.has(o.repId)) continue;
        const g = f.gp * o.share * scale;
        const k = `${o.repId}|${seg}`;
        repSeg.set(k, (repSeg.get(k) || 0) + g);
        repTotal.set(o.repId, (repTotal.get(o.repId) || 0) + g);
      }
    }
  }
  const expByRep = sumExpenses(ctx, ctx.currentWindow, (e) => e.repId);
  const allocated = new Map();
  for (const [k, g] of repSeg) {
    const [repId, seg] = k.split("|");
    const total = repTotal.get(repId);
    const e = expByRep.get(repId)?.total || 0;
    if (total > 0) allocated.set(seg, (allocated.get(seg) || 0) + (e * g) / total);
  }

  const keys = new Set([...cur.keys(), ...cmp.keys()]);
  return [...keys]
    .map((k) => {
      const c = cur.get(k);
      const b = cmp.get(k);
      const revenue = c?.revenue || 0;
      const gp = c?.gp || 0;
      return {
        key: k,
        name: nameOf(k),
        revenue,
        gp,
        gmPct: gmPct(gp, revenue),
        contribution: gp - (allocated.get(k) || 0),
        contractors: active.get(k) || 0,
        cmpRevenue: b?.revenue ?? null,
        cmpGp: b?.gp ?? null,
        revenueVar: b ? revenue - b.revenue : null,
        revenueVarPct: b?.revenue ? ((revenue - b.revenue) / Math.abs(b.revenue)) * 100 : null,
        gpVar: b ? gp - b.gp : null,
      };
    })
    .filter((r) => r.revenue || r.cmpRevenue)
    .sort((a, b) => b.revenue - a.revenue);
}

/** Open opportunities grouped by stage, plus won / lost in the period. */
export function pipelineByStage(pipe, asOf) {
  const stages = ["Prospect", "Qualified", "Proposal", "Negotiation"];
  const ageDays = (o) => Math.max(0, Math.round((Date.parse(asOf) - Date.parse(o.stageEnteredDate)) / 86400000));
  return {
    stages: stages.map((stage) => {
      const list = pipe.open.filter((o) => o.stage === stage);
      const sum = (f) => list.reduce((s, o) => s + f(o), 0);
      return {
        stage,
        count: list.length,
        revenue: sum((o) => o.expectedRevenue),
        gp: sum((o) => o.expectedGp),
        weightedRevenue: sum((o) => o.expectedRevenue * o.probability),
        weightedGp: sum((o) => o.expectedGp * o.probability),
        avgDaysInStage: list.length ? sum(ageDays) / list.length : null,
      };
    }),
    won: { count: pipe.wonCount, revenue: pipe.wonRevenue },
    lost: { count: pipe.lostCount },
    winRate: pipe.winRate,
  };
}

export const daysInStage = (o, asOf) => Math.max(0, Math.round((Date.parse(asOf) - Date.parse(o.stageEnteredDate)) / 86400000));

/** Rows for an opportunity table. */
export const opportunityRow = (ctx, o) => {
  const rep = ctx.index.repById.get(o.repId);
  return {
    id: o.id,
    name: o.prospectName,
    clientId: o.clientId,
    type: o.type === "new_logo" ? "New logo" : "Expansion",
    owner: rep?.name,
    repId: o.repId,
    vertical: ctx.index.verticalById.get(o.verticalId)?.name,
    stage: o.stage,
    status: o.status,
    probability: o.probability * 100,
    expectedRevenue: o.expectedRevenue,
    expectedGp: o.expectedGp,
    weightedGp: o.expectedGp * o.probability,
    weightedRevenue: o.expectedRevenue * o.probability,
    headcount: o.headcount,
    billRate: o.billRate,
    payRate: o.payRate,
    expectedStart: o.expectedStart,
    expectedFirstBilling: o.expectedFirstBilling,
    daysInStage: o.status === "open" ? daysInStage(o, ctx.ds.meta.asOf) : null,
    originalCloseDate: o.originalCloseDate,
    closeDate: o.closeDate,
    pushes: o.pushes.length,
    nextAction: o.nextAction,
    lossReason: o.lossReason,
    competitor: o.competitor,
    leadSource: o.leadSource,
  };
};

/** Deals closed between two dates: win rate and loss reasons by count and expected GP. */
export function winLossSummary(ctx, from, to) {
  const closed = ctx.ds.opportunities.filter((o) => ctx.oppPass(o) && o.status !== "open" && o.closeDate >= from && o.closeDate <= to);
  const won = closed.filter((o) => o.status === "won");
  const lost = closed.filter((o) => o.status === "lost");
  const reasons = new Map();
  for (const o of lost) {
    const key = o.lossReason || "Not recorded";
    const r = reasons.get(key) || { reason: key, count: 0, expectedGp: 0 };
    r.count += 1;
    r.expectedGp += o.expectedGp;
    reasons.set(key, r);
  }
  return {
    won: won.length,
    lost: lost.length,
    winRate: winRate(won.length, lost.length),
    reasons: [...reasons.values()].sort((a, b) => b.count - a.count || b.expectedGp - a.expectedGp),
  };
}
