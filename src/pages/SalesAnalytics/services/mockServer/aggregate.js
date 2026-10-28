// Aggregations over the sample dataset for one query context. Money and
// hours are credited by owner share (so team and company totals never double
// count shared clients); people and client counts are distinct counts.

import { addDays, daysInMonth, monthEnd, monthStart, toYm } from "../../calc/dates";

export const emptyTotals = () => ({
  revenue: 0, gp: 0, directCost: 0, wages: 0, burden: 0, fica: 0, futa: 0, suta: 0, wc: 0, benefits: 0,
  odc: 0, vmsFee: 0, fees: 0, timeRevenue: 0, billedHours: 0, paidHours: 0, otHours: 0, N: 0,
});

export function addFact(t, f, w) {
  t.revenue += f.revenue * w;
  t.gp += f.gp * w;
  t.directCost += f.directCost * w;
  if (f.kind === "time") {
    t.timeRevenue += f.revenue * w;
    t.wages += f.wages * w;
    t.burden += f.burden * w;
    t.fica += f.fica * w;
    t.futa += f.futa * w;
    t.suta += f.suta * w;
    t.wc += f.wc * w;
    t.benefits += f.benefits * w;
    t.odc += f.odc * w;
    t.vmsFee += (f.vmsFee || 0) * w;
    t.billedHours += f.billedHours * w;
    t.paidHours += f.paidHours * w;
    t.otHours += f.otHours * w;
    t.N += f.af * w;
  } else {
    t.fees += f.revenue * w;
  }
  return t;
}

const addTo = (map, key, f, w) => {
  let t = map.get(key);
  if (!t) {
    t = emptyTotals();
    map.set(key, t);
  }
  addFact(t, f, w);
};

/** Totals over a window, or a Map of totals when `keyOf(fact)` is given. */
export function sumFacts(ctx, window, keyOf = null) {
  const total = emptyTotals();
  const map = new Map();
  for (const { ym, scale } of window) {
    for (const f of ctx.index.factsByYm.get(ym) || []) {
      if (!ctx.factPass(f)) continue;
      const w = ctx.credit.get(f.clientId) * scale;
      if (keyOf) {
        const k = keyOf(f);
        if (k != null) addTo(map, k, f, w);
      } else addFact(total, f, w);
    }
  }
  return keyOf ? map : total;
}

/** Totals per rep in view, each credited with its own owner share. */
export function sumFactsByRep(ctx, window) {
  const map = new Map();
  for (const { ym, scale } of window) {
    for (const f of ctx.index.factsByYm.get(ym) || []) {
      if (!ctx.factPass(f)) continue;
      for (const o of ctx.index.clientById.get(f.clientId).owners) {
        if (ctx.repSet.has(o.repId)) addTo(map, o.repId, f, o.share * scale);
      }
    }
  }
  return map;
}

/** Credited GP per rep with and without the client-attribute filters. */
function repGp(ctx, window, useFilters) {
  const map = new Map();
  for (const { ym, scale } of window) {
    for (const f of ctx.index.factsByYm.get(ym) || []) {
      if (useFilters ? !ctx.factPass(f) : !ctx.creditAll.has(f.clientId)) continue;
      for (const o of ctx.index.clientById.get(f.clientId).owners) {
        if (ctx.repSet.has(o.repId)) map.set(o.repId, (map.get(o.repId) || 0) + f.gp * o.share * scale);
      }
    }
  }
  return map;
}

/**
 * With client filters active, a rep's sales expense is allocated to the
 * filtered clients in proportion to the GP they produced (disclosed in the
 * footer). Without client filters every rep's expense counts in full.
 */
export function expenseAllocation(ctx, window) {
  if (!ctx.sliceActive) return null;
  const filtered = repGp(ctx, window, true);
  const all = repGp(ctx, window, false);
  const factors = new Map();
  for (const repId of ctx.repSet) {
    const a = all.get(repId) || 0;
    factors.set(repId, a > 0 ? Math.max(0, Math.min(1, (filtered.get(repId) || 0) / a)) : 0);
  }
  return factors;
}

export const EXPENSE_KEYS = ["commission", "travel", "entertainment", "acquisition", "salary"];
const emptyExpenses = () => ({ commission: 0, commissionApproved: 0, commissionAccrued: 0, travel: 0, entertainment: 0, acquisition: 0, salary: 0, total: 0 });

/** Sales expense totals (or per key) over a window, allocated when sliced. */
export function sumExpenses(ctx, window, keyOf = null, allocation = expenseAllocation(ctx, window)) {
  const total = emptyExpenses();
  const map = new Map();
  for (const { ym, scale } of window) {
    for (const e of ctx.index.expensesByYm.get(ym) || []) {
      if (!ctx.expensePass(e)) continue;
      const factor = allocation ? allocation.get(e.repId) || 0 : 1;
      const amount = e.amount * scale * factor;
      if (!amount) continue;
      let t = total;
      if (keyOf) {
        const k = keyOf(e);
        if (k == null) continue;
        t = map.get(k);
        if (!t) {
          t = emptyExpenses();
          map.set(k, t);
        }
      }
      t[e.category] += amount;
      if (e.category === "commission") t[e.status === "approved" ? "commissionApproved" : "commissionAccrued"] += amount;
      t.total += amount;
    }
  }
  return keyOf ? map : total;
}

/** Expense rows (transactions) behind a drill, allocated like the totals. */
export function expenseRows(ctx, window, predicate = () => true) {
  const allocation = expenseAllocation(ctx, window);
  const rows = [];
  for (const { ym, scale } of window) {
    for (const e of ctx.index.expensesByYm.get(ym) || []) {
      if (!ctx.expensePass(e) || !predicate(e)) continue;
      const factor = allocation ? allocation.get(e.repId) || 0 : 1;
      if (!factor) continue;
      rows.push({ ...e, amount: e.amount * scale * factor });
    }
  }
  return rows;
}

const PLAN_DRIVER_KEYS = ["N", "H", "R", "W", "burden", "odc", "fees"];
const emptyPlan = () => ({ revenue: 0, gp: 0, N: 0, H: 0, R: 0, W: 0, burden: 0, odc: 0, fees: 0 });

const addPlan = (t, p, basis, w) => {
  const b = p[basis];
  t.revenue += b.revenue * w;
  t.gp += b.gp * w;
  if (b.N != null) for (const k of PLAN_DRIVER_KEYS) t[k] += b[k] * w;
};

/** Plan totals for a basis (budget / target / board / forecast) over a window. */
export function sumPlans(ctx, window, basis, keyOf = null) {
  const total = emptyPlan();
  const map = new Map();
  for (const { ym, scale } of window) {
    for (const p of ctx.index.plansByYm.get(ym) || []) {
      const w = ctx.planWeight(p) * scale;
      if (!w) continue;
      if (keyOf) {
        const k = keyOf(p);
        if (k == null) continue;
        let t = map.get(k);
        if (!t) {
          t = emptyPlan();
          map.set(k, t);
        }
        addPlan(t, p, basis, w);
      } else addPlan(total, p, basis, w);
    }
  }
  return keyOf ? map : total;
}

/** Plan totals per rep in view (client rows by owner share; new-business rows by rep). */
export function sumPlansByRep(ctx, window, basis) {
  const map = new Map();
  const add = (repId, p, w) => {
    let t = map.get(repId);
    if (!t) {
      t = emptyPlan();
      map.set(repId, t);
    }
    addPlan(t, p, basis, w);
  };
  for (const { ym, scale } of window) {
    for (const p of ctx.index.plansByYm.get(ym) || []) {
      if (!ctx.planWeight(p)) continue;
      if (p.clientId) {
        for (const o of ctx.index.clientById.get(p.clientId).owners) if (ctx.repSet.has(o.repId)) add(o.repId, p, o.share * scale);
      } else add(p.repId, p, scale);
    }
  }
  return map;
}

/** Distinct contractors on assignment on a date (period end). */
export function activeContractorsOn(ctx, date, keyOf = null) {
  const set = new Set();
  const map = new Map();
  for (const a of ctx.ds.assignments) {
    if (a.startDate > date || (a.actualEndDate && a.actualEndDate < date) || !ctx.assignmentPass(a)) continue;
    if (keyOf) {
      const k = keyOf(a);
      if (!map.has(k)) map.set(k, new Set());
      map.get(k).add(a.contractorId);
    } else set.add(a.contractorId);
  }
  return keyOf ? map : set;
}

/** Average active contractors over a window: Σ active-month fractions ÷ Σ elapsed fractions. */
export function averageActive(ctx, window, keyOf = null) {
  let days = 0;
  const totals = new Map();
  for (const { ym, scale, fraction } of window) {
    days += fraction;
    for (const f of ctx.index.factsByYm.get(ym) || []) {
      if (f.kind !== "time" || !ctx.factPass(f)) continue;
      const k = keyOf ? keyOf(f) : "_";
      if (k == null) continue;
      totals.set(k, (totals.get(k) || 0) + f.af * scale);
    }
  }
  if (!keyOf) return days ? (totals.get("_") || 0) / days : 0;
  return new Map([...totals].map(([k, v]) => [k, days ? v / days : 0]));
}

/** Starts and ends of assignments between two dates (inclusive). */
export function movements(ctx, fromDate, toDate, keyOf = null) {
  const out = new Map();
  const bucket = (k) => {
    if (!out.has(k)) out.set(k, { starts: 0, ends: 0, conversions: 0, earlyEnds: 0, plannedEnds: 0, redeployed: 0 });
    return out.get(k);
  };
  for (const a of ctx.ds.assignments) {
    if (!ctx.credit.has(a.clientId) || !(!ctx.filters.placementType.length || ctx.filters.placementType.includes(a.placementType))) continue;
    const k = keyOf ? keyOf(a) : "_";
    if (a.startDate >= fromDate && a.startDate <= toDate) {
      const b = bucket(k);
      b.starts += 1;
      if (a.redeployedFrom) b.redeployed += 1;
    }
    if (a.actualEndDate && a.actualEndDate >= fromDate && a.actualEndDate <= toDate) {
      const b = bucket(k);
      b.ends += 1;
      if (a.endReason === "converted") b.conversions += 1;
      else if (a.endReason === "planned") b.plannedEnds += 1;
      else b.earlyEnds += 1;
    }
  }
  return keyOf ? out : out.get("_") || bucket("_");
}

/**
 * First and last date covered by a window. A part-month window (the as-of
 * month, or a comparison mapped onto it) ends the same number of days in.
 */
export const windowDates = (window, asOf) => {
  if (!window.length) return { from: asOf, to: asOf };
  const last = window[window.length - 1];
  const to = last.ym === toYm(asOf)
    ? asOf
    : last.fraction < 1
      ? addDays(monthStart(last.ym), Math.max(0, Math.round(last.fraction * daysInMonth(last.ym)) - 1))
      : monthEnd(last.ym);
  return { from: monthStart(window[0].ym), to };
};
