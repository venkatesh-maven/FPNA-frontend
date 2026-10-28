// What-If engine for one recruiter's current quarter (spec section 7).
// Pure: the same baseline (from the service) and assumptions always give the
// same quarter, so the page, saved scenarios, forecast submissions and tests
// agree. Actual-to-date is never changed; only the rest of the quarter is
// modeled, and every modeled amount is tagged by confidence:
//   confirmed — existing assignments to their planned end, committed starts
//   probable  — extensions at the historical rate, pipeline at stage probability
//   upside    — anything assumed beyond that (uncommitted starts, higher fill odds)

import { addDays, dayDiff, daysInMonth, maxDate, minDate, monthEnd, monthStart, toYm } from "./dates";
import { OT_MULTIPLIER, gmPct } from "./economics";

export const PAID_HOURS_FACTOR = 1.01; // paid hours run slightly above billed hours

export const ASSUMPTION_GROUPS = [
  { id: "existing", label: "Extensions & early ends" },
  { id: "hours", label: "Hours worked" },
  { id: "billRates", label: "Bill rates" },
  { id: "payRates", label: "Pay rates" },
  { id: "directCosts", label: "Burden & other direct costs" },
  { id: "attrition", label: "Client attrition & delays" },
  { id: "newStarts", label: "New starts" },
  { id: "pipeline", label: "Job order fills" },
];
const ALL_GROUPS = new Set(ASSUMPTION_GROUPS.map((g) => g.id));

export const CONFIDENCE = ["actual", "confirmed", "probable", "upside"];
export const CONFIDENCE_LABELS = { actual: "Actual to date", confirmed: "Confirmed existing", probable: "Probable", upside: "Upside assumptions" };

export const emptyAssumptions = () => ({
  global: { extensionProbability: null, hoursPct: 0, billRatePct: 0, payRatePct: 0, rateEffectiveYm: null, payrollTaxPp: 0, wcPp: 0, benefitsPerHour: 0, odcPerContractorMonth: 0 },
  assignments: {}, // id → { extensionProbability, endDate, hoursPerWeek, billRate, payRate }
  clients: {}, // id → { billRatePct, payRatePct, hoursPct, lose, loseFrom, delayStartsWeeks }
  newStarts: [], // { id, clientId, name, count, startDate, durationMonths, hoursPerWeek, billRate, payRate, committed }
  opportunities: {}, // id → { include, probability, startDate, headcount, billRate, payRate, rampMonths }
  expenses: {}, // remaining-quarter { travel, entertainment, acquisition }
});

/** Commission on a quarter's GP: base rate up to the GP target, accelerator above it. */
export const planCommission = (gp, target, plan) =>
  Math.max(0, Math.min(gp, target)) * plan.baseRate + Math.max(0, gp - target) * plan.accelRate;

/** Quarter GP needed for a quarter commission amount (inverse of planCommission). */
export const gpForCommission = (commission, target, plan) => {
  const atTarget = target * plan.baseRate;
  return commission <= atTarget ? commission / plan.baseRate : target + (commission - atTarget) / plan.accelRate;
};

const num = (v, fallback) => (v === "" || v == null || !Number.isFinite(Number(v)) ? fallback : Number(v));
const pct = (v) => num(v, 0) / 100;

const zero = () => ({ revenue: 0, gp: 0, directCost: 0, wages: 0, burden: 0, odc: 0, hours: 0, fte: 0, starts: 0, ends: 0 });
const addInto = (t, x) => {
  for (const k of Object.keys(t)) t[k] += x[k] || 0;
  return t;
};

/** Days of [from, to] (inclusive ISO dates) inside month ym. */
const daysIn = (from, to, ym) => {
  const a = maxDate(from, monthStart(ym));
  const b = minDate(to, monthEnd(ym));
  return a > b ? 0 : dayDiff(a, b) + 1;
};

/**
 * Money for `days` of one contractor in month ym, credited by `share` and
 * weighted by probability. Without cost detail (pay is null) the client's
 * cost ratio stands in for pay and burden, so restricted viewers can model
 * revenue and GP without seeing pay rates.
 */
function work(x, days, ym) {
  if (days <= 0 || x.weight <= 0) return null;
  const hours = (days / 7) * x.hoursPerWeek;
  const otMult = 1 + (OT_MULTIPLIER - 1) * x.otShare;
  const revenue = hours * x.bill * otMult;
  let wages = 0;
  let burden = 0;
  let odc = 0;
  let directCost;
  if (x.pay == null) {
    directCost = revenue * x.costRatio;
  } else {
    const paidHours = hours * PAID_HOURS_FACTOR;
    wages = paidHours * x.pay * otMult;
    burden = wages * x.burdenRate + paidHours * x.benefitsPerHour;
    odc = x.odcPerMonth * (days / daysInMonth(ym));
    directCost = wages + burden + odc;
  }
  const w = x.share * x.weight;
  return {
    revenue: revenue * w,
    directCost: directCost * w,
    gp: (revenue - directCost) * w,
    wages: wages * w,
    burden: burden * w,
    odc: odc * w,
    hours: hours * w,
    fte: (days / daysInMonth(ym)) * x.weight,
  };
}

/**
 * Model the rest of the quarter. `groups` limits which assumption groups
 * apply (all by default) — the GP bridge switches them on one at a time.
 */
export function simulate(baseline, assumptions = emptyAssumptions(), { groups = ALL_GROUPS } = {}) {
  const on = (g) => groups.has(g);
  const a = { ...emptyAssumptions(), ...assumptions, global: { ...emptyAssumptions().global, ...(assumptions?.global || {}) } };
  const g = a.global;
  const q = baseline.quarter;
  const next = addDays(q.asOf, 1);
  const qEnd = q.to;
  const months = q.months.filter((m) => m >= toYm(next));
  const effYm = g.rateEffectiveYm || months[0];
  const clientById = new Map(baseline.clients.map((c) => [c.id, c]));
  const defaults = baseline.defaults;

  // cells: `${ym}|${clientKey}|${confidence}` → totals
  const cells = new Map();
  const meta = new Map(); // clientKey → client descriptor
  const put = (ym, key, conf, t) => {
    if (!t) return;
    const k = `${ym}|${key}|${conf}`;
    if (!cells.has(k)) cells.set(k, zero());
    addInto(cells.get(k), t);
  };
  const event = (ym, key, conf, field, n) => {
    if (!n || ym < months[0] || ym > months[months.length - 1]) return;
    const k = `${ym}|${key}|${conf}`;
    if (!cells.has(k)) cells.set(k, zero());
    cells.get(k)[field] += n;
  };
  const activity = { activeAtEnd: 0, starts: 0, ends: 0 };

  const clientRule = (clientId) => a.clients[clientId] || {};
  const rateFactor = (clientId, ym, kind) => {
    if (ym < effYm) return 1;
    const c = clientRule(clientId);
    if (kind === "bill" && on("billRates")) return 1 + pct(c.billRatePct) + pct(g.billRatePct);
    if (kind === "pay" && on("payRates")) return 1 + pct(c.payRatePct) + pct(g.payRatePct);
    return 1;
  };
  const hoursFactor = (clientId) => (on("hours") ? (1 + pct(clientRule(clientId).hoursPct)) * (1 + pct(g.hoursPct)) : 1);
  const costAdds = () =>
    on("directCosts")
      ? { burdenPp: pct(g.payrollTaxPp) + pct(g.wcPp), benefitsPerHour: num(g.benefitsPerHour, 0), odc: num(g.odcPerContractorMonth, 0) }
      : { burdenPp: 0, benefitsPerHour: 0, odc: 0 };
  const lossDate = (clientId) => {
    const c = clientRule(clientId);
    return on("attrition") && c.lose ? c.loseFrom || next : null;
  };
  const delayDays = (clientId) => (on("attrition") ? num(clientRule(clientId).delayStartsWeeks, 0) * 7 : 0);

  /** Spread one contractor's work over [from, to] into the month cells. */
  const spread = (key, conf, base, from, to) => {
    if (from > to) return;
    for (const ym of months) {
      const d = daysIn(from, to, ym);
      if (!d) continue;
      put(ym, key, conf, work({ ...base, bill: base.bill * rateFactor(base.clientId, ym, "bill"), pay: base.pay == null ? null : base.pay * rateFactor(base.clientId, ym, "pay") }, d, ym));
    }
  };

  const extDefault = num(defaults.extensionProbability, 50) / 100;
  const extGlobal = on("existing") && g.extensionProbability != null && g.extensionProbability !== "" ? pct(g.extensionProbability) : extDefault;
  const adds = costAdds();

  // Existing assignments.
  for (const asg of baseline.assignments) {
    const client = clientById.get(asg.clientId);
    const key = asg.clientId;
    meta.set(key, client);
    const ov = a.assignments[asg.id] || {};
    const lost = lossDate(asg.clientId);
    let end = asg.plannedEndDate;
    if (on("existing") && ov.endDate && ov.endDate < end) end = maxDate(ov.endDate, q.asOf);
    if (lost && lost <= end) end = addDays(lost, -1);
    const pExt = lost ? 0 : on("existing") && ov.extensionProbability != null && ov.extensionProbability !== "" ? pct(ov.extensionProbability) : extGlobal;
    const base = {
      clientId: asg.clientId,
      share: client.share,
      weight: 1,
      hoursPerWeek: (on("hours") ? num(ov.hoursPerWeek, asg.effWeeklyHours) : asg.effWeeklyHours) * hoursFactor(asg.clientId),
      otShare: asg.otShare,
      bill: on("billRates") ? num(ov.billRate, asg.billRate) : asg.billRate,
      pay: asg.payRate == null ? null : on("payRates") ? num(ov.payRate, asg.payRate) : asg.payRate,
      burdenRate: (asg.burdenRate ?? defaults.burdenRate ?? 0) + adds.burdenPp,
      benefitsPerHour: adds.benefitsPerHour,
      odcPerMonth: asg.odcPerMonth + adds.odc,
      costRatio: client.costRatio ?? defaults.costRatio,
    };
    spread(key, "confirmed", base, next, minDate(end, qEnd));
    const endsInQuarter = end < qEnd;
    // Extension after the (unchanged) planned end, through quarter end.
    if (endsInQuarter && end === asg.plannedEndDate && pExt > 0) {
      const extFrom = addDays(end, 1);
      const pBase = Math.min(pExt, extDefault);
      const pUp = Math.max(0, pExt - extDefault);
      spread(key, "probable", { ...base, weight: pBase }, extFrom, qEnd);
      spread(key, "upside", { ...base, weight: pUp }, extFrom, qEnd);
      event(toYm(end), key, "confirmed", "ends", 1 - pExt);
      activity.ends += 1 - pExt;
      activity.activeAtEnd += pExt;
    } else if (endsInQuarter) {
      event(toYm(maxDate(end, next)), key, "confirmed", "ends", 1);
      activity.ends += 1;
    } else {
      activity.activeAtEnd += 1;
    }
  }

  // New starts the recruiter adds.
  if (on("newStarts")) {
    for (const s of a.newStarts || []) {
      const existing = s.clientId && clientById.get(s.clientId);
      const key = existing ? s.clientId : `new:${s.id}`;
      meta.set(key, existing || { id: null, name: s.name || "New client", share: 1, isNew: true, vertical: s.vertical || null, location: s.location || null, serviceType: s.serviceType || null, bu: s.bu || null, costRatio: defaults.costRatio });
      const count = Math.max(0, Math.round(num(s.count, 0)));
      if (!count || !s.startDate) continue;
      const start = addDays(maxDate(s.startDate, next), existing ? delayDays(s.clientId) : 0);
      const end = minDate(addDays(start, Math.round(num(s.durationMonths, 6) * 30) - 1), qEnd);
      const lost = existing ? lossDate(s.clientId) : null;
      const stop = lost ? minDate(end, addDays(lost, -1)) : end;
      const conf = s.committed ? "confirmed" : "upside";
      const hpw = num(s.hoursPerWeek, 40);
      const base = {
        clientId: s.clientId,
        share: existing ? existing.share : 1,
        weight: count,
        hoursPerWeek: hpw * (existing ? hoursFactor(s.clientId) : 1),
        otShare: hpw > 40 ? (hpw - 40) / hpw : 0,
        bill: num(s.billRate, 0),
        pay: defaults.burdenRate == null ? null : num(s.payRate, 0),
        burdenRate: (defaults.burdenRate ?? 0) + adds.burdenPp,
        benefitsPerHour: adds.benefitsPerHour,
        odcPerMonth: num(defaults.odcPerContractorMonth, 0) + adds.odc,
        costRatio: (existing && existing.costRatio) ?? defaults.costRatio,
      };
      if (start > qEnd || start > stop) continue;
      spread(key, conf, base, start, stop);
      event(toYm(start), key, conf, "starts", count);
      activity.starts += count;
      if (stop < qEnd) {
        event(toYm(stop), key, conf, "ends", count);
        activity.ends += count;
      } else activity.activeAtEnd += count;
    }
  }

  // Open job orders, weighted by fill probability.
  for (const o of baseline.opportunities) {
    const ov = on("pipeline") ? a.opportunities[o.id] || {} : {};
    if (ov.include === false) continue;
    const existing = o.clientId && clientById.get(o.clientId);
    const key = existing ? o.clientId : `opp:${o.id}`;
    meta.set(key, existing || { id: null, name: o.name, share: 1, isNew: true, vertical: o.vertical, location: o.location, serviceType: o.serviceType, bu: o.bu, costRatio: defaults.costRatio });
    const p0 = o.probability / 100;
    const p = ov.probability != null && ov.probability !== "" ? pct(ov.probability) : p0;
    const headcount = Math.max(0, Math.round(num(ov.headcount, o.headcount)));
    const ramp = Math.max(0, num(ov.rampMonths, 0));
    let start = maxDate(ov.startDate || o.expectedStart, addDays(q.asOf, 7));
    if (existing) start = addDays(start, delayDays(o.clientId));
    const lost = existing ? lossDate(o.clientId) : null;
    if (lost && lost <= start) continue;
    const hpw = num(o.hoursPerWeek, 40);
    const base = {
      clientId: o.clientId,
      share: existing ? existing.share : 1,
      hoursPerWeek: hpw * (existing ? hoursFactor(o.clientId) : 1),
      otShare: hpw > 40 ? (hpw - 40) / hpw : 0,
      bill: num(ov.billRate, o.billRate),
      pay: o.payRate == null ? null : num(ov.payRate, o.payRate),
      burdenRate: (defaults.burdenRate ?? 0) + adds.burdenPp,
      benefitsPerHour: adds.benefitsPerHour,
      odcPerMonth: num(defaults.odcPerContractorMonth, 0) + adds.odc,
      costRatio: (existing && existing.costRatio) ?? defaults.costRatio,
    };
    // Ramp: contractors start evenly spaced over the ramp period.
    for (let i = 0; i < headcount; i++) {
      const s = addDays(start, headcount > 1 ? Math.round((i * ramp * 30) / headcount) : 0);
      if (s > qEnd) continue;
      const end = minDate(addDays(s, o.durationMonths * 30 - 1), lost ? addDays(lost, -1) : qEnd);
      const pBase = Math.min(p, p0);
      const pUp = Math.max(0, p - p0);
      spread(key, "probable", { ...base, weight: pBase }, s, minDate(end, qEnd));
      spread(key, "upside", { ...base, weight: pUp }, s, minDate(end, qEnd));
      event(toYm(s), key, "probable", "starts", pBase);
      event(toYm(s), key, "upside", "starts", pUp);
      activity.starts += p;
      if (end < qEnd) activity.ends += p;
      else activity.activeAtEnd += p;
    }
  }

  // Actuals to date.
  for (const r of baseline.actuals) {
    meta.set(r.clientId, clientById.get(r.clientId));
    put(r.ym, r.clientId, "actual", { revenue: r.revenue, gp: r.gp, directCost: r.directCost, wages: r.wages || 0, burden: r.burden || 0, odc: r.odc || 0, hours: r.hours || 0 });
  }

  return summarize(baseline, a, cells, meta, activity);
}

function summarize(baseline, a, cells, meta, activity) {
  const q = baseline.quarter;
  const byMonth = new Map(q.months.map((m) => [m, { actual: zero(), modeled: zero(), byConf: Object.fromEntries(CONFIDENCE.map((c) => [c, zero()])) }]));
  const byClient = new Map();
  const byConf = Object.fromEntries(CONFIDENCE.map((c) => [c, zero()]));
  const rows = [];
  for (const [k, t] of cells) {
    const [ym, key, conf] = k.split("|");
    const m = byMonth.get(ym);
    if (!m) continue;
    addInto(conf === "actual" ? m.actual : m.modeled, t);
    addInto(m.byConf[conf], t);
    addInto(byConf[conf], t);
    if (!byClient.has(key)) byClient.set(key, { key, ...describe(meta.get(key), key), actual: zero(), modeled: zero(), byConf: Object.fromEntries(CONFIDENCE.map((c) => [c, zero()])) });
    const c = byClient.get(key);
    addInto(conf === "actual" ? c.actual : c.modeled, t);
    addInto(c.byConf[conf], t);
    rows.push({ ym, key, conf, ...t });
  }

  const actual = zero();
  const modeled = zero();
  for (const m of byMonth.values()) {
    addInto(actual, m.actual);
    addInto(modeled, m.modeled);
  }
  const quarter = addInto(addInto(zero(), actual), modeled);

  // Recruiting expense and contribution (contribution is GP less recruiting expense, never relabelled as GP).
  const commission = baseline.commission
    ? (() => {
        const plan = baseline.commission;
        const total = planCommission(quarter.gp, baseline.target.gp, plan);
        return { earnedToDate: plan.earnedToDate, approvedToDate: plan.approvedToDate, quarterTotal: total, projectedRemaining: Math.max(0, total - plan.earnedToDate), baseRate: plan.baseRate, accelRate: plan.accelRate };
      })()
    : null;
  const ex = baseline.expenses;
  const remainingExp = (key, fallback) => num(a.expenses?.[key], fallback);
  const expenses =
    ex && ex.toDate.travel != null
      ? {
          travel: ex.toDate.travel + remainingExp("travel", ex.remainingDefaults.travel),
          entertainment: ex.toDate.entertainment + remainingExp("entertainment", ex.remainingDefaults.entertainment),
          acquisition: ex.toDate.acquisition + remainingExp("acquisition", 0),
          salary: ex.toDate.salary + ex.remainingDefaults.salary,
        }
      : null;
  const salesExpense = expenses && commission ? commission.quarterTotal + expenses.travel + expenses.entertainment + expenses.acquisition + expenses.salary : null;

  return {
    quarter: { ...quarter, gmPct: gmPct(quarter.gp, quarter.revenue) },
    actual,
    modeled,
    months: q.months.map((ym) => {
      const m = byMonth.get(ym);
      const total = addInto(addInto(zero(), m.actual), m.modeled);
      return { ym, actual: m.actual, modeled: m.modeled, total: { ...total, gmPct: gmPct(total.gp, total.revenue) }, byConf: m.byConf };
    }),
    clients: [...byClient.values()].map((c) => {
      const total = addInto(addInto(zero(), c.actual), c.modeled);
      return { ...c, total: { ...total, gmPct: gmPct(total.gp, total.revenue) } };
    }),
    confidence: byConf,
    rows,
    activity: {
      activeAtEnd: activity.activeAtEnd,
      starts: baseline.activityToDate.starts + activity.starts,
      ends: baseline.activityToDate.ends + activity.ends,
      hours: quarter.hours,
    },
    attainment: {
      revenue: baseline.target.revenue ? (quarter.revenue / baseline.target.revenue) * 100 : null,
      gp: baseline.target.gp ? (quarter.gp / baseline.target.gp) * 100 : null,
      revenueGap: baseline.target.revenue - quarter.revenue,
      gpGap: baseline.target.gp - quarter.gp,
    },
    commission,
    expenses,
    salesExpense,
    contribution: salesExpense == null ? null : quarter.gp - salesExpense,
  };
}

const describe = (c, key) => ({
  clientId: c?.id || null,
  client: c?.name || key,
  isNew: !!c?.isNew,
  vertical: c?.vertical || null,
  location: c?.location || null,
  serviceType: c?.serviceType || null,
  bu: c?.bu || null,
});

/** GP bridge from the baseline to the scenario, one assumption group at a time. */
export function scenarioBridge(baseline, assumptions) {
  const enabled = new Set();
  let prev = simulate(baseline, assumptions, { groups: enabled }).quarter;
  const start = prev;
  const steps = [];
  for (const grp of ASSUMPTION_GROUPS) {
    enabled.add(grp.id);
    const cur = simulate(baseline, assumptions, { groups: new Set(enabled) }).quarter;
    steps.push({ key: grp.id, label: grp.label, amount: cur.gp - prev.gp, revenue: cur.revenue - prev.revenue });
    prev = cur;
  }
  return { start, end: prev, steps };
}

/** How many assumptions differ from the baseline (for the "changed" badge). */
export function countChanges(a) {
  if (!a) return 0;
  const g = a.global || {};
  let n = 0;
  for (const [k, v] of Object.entries(g)) if (v != null && v !== "" && v !== 0 && k !== "rateEffectiveYm") n++;
  for (const o of Object.values(a.assignments || {})) n += Object.values(o).filter((v) => v != null && v !== "").length;
  for (const o of Object.values(a.clients || {})) n += Object.values(o).filter((v) => v != null && v !== "" && v !== false && v !== 0).length;
  for (const o of Object.values(a.opportunities || {})) n += Object.values(o).filter((v) => v != null && v !== "").length;
  n += (a.newStarts || []).length;
  n += Object.values(a.expenses || {}).filter((v) => v != null && v !== "").length;
  return n;
}

/**
 * Month × client rows for a forecast submission or a Forecasting transfer:
 * the fields the spec's handoff requires (staffing drivers, rates, costs,
 * Revenue, GP, GM%, confidence).
 */
export function forecastRows(baseline, result) {
  const out = new Map();
  for (const r of result.rows) {
    const k = `${r.ym}|${r.key}`;
    if (!out.has(k)) {
      const c = result.clients.find((x) => x.key === r.key) || {};
      out.set(k, {
        ym: r.ym,
        clientKey: r.key,
        clientId: c.clientId,
        client: c.client,
        business: c.isNew ? "new" : "existing",
        bu: c.bu,
        vertical: c.vertical,
        location: c.location,
        serviceType: c.serviceType,
        totals: zero(),
        confidence: Object.fromEntries(CONFIDENCE.map((x) => [x, { revenue: 0, gp: 0 }])),
      });
    }
    const row = out.get(k);
    addInto(row.totals, r);
    row.confidence[r.conf].revenue += r.revenue;
    row.confidence[r.conf].gp += r.gp;
  }
  return [...out.values()].map(({ totals: t, ...r }) => ({
    ...r,
    ...t,
    gmPct: gmPct(t.gp, t.revenue),
    billRate: t.hours ? t.revenue / t.hours : null,
    payRate: t.wages && t.hours ? t.wages / (t.hours * PAID_HOURS_FACTOR) : null,
  }));
}
