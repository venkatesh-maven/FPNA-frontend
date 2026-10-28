// Forward-looking sales health (spec section 11): pipeline, conversion,
// win/loss, churn & retention, contractor movement, velocity and sales
// efficiency. Every record is read through the scoped query context; the
// viewer's role (scope kind) only changes wording, ordering and emphasis,
// never which records count.
//
// Event definitions kept distinct throughout: a client win (new-logo
// opportunity won), a requisition fill, a contractor start (placement on
// assignment) and first billing are separate events. Pipeline values are
// expectations and are never added to actual revenue.

import { addDays, addMonths, dayDiff, dayOf, daysInMonth, formatDate, formatYmShort, monthEnd, monthRange, toYm } from "../../calc/dates";
import { gmPct } from "../../calc/economics";
import { pctOf } from "../../calc/metrics";
import { compareLabel, resolvePeriod } from "../../calc/periods";
import { FISCAL_START_MONTH, SOURCES } from "../../config/dataset";
import { can } from "../../access/accessEngine";
import { OPEN_STAGES, STAGE_PROBABILITY } from "../../mock/generators/pipeline";
import { END_REASONS } from "../../mock/seedLists";
import { activeContractorsOn, sumExpenses, sumFacts, sumFactsByRep, sumPlans, windowDates } from "./aggregate";
import { actualCompareWindows, opportunityRow, salesCostTrend, tile, trendSeries } from "./common";
import { simpleCmp } from "./executive";
import { buildHealthInsights } from "../../insights/healthInsights";
import { compactMoney } from "../../utils/format";

/** Days in a stage after which an open deal counts as stuck. */
export const STAGE_THRESHOLD_DAYS = { Prospect: 21, Qualified: 30, Proposal: 30, Negotiation: 45 };
/** Loss reasons within the sales team's control (pricing, qualification, fill readiness). */
export const AVOIDABLE_LOSS_REASONS = ["Price / markup", "No decision", "Could not fill skills"];
export const EXPIRING_DAYS = 60;
const DORMANT_DAYS = 45;
const DEAL_SIZE_BANDS = [
  { id: "s", label: "Under $50K GP", max: 50000 },
  { id: "m", label: "$50K–$150K GP", max: 150000 },
  { id: "l", label: "$150K–$300K GP", max: 300000 },
  { id: "xl", label: "$300K+ GP", max: Infinity },
];
const END_CLASS = {
  planned: "planned",
  converted: "conversion",
  contractor_quit: "early",
  performance: "early",
  client_ended: "early",
  client_reduced: "clientDriven",
  client_lost: "clientDriven",
};
export const END_CLASS_LABELS = {
  planned: "Planned ends",
  conversion: "Converted to permanent",
  early: "Early terminations",
  clientDriven: "Client reductions & losses",
};

const sum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
const avg = (values) => {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const ratePct = (n, d) => (d ? (n / d) * 100 : null);
const compact = (list) => list.filter(Boolean);
const col = (key, label, unit = "money") => ({ key, label, unit });
const between = (d, from, to) => !!d && d >= from && d <= to;
const minOf = (list) => list.reduce((m, x) => (x && (!m || x < m) ? x : m), null);
const fullMonths = (months) => months.map((ym) => ({ ym, scale: 1, fraction: 1 }));
const sameDayMonthsAgo = (date, n) => {
  const ym = addMonths(toYm(date), -n);
  return `${ym}-${String(Math.min(dayOf(date), daysInMonth(ym))).padStart(2, "0")}`;
};
const pl = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const repName = (ctx, id) => ctx.index.repById.get(id)?.name || id;
const ownersLabel = (ctx, client) =>
  client.owners
    .filter((o) => ctx.repSet.has(o.repId))
    .map((o) => `${repName(ctx, o.repId)}${o.share < 1 ? ` (${Math.round(o.share * 100)}%)` : ""}`)
    .join(", ");

// ---------------------------------------------------------------------------
// Dataset-level lookups, built once per dataset.

const indexCache = new WeakMap();
function healthIndex(ds) {
  let idx = indexCache.get(ds);
  if (idx) return idx;
  const assignmentByReq = new Map();
  const redeployTarget = new Map(); // ended assignment id → the assignment that re-placed its contractor
  for (const a of ds.assignments) {
    if (a.requisitionId) assignmentByReq.set(a.requisitionId, a);
    if (a.redeployedFrom) redeployTarget.set(a.redeployedFrom, a);
  }
  const reqsByClient = new Map();
  const reqById = new Map();
  for (const r of ds.requisitions) {
    reqById.set(r.id, r);
    if (!reqsByClient.has(r.clientId)) reqsByClient.set(r.clientId, []);
    reqsByClient.get(r.clientId).push(r);
  }
  // Lifetime billing per assignment: monthly GP while active = gp ÷ active-month fractions.
  const lifetime = new Map();
  const lastBilled = new Map(); // clientId → last ym with time billing
  for (const f of ds.facts) {
    if (f.kind !== "time") continue;
    let t = lifetime.get(f.assignmentId);
    if (!t) lifetime.set(f.assignmentId, (t = { gp: 0, revenue: 0, af: 0 }));
    t.gp += f.gp;
    t.revenue += f.revenue;
    t.af += f.af;
    if (f.revenue > 0 && (!lastBilled.get(f.clientId) || f.ym > lastBilled.get(f.clientId))) lastBilled.set(f.clientId, f.ym);
  }
  idx = { assignmentByReq, redeployTarget, reqsByClient, reqById, lifetime, lastBilled };
  indexCache.set(ds, idx);
  return idx;
}

const monthlyGpOf = (hx, assignmentId) => {
  const t = hx.lifetime.get(assignmentId);
  return t && t.af > 0 ? { gp: t.gp / t.af, revenue: t.revenue / t.af } : { gp: 0, revenue: 0 };
};

// ---------------------------------------------------------------------------
// Windows: the selected period, its comparison base, and the trailing
// twelve-month cohort used for stage conversion and velocity.

function healthWindows(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const cur = windowDates(ctx.currentWindow, asOf);
  const baseKind = ctx.filters.compare === "pp" ? "pp" : "py";
  const baseWindow = actualCompareWindows(ctx)[baseKind];
  const base = windowDates(baseWindow, asOf);
  const cohortTo = cur.to;
  const cohortFrom = addDays(cohortTo, -364);
  const priorTo = addDays(cohortFrom, -1);
  const priorFrom = addDays(priorTo, -364);
  const label = (r) => `${formatDate(r.from)} – ${formatDate(r.to)}`;
  return {
    asOf,
    cur: { ...cur, label: ctx.period.label },
    base: { ...base, label: `${compareLabel(baseKind)} (${label(base)})` },
    baseKind,
    baseLabel: compareLabel(baseKind),
    baseWindow,
    cohort: { from: cohortFrom, to: cohortTo, label: label({ from: cohortFrom, to: cohortTo }) },
    priorCohort: { from: priorFrom, to: priorTo, label: label({ from: priorFrom, to: priorTo }) },
  };
}

// ---------------------------------------------------------------------------
// Pipeline: snapshot, landing value, coverage and trend.

/** Expected value spread evenly over the deal's duration from its expected start; the part between two dates. */
function landing(o, value, fromDate, toDate) {
  const days = Math.max(1, Math.round(Math.min(12, o.durationMonths) * 30.4));
  const end = addDays(o.expectedStart, days - 1);
  const a = o.expectedStart > fromDate ? o.expectedStart : fromDate;
  const b = end < toDate ? end : toDate;
  if (b < a) return 0;
  return (value / days) * (dayDiff(a, b) + 1);
}

const openAt = (opps, date) => opps.filter((o) => o.createdDate <= date && (o.status === "open" || o.closeDate > date));
const stageAt = (o, date) => {
  let stage = OPEN_STAGES[0];
  for (const h of o.stageHistory) if (h.date <= date && OPEN_STAGES.includes(h.stage)) stage = h.stage;
  return stage;
};

/** The period coverage is matched to: the current quarter for month/quarter views, the fiscal year otherwise. */
function matchingWindow(ctx, date) {
  const kind = ["MTD", "QTD", "CQ"].includes(ctx.period.preset) ? "quarter" : "year";
  const p = resolvePeriod({ preset: kind === "quarter" ? "CQ" : "FY" }, { asOf: date, fiscalStartMonth: FISCAL_START_MONTH });
  return { kind, label: p.label, months: p.months, to: monthEnd(p.months[p.months.length - 1]) };
}

/** Actual and target by month for every month coverage may need. */
function monthlyBase(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const asOfYm = toYm(asOf);
  const fy = resolvePeriod({ preset: "FY" }, { asOf, fiscalStartMonth: FISCAL_START_MONTH });
  const first = addMonths(asOfYm, -18);
  const actualMonths = monthRange(first, asOfYm);
  const planMonths = monthRange(first, fy.months[fy.months.length - 1]);
  return {
    actual: sumFacts(ctx, fullMonths(actualMonths), (f) => f.ym),
    target: sumPlans(ctx, fullMonths(planMonths), "target", (p) => p.ym),
  };
}

/**
 * Coverage on a date: weighted pipeline landing in the rest of the matching
 * period ÷ the target still uncovered after actuals to date and the current
 * billable base's run-rate (last three complete months, carried forward).
 * Revenue and GP are computed separately; the full remaining target is kept
 * for lineage.
 */
function coverageAt(ctx, date, open, probOf, monthly) {
  const asOf = ctx.ds.meta.asOf;
  const w = matchingWindow(ctx, date);
  const ym = toYm(date);
  const frac = date === asOf ? 1 : dayOf(date) / daysInMonth(ym);
  const last3 = [1, 2, 3].map((i) => addMonths(ym, -i));
  const rrDays = last3.reduce((s, m) => s + daysInMonth(m), 0);
  const remainingDays = daysInMonth(ym) - dayOf(date) + w.months.filter((m) => m > ym).reduce((s, m) => s + daysInMonth(m), 0);
  const nextDay = addDays(date, 1);
  const out = { label: w.label, kind: w.kind, date };
  for (const k of ["revenue", "gp"]) {
    let target = 0;
    let actual = 0;
    for (const m of w.months) {
      target += monthly.target.get(m)?.[k] || 0;
      if (m < ym) actual += monthly.actual.get(m)?.[k] || 0;
      else if (m === ym) actual += (monthly.actual.get(m)?.[k] || 0) * frac;
    }
    const runRate = last3.reduce((s, m) => s + (monthly.actual.get(m)?.[k] || 0), 0);
    const projected = rrDays ? (runRate / rrDays) * remainingDays : 0;
    const remaining = target - actual;
    const uncovered = remaining - projected;
    const value = k === "revenue" ? (o) => o.expectedRevenue : (o) => o.expectedGp;
    const pipeline = open.reduce((s, o) => s + probOf(o) * landing(o, value(o), nextDay, w.to), 0);
    out[k] = {
      target,
      actualToDate: actual,
      remainingTarget: remaining,
      runRateProjection: projected,
      uncoveredTarget: uncovered,
      weightedLanding: pipeline,
      coverage: uncovered > 0 ? pipeline / uncovered : null,
      coverageOfRemaining: remaining > 0 ? pipeline / remaining : null,
    };
  }
  return out;
}

function pipelineRow(ctx, o) {
  const asOf = ctx.ds.meta.asOf;
  const r = opportunityRow(ctx, o);
  const client = o.clientId ? ctx.index.clientById.get(o.clientId) : null;
  const rep = ctx.index.repById.get(o.repId);
  const threshold = STAGE_THRESHOLD_DAYS[o.stage] ?? null;
  return {
    ...r,
    client: o.prospectName,
    serviceType: client ? ctx.index.serviceLineById.get(client.serviceLineId)?.name : "New prospect",
    team: ctx.index.teamById.get(rep?.teamId)?.name,
    region: ctx.index.regionById.get(o.regionId)?.name,
    createdDate: o.createdDate,
    durationMonths: o.durationMonths,
    hoursPerWeek: o.hoursPerWeek,
    closeDateChanges: o.pushes.length,
    daysMoved: dayDiff(o.originalCloseDate, o.closeDate),
    stageThreshold: threshold,
    stale: o.status === "open" && threshold != null && r.daysInStage > threshold,
    daysOverThreshold: o.status === "open" && threshold != null ? Math.max(0, r.daysInStage - threshold) : null,
    pastExpectedStart: o.status === "open" && o.expectedStart < asOf,
    closeOverdue: o.status === "open" && o.closeDate < asOf,
  };
}

const groupPipeline = (rows, keyOf, nameOf) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    let g = map.get(k);
    if (!g) map.set(k, (g = { key: k, name: nameOf(r), count: 0, expectedRevenue: 0, expectedGp: 0, weightedRevenue: 0, weightedGp: 0, stale: 0, slipped: 0, days: [] }));
    g.count += 1;
    g.expectedRevenue += r.expectedRevenue;
    g.expectedGp += r.expectedGp;
    g.weightedRevenue += r.weightedRevenue;
    g.weightedGp += r.weightedGp;
    if (r.stale) g.stale += 1;
    if (r.closeDateChanges) g.slipped += 1;
    g.days.push(r.daysInStage);
  }
  return [...map.values()]
    .map(({ days, ...g }) => ({ ...g, avgDaysInStage: avg(days) }))
    .sort((a, b) => b.weightedGp - a.weightedGp);
};

function buildPipeline(ctx, opps) {
  const asOf = ctx.ds.meta.asOf;
  const open = opps.filter((o) => o.status === "open");
  const rows = open.map((o) => pipelineRow(ctx, o)).sort((a, b) => b.weightedGp - a.weightedGp);
  const totals = {
    count: rows.length,
    expectedRevenue: sum(rows, (r) => r.expectedRevenue),
    expectedGp: sum(rows, (r) => r.expectedGp),
    weightedRevenue: sum(rows, (r) => r.weightedRevenue),
    weightedGp: sum(rows, (r) => r.weightedGp),
  };

  const monthly = monthlyBase(ctx);
  const stageProb = (date) => (o) => STAGE_PROBABILITY[stageAt(o, date)];
  const coverage = coverageAt(ctx, asOf, open, (o) => o.probability, monthly);
  const d3 = sameDayMonthsAgo(asOf, 3);
  const d12 = sameDayMonthsAgo(asOf, 12);
  const coverage3m = coverageAt(ctx, d3, openAt(opps, d3), stageProb(d3), monthly);
  const coverage12m = coverageAt(ctx, d12, openAt(opps, d12), stageProb(d12), monthly);

  // Month-end snapshots, weighted by configured stage probability so past and present compare like-for-like.
  const asOfYm = toYm(asOf);
  const snapshotDates = [...[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((i) => monthEnd(addMonths(asOfYm, -i))), asOf];
  const trend = snapshotDates.map((date) => {
    const list = openAt(opps, date);
    const p = stageProb(date);
    return {
      ym: toYm(date),
      date,
      label: date === asOf ? `${formatYmShort(toYm(date))} (to date)` : formatYmShort(toYm(date)),
      count: list.length,
      expectedRevenue: sum(list, (o) => o.expectedRevenue),
      expectedGp: sum(list, (o) => o.expectedGp),
      weightedRevenue: sum(list, (o) => o.expectedRevenue * p(o)),
      weightedGp: sum(list, (o) => o.expectedGp * p(o)),
    };
  });
  const snap3m = (() => {
    const list = openAt(opps, d3);
    const p = stageProb(d3);
    return { date: d3, count: list.length, weightedRevenue: sum(list, (o) => o.expectedRevenue * p(o)), weightedGp: sum(list, (o) => o.expectedGp * p(o)), expectedRevenue: sum(list, (o) => o.expectedRevenue), expectedGp: sum(list, (o) => o.expectedGp) };
  })();

  // Concentration: share of weighted GP in the five largest deals and in the largest client / prospect.
  const top5 = rows.slice(0, 5);
  const byName = groupPipeline(rows, (r) => r.clientId || r.name, (r) => r.name);
  const concentration = {
    top5Share: ratePct(sum(top5, (r) => r.weightedGp), totals.weightedGp),
    topClient: byName[0] ? { name: byName[0].name, share: ratePct(byName[0].weightedGp, totals.weightedGp) } : null,
    top5,
  };

  const stale = rows.filter((r) => r.stale).sort((a, b) => b.daysOverThreshold - a.daysOverThreshold);
  const byStage = OPEN_STAGES.map((stage) => {
    const list = rows.filter((r) => r.stage === stage);
    return {
      key: stage,
      stage,
      count: list.length,
      expectedRevenue: sum(list, (r) => r.expectedRevenue),
      expectedGp: sum(list, (r) => r.expectedGp),
      weightedRevenue: sum(list, (r) => r.weightedRevenue),
      weightedGp: sum(list, (r) => r.weightedGp),
      avgDaysInStage: avg(list.map((r) => r.daysInStage)),
      threshold: STAGE_THRESHOLD_DAYS[stage],
      stale: list.filter((r) => r.stale).length,
      staleGp: sum(list.filter((r) => r.stale), (r) => r.expectedGp),
    };
  });

  return {
    open,
    rows,
    totals,
    coverage,
    coverage3m,
    coverage12m,
    trend,
    snap3m,
    concentration,
    stale,
    byStage,
    byOwner: groupPipeline(rows, (r) => r.repId, (r) => r.owner).map((g) => ({ ...g, repId: g.key, team: ctx.index.teamById.get(ctx.index.repById.get(g.key)?.teamId)?.name })),
    byVertical: groupPipeline(rows, (r) => r.vertical || "—", (r) => r.vertical || "—"),
    byRegion: groupPipeline(rows, (r) => r.region || "—", (r) => r.region || "—"),
  };
}

// ---------------------------------------------------------------------------
// Stage conversion by cohort: deals that entered each stage in the window,
// followed to the as-of date. Snapshots (in stage at window start) are shown
// for context only and never enter a conversion rate.

function cohortEntries(ctx, opps, from, to) {
  const asOf = ctx.ds.meta.asOf;
  const entries = [];
  const opening = Object.fromEntries(OPEN_STAGES.map((s) => [s, 0]));
  for (const o of opps) {
    const h = o.stageHistory;
    for (let j = 0; j < h.length; j++) {
      const stageIndex = OPEN_STAGES.indexOf(h[j].stage);
      if (stageIndex < 0) continue;
      const next = h[j + 1];
      if (h[j].date < from && (!next || next.date >= from)) opening[h[j].stage] += 1;
      if (h[j].date < from || h[j].date > to) continue;
      const outcome = !next ? "open" : next.stage === "Lost" ? "lost" : "advanced";
      entries.push({
        id: `${o.id}-${stageIndex}`,
        opportunityId: o.id,
        stage: h[j].stage,
        stageIndex,
        enteredDate: h[j].date,
        outcome,
        outcomeLabel: { open: "Still in stage", lost: "Lost at this stage", advanced: OPEN_STAGES[stageIndex + 1] ? `Moved to ${OPEN_STAGES[stageIndex + 1]}` : "Won" }[outcome],
        daysInStage: dayDiff(h[j].date, next ? next.date : asOf),
        left: !!next,
        won: o.status === "won",
        status: o.status,
        type: o.type,
        repId: o.repId,
        owner: repName(ctx, o.repId),
        clientId: o.clientId,
        name: o.prospectName,
        verticalId: o.verticalId,
        vertical: ctx.index.verticalById.get(o.verticalId)?.name,
        expectedGp: o.expectedGp,
      });
    }
  }
  return { entries, opening };
}

/**
 * Conversion = advanced / eligible, where the eligible cohort is the entries
 * that have left the stage (advanced or lost there). Deals still in the
 * stage are not yet eligible, so young cohorts are not penalised.
 */
const conversionSummary = (list) => {
  const entered = list.length;
  const advanced = list.filter((e) => e.outcome === "advanced").length;
  const lost = list.filter((e) => e.outcome === "lost").length;
  return {
    entered,
    advanced,
    lost,
    eligible: advanced + lost,
    open: entered - advanced - lost,
    won: list.filter((e) => e.won).length,
    conversion: ratePct(advanced, advanced + lost),
    conversionOfEntered: ratePct(advanced, entered),
    avgStageDays: avg(list.filter((e) => e.left).map((e) => e.daysInStage)),
    expectedGp: sum(list, (e) => e.expectedGp),
  };
};

const stageRows = (entries, opening) =>
  OPEN_STAGES.map((stage) => ({ key: stage, stage, opening: opening?.[stage] ?? null, ...conversionSummary(entries.filter((e) => e.stage === stage)) }));

/** Per-group conversion: stage-to-stage advance rate and the Prospect cohort's eventual win rate. */
const conversionBy = (entries, keyOf, nameOf, extra = () => ({})) => {
  const map = new Map();
  for (const e of entries) {
    const k = keyOf(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return [...map.entries()]
    .map(([k, list]) => {
      const s = conversionSummary(list);
      const prospects = list.filter((e) => e.stageIndex === 0);
      const won = prospects.filter((e) => e.status === "won").length;
      const lost = prospects.filter((e) => e.status === "lost").length;
      return {
        key: k,
        name: nameOf(list[0]),
        ...extra(list[0]),
        ...s,
        prospectsEntered: prospects.length,
        prospectsWon: won,
        cohortWinRate: ratePct(won, won + lost),
        weakestStage: OPEN_STAGES.map((stage) => ({ stage, ...conversionSummary(list.filter((e) => e.stage === stage)) }))
          .filter((x) => x.eligible >= 2)
          .sort((a, b) => (a.conversion ?? 101) - (b.conversion ?? 101))[0]?.stage || null,
      };
    })
    .sort((a, b) => b.entered - a.entered);
};

function buildFunnel(ctx, opps, w) {
  const cur = cohortEntries(ctx, opps, w.cohort.from, w.cohort.to);
  const prior = cohortEntries(ctx, opps, w.priorCohort.from, w.priorCohort.to);
  const stages = stageRows(cur.entries, cur.opening);
  const priorStages = stageRows(prior.entries, prior.opening);
  const byType = (type) => stageRows(cur.entries.filter((e) => e.type === type), null);
  const overall = conversionSummary(cur.entries);
  const priorOverall = conversionSummary(prior.entries);
  // Prospect cohort -> eventual outcome; deals still open are not yet eligible.
  const statusById = new Map(opps.map((o) => [o.id, o.status]));
  const cohortWin = (list, type) => {
    const p = list.filter((e) => e.stageIndex === 0 && e.type === type);
    const won = p.filter((e) => statusById.get(e.opportunityId) === "won").length;
    const lost = p.filter((e) => statusById.get(e.opportunityId) === "lost").length;
    return { entered: p.length, won, lost, open: p.length - won - lost, rate: ratePct(won, won + lost) };
  };
  const weakest = stages.filter((s) => s.eligible >= 3).sort((a, b) => (a.conversion ?? 101) - (b.conversion ?? 101))[0] || null;

  return {
    stages,
    priorStages,
    newClient: byType("new_logo"),
    expansion: byType("expansion"),
    overall,
    priorOverall,
    weakest,
    cohortWin: { newClient: cohortWin(cur.entries, "new_logo"), expansion: cohortWin(cur.entries, "expansion") },
    priorCohortWin: { newClient: cohortWin(prior.entries, "new_logo"), expansion: cohortWin(prior.entries, "expansion") },
    byRep: conversionBy(cur.entries, (e) => e.repId, (e) => e.owner, (e) => ({ repId: e.repId, team: ctx.index.teamById.get(ctx.index.repById.get(e.repId)?.teamId)?.name })),
    byVertical: conversionBy(cur.entries, (e) => e.verticalId, (e) => e.vertical),
  };
}

const slimConversion = (rows) =>
  rows.map((r) => ({ key: r.key, name: r.name, repId: r.repId ?? null, clientId: r.clientId ?? null, entered: r.entered, advanced: r.advanced, lost: r.lost, open: r.open, conversion: r.conversion, avgStageDays: r.avgStageDays, expectedGp: r.expectedGp }));

/**
 * One stage of the cohort funnel for the in-place drill: stage → owner →
 * client → opportunity. Read on demand so the page payload stays small.
 */
export function salesHealthStageView(ctx, { stage }) {
  if (!OPEN_STAGES.includes(stage)) return { data: { stage: null }, families: ["pipeline"], sources: [] };
  const w = healthWindows(ctx);
  const opps = ctx.ds.opportunities.filter(ctx.oppPass);
  const list = cohortEntries(ctx, opps, w.cohort.from, w.cohort.to).entries.filter((e) => e.stage === stage);
  return {
    data: {
      stage,
      cohort: w.cohort,
      summary: conversionSummary(list),
      byOwner: slimConversion(conversionBy(list, (e) => e.repId, (e) => e.owner, (e) => ({ repId: e.repId }))),
      byClient: slimConversion(conversionBy(list, (e) => e.clientId || e.name, (e) => e.name, (e) => ({ clientId: e.clientId }))),
      entries: list
        .sort((a, b) => b.enteredDate.localeCompare(a.enteredDate))
        .map((e) => ({ id: e.id, opportunityId: e.opportunityId, name: e.name, owner: e.owner, repId: e.repId, clientId: e.clientId, type: e.type === "new_logo" ? "New client" : "Expansion", enteredDate: e.enteredDate, outcome: e.outcomeLabel, daysInStage: e.daysInStage, expectedGp: e.expectedGp })),
    },
    families: ["pipeline"],
    sources: [SOURCES.crm],
  };
}

// ---------------------------------------------------------------------------
// Win / loss: opportunities decided in a window. New-client (client
// acquisition) and expansion (requisition-level, existing client) deals are
// kept apart.

function winLossFor(ctx, opps, from, to) {
  const closed = opps.filter((o) => o.status !== "open" && between(o.closeDate, from, to));
  const rows = closed.map((o) => {
    const r = opportunityRow(ctx, o);
    const band = DEAL_SIZE_BANDS.find((b) => o.expectedGp < b.max) || DEAL_SIZE_BANDS[DEAL_SIZE_BANDS.length - 1];
    return {
      ...r,
      client: o.prospectName,
      dealType: o.type === "new_logo" ? "New client" : "Requisition (expansion)",
      decisionDate: o.closeDate,
      outcome: o.status === "won" ? "Won" : "Lost",
      reason: o.status === "lost" ? o.lossReason || "Not recorded" : "—",
      competitor: o.competitor || (o.status === "lost" ? "Unknown" : "—"),
      cycleDays: dayDiff(o.createdDate, o.closeDate),
      avoidable: o.status === "lost" && AVOIDABLE_LOSS_REASONS.includes(o.lossReason),
      sizeBand: band.label,
      sizeOrder: DEAL_SIZE_BANDS.indexOf(band),
    };
  });
  const count = (list, type, status) => list.filter((r) => (!type || r.dealType === type) && r.status === status).length;
  const rate = (type) => {
    const won = count(rows, type, "won");
    const lost = count(rows, type, "lost");
    return { won, lost, closed: won + lost, rate: ratePct(won, won + lost) };
  };
  return {
    rows: rows.sort((a, b) => b.decisionDate.localeCompare(a.decisionDate)),
    all: rate(null),
    newClient: rate("New client"),
    expansion: rate("Requisition (expansion)"),
    lostGp: sum(rows.filter((r) => r.status === "lost"), (r) => r.expectedGp),
    wonGp: sum(rows.filter((r) => r.status === "won"), (r) => r.expectedGp),
    avoidableLost: rows.filter((r) => r.avoidable).length,
    avoidableGp: sum(rows.filter((r) => r.avoidable), (r) => r.expectedGp),
    avgWonCycle: avg(rows.filter((r) => r.status === "won").map((r) => r.cycleDays)),
    avgLostCycle: avg(rows.filter((r) => r.status === "lost").map((r) => r.cycleDays)),
  };
}

const winLossGroups = (rows, keyOf, nameOf, extra = () => ({})) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()]
    .map(([k, list]) => {
      const won = list.filter((r) => r.status === "won");
      const lost = list.filter((r) => r.status === "lost");
      return {
        key: k,
        name: nameOf(list[0]),
        ...extra(list[0]),
        won: won.length,
        lost: lost.length,
        closed: list.length,
        winRate: ratePct(won.length, list.length),
        wonGp: sum(won, (r) => r.expectedGp),
        lostGp: sum(lost, (r) => r.expectedGp),
        avoidable: lost.filter((r) => r.avoidable).length,
        avgCycleDays: avg(list.map((r) => r.cycleDays)),
      };
    })
    .sort((a, b) => b.closed - a.closed || b.lostGp - a.lostGp);
};

function buildWinLoss(ctx, opps, w) {
  const cur = winLossFor(ctx, opps, w.cur.from, w.cur.to);
  const base = winLossFor(ctx, opps, w.base.from, w.base.to);
  const lostRows = cur.rows.filter((r) => r.status === "lost");
  const reasons = winLossGroups(lostRows, (r) => r.reason, (r) => r.reason).map((g) => ({ ...g, reason: g.name, avoidableReason: AVOIDABLE_LOSS_REASONS.includes(g.name) ? "Yes" : "No" }));
  // Largest client win: in the period, else the trailing twelve months.
  const newWins = (from, to) =>
    opps.filter((o) => o.type === "new_logo" && o.status === "won" && between(o.wonDate, from, to)).sort((a, b) => b.expectedGp - a.expectedGp);
  const periodWins = newWins(w.cur.from, w.cur.to);
  const largest = periodWins[0] || newWins(w.cohort.from, w.cohort.to)[0] || null;
  return {
    ...cur,
    base,
    reasons,
    byRep: winLossGroups(cur.rows, (r) => r.repId, (r) => r.owner, (r) => ({ repId: r.repId, team: ctx.index.teamById.get(ctx.index.repById.get(r.repId)?.teamId)?.name })),
    byCompetitor: winLossGroups(lostRows, (r) => r.competitor, (r) => r.competitor).map((g) => ({ ...g, competitor: g.name })),
    byVertical: winLossGroups(cur.rows, (r) => r.vertical, (r) => r.vertical),
    bySize: winLossGroups(cur.rows, (r) => r.sizeOrder, (r) => r.sizeBand).sort((a, b) => a.key - b.key),
    newClientWins: periodWins.length,
    largestWin: largest ? { ...opportunityRow(ctx, largest), client: largest.prospectName, winDate: largest.wonDate, inPeriod: periodWins[0] === largest } : null,
  };
}

// ---------------------------------------------------------------------------
// Requisitions: each is one position, so there are no partial fills.

function requisitionSummary(list, hx) {
  const filled = list.filter((r) => r.status === "filled");
  const cancelled = list.filter((r) => r.status === "cancelled").length;
  const toBilling = filled
    .map((r) => {
      const a = hx.assignmentByReq.get(r.id);
      return a ? dayDiff(r.filledDate, a.firstBilledDate) : null;
    })
    .filter((v) => v != null);
  return {
    eligible: list.length,
    filled: filled.length,
    cancelled,
    open: list.length - filled.length - cancelled,
    fillRate: ratePct(filled.length, list.length),
    avgDaysToFill: avg(filled.map((r) => dayDiff(r.openedDate, r.filledDate))),
    avgFillToBilling: avg(toBilling),
  };
}

/** Requisitions opened in the twelve-month cohort window (and the prior one), outcomes as of the data date. */
function buildRequisitions(ctx, w, hx) {
  const cohort = (from, to) => ctx.ds.requisitions.filter((r) => ctx.credit.has(r.clientId) && between(r.openedDate, from, to));
  const list = cohort(w.cohort.from, w.cohort.to);
  const byClient = new Map();
  for (const r of list) {
    if (!byClient.has(r.clientId)) byClient.set(r.clientId, []);
    byClient.get(r.clientId).push(r);
  }
  const rows = [...byClient.entries()]
    .map(([clientId, reqs]) => {
      const c = ctx.index.clientById.get(clientId);
      return {
        clientId,
        client: c.name,
        owner: ownersLabel(ctx, c),
        location: ctx.index.branchById.get(c.branchId)?.name,
        vertical: ctx.index.verticalById.get(c.verticalId)?.name,
        ...requisitionSummary(reqs, hx),
      };
    })
    .sort((a, b) => b.eligible - a.eligible);
  return { cur: requisitionSummary(list, hx), prior: requisitionSummary(cohort(w.priorCohort.from, w.priorCohort.to), hx), byClient: rows };
}

// ---------------------------------------------------------------------------
// Churn and retention. Logo churn uses the recorded loss date; revenue and GP
// retention compare each existing client's billing with the base window.

function buildRetention(ctx, w, hx, movementByClient) {
  const asOf = ctx.ds.meta.asOf;
  const asOfYm = toYm(asOf);
  const cur = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
  const base = sumFacts(ctx, w.baseWindow, (f) => f.clientId);
  const clients = [...ctx.credit.keys()].map((id) => ctx.index.clientById.get(id));

  const logo = (from, to) => {
    const active = clients.filter((c) => c.acquiredDate < from && (!c.churnDate || c.churnDate >= from));
    const lost = clients.filter((c) => between(c.churnDate, from, to));
    return { activeAtStart: active.length, lost: lost.length, lostClients: lost, rate: ratePct(lost.length, active.length) };
  };
  const logoCur = logo(w.cur.from, w.cur.to);
  const logoBase = logo(w.base.from, w.base.to);

  const money = (k) => {
    const r = { base: 0, kept: 0, lost: 0, contraction: 0, expansion: 0, existingNow: 0, newClients: 0, baseClients: 0 };
    for (const id of new Set([...cur.keys(), ...base.keys()])) {
      const b = base.get(id)?.[k] || 0;
      const c = cur.get(id)?.[k] || 0;
      if (b > 0) {
        r.baseClients += 1;
        r.base += b;
        const kept = Math.min(Math.max(c, 0), b);
        r.kept += kept;
        if (c <= 0) r.lost += b;
        else if (c < b) r.contraction += b - c;
        else r.expansion += c - b;
        r.existingNow += Math.max(c, 0);
      } else if (c > 0) r.newClients += c;
    }
    r.churned = r.lost + r.contraction;
    r.grossRetention = ratePct(r.kept, r.base);
    r.netRetention = ratePct(r.existingNow, r.base);
    return r;
  };
  const revenue = money("revenue");
  const gp = money("gp");

  // At-risk signals, estimated as of the data date with fixed lookbacks so they don't move with the period.
  const last3 = [1, 2, 3].map((i) => addMonths(asOfYm, -i));
  const prev3 = [4, 5, 6].map((i) => addMonths(asOfYm, -i));
  const gpLast3 = sumFacts(ctx, fullMonths(last3), (f) => f.clientId);
  const gpPrev3 = sumFacts(ctx, fullMonths(prev3), (f) => f.clientId);
  const activeNow = activeContractorsOn(ctx, asOf, (a) => a.clientId);
  const active90 = activeContractorsOn(ctx, addDays(asOf, -90), (a) => a.clientId);
  const horizon = addDays(asOf, EXPIRING_DAYS);
  const expiringByClient = new Map();
  const nextEndByClient = new Map();
  for (const a of ctx.ds.assignments) {
    if (a.actualEndDate || a.startDate > asOf || !ctx.assignmentPass(a)) continue;
    if (a.plannedEndDate <= horizon) expiringByClient.set(a.clientId, (expiringByClient.get(a.clientId) || 0) + 1);
    if (!nextEndByClient.get(a.clientId) || a.plannedEndDate < nextEndByClient.get(a.clientId)) nextEndByClient.set(a.clientId, a.plannedEndDate);
  }
  const dormantYm = toYm(addDays(asOf, -DORMANT_DAYS));

  const rows = [];
  for (const c of clients) {
    if (c.acquiredDate > w.cur.to) continue;
    const lostBefore = c.churnDate && c.churnDate < w.base.from;
    const b = base.get(c.id);
    const t = cur.get(c.id);
    if (lostBefore && !t?.revenue && !b?.revenue) continue;
    const lost = !!c.churnDate && c.churnDate <= w.cur.to;
    const nowActive = activeNow.get(c.id)?.size || 0;
    const before = active90.get(c.id)?.size || 0;
    const expiring = expiringByClient.get(c.id) || 0;
    const g3 = gpLast3.get(c.id)?.gp || 0;
    const gPrev = gpPrev3.get(c.id)?.gp || 0;
    const flags = [];
    if (!lost) {
      if (gPrev > 0 && g3 < gPrev * 0.75) flags.push("GP falling");
      if (before >= 3 && nowActive < before * 0.7) flags.push("Headcount shrinking");
      if (nowActive > 0 && expiring / nowActive >= 0.5) flags.push("Most assignments ending");
      const lb = hx.lastBilled.get(c.id);
      if (c.acquiredDate < addDays(asOf, -DORMANT_DAYS) && (!lb || lb < dormantYm)) flags.push("No recent billing");
    }
    const mv = movementByClient.get(c.id);
    const endReason = (() => {
      if (lost) return c.churnReason || "Not recorded";
      if (!mv?.ends) return "—";
      const top = Object.entries(mv.reasons).sort((x, y) => y[1] - x[1])[0];
      return top ? END_REASONS[top[0]] || top[0] : "—";
    })();
    const baseRevenue = b?.revenue || 0;
    const baseGp = b?.gp || 0;
    const revenueNow = t?.revenue || 0;
    const gpNow = t?.gp || 0;
    rows.push({
      clientId: c.id,
      client: c.name,
      owner: ownersLabel(ctx, c),
      primaryOwner: repName(ctx, [...c.owners].filter((o) => ctx.repSet.has(o.repId)).sort((a, b) => b.share - a.share)[0]?.repId),
      vertical: ctx.index.verticalById.get(c.verticalId)?.name,
      status: lost ? "Lost" : baseRevenue <= 0 && revenueNow > 0 ? "New" : revenueNow <= 0 ? "Inactive" : "Active",
      lossDate: c.churnDate || null,
      baseRevenue,
      baseGp,
      revenue: revenueNow,
      gp: gpNow,
      revenueChange: revenueNow - baseRevenue,
      lostGp: baseGp > 0 ? Math.max(0, baseGp - Math.max(gpNow, 0)) : 0,
      contractorsNow: nowActive,
      contractorStarts: mv?.starts || 0,
      contractorEnds: mv?.ends || 0,
      plannedEnds: mv?.planned || 0,
      churnReason: endReason,
      riskFlags: flags.join(", ") || "—",
      riskCount: flags.length,
      atRisk: flags.length >= 2 ? "High" : flags.length === 1 ? "Watch" : "—",
      gpLast3Months: g3,
      gpPrior3Months: gPrev,
      expiringAssignments: expiring,
      nextAssignmentEnd: nextEndByClient.get(c.id) || null,
    });
  }
  rows.sort((a, b) => b.lostGp - a.lostGp || b.riskCount - a.riskCount || b.gp - a.gp);
  const atRisk = rows.filter((r) => r.riskCount > 0).sort((a, b) => b.riskCount - a.riskCount || b.gpLast3Months - a.gpLast3Months);
  const expanding = rows.filter((r) => r.status === "Active" && r.baseGp > 0 && r.gp > r.baseGp * 1.05).sort((a, b) => b.gp - b.baseGp - (a.gp - a.baseGp));
  return { logo: logoCur, logoBase, revenue, gp, rows, atRisk, expanding, lastThreeMonths: `${formatYmShort(last3[2])} – ${formatYmShort(last3[0])}` };
}

// ---------------------------------------------------------------------------
// Contractor movement: billable assignments at the start and end of the
// period, starts and ends between. closing = opening + starts − ends holds
// for every assignment, so the table always reconciles.

function emptyMovement() {
  return { opening: 0, starts: 0, ends: 0, closing: 0, redeployed: 0, endsReplaced: 0, planned: 0, conversion: 0, early: 0, clientDriven: 0, reasons: {}, revenueFromStarts: 0, gpFromStarts: 0, endedMonthlyGp: 0, endedMonthlyRevenue: 0 };
}

function buildMovement(ctx, w, hx) {
  const asOf = ctx.ds.meta.asOf;
  const { from, to } = w.cur;
  const byAssignment = sumFacts(ctx, ctx.currentWindow, (f) => (f.kind === "time" ? f.assignmentId : null));
  const factsByClient = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
  const total = emptyMovement();
  const byClient = new Map();
  const byRep = new Map();
  const bucket = (map, k) => {
    if (!map.has(k)) map.set(k, emptyMovement());
    return map.get(k);
  };
  const endedRows = [];
  for (const a of ctx.ds.assignments) {
    if (!ctx.assignmentPass(a)) continue;
    const end = a.actualEndDate;
    const opening = a.startDate < from && (!end || end >= from);
    const started = between(a.startDate, from, to);
    const ended = !!end && between(end, from, to);
    const closing = a.startDate <= to && (!end || end > to);
    if (!opening && !started && !ended && !closing) continue;
    const share = ctx.credit.get(a.clientId) || 0;
    const reps = ctx.index.clientById.get(a.clientId).owners.filter((o) => ctx.repSet.has(o.repId)).map((o) => o.repId);
    const targets = [total, bucket(byClient, a.clientId), ...reps.map((r) => bucket(byRep, r))];
    const billed = byAssignment.get(a.id);
    const target = hx.redeployTarget.get(a.id);
    const replaced = ended && !!target && ctx.credit.has(target.clientId) && between(target.startDate, end, addDays(end, 30));
    const runRate = ended ? monthlyGpOf(hx, a.id) : null;
    for (const t of targets) {
      if (opening) t.opening += 1;
      if (closing) t.closing += 1;
      if (started) {
        t.starts += 1;
        if (a.redeployedFrom) t.redeployed += 1;
        t.revenueFromStarts += billed?.revenue || 0;
        t.gpFromStarts += billed?.gp || 0;
      }
      if (ended) {
        t.ends += 1;
        t[END_CLASS[a.endReason] || "early"] += 1;
        t.reasons[a.endReason] = (t.reasons[a.endReason] || 0) + 1;
        if (replaced) t.endsReplaced += 1;
        t.endedMonthlyGp += runRate.gp * share;
        t.endedMonthlyRevenue += runRate.revenue * share;
      }
    }
    if (ended) {
      const ctr = ctx.index.contractorById.get(a.contractorId);
      endedRows.push({
        assignmentId: a.id,
        clientId: a.clientId,
        client: ctx.index.clientById.get(a.clientId).name,
        contractor: ctr?.name,
        title: ctr?.title,
        startDate: a.startDate,
        endDate: end,
        endReason: END_REASONS[a.endReason] || a.endReason,
        endClass: END_CLASS_LABELS[END_CLASS[a.endReason] || "early"],
        redeployed: replaced ? "Yes" : "No",
        monthlyGp: runRate.gp * share,
      });
    }
  }
  const rate = (t) => ({
    ...t,
    netChange: t.starts - t.ends,
    attritionRate: ratePct(t.ends, t.opening),
    earlyRate: ratePct(t.early, t.opening),
    // Share of starts that re-placed a contractor coming off another assignment
    // (observed). Ends re-placed is kept for lineage; recent ends may still be re-placed.
    redeployRate: ratePct(t.redeployed, t.starts),
    endsReplacedRate: ratePct(t.endsReplaced, t.ends),
  });

  const clientRows = [...byClient.entries()].map(([clientId, t]) => {
    const c = ctx.index.clientById.get(clientId);
    const f = factsByClient.get(clientId);
    return { clientId, client: c.name, owner: ownersLabel(ctx, c), vertical: ctx.index.verticalById.get(c.verticalId)?.name, ...rate(t), billedHours: f?.billedHours || 0, revenue: f?.revenue || 0, gp: f?.gp || 0 };
  });
  const repRows = [...byRep.entries()].map(([repId, t]) => ({ repId, name: repName(ctx, repId), team: ctx.index.teamById.get(ctx.index.repById.get(repId)?.teamId)?.name, ...rate(t) }));

  // Assignments due to end soon: extension and redeployment levers.
  const horizon = addDays(asOf, EXPIRING_DAYS);
  const expiring = ctx.ds.assignments
    .filter((a) => !a.actualEndDate && a.startDate <= asOf && a.plannedEndDate <= horizon && ctx.assignmentPass(a))
    .map((a) => {
      const ctr = ctx.index.contractorById.get(a.contractorId);
      const c = ctx.index.clientById.get(a.clientId);
      const share = ctx.credit.get(a.clientId) || 0;
      const rr = monthlyGpOf(hx, a.id);
      return {
        assignmentId: a.id,
        clientId: a.clientId,
        client: c.name,
        owner: ownersLabel(ctx, c),
        contractor: ctr?.name,
        title: ctr?.title,
        placementType: a.placementType === "c2h" ? "Contract-to-hire" : "Contract",
        startDate: a.startDate,
        plannedEndDate: a.plannedEndDate,
        daysLeft: Math.max(0, dayDiff(asOf, a.plannedEndDate)),
        extensions: a.extensions,
        billRate: a.rateHistory[a.rateHistory.length - 1].billRate,
        monthlyRevenue: rr.revenue * share,
        monthlyGp: rr.gp * share,
      };
    })
    .sort((a, b) => a.plannedEndDate.localeCompare(b.plannedEndDate));

  return {
    total: rate(total),
    byClient: clientRows.sort((a, b) => b.ends - a.ends || b.starts - a.starts || b.closing - a.closing),
    byClientMap: byClient,
    byRep: repRows.sort((a, b) => b.ends - a.ends),
    endReasons: Object.entries(total.reasons)
      .map(([k, n]) => ({ key: k, reason: END_REASONS[k] || k, endClass: END_CLASS_LABELS[END_CLASS[k] || "early"], count: n }))
      .sort((a, b) => b.count - a.count),
    endedRows: endedRows.sort((a, b) => b.endDate.localeCompare(a.endDate)),
    expiring,
  };
}

// ---------------------------------------------------------------------------
// Velocity: days from first contact to client win, then to first requisition
// fill, first contractor start and first billing — four separate events.

function buildVelocity(ctx, opps, w, hx, pipeline, winLoss) {
  const asOf = ctx.ds.meta.asOf;
  const wonNew = opps.filter((o) => o.type === "new_logo" && o.status === "won" && between(o.wonDate, w.cohort.from, w.cohort.to));
  const timeline = wonNew
    .map((o) => {
      const inScope = o.clientId && ctx.credit.has(o.clientId);
      const assignments = inScope ? (ctx.index.assignmentsByClient.get(o.clientId) || []).filter((a) => a.startDate >= o.wonDate && ctx.assignmentPass(a)) : [];
      // The fill behind each post-win start; a requisition filled before the win was recorded counts as day 0.
      const firstFill = minOf(assignments.map((a) => hx.reqById.get(a.requisitionId)?.filledDate).filter(Boolean));
      const firstStart = minOf(assignments.map((a) => a.startDate));
      const firstBilling = minOf(assignments.map((a) => a.firstBilledDate).filter((d) => d <= asOf));
      return {
        id: o.id,
        opportunityId: o.id,
        clientId: o.clientId,
        client: o.prospectName,
        owner: repName(ctx, o.repId),
        repId: o.repId,
        vertical: ctx.index.verticalById.get(o.verticalId)?.name,
        createdDate: o.createdDate,
        winDate: o.wonDate,
        daysToWin: dayDiff(o.createdDate, o.wonDate),
        firstFillDate: firstFill,
        daysToFirstFill: firstFill ? Math.max(0, dayDiff(o.wonDate, firstFill)) : null,
        firstStartDate: firstStart,
        daysToFirstStart: firstStart ? dayDiff(o.wonDate, firstStart) : null,
        firstBillingDate: firstBilling,
        daysToFirstBilling: firstBilling ? dayDiff(o.wonDate, firstBilling) : null,
        expectedGp: o.expectedGp,
      };
    })
    .sort((a, b) => b.winDate.localeCompare(a.winDate));

  const rows = pipeline.rows;
  const slipped = rows.filter((r) => r.closeDateChanges > 0).sort((a, b) => b.daysMoved - a.daysMoved);
  const delayed = rows.filter((r) => r.pastExpectedStart).sort((a, b) => a.expectedStart.localeCompare(b.expectedStart));
  const stageAging = pipeline.byStage.map((s) => {
    const list = rows.filter((r) => r.stage === s.stage);
    return {
      key: s.stage,
      stage: s.stage,
      count: s.count,
      avgDaysInStage: s.avgDaysInStage,
      maxDaysInStage: list.length ? Math.max(...list.map((r) => r.daysInStage)) : null,
      threshold: s.threshold,
      stale: s.stale,
      staleGp: s.staleGp,
      weightedGp: s.weightedGp,
    };
  });

  const byRep = new Map();
  const repBucket = (repId) => {
    if (!byRep.has(repId)) byRep.set(repId, { repId, name: repName(ctx, repId), team: ctx.index.teamById.get(ctx.index.repById.get(repId)?.teamId)?.name, open: 0, stale: 0, slipped: 0, delayed: 0, days: [], cycles: [] });
    return byRep.get(repId);
  };
  for (const r of rows) {
    const b = repBucket(r.repId);
    b.open += 1;
    if (r.stale) b.stale += 1;
    if (r.closeDateChanges) b.slipped += 1;
    if (r.pastExpectedStart) b.delayed += 1;
    b.days.push(r.daysInStage);
  }
  for (const r of winLoss.rows) if (r.status === "won") repBucket(r.repId).cycles.push(r.cycleDays);

  return {
    timeline,
    avgDaysToWin: avg(timeline.map((t) => t.daysToWin)),
    avgDaysToFirstFill: avg(timeline.map((t) => t.daysToFirstFill)),
    avgDaysToFirstStart: avg(timeline.map((t) => t.daysToFirstStart)),
    avgDaysToFirstBilling: avg(timeline.map((t) => t.daysToFirstBilling)),
    avgDaysInStage: avg(rows.map((r) => r.daysInStage)),
    avgWonCycle: winLoss.avgWonCycle,
    baseWonCycle: winLoss.base.avgWonCycle,
    slipped,
    slippedGp: sum(slipped, (r) => r.expectedGp),
    slippedWeightedGp: sum(slipped, (r) => r.weightedGp),
    totalPushes: sum(slipped, (r) => r.closeDateChanges),
    avgDaysMoved: avg(slipped.map((r) => r.daysMoved)),
    delayed,
    delayedWeightedGp: sum(delayed, (r) => r.weightedGp),
    stageAging,
    byRep: [...byRep.values()]
      .map(({ days, cycles, ...b }) => ({ ...b, avgDaysInStage: avg(days), avgWonCycle: avg(cycles), wonDeals: cycles.length }))
      .sort((a, b) => b.stale + b.slipped - (a.stale + a.slipped)),
  };
}

// ---------------------------------------------------------------------------
// Sales efficiency: allocated sales operating expense against GP.

function buildEfficiency(ctx, w, winLoss) {
  const cur = sumFacts(ctx, ctx.currentWindow);
  const base = sumFacts(ctx, w.baseWindow);
  const exp = sumExpenses(ctx, ctx.currentWindow);
  const expBase = sumExpenses(ctx, w.baseWindow);
  const wins = winLoss.all.won;
  const newWins = winLoss.newClient.won;
  const gpByRep = sumFactsByRep(ctx, ctx.currentWindow);
  const expByRep = sumExpenses(ctx, ctx.currentWindow, (e) => e.repId);
  const winsByRep = new Map();
  for (const r of winLoss.rows) if (r.status === "won") winsByRep.set(r.repId, (winsByRep.get(r.repId) || 0) + 1);
  const byRep = ctx.reps.map((rep) => {
    const g = gpByRep.get(rep.id)?.gp || 0;
    const e = expByRep.get(rep.id) || { commission: 0, travel: 0, entertainment: 0, acquisition: 0, salary: 0, total: 0 };
    const won = winsByRep.get(rep.id) || 0;
    return {
      repId: rep.id,
      name: rep.name,
      team: ctx.index.teamById.get(rep.teamId)?.name,
      gp: g,
      salesExpense: e.total,
      costToGp: pctOf(e.total, g),
      commission: e.commission,
      travel: e.travel,
      entertainment: e.entertainment,
      tAndE: e.travel + e.entertainment,
      acquisition: e.acquisition,
      salary: e.salary,
      wins: won,
      costPerWin: won ? e.total / won : null,
      contribution: g - e.total,
    };
  }).sort((a, b) => b.contribution - a.contribution);
  const monthly = salesCostTrend(ctx, trendSeries(ctx));
  return {
    gp: cur.gp,
    revenue: cur.revenue,
    baseGp: base.gp,
    exp,
    expBase,
    costToGp: pctOf(exp.total, cur.gp),
    baseCostToGp: pctOf(expBase.total, base.gp),
    contribution: cur.gp - exp.total,
    baseContribution: base.gp - expBase.total,
    costPerWin: wins ? exp.total / wins : null,
    acquisitionPerNewClient: newWins ? exp.acquisition / newWins : null,
    gpPerRep: ctx.reps.length ? cur.gp / ctx.reps.length : null,
    byRep,
    monthly,
    method: ctx.sliceActive
      ? "Sales expense (commissions, travel, client entertainment, client acquisition and allocated salary & benefits, all below GP) ÷ GP. With client filters active, each salesperson's expense is allocated to the filtered clients in proportion to the GP they produced."
      : "Sales expense (commissions, travel, client entertainment, client acquisition and allocated salary & benefits, all below GP) ÷ GP. Each salesperson's expense counts in full.",
  };
}

// ---------------------------------------------------------------------------

/** Keep only the listed columns of each row (plus ids a drill needs). */
const pick = (rows, columns, extra = ["id", "key", "clientId", "repId", "opportunityId"]) => {
  const keys = [...new Set([...columns.map((c) => c.key), ...extra])];
  return rows.map((r) => {
    const out = {};
    for (const k of keys) if (r[k] !== undefined) out[k] = r[k];
    return out;
  });
};
/** A drill section: inline rows, or a reference to one of the page tables (`table`). */
const drillSection = (title, columns, rows, { table = null, limit = null } = {}) =>
  table ? { title, columns, table, limit } : { title, columns, rows: pick(rows, columns) };
const lineage = (title, rows) => ({ title, columns: [col("label", "Measure", "text"), col("value", "Value", "text")], rows });

const OPP_COLUMNS = [col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"), col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"), col("weightedGp", "Weighted GP"), col("daysInStage", "Days in stage", "days"), col("closeDateChanges", "Close-date changes", "count"), col("expectedStart", "Expected start", "date")];
const WL_COLUMNS = [col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("dealType", "Type", "text"), col("decisionDate", "Decision date", "date"), col("outcome", "Outcome", "text"), col("reason", "Reason", "text"), col("expectedGp", "Expected GP"), col("cycleDays", "Cycle", "days")];
const FUNNEL_COLUMNS = [col("stage", "Stage", "text"), col("opening", "In stage at window start", "count"), col("entered", "Entered", "count"), col("advanced", "Advanced", "count"), col("lost", "Lost", "count"), col("open", "Still in stage", "count"), col("won", "Eventually won", "count"), col("conversion", "Conversion", "pct"), col("avgStageDays", "Avg stage days", "days"), col("expectedGp", "GP opportunity")];

/** Tiles that open another tile's drill. */
const DRILL_ALIASES = {
  openPipelineGp: "openPipeline",
  weightedGpPipeline: "weightedPipeline",
  netRevenueRetention: "grossRevenueRetention",
  netGpRetention: "grossGpRetention",
  gpChurned: "grossGpRetention",
  weakestStage: "stageConversion",
  timeToFill: "fillRate",
  fillToBilling: "fillRate",
  avoidableLosses: "lostGp",
  wonCycle: "wonGp",
  lostCycle: "lostGp",
  openingBillable: "attritionRate",
  contractorStarts: "attritionRate",
  contractorEnds: "attritionRate",
  earlyTerminationRate: "attritionRate",
  redeploymentRate: "attritionRate",
  netBillableChange: "attritionRate",
  daysToFirstPlacement: "daysToClientWin",
  daysToFirstStart: "daysToClientWin",
  daysToFirstBilling: "daysToClientWin",
  avgSlipDays: "slippedDeals",
  salesContribution: "salesCostToGp",
  costPerWin: "salesCostToGp",
  salesExpenseTotal: "salesCostToGp",
};

export function salesHealthView(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const kind = ctx.access.scope.kind;
  const own = kind === "own";
  const canCost = can(ctx.access, "view_cost_detail");
  const canCommission = can(ctx.access, "view_commissions");
  const w = healthWindows(ctx);
  const hx = healthIndex(ctx.ds);
  const opps = ctx.ds.opportunities.filter(ctx.oppPass);

  const pipeline = buildPipeline(ctx, opps);
  const funnel = buildFunnel(ctx, opps, w);
  const winLoss = buildWinLoss(ctx, opps, w);
  const reqs = buildRequisitions(ctx, w, hx);
  const movement = buildMovement(ctx, w, hx);
  const retention = buildRetention(ctx, w, hx, movement.byClientMap);
  const velocity = buildVelocity(ctx, opps, w, hx, pipeline, winLoss);
  const efficiency = buildEfficiency(ctx, w, winLoss);

  const cov = pipeline.coverage;
  const covNote = (k) => {
    const c = cov[k];
    if (c.uncoveredTarget <= 0) return `Run-rate already covers the ${cov.label} ${k === "gp" ? "GP" : "revenue"} target; pipeline is upside`;
    return `Weighted ${k === "gp" ? "GP" : "revenue"} landing in ${cov.label} ÷ target not yet covered by actuals and run-rate`;
  };
  const B = w.baseLabel;
  const PRIOR = "Prior 12-month cohort";
  const highRisk = retention.atRisk.filter((r) => r.atRisk === "High");

  // ---- KPI sections -------------------------------------------------------
  const sections = {
    "health-pipeline": {
      id: "health-pipeline",
      title: own ? "My pipeline health" : "Pipeline health",
      tiles: [
        tile({ key: "openPipeline", label: "Open pipeline revenue", value: pipeline.totals.expectedRevenue, sub: `${pl(pipeline.totals.count, "open opportunity", "open opportunities")} · expected, not actual`, comparisons: compact([simpleCmp("3m", "3 months ago", pipeline.totals.expectedRevenue, pipeline.snap3m.expectedRevenue)]) }),
        tile({ key: "openPipelineGp", label: "Open pipeline expected GP", value: pipeline.totals.expectedGp, comparisons: compact([simpleCmp("3m", "3 months ago", pipeline.totals.expectedGp, pipeline.snap3m.expectedGp)]) }),
        tile({ key: "weightedPipeline", label: "Weighted revenue pipeline", value: pipeline.totals.weightedRevenue, sub: "Value × record probability", comparisons: compact([simpleCmp("3m", "3 months ago (stage probability)", pipeline.totals.weightedRevenue, pipeline.snap3m.weightedRevenue)]) }),
        tile({ key: "weightedGpPipeline", label: "Weighted GP pipeline", value: pipeline.totals.weightedGp, comparisons: compact([simpleCmp("3m", "3 months ago (stage probability)", pipeline.totals.weightedGp, pipeline.snap3m.weightedGp)]) }),
        tile({ key: "coverageRevenue", label: `Revenue coverage · ${cov.label}`, unit: "ratio", value: cov.revenue.coverage, sub: covNote("revenue"), comparisons: compact([simpleCmp("3m", "Same point 3 months ago", cov.revenue.coverage, pipeline.coverage3m.revenue.coverage), simpleCmp("12m", "Same point last year", cov.revenue.coverage, pipeline.coverage12m.revenue.coverage)]) }),
        tile({ key: "coverageGp", label: `GP coverage · ${cov.label}`, unit: "ratio", value: cov.gp.coverage, sub: covNote("gp"), comparisons: compact([simpleCmp("3m", "Same point 3 months ago", cov.gp.coverage, pipeline.coverage3m.gp.coverage), simpleCmp("12m", "Same point last year", cov.gp.coverage, pipeline.coverage12m.gp.coverage)]) }),
        tile({ key: "pipelineConcentration", label: "Top-5 deal concentration", unit: "pct", lowerIsBetter: true, value: pipeline.concentration.top5Share, sub: pipeline.concentration.topClient ? `Share of weighted GP · largest account ${Math.round(pipeline.concentration.topClient.share || 0)}%` : "No open deals" }),
        tile({ key: "staleDeals", label: "Stuck deals", unit: "count", lowerIsBetter: true, value: pipeline.stale.length, sub: `Over stage threshold · ${compactMoney(sum(pipeline.stale, (r) => r.expectedGp))} expected GP` }),
      ],
    },
    "health-conversion": {
      id: "health-conversion",
      title: own ? "My conversion" : "Funnel conversion",
      tiles: [
        tile({ key: "stageConversion", label: "Stage-to-stage conversion", unit: "pct", value: funnel.overall.conversion, sub: `${funnel.overall.advanced} advanced of ${funnel.overall.eligible} resolved stage entries · ${funnel.overall.open} still in stage`, comparisons: compact([simpleCmp("prior", PRIOR, funnel.overall.conversion, funnel.priorOverall.conversion, { unit: "pct" })]) }),
        tile({ key: "newClientCohortWin", label: "New-client funnel: prospect → won", unit: "pct", value: funnel.cohortWin.newClient.rate, sub: `${funnel.cohortWin.newClient.won} won · ${funnel.cohortWin.newClient.lost} lost · ${funnel.cohortWin.newClient.open} still open`, comparisons: compact([simpleCmp("prior", PRIOR, funnel.cohortWin.newClient.rate, funnel.priorCohortWin.newClient.rate, { unit: "pct" })]) }),
        tile({ key: "expansionCohortWin", label: "Expansion funnel: prospect → won", unit: "pct", value: funnel.cohortWin.expansion.rate, sub: `${funnel.cohortWin.expansion.won} won · ${funnel.cohortWin.expansion.lost} lost · ${funnel.cohortWin.expansion.open} still open`, comparisons: compact([simpleCmp("prior", PRIOR, funnel.cohortWin.expansion.rate, funnel.priorCohortWin.expansion.rate, { unit: "pct" })]) }),
        tile({ key: "weakestStage", label: funnel.weakest ? `Weakest stage · ${funnel.weakest.stage}` : "Weakest stage", unit: "pct", value: funnel.weakest?.conversion ?? null, sub: funnel.weakest ? `${funnel.weakest.lost} lost at this stage of ${funnel.weakest.eligible} resolved` : "Not enough resolved stage entries" }),
        tile({ key: "fillRate", label: "Requisition fill rate", unit: "pct", value: reqs.cur.fillRate, sub: `${reqs.cur.filled} filled of ${reqs.cur.eligible} opened · ${reqs.cur.open} still open`, comparisons: compact([simpleCmp("prior", PRIOR, reqs.cur.fillRate, reqs.prior.fillRate, { unit: "pct" })]) }),
        tile({ key: "timeToFill", label: "Days to fill", unit: "days", lowerIsBetter: true, value: reqs.cur.avgDaysToFill, sub: "Requisition opened → filled", comparisons: compact([simpleCmp("prior", PRIOR, reqs.cur.avgDaysToFill, reqs.prior.avgDaysToFill, { lowerIsBetter: true })]) }),
        tile({ key: "fillToBilling", label: "Fill to first billing", unit: "days", lowerIsBetter: true, value: reqs.cur.avgFillToBilling, sub: "Requisition filled → first billed timesheet", comparisons: compact([simpleCmp("prior", PRIOR, reqs.cur.avgFillToBilling, reqs.prior.avgFillToBilling, { lowerIsBetter: true })]) }),
      ],
    },
    "health-winloss": {
      id: "health-winloss",
      title: own ? "My wins & losses" : "Win / loss",
      tiles: [
        tile({ key: "clientWinRate", label: "Client win rate", unit: "pct", value: winLoss.newClient.rate, sub: `${pl(winLoss.newClient.won, "new client")} won · ${winLoss.newClient.lost} lost`, comparisons: compact([simpleCmp(w.baseKind, B, winLoss.newClient.rate, winLoss.base.newClient.rate, { unit: "pct" })]) }),
        tile({ key: "expansionWinRate", label: "Requisition (expansion) win rate", unit: "pct", value: winLoss.expansion.rate, sub: `${winLoss.expansion.won} won · ${winLoss.expansion.lost} lost at existing clients`, comparisons: compact([simpleCmp(w.baseKind, B, winLoss.expansion.rate, winLoss.base.expansion.rate, { unit: "pct" })]) }),
        tile({ key: "wonGp", label: "Expected GP won", value: winLoss.wonGp, sub: `${pl(winLoss.all.won, "deal")} won · expected, not yet billed`, comparisons: compact([simpleCmp(w.baseKind, B, winLoss.wonGp, winLoss.base.wonGp)]) }),
        tile({ key: "lostGp", label: "Expected GP lost", value: winLoss.lostGp, lowerIsBetter: true, sub: `${pl(winLoss.all.lost, "deal")} lost`, comparisons: compact([simpleCmp(w.baseKind, B, winLoss.lostGp, winLoss.base.lostGp, { lowerIsBetter: true })]) }),
        tile({ key: "avoidableLosses", label: "Avoidable losses", unit: "pct", lowerIsBetter: true, value: ratePct(winLoss.avoidableLost, winLoss.all.lost), sub: `${winLoss.avoidableLost} of ${winLoss.all.lost} losses · price, no decision or unfilled skills` }),
        tile({ key: "wonCycle", label: "Won-deal cycle", unit: "days", lowerIsBetter: true, value: winLoss.avgWonCycle, sub: "Created → won", comparisons: compact([simpleCmp(w.baseKind, B, winLoss.avgWonCycle, winLoss.base.avgWonCycle, { lowerIsBetter: true })]) }),
        tile({ key: "lostCycle", label: "Lost-deal cycle", unit: "days", lowerIsBetter: true, value: winLoss.avgLostCycle, sub: "Created → lost; long losing cycles tie up selling time", comparisons: compact([simpleCmp(w.baseKind, B, winLoss.avgLostCycle, winLoss.base.avgLostCycle, { lowerIsBetter: true })]) }),
      ],
    },
    "health-churn": {
      id: "health-churn",
      title: own ? "My account retention" : "Churn & retention",
      tiles: [
        tile({ key: "logoChurn", label: "Client logo churn", unit: "pct", lowerIsBetter: true, value: retention.logo.rate, sub: `${retention.logo.lost} lost of ${retention.logo.activeAtStart} active at start`, comparisons: compact([simpleCmp(w.baseKind, B, retention.logo.rate, retention.logoBase.rate, { unit: "pct", lowerIsBetter: true })]) }),
        tile({ key: "grossRevenueRetention", label: "Gross revenue retention", unit: "pct", value: retention.revenue.grossRetention, sub: `Existing clients vs ${B}, excluding expansion` }),
        tile({ key: "netRevenueRetention", label: "Net revenue retention", unit: "pct", value: retention.revenue.netRetention, sub: "Including expansion; new clients excluded" }),
        tile({ key: "grossGpRetention", label: "Gross GP retention", unit: "pct", value: retention.gp.grossRetention, sub: "Retained GP, capped at the base" }),
        tile({ key: "netGpRetention", label: "Net GP retention", unit: "pct", value: retention.gp.netRetention, sub: "Including expansion" }),
        tile({ key: "gpChurned", label: "GP lost from existing clients", value: retention.gp.churned, lowerIsBetter: true, sub: `Lost clients ${compactMoney(retention.gp.lost)} · contraction ${compactMoney(retention.gp.contraction)}` }),
        tile({ key: "atRiskClients", label: "High-risk clients (estimated)", unit: "count", lowerIsBetter: true, value: highRisk.length, sub: `Two or more signals · ${retention.atRisk.length - highRisk.length} more on watch with one · ${compactMoney(sum(retention.atRisk, (r) => r.gpLast3Months))} GP last 3 months across both` }),
      ],
    },
    "health-movement": {
      id: "health-movement",
      title: own ? "My contractor movement" : "Contractor movement",
      tiles: [
        tile({ key: "openingBillable", label: "Billable at period start", unit: "count", value: movement.total.opening, sub: `${movement.total.closing} at period end` }),
        tile({ key: "contractorStarts", label: "Starts", unit: "count", value: movement.total.starts, sub: `${movement.total.redeployed} redeployed from other assignments` }),
        tile({ key: "contractorEnds", label: "Ends", unit: "count", lowerIsBetter: true, value: movement.total.ends, sub: `${movement.total.planned} planned · ${movement.total.early} early · ${movement.total.conversion} converted · ${movement.total.clientDriven} client-driven` }),
        tile({ key: "attritionRate", label: "Contractor attrition", unit: "pct", lowerIsBetter: true, value: movement.total.attritionRate, sub: "All ends ÷ billable at period start" }),
        tile({ key: "earlyTerminationRate", label: "Early terminations", unit: "pct", lowerIsBetter: true, value: movement.total.earlyRate, sub: "Resigned, performance or client ended early ÷ start base" }),
        tile({ key: "redeploymentRate", label: "Starts from redeployment", unit: "pct", value: movement.total.redeployRate, sub: "Contractors re-placed after another assignment ÷ starts" }),
        tile({ key: "netBillableChange", label: "Net billable change", unit: "count", value: movement.total.netChange, sub: "Starts − ends" }),
        tile({ key: "expiringAssignments", label: `Ending in next ${EXPIRING_DAYS} days`, unit: "count", lowerIsBetter: true, value: movement.expiring.length, sub: `${compactMoney(sum(movement.expiring, (r) => r.monthlyGp))} monthly GP run-rate at stake` }),
      ],
    },
    "health-velocity": {
      id: "health-velocity",
      title: own ? "My sales velocity" : "Sales velocity & slippage",
      tiles: [
        tile({ key: "daysToClientWin", label: "Days to client win", unit: "days", lowerIsBetter: true, value: velocity.avgDaysToWin, sub: `${pl(velocity.timeline.length, "new client")} won, trailing 12 months` }),
        tile({ key: "daysToFirstPlacement", label: "Win → first fill", unit: "days", lowerIsBetter: true, value: velocity.avgDaysToFirstFill, sub: "Client win → first requisition filled" }),
        tile({ key: "daysToFirstStart", label: "Win → first start", unit: "days", lowerIsBetter: true, value: velocity.avgDaysToFirstStart, sub: "Client win → first contractor start" }),
        tile({ key: "daysToFirstBilling", label: "Win → first billing", unit: "days", lowerIsBetter: true, value: velocity.avgDaysToFirstBilling, sub: "Client win → first billed timesheet" }),
        tile({ key: "avgDaysInStage", label: "Days in current stage", unit: "days", lowerIsBetter: true, value: velocity.avgDaysInStage, sub: "Average across open deals" }),
        tile({ key: "slippedDeals", label: "Deals with moved close dates", unit: "count", lowerIsBetter: true, value: velocity.slipped.length, sub: `${compactMoney(velocity.slippedGp)} expected GP · ${velocity.totalPushes} pushes` }),
        tile({ key: "avgSlipDays", label: "Average slip", unit: "days", lowerIsBetter: true, value: velocity.avgDaysMoved, sub: "Original → current close date" }),
        tile({ key: "delayedStarts", label: "Past expected start", unit: "count", lowerIsBetter: true, value: velocity.delayed.length, sub: `${compactMoney(velocity.delayedWeightedGp)} weighted GP still open` }),
      ],
    },
    "health-efficiency": {
      id: "health-efficiency",
      title: own ? "My sales efficiency" : "Sales efficiency & cost",
      tiles: compact([
        tile({ key: "salesCostToGp", label: "Sales cost-to-GP", unit: "pct", lowerIsBetter: true, value: efficiency.costToGp, sub: "Allocated sales expense ÷ GP", comparisons: compact([simpleCmp(w.baseKind, B, efficiency.costToGp, efficiency.baseCostToGp, { unit: "pct", lowerIsBetter: true })]) }),
        tile({ key: "salesContribution", label: own ? "My GP after sales expense" : "GP after sales expense", value: efficiency.contribution, sub: "Sales contribution, not EBITDA", comparisons: compact([simpleCmp(w.baseKind, B, efficiency.contribution, efficiency.baseContribution)]) }),
        tile({ key: "costPerWin", label: "Sales cost per win", value: efficiency.costPerWin, lowerIsBetter: true, sub: `${pl(winLoss.all.won, "deal")} won (all types)` }),
        tile({ key: "acquisition", label: "Acquisition cost per new client", value: efficiency.acquisitionPerNewClient, lowerIsBetter: true, sub: `${pl(winLoss.newClient.won, "new client")} won` }),
        tile({ key: "commission", label: own ? "My commission" : "Commissions", value: efficiency.exp.commission, sub: `${Math.round(pctOf(efficiency.exp.commission, efficiency.gp) || 0)}% of GP` }),
        tile({ key: "tAndE", label: own ? "My travel & entertainment" : "Travel & entertainment", value: efficiency.exp.travel + efficiency.exp.entertainment, lowerIsBetter: true, comparisons: compact([simpleCmp(w.baseKind, B, efficiency.exp.travel + efficiency.exp.entertainment, efficiency.expBase.travel + efficiency.expBase.entertainment, { lowerIsBetter: true })]) }),
        own
          ? tile({ key: "salesExpenseTotal", label: "My sales expense", value: efficiency.exp.total, lowerIsBetter: true, sub: "All categories, below GP", comparisons: compact([simpleCmp(w.baseKind, B, efficiency.exp.total, efficiency.expBase.total, { lowerIsBetter: true })]) })
          : tile({ key: "gpPerRep", label: "GP per salesperson", value: efficiency.gpPerRep, sub: `${pl(ctx.reps.length, "salesperson", "salespeople")} in view` }),
      ]),
    },
  };

  const order = own
    ? ["health-pipeline", "health-movement", "health-churn", "health-conversion", "health-winloss", "health-velocity", "health-efficiency"]
    : ["health-pipeline", "health-conversion", "health-winloss", "health-churn", "health-movement", "health-velocity", "health-efficiency"];
  const kpiSections = order.map((id) => sections[id]);

  // ---- Tile drills: numerator / denominator lineage and the records behind them.
  const fmtMoney = (v) => (v == null ? "—" : compactMoney(v));
  const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const fmtRatio = (v) => (v == null ? "—" : `${v.toFixed(2)}×`);
  const n = (v) => String(v ?? 0);
  const coverageLineage = (k) =>
    lineage(`${k === "gp" ? "GP" : "Revenue"} coverage lineage · ${cov.label}`, [
      { label: `${cov.label} ${k === "gp" ? "GP" : "revenue"} target`, value: fmtMoney(cov[k].target) },
      { label: "Actual to date", value: fmtMoney(cov[k].actualToDate) },
      { label: "Remaining target", value: fmtMoney(cov[k].remainingTarget) },
      { label: "Run-rate of current billable base, rest of period", value: fmtMoney(cov[k].runRateProjection) },
      { label: "Target not yet covered (denominator)", value: fmtMoney(cov[k].uncoveredTarget) },
      { label: "Weighted pipeline landing in the period (numerator)", value: fmtMoney(cov[k].weightedLanding) },
      { label: "Coverage", value: fmtRatio(cov[k].coverage) },
      { label: "Coverage of the full remaining target", value: fmtRatio(cov[k].coverageOfRemaining) },
      { label: `Same point 3 months ago (${pipeline.coverage3m.label})`, value: fmtRatio(pipeline.coverage3m[k].coverage) },
      { label: `Same point last year (${pipeline.coverage12m.label})`, value: fmtRatio(pipeline.coverage12m[k].coverage) },
    ]);
  const cohortSubtitle = `Deals entering each stage ${w.cohort.label}, followed to ${formatDate(asOf)}. Conversion = advanced ÷ (advanced + lost at the stage); deals still in the stage are not yet eligible.`;
  const reqColumns = [col("client", "Client", "text"), col("location", "Location", "text"), col("eligible", "Opened", "count"), col("filled", "Filled", "count"), col("cancelled", "Cancelled", "count"), col("open", "Open", "count"), col("fillRate", "Fill rate", "pct"), col("avgDaysToFill", "Days to fill", "days"), col("avgFillToBilling", "Fill to billing", "days")];

  const drills = {
    openPipeline: { title: "Open pipeline", subtitle: "Open opportunities as of the data date; expected values, not actual revenue.", sections: [drillSection("By stage", [col("stage", "Stage", "text"), col("count", "Deals", "count"), col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"), col("weightedRevenue", "Weighted revenue"), col("weightedGp", "Weighted GP")], pipeline.byStage), drillSection("Open deals by weighted GP", OPP_COLUMNS, null, { table: "pipeline" })] },
    weightedPipeline: { title: "Weighted pipeline trend", subtitle: "Month-end snapshots reconstructed from stage history and weighted by configured stage probability.", sections: [drillSection("Snapshots", [col("label", "Month end", "text"), col("count", "Open deals", "count"), col("expectedRevenue", "Expected revenue"), col("weightedRevenue", "Weighted revenue"), col("expectedGp", "Expected GP"), col("weightedGp", "Weighted GP")], pipeline.trend)] },
    coverageRevenue: { title: "Revenue pipeline coverage", subtitle: covNote("revenue"), sections: [coverageLineage("revenue")] },
    coverageGp: { title: "GP pipeline coverage", subtitle: covNote("gp"), sections: [coverageLineage("gp")] },
    pipelineConcentration: { title: "Pipeline concentration", subtitle: "Share of weighted GP held by the five largest deals.", sections: [drillSection("Five largest deals by weighted GP", OPP_COLUMNS, pipeline.concentration.top5)] },
    staleDeals: { title: "Deals stuck beyond stage thresholds", subtitle: `Thresholds: ${OPEN_STAGES.map((s) => `${s} ${STAGE_THRESHOLD_DAYS[s]} days`).join(" · ")}`, sections: [drillSection("Stuck deals", [...OPP_COLUMNS, col("daysOverThreshold", "Days over threshold", "days"), col("nextAction", "Next action", "text")], pipeline.stale)] },
    stageConversion: { title: "Stage conversion by cohort", subtitle: cohortSubtitle, sections: [drillSection("This cohort", FUNNEL_COLUMNS, funnel.stages), drillSection(`Prior cohort (${w.priorCohort.label})`, FUNNEL_COLUMNS, funnel.priorStages)] },
    newClientCohortWin: { title: "New-client acquisition funnel", subtitle: cohortSubtitle, sections: [drillSection("New-client deals", FUNNEL_COLUMNS.filter((c) => c.key !== "opening"), funnel.newClient)] },
    expansionCohortWin: { title: "Expansion funnel", subtitle: cohortSubtitle, sections: [drillSection("Expansion deals", FUNNEL_COLUMNS.filter((c) => c.key !== "opening"), funnel.expansion)] },
    fillRate: { title: "Requisition fill rate", subtitle: `Requisitions opened ${w.cohort.label}, outcomes as of ${formatDate(asOf)}. Each requisition is one position, so there are no partial fills. Fill rate = filled ÷ opened.`, sections: [lineage("Lineage", [{ label: "Opened (denominator)", value: n(reqs.cur.eligible) }, { label: "Filled (numerator)", value: n(reqs.cur.filled) }, { label: "Cancelled", value: n(reqs.cur.cancelled) }, { label: "Still open", value: n(reqs.cur.open) }, { label: "Fill rate", value: fmtPct(reqs.cur.fillRate) }, { label: `${PRIOR} fill rate`, value: fmtPct(reqs.prior.fillRate) }, { label: "Days to fill", value: reqs.cur.avgDaysToFill == null ? "—" : reqs.cur.avgDaysToFill.toFixed(1) }, { label: "Fill to first billing (days)", value: reqs.cur.avgFillToBilling == null ? "—" : reqs.cur.avgFillToBilling.toFixed(1) }]), drillSection("By client", reqColumns, null, { table: "requisitions" })] },
    clientWinRate: { title: "Client win rate", subtitle: "New-client wins ÷ closed new-client opportunities (won + lost) decided in the period.", sections: [lineage("Lineage", [{ label: "New-client deals won (numerator)", value: n(winLoss.newClient.won) }, { label: "New-client deals lost", value: n(winLoss.newClient.lost) }, { label: "Closed new-client deals (denominator)", value: n(winLoss.newClient.closed) }, { label: "Win rate", value: fmtPct(winLoss.newClient.rate) }, { label: `${B} win rate`, value: fmtPct(winLoss.base.newClient.rate) }]), drillSection("Decided new-client deals", WL_COLUMNS, winLoss.rows.filter((r) => r.dealType === "New client"))] },
    expansionWinRate: { title: "Requisition (expansion) win rate", subtitle: "Expansion wins at existing clients ÷ closed expansion opportunities (won + lost).", sections: [lineage("Lineage", [{ label: "Won (numerator)", value: n(winLoss.expansion.won) }, { label: "Lost", value: n(winLoss.expansion.lost) }, { label: "Closed (denominator)", value: n(winLoss.expansion.closed) }, { label: "Win rate", value: fmtPct(winLoss.expansion.rate) }, { label: `${B} win rate`, value: fmtPct(winLoss.base.expansion.rate) }]), drillSection("Decided expansion deals", WL_COLUMNS, winLoss.rows.filter((r) => r.dealType !== "New client"))] },
    wonGp: { title: "Deals won", subtitle: "Expected GP of deals won in the period; actual billing follows only from contractor starts.", sections: [drillSection("Won deals", WL_COLUMNS, winLoss.rows.filter((r) => r.status === "won"))] },
    lostGp: { title: "Lost deals", subtitle: `Expected GP of deals lost in the period, by reason. Avoidable = ${AVOIDABLE_LOSS_REASONS.join(", ").toLowerCase()}.`, sections: [drillSection("By reason", [col("reason", "Reason", "text"), col("avoidableReason", "Avoidable", "text"), col("lost", "Deals", "count"), col("lostGp", "Expected GP lost")], winLoss.reasons), drillSection("Lost deals", WL_COLUMNS, winLoss.rows.filter((r) => r.status === "lost"))] },
    logoChurn: { title: "Client logo churn", subtitle: "A client counts as lost on its recorded loss date, when all its billing stops. Rate = clients lost in the period ÷ clients active at the start (acquired before the period and not yet lost). Planned assignment endings are not client churn.", sections: [lineage("Lineage", [{ label: "Active at period start (denominator)", value: n(retention.logo.activeAtStart) }, { label: "Lost in period (numerator)", value: n(retention.logo.lost) }, { label: "Logo churn", value: fmtPct(retention.logo.rate) }, { label: `${B} logo churn`, value: fmtPct(retention.logoBase.rate) }]), drillSection("Clients lost in the period", [col("client", "Client", "text"), col("owner", "Owner", "text"), col("lossDate", "Loss date", "date"), col("churnReason", "Reason", "text"), col("baseGp", `GP · ${B}`), col("lostGp", "GP lost")], retention.rows.filter((r) => r.status === "Lost" && between(r.lossDate, w.cur.from, w.cur.to)))] },
    grossRevenueRetention: { title: "Revenue retention", subtitle: `Clients billing in the ${B} window, compared with this period. Gross = retained revenue (capped at the base) ÷ base; net adds expansion. New clients are excluded from both.`, sections: [retentionLineage(retention.revenue, B, fmtMoney, fmtPct)] },
    grossGpRetention: { title: "GP retention", subtitle: `Same method on GP; clients with no positive GP in the ${B} window are excluded from the base.`, sections: [retentionLineage(retention.gp, B, fmtMoney, fmtPct), drillSection("Clients losing the most GP", [col("client", "Client", "text"), col("owner", "Owner", "text"), col("status", "Status", "text"), col("baseGp", `GP · ${B}`), col("gp", "GP now"), col("lostGp", "GP lost"), col("churnReason", "Main reason", "text")], retention.rows.filter((r) => r.lostGp > 0).slice(0, 25))] },
    atRiskClients: { title: "Clients at risk (estimated)", subtitle: `Signals as of ${formatDate(asOf)}: GP in the last three complete months down more than 25% on the three before; billable headcount down 30%+ in 90 days; half or more of assignments ending within ${EXPIRING_DAYS} days; or no billing for ${DORMANT_DAYS}+ days. Two or more signals = high, one = watch. An estimate, not a recorded loss.`, sections: [drillSection("At-risk clients", [col("client", "Client", "text"), col("owner", "Owner", "text"), col("atRisk", "Risk", "text"), col("riskFlags", "Signals", "text"), col("gpLast3Months", "GP last 3 months"), col("gpPrior3Months", "GP prior 3 months"), col("contractorsNow", "On billing", "count"), col("expiringAssignments", "Ending soon", "count"), col("nextAssignmentEnd", "Next assignment end", "date")], null, { table: "atRisk" })] },
    attritionRate: { title: "Contractor attrition", subtitle: "Ends ÷ billable assignments at the period start (opening base). Closing = opening + starts − ends.", sections: [lineage("Lineage", [{ label: "Billable at period start (denominator)", value: n(movement.total.opening) }, { label: "Starts", value: n(movement.total.starts) }, { label: "· of which redeployed contractors", value: n(movement.total.redeployed) }, { label: "Ends (numerator)", value: n(movement.total.ends) }, ...Object.entries(END_CLASS_LABELS).map(([k, label]) => ({ label: `· ${label}`, value: n(movement.total[k]) })), { label: "Billable at period end", value: n(movement.total.closing) }, { label: "Attrition", value: fmtPct(movement.total.attritionRate) }, { label: "Early-termination rate", value: fmtPct(movement.total.earlyRate) }, { label: "Starts from redeployment", value: fmtPct(movement.total.redeployRate) }, { label: "Ending contractors re-placed so far (recent ends may still be)", value: fmtPct(movement.total.endsReplacedRate) }]), drillSection("Ends by reason", [col("reason", "Reason", "text"), col("endClass", "Type", "text"), col("count", "Ends", "count")], movement.endReasons), drillSection("Assignments ended in the period", [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("endDate", "Ended", "date"), col("endReason", "Reason", "text"), col("redeployed", "Re-placed", "text"), col("monthlyGp", "Monthly GP run-rate")], movement.endedRows.slice(0, 150))] },
    expiringAssignments: { title: `Assignments ending in the next ${EXPIRING_DAYS} days`, subtitle: "Planned end dates; extensions not yet recorded. Monthly GP is the assignment's average while active.", sections: [drillSection("Expiring assignments", [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("plannedEndDate", "Planned end", "date"), col("daysLeft", "Days left", "days"), col("extensions", "Extensions so far", "count"), col("billRate", "Bill rate", "rate"), col("monthlyGp", "Monthly GP")], null, { table: "expiring" })] },
    daysToClientWin: { title: "New-client timeline", subtitle: "Client win, first requisition fill, first contractor start and first billing are separate events. A requisition filled before the win was recorded counts as day 0.", sections: [drillSection(`New clients won ${w.cohort.label}`, [col("client", "Client", "text"), col("owner", "Owner", "text"), col("winDate", "Won", "date"), col("daysToWin", "Days to win", "days"), col("daysToFirstFill", "Win → first fill", "days"), col("daysToFirstStart", "Win → first start", "days"), col("daysToFirstBilling", "Win → first billing", "days")], velocity.timeline)] },
    avgDaysInStage: { title: "Stage aging", subtitle: `Thresholds: ${OPEN_STAGES.map((s) => `${s} ${STAGE_THRESHOLD_DAYS[s]} days`).join(" · ")}`, sections: [drillSection("Open deals by stage", [col("stage", "Stage", "text"), col("count", "Open deals", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("maxDaysInStage", "Longest", "days"), col("threshold", "Threshold", "days"), col("stale", "Over threshold", "count"), col("staleGp", "Expected GP over threshold")], velocity.stageAging)] },
    slippedDeals: { title: "Deal slippage", subtitle: "Open deals whose expected close date has moved.", sections: [drillSection("Slipped deals", [col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text"), col("originalCloseDate", "Original close", "date"), col("closeDate", "Current close", "date"), col("closeDateChanges", "Pushes", "count"), col("daysMoved", "Days moved", "days"), col("expectedGp", "Expected GP")], null, { table: "slippage" })] },
    delayedStarts: { title: "Open deals past their expected start", subtitle: "Still open after the date the client was expected to start; start dates need re-confirming.", sections: [drillSection("Delayed starts", [...OPP_COLUMNS, col("nextAction", "Next action", "text")], velocity.delayed)] },
    salesCostToGp: { title: "Sales cost-to-GP", subtitle: efficiency.method, sections: [lineage("Lineage", compact([{ label: "Gross profit (denominator)", value: fmtMoney(efficiency.gp) }, canCommission ? { label: "Commissions", value: fmtMoney(efficiency.exp.commission) } : null, canCost ? { label: "Travel", value: fmtMoney(efficiency.exp.travel) } : null, canCost ? { label: "Client entertainment", value: fmtMoney(efficiency.exp.entertainment) } : null, canCost ? { label: "Client acquisition", value: fmtMoney(efficiency.exp.acquisition) } : null, canCost ? { label: "Salary & benefits allocation", value: fmtMoney(efficiency.exp.salary) } : null, { label: "Total sales expense (numerator)", value: fmtMoney(efficiency.exp.total) }, { label: "Sales cost-to-GP", value: fmtPct(efficiency.costToGp) }, { label: `${B} sales cost-to-GP`, value: fmtPct(efficiency.baseCostToGp) }, { label: "GP after sales expense", value: fmtMoney(efficiency.contribution) }, { label: "Deals won (all types)", value: n(winLoss.all.won) }, { label: "Sales cost per win", value: fmtMoney(efficiency.costPerWin) }]))] },
  };

  for (const s of kpiSections) {
    for (const t of s.tiles) {
      const key = drills[t.key] ? t.key : DRILL_ALIASES[t.key];
      t.drillKey = key || null;
      t.drill = !!key;
    }
  }

  // ---- Tables -------------------------------------------------------------
  const tables = {
    pipeline: pipeline.rows,
    pipelineByOwner: pipeline.byOwner,
    pipelineByVertical: pipeline.byVertical,
    pipelineByRegion: pipeline.byRegion,
    funnel: funnel.stages,
    funnelNewClient: funnel.newClient,
    funnelExpansion: funnel.expansion,
    conversionByRep: funnel.byRep,
    conversionByVertical: funnel.byVertical,
    requisitions: reqs.byClient,
    winLoss: winLoss.rows,
    winLossByReason: winLoss.reasons,
    winLossByRep: winLoss.byRep,
    winLossByCompetitor: winLoss.byCompetitor,
    winLossByVertical: winLoss.byVertical,
    winLossBySize: winLoss.bySize,
    churn: retention.rows,
    atRisk: retention.atRisk,
    movement: movement.byClient,
    movementByRep: movement.byRep,
    expiring: movement.expiring,
    newClientTimeline: velocity.timeline,
    stageAging: velocity.stageAging,
    slippage: velocity.slipped,
    delayedStarts: velocity.delayed,
    velocityByRep: velocity.byRep,
    efficiencyByRep: efficiency.byRep,
    efficiencyMonthly: efficiency.monthly,
  };

  const retentionBridge = (r, label) => {
    const start = Math.round(r.base);
    const steps = [
      { key: "lost", label: "Lost clients", amount: -Math.round(r.lost) },
      { key: "contraction", label: "Contraction", amount: -Math.round(r.contraction) },
      { key: "expansion", label: "Expansion", amount: Math.round(r.expansion) },
    ];
    return {
      start: { label: `${label} · ${B}`, amount: start },
      steps,
      end: { label: `${label} · existing clients now`, amount: start + steps.reduce((s, x) => s + x.amount, 0) },
      newClients: r.newClients,
    };
  };

  const definitions = {
    "health-pipeline": `Open pipeline as of ${formatDate(asOf)}; expected values, never counted as actual revenue. Coverage matches ${cov.label}.`,
    "health-conversion": `Cohorts: deals entering each stage and requisitions opened ${w.cohort.label}, followed to ${formatDate(asOf)}.`,
    "health-winloss": `Deals decided in ${ctx.period.label} against ${w.base.label}. Win rate = won ÷ (won + lost).`,
    "health-churn": `Existing clients against ${w.base.label}. A client is lost on its recorded loss date; planned assignment ends are not churn.`,
    "health-movement": `Billable assignments ${formatDate(w.cur.from)} – ${formatDate(w.cur.to)}. Attrition = ends ÷ opening base.`,
    "health-velocity": `New clients won ${w.cohort.label}; open-deal aging and slippage as of ${formatDate(asOf)}.`,
    "health-efficiency": "Sales expense (all below GP) ÷ GP; allocated by GP share when client filters are active.",
  };

  const model = {
    ctx, kind, own, w, pipeline, funnel, winLoss, reqs, retention, movement, velocity, efficiency,
    canSeeCostDetail: canCost,
    canSeeCommissions: canCommission,
    rep: own ? ctx.reps[0] || null : null,
  };

  return {
    data: {
      role: kind,
      windows: {
        period: { from: w.cur.from, to: w.cur.to, label: ctx.period.label },
        base: { from: w.base.from, to: w.base.to, label: w.base.label, short: B },
        cohort: w.cohort,
        priorCohort: w.priorCohort,
        coverage: { label: cov.label, kind: cov.kind },
      },
      kpiSections,
      drills,
      definitions,
      pipeline: { trend: pipeline.trend, byStage: pipeline.byStage, thresholds: STAGE_THRESHOLD_DAYS },
      winLoss: { reasons: winLoss.reasons, avoidableReasons: AVOIDABLE_LOSS_REASONS },
      retention: { revenueBridge: retentionBridge(retention.revenue, "Revenue"), gpBridge: retentionBridge(retention.gp, "GP") },
      movement: {
        endReasons: movement.endReasons,
        flow: [
          { key: "opening", label: "Billable at start", value: movement.total.opening },
          { key: "starts", label: "Starts", value: movement.total.starts },
          { key: "planned", label: "Planned ends", value: -movement.total.planned },
          { key: "conversion", label: "Converted to perm", value: -movement.total.conversion },
          { key: "early", label: "Early terminations", value: -movement.total.early },
          { key: "clientDriven", label: "Client reductions", value: -movement.total.clientDriven },
          { key: "closing", label: "Billable at end", value: movement.total.closing },
        ],
      },
      efficiency: { method: efficiency.method },
      // Numerator / denominator lineage for every rate on the page.
      lineage: {
        clientWinRate: { won: winLoss.newClient.won, lost: winLoss.newClient.lost, closed: winLoss.newClient.closed, rate: winLoss.newClient.rate },
        expansionWinRate: { won: winLoss.expansion.won, lost: winLoss.expansion.lost, closed: winLoss.expansion.closed, rate: winLoss.expansion.rate },
        fillRate: { filled: reqs.cur.filled, cancelled: reqs.cur.cancelled, open: reqs.cur.open, eligible: reqs.cur.eligible, rate: reqs.cur.fillRate },
        logoChurn: { lost: retention.logo.lost, activeAtStart: retention.logo.activeAtStart, rate: retention.logo.rate },
        attrition: { opening: movement.total.opening, starts: movement.total.starts, ends: movement.total.ends, closing: movement.total.closing, planned: movement.total.planned, conversion: movement.total.conversion, early: movement.total.early, clientDriven: movement.total.clientDriven, rate: movement.total.attritionRate },
        stageConversion: { advanced: funnel.overall.advanced, lost: funnel.overall.lost, eligible: funnel.overall.eligible, open: funnel.overall.open, entered: funnel.overall.entered, rate: funnel.overall.conversion },
        revenueRetention: { base: retention.revenue.base, kept: retention.revenue.kept, existingNow: retention.revenue.existingNow, gross: retention.revenue.grossRetention, net: retention.revenue.netRetention },
        gpRetention: { base: retention.gp.base, kept: retention.gp.kept, existingNow: retention.gp.existingNow, gross: retention.gp.grossRetention, net: retention.gp.netRetention },
        salesCostToGp: { salesExpense: efficiency.exp.total, gp: efficiency.gp, rate: efficiency.costToGp },
      },
      tables,
      insights: buildHealthInsights(model),
    },
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.crm, SOURCES.billing, SOURCES.payroll, SOURCES.expenses, SOURCES.plans],
    notes: [
      `Pipeline coverage = weighted pipeline landing in ${cov.label} ÷ target not yet covered by actuals and the current run-rate (last three complete months). Revenue and GP are measured separately; pipeline is never counted as actual revenue.`,
      `Stage conversion and requisition fill follow cohorts entering or opened ${w.cohort.label}: conversion = advanced ÷ (advanced + lost at the stage); deals still in a stage are not yet eligible.`,
      "Client wins, requisition fills, contractor starts and first billing are separate events. Expansion opportunities stand in for requisition-level deals; candidate submissions, interviews and offers are not in the sample data.",
      "Client renewal dates are not recorded, so the next assignment end date is shown instead.",
    ],
  };
}

function retentionLineage(r, baseLabel, fmtMoney, fmtPct) {
  return lineage("Lineage", [
    { label: `Existing clients in the ${baseLabel} window`, value: String(r.baseClients) },
    { label: `Base · ${baseLabel} (denominator)`, value: fmtMoney(r.base) },
    { label: "Lost clients (no billing now)", value: fmtMoney(r.lost) },
    { label: "Contraction", value: fmtMoney(r.contraction) },
    { label: "Retained, capped at base (gross numerator)", value: fmtMoney(r.kept) },
    { label: "Expansion", value: fmtMoney(r.expansion) },
    { label: "Existing clients now (net numerator)", value: fmtMoney(r.existingNow) },
    { label: "Gross retention", value: fmtPct(r.grossRetention) },
    { label: "Net retention", value: fmtPct(r.netRetention) },
    { label: "New clients (excluded)", value: fmtMoney(r.newClients) },
  ]);
}

/**
 * One opportunity for the in-place drill: stage history, close-date moves,
 * the deal's drivers and, for existing clients, the client's requisitions and
 * assignments due to end (planned capacity). Requisitions are not linked to
 * deals in the data, so the client's recent requisitions are shown instead.
 */
export function salesHealthOpportunityView(ctx, { opportunityId }) {
  const o = ctx.index.opportunityById.get(opportunityId);
  if (!o || !ctx.oppPass(o)) return { data: { opportunity: null }, families: ["pipeline"], sources: [] };
  const asOf = ctx.ds.meta.asOf;
  const hx = healthIndex(ctx.ds);
  const row = pipelineRow(ctx, o);
  const history = o.stageHistory.map((h, i) => {
    const next = o.stageHistory[i + 1];
    return { key: `${h.stage}-${i}`, stage: h.stage, enteredDate: h.date, leftDate: next?.date || null, days: OPEN_STAGES.includes(h.stage) ? dayDiff(h.date, next ? next.date : asOf) : null };
  });
  const pushes = o.pushes.map((p, i) => ({ key: `p${i}`, from: p.from, to: p.to, daysMoved: dayDiff(p.from, p.to) }));
  const months = Math.min(12, o.durationMonths);
  const drivers = [{
    key: "drivers",
    headcount: o.headcount,
    hoursPerWeek: o.hoursPerWeek,
    billRate: o.billRate,
    payRate: o.payRate,
    durationMonths: o.durationMonths,
    monthlyRevenue: o.expectedRevenue / months,
    monthlyGp: o.expectedGp / months,
    gmPct: gmPct(o.expectedGp, o.expectedRevenue),
  }];
  let requisitions = [];
  let assignments = [];
  if (o.clientId && ctx.credit.has(o.clientId)) {
    requisitions = (hx.reqsByClient.get(o.clientId) || [])
      .filter((r) => r.openedDate >= o.createdDate)
      .map((r) => ({ key: r.id, id: r.id, openedDate: r.openedDate, status: r.status === "filled" ? "Filled" : r.status === "open" ? "Open" : "Cancelled", filledDate: r.filledDate, daysToFill: r.filledDate ? dayDiff(r.openedDate, r.filledDate) : null }))
      .sort((a, b) => b.openedDate.localeCompare(a.openedDate));
    assignments = (ctx.index.assignmentsByClient.get(o.clientId) || [])
      .filter((a) => !a.actualEndDate && a.startDate <= asOf && ctx.assignmentPass(a))
      .map((a) => {
        const ctr = ctx.index.contractorById.get(a.contractorId);
        return { key: a.id, contractor: ctr?.name, title: ctr?.title, startDate: a.startDate, plannedEndDate: a.plannedEndDate, extensions: a.extensions, billRate: a.rateHistory[a.rateHistory.length - 1].billRate };
      })
      .sort((a, b) => a.plannedEndDate.localeCompare(b.plannedEndDate));
  }
  return {
    data: {
      opportunity: {
        ...row,
        type: o.type === "new_logo" ? "New client" : "Requisition (expansion)",
        lostDate: o.lostDate,
        wonDate: o.wonDate,
      },
      history,
      pushes,
      drivers,
      requisitions,
      assignments,
    },
    families: ["pipeline"],
    sources: [SOURCES.crm],
  };
}
