// Goal planner for the What-If engine: a salesperson states a goal ("raise my
// commission by 15%") and each plan finds how far one lever, or a mix of
// them, has to move to reach it. Every candidate runs the full quarter model,
// so commission tiers, accelerators and confidence rules all apply exactly.

import { addDays, toYm } from "./dates";
import { simulate } from "./whatIf";

export const GOAL_METRICS = {
  commission: { label: "Quarter commission", unit: "money", value: (r) => r.commission?.quarterTotal ?? null },
  gp: { label: "Quarter GP", unit: "money", value: (r) => r.quarter.gp },
  revenue: { label: "Quarter revenue", unit: "money", value: (r) => r.quarter.revenue },
  contribution: { label: "Sales contribution", unit: "money", value: (r) => r.contribution },
  attainment: { label: "GP target attainment", unit: "pct", value: (r) => r.attainment.gp },
};

// Checked in order: "sales contribution" must not read as revenue, "commission target" not as attainment.
const METRIC_WORDS = [
  ["contribution", /contribution/],
  ["commission", /com+is+i?on|incentive|payout|bonus/],
  ["attainment", /attainment|target|quota/],
  ["gp", /\bgp\b|gross profit|\bprofit/],
  ["revenue", /revenue|\bsales\b|billings?|turnover/],
];
const RELATIVE = /\bby\b|\bmore\b|\bextra\b|\badditional\b|\badd(ed)?\b|\+/;

/**
 * Reads a goal sentence. Returns { metric, mode, value, readAs? } where mode is
 * "pct" (grow by value %), "add" (add value) or "abs" (reach value), or
 * { error } when there's no metric or amount to plan for.
 */
export function parseGoal(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "");
  const metric = METRIC_WORDS.find(([, re]) => re.test(t))?.[0];
  if (!metric) return { error: "metric" };
  const relative = RELATIVE.test(t);
  const pctMatch = t.match(/(\d*\.?\d+)\s*(%|percent|pct)/);
  const moneyMatch = t.match(/\$\s*(\d*\.?\d+)\s*([km])?\b/) || t.match(/(\d*\.?\d+)\s*([km])\b/);
  const plain = t.match(/(\d*\.?\d+)/);
  const scale = (m) => Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1);

  if (metric === "attainment") {
    const v = pctMatch ? Number(pctMatch[1]) : plain ? Number(plain[1]) : 100;
    return relative ? { metric, mode: "add", value: v } : { metric, mode: "abs", value: v };
  }
  if (pctMatch) {
    // "Increase my commission to 15%" is read as growth: a money amount can't be a percentage.
    return { metric, mode: "pct", value: Number(pctMatch[1]), readAs: relative ? null : "growth" };
  }
  if (/\bdouble\b/.test(t)) return { metric, mode: "pct", value: 100 };
  if (moneyMatch || plain) {
    const v = moneyMatch ? scale(moneyMatch) : Number(plain[1]);
    return { metric, mode: relative ? "add" : "abs", value: v };
  }
  return { error: "amount", metric };
}

/** The value the goal asks for, from the metric's baseline value. */
export function goalTarget(goal, baseValue) {
  if (goal.mode === "pct") return baseValue * (1 + goal.value / 100);
  if (goal.mode === "add") return baseValue + goal.value;
  return goal.value;
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const num = (v, fallback = 0) => (v == null || v === "" || !Number.isFinite(Number(v)) ? fallback : Number(v));
const roundUp = (x, step) => Number((Math.ceil(x / step - 1e-9) * step).toFixed(4));

// How far each lever may go before it stops being a believable plan, and the
// share of that a balanced mix uses at full stretch.
export const LEVER_LIMITS = { billRatePct: 15, hoursPct: 10, extensionProbability: 100, pipelinePts: 60, starts: 20 };
const MIX = { billRatePct: 6, hoursPct: 4, extensionShare: 0.6, pipelinePts: 30, starts: 5 };
const STEP = { billRatePct: 0.1, hoursPct: 0.1, extensionProbability: 1, pipelinePts: 1, starts: 1 };

/** A new start at the salesperson's most active client, at that client's average rates. */
function startTemplate(baseline, costDetail) {
  const by = new Map();
  for (const x of baseline.assignments) {
    const t = by.get(x.clientId) || { n: 0, bill: 0, pay: 0 };
    t.n += 1;
    t.bill += x.billRate;
    t.pay += x.payRate || 0;
    by.set(x.clientId, t);
  }
  const [clientId, t] = [...by].sort((x, y) => y[1].n - x[1].n)[0] || [];
  const client = baseline.clients.find((c) => c.id === clientId);
  const startDate = addDays(baseline.quarter.asOf, 14);
  if (!client || startDate > baseline.quarter.to) return null;
  return {
    clientId,
    clientName: client.name,
    startDate,
    durationMonths: 6,
    hoursPerWeek: 40,
    billRate: Math.round((t.bill / t.n) * 4) / 4,
    payRate: costDetail ? Math.round((t.pay / t.n) * 100) / 100 : null,
  };
}

/**
 * Plans that reach `target` for `metric`, each built on top of the current
 * assumptions. A plan records the lever amounts it needs, the assumptions to
 * apply and the metric it reaches; one that can't get there within its limit
 * comes back with reached = false and the most it can do.
 */
export function planForGoal(baseline, assumptions, metric, target, { costDetail = true } = {}) {
  const valueOf = GOAL_METRICS[metric].value;
  const run = (a) => {
    const r = simulate(baseline, a);
    return { value: valueOf(r), result: { revenue: r.quarter.revenue, gp: r.quarter.gp, gmPct: r.quarter.gmPct, commission: r.commission?.quarterTotal ?? null } };
  };
  const now = run(assumptions).value;
  const qEnd = baseline.quarter.to;
  const extFrom = num(assumptions.global?.extensionProbability, baseline.defaults.extensionProbability);
  const context = {
    ending: baseline.assignments.filter((x) => x.plannedEndDate < qEnd).length,
    extFrom,
    openDeals: baseline.opportunities.filter((o) => {
      const ov = assumptions.opportunities?.[o.id] || {};
      return ov.include !== false && num(ov.probability, o.probability) < 100;
    }).length,
    start: startTemplate(baseline, costDetail),
    rateFromYm: assumptions.global?.rateEffectiveYm || baseline.quarter.months.find((m) => m >= toYm(addDays(baseline.quarter.asOf, 1))),
  };
  if (now == null || now >= target) return { now, target, alreadyMet: now != null && now >= target, plans: [], context };

  // Lever amounts → assumptions, layered on what the salesperson already set.
  const build = (levers) => {
    const a = clone(assumptions);
    if (levers.billRatePct) a.global.billRatePct = Number((num(a.global.billRatePct) + levers.billRatePct).toFixed(2));
    if (levers.hoursPct) a.global.hoursPct = Number((num(a.global.hoursPct) + levers.hoursPct).toFixed(2));
    if (levers.extensionProbability != null && levers.extensionProbability > extFrom) a.global.extensionProbability = levers.extensionProbability;
    if (levers.pipelinePts) {
      for (const o of baseline.opportunities) {
        const ov = a.opportunities[o.id] || {};
        if (ov.include === false) continue;
        const p = num(ov.probability, o.probability);
        if (p < 100) a.opportunities[o.id] = { ...ov, probability: Math.min(100, Math.round(p + levers.pipelinePts)) };
      }
    }
    if (levers.starts && context.start) {
      const s = context.start;
      a.newStarts = [
        ...(a.newStarts || []),
        { id: `goal-${Date.now().toString(36)}`, clientId: s.clientId, name: "", count: levers.starts, startDate: s.startDate, durationMonths: s.durationMonths, hoursPerWeek: s.hoursPerWeek, billRate: s.billRate, payRate: s.payRate, committed: false },
      ];
    }
    return a;
  };

  const levers = [];
  levers.push({ id: "billRate", key: "billRatePct", max: LEVER_LIMITS.billRatePct, at: (x) => ({ billRatePct: x }) });
  if (context.ending && extFrom < 100) levers.push({ id: "extension", key: "extensionProbability", max: 100 - extFrom, at: (x) => ({ extensionProbability: extFrom + x }) });
  if (context.openDeals) levers.push({ id: "pipeline", key: "pipelinePts", max: LEVER_LIMITS.pipelinePts, at: (x) => ({ pipelinePts: x }) });
  if (context.start) levers.push({ id: "starts", key: "starts", max: LEVER_LIMITS.starts, at: (x) => ({ starts: x }) });
  levers.push({ id: "hours", key: "hoursPct", max: LEVER_LIMITS.hoursPct, at: (x) => ({ hoursPct: x }) });

  // Balanced: every available lever moves together, `t` of the way to its mix share.
  // `starts` fixes the number of new contractors instead of scaling it with t.
  const has = new Set(levers.map((l) => l.id));
  const mixAt = (starts) => (t) => ({
    billRatePct: roundUp(t * MIX.billRatePct, STEP.billRatePct),
    hoursPct: roundUp(t * MIX.hoursPct, STEP.hoursPct),
    ...(has.has("extension") ? { extensionProbability: extFrom + Math.round(t * MIX.extensionShare * (100 - extFrom)) } : {}),
    ...(has.has("pipeline") ? { pipelinePts: Math.round(t * MIX.pipelinePts) } : {}),
    ...(has.has("starts") ? { starts: starts ?? Math.round(t * MIX.starts) } : {}),
  });

  /** Smallest x in (0, max] (on the lever's step) that reaches the target; levers only ever add. */
  const seek = (at, max, step) => {
    const eval_ = (x) => {
      const lv = at(roundUp(x, step));
      const a = build(lv);
      return { levers: lv, assumptions: a, ...run(a) };
    };
    const top = eval_(max);
    if (top.value < target) return { ...top, x: max, reached: false };
    let lo = 0;
    let hi = max;
    while (hi - lo > step) {
      const mid = (lo + hi) / 2;
      if (eval_(mid).value >= target) hi = mid;
      else lo = mid;
    }
    const x = Math.min(max, roundUp(hi, step));
    return { ...eval_(x), x, reached: true };
  };

  const plans = levers.map((l) => {
    const p = seek(l.at, l.max, STEP[l.key]);
    return { id: l.id, ...p, stretch: p.x / l.max };
  });
  if (levers.length > 1) {
    let p = seek(mixAt(null), 1, 0.01);
    // Whole contractors make the mix jump past the goal; one start fewer with a
    // little more from the other levers often lands closer to it.
    if (p.reached && p.levers.starts > 0) {
      const fewer = seek(mixAt(p.levers.starts - 1), 1, 0.01);
      if (fewer.reached && fewer.value < p.value) p = fewer;
    }
    plans.unshift({ id: "balanced", ...p, stretch: p.x });
  }
  // Balanced first, then the single levers that need the smallest share of their limit; plans that fall short last.
  const order = (p) => (p.reached ? 0 : 2) + (p.id === "balanced" ? 0 : 1);
  plans.sort((x, y) => order(x) - order(y) || x.stretch - y.stretch);
  return { now, target, alreadyMet: false, plans, context };
}
