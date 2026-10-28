import {
  addDays,
  addMonths,
  dayDiff,
  dayOf,
  daysInMonth,
  isoDate,
  maxDate,
  minDate,
  monthDiff,
  monthEnd,
  monthRange,
  monthStart,
  parseYm,
  toYm,
} from "../../calc/dates";
import { burdenFor, timeRevenue } from "../../calc/economics";
import { FIRST_NAMES, LAST_NAMES, TITLES_BY_VERTICAL } from "../seedLists";

const round2 = (v) => Math.round(v * 100) / 100;
const roundQuarter = (v) => Math.round(v * 4) / 4;

const EXTENSION_PROBABILITY = 0.55;
const EARLY_END_MONTHLY = 0.018;
const REDEPLOY_SHARE = 0.3;
const C2H_CONVERSION_PROBABILITY = 0.6;

/** Friday on or after a date: when the first timesheet is billed. */
const firstFriday = (date) => {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun … 5 Fri
  return addDays(date, (5 - dow + 7) % 7);
};

/**
 * Month-by-month staffing simulation from Jan 2024 to the as-of date. Each
 * client's demand (base size × trend × season, ramping for new logos, plus won
 * expansion deals) drives starts; assignments end at their planned end unless
 * extended, early, on conversion, on contraction or when the client churns.
 */
export function generateWorkforce(rng, { org, clients, opportunities, startYm, asOf }) {
  const asOfYm = toYm(asOf);
  const asOfDay = dayOf(asOf);
  const months = monthRange(startYm, asOfYm);
  const verticalById = new Map(org.verticals.map((v) => [v.id, v]));
  const branchById = new Map(org.branches.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const contractors = [];
  const contractorById = new Map();
  const assignments = [];
  const requisitions = [];
  const activeByClient = new Map(clients.map((c) => [c.id, []]));
  const activeContractors = new Set();
  const pool = new Map(org.branches.map((b) => [b.id, []])); // recently ended, by branch

  const boosts = new Map(clients.map((c) => [c.id, []]));
  for (const o of opportunities) {
    if (o.type === "expansion" && o.status === "won" && o.clientId) {
      boosts.get(o.clientId).push({ from: toYm(o.expectedStart), to: addMonths(toYm(o.expectedStart), o.durationMonths), add: o.headcount * 0.7 });
    }
  }

  const newContractor = (client) => {
    const id = `C-${String(contractors.length + 1).padStart(4, "0")}`;
    const vertical = verticalById.get(client.verticalId);
    const c = {
      id,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      title: rng.pick(TITLES_BY_VERTICAL[vertical.id]),
      branchId: client.branchId,
      benefitsEligible: rng.chance(0.55),
      benefitsPerHour: round2(rng.float(1.5, 3.5)),
      travel: vertical.id === "HC" && rng.chance(0.2),
    };
    contractors.push(c);
    contractorById.set(id, c);
    return c;
  };

  const ratesFor = (client) => {
    const v = verticalById.get(client.verticalId);
    const pay = round2(rng.float(v.pay[0], v.pay[1]));
    const markup = rng.float(v.markup[0], v.markup[1]) - (client.isMsp ? 0.05 : 0);
    return { pay, bill: roundQuarter(pay * markup) };
  };

  const weeklyHoursFor = (client) => {
    const [lo, hi] = verticalById.get(client.verticalId).weeklyHours;
    if (client.verticalId === "LI") return rng.chance(0.4) ? rng.int(42, hi) : 40;
    return Math.round(rng.float(lo, hi) * 2) / 2;
  };

  const demand = (c, m) => {
    const acquiredYm = toYm(c.acquiredDate);
    if (m < acquiredYm) return 0;
    if (c.churnDate && m >= toYm(c.churnDate)) return 0;
    const t = monthDiff(startYm, m);
    let d = c.baseHeadcount * (1 + c.trendRate) ** t;
    if (c.isNewLogo) d *= Math.min(1, 0.35 + 0.22 * monthDiff(acquiredYm, m));
    const { m: month } = parseYm(m);
    if (c.verticalId === "LI" && month >= 10) d *= 1.2;
    if (c.verticalId === "LI" && month === 1) d *= 0.9;
    if (month === 12) d *= 0.93;
    for (const b of boosts.get(c.id)) if (m >= b.from && m < b.to) d += b.add;
    d *= 1 + rng.float(-0.07, 0.07);
    return Math.max(0, Math.round(d));
  };

  const endAssignment = (a, date, reason) => {
    a.actualEndDate = date;
    a.endReason = reason;
    const list = activeByClient.get(a.clientId);
    list.splice(list.indexOf(a), 1);
    activeContractors.delete(a.contractorId);
    pool.get(clientById.get(a.clientId).branchId).push({ contractorId: a.contractorId, endDate: date, assignmentId: a.id });
  };

  const startAssignment = (client, startDate, { backdated = false } = {}) => {
    const startYmS = toYm(startDate);
    // Redeploy someone who finished in the last 30 days at the same branch.
    let contractor = null;
    let redeployedFrom = null;
    if (!backdated && rng.chance(REDEPLOY_SHARE)) {
      const candidates = pool.get(client.branchId);
      const earliest = addDays(startDate, -30);
      const idx = candidates.findIndex(
        (p) => p.endDate <= startDate && p.endDate >= earliest && !activeContractors.has(p.contractorId)
      );
      if (idx >= 0) {
        const p = candidates.splice(idx, 1)[0];
        contractor = contractorById.get(p.contractorId);
        redeployedFrom = p.assignmentId;
      }
    }
    if (!contractor) contractor = newContractor(client);

    const c2hShare = client.serviceLineId === "PERM" ? 0.4 : client.verticalId === "LI" ? 0.15 : 0.25;
    const placementType = rng.chance(c2hShare) ? "c2h" : "contract";
    const durationMonths = placementType === "c2h" ? 6 : rng.int(3, 12);
    const { pay, bill } = ratesFor(client);
    const lag = rng.int(3, 14);
    const fillDays = rng.int(5, 25);
    const reqId = `RQ-${String(requisitions.length + 1).padStart(4, "0")}`;
    requisitions.push({
      id: reqId,
      clientId: client.id,
      openedDate: addDays(startDate, -(lag + fillDays)),
      filledDate: addDays(startDate, -lag),
      status: "filled",
      positions: 1,
    });

    const a = {
      id: `A-${String(assignments.length + 1).padStart(5, "0")}`,
      clientId: client.id,
      contractorId: contractor.id,
      requisitionId: reqId,
      placementType,
      startDate,
      firstBilledDate: firstFriday(startDate),
      plannedEndDate: addDays(startDate, durationMonths * 30),
      originalPlannedEndDate: addDays(startDate, durationMonths * 30),
      actualEndDate: null,
      endReason: null,
      extensions: 0,
      conversionYm: placementType === "c2h" ? addMonths(startYmS, rng.int(3, 6)) : null,
      weeklyHours: weeklyHoursFor(client),
      rateHistory: [{ fromYm: startYmS, billRate: bill, payRate: pay }],
      redeployedFrom,
    };
    assignments.push(a);
    activeByClient.get(client.id).push(a);
    activeContractors.add(contractor.id);
    return a;
  };

  // Clients already active before the window start with backdated assignments.
  for (const c of clients) {
    if (c.acquiredDate >= monthStart(startYm)) continue;
    const n = Math.max(1, Math.round(c.baseHeadcount * rng.float(0.85, 1.1)));
    for (let i = 0; i < n; i++) {
      const start = isoDate(addMonths(startYm, -rng.int(1, 11)), rng.int(1, 28));
      const a = startAssignment(c, start, { backdated: true });
      if (a.plannedEndDate < monthStart(startYm)) a.plannedEndDate = addDays(monthStart(startYm), rng.int(10, 200));
      if (a.conversionYm && a.conversionYm < startYm) a.conversionYm = addMonths(startYm, rng.int(0, 2));
    }
  }

  const mspClients = clients.filter((c) => c.isMsp);
  const renegotiated = new Set(rng.shuffle(mspClients).slice(0, 3).map((c) => c.id));

  for (const m of months) {
    const lastDay = m === asOfYm ? asOfDay : daysInMonth(m);
    const dayIn = (lo = 1, hi = 28) => isoDate(m, Math.min(lastDay, rng.int(lo, Math.min(hi, lastDay))));
    const { m: month } = parseYm(m);
    // Only people who finished in the last month can still be redeployed.
    const stale = addDays(monthStart(m), -31);
    for (const [branchId, list] of pool) pool.set(branchId, list.filter((p) => p.endDate >= stale));

    for (const c of clients) {
      const active = activeByClient.get(c.id);

      // January merit increases; MSP clients pass little of it on to bill rates.
      if (month === 1) {
        for (const a of active) {
          if (a.startDate >= monthStart(addMonths(m, -3))) continue;
          const last = a.rateHistory[a.rateHistory.length - 1];
          a.rateHistory.push({
            fromYm: m,
            payRate: round2(last.payRate * rng.float(1.02, 1.04)),
            billRate: roundQuarter(last.billRate * (c.isMsp ? rng.float(1.0, 1.015) : rng.float(1.02, 1.045))),
          });
        }
      }
      // Mid-2026 MSP rate renegotiation squeezes bill rates on three accounts.
      if (m === "2026-07" && renegotiated.has(c.id)) {
        for (const a of active) {
          const last = a.rateHistory[a.rateHistory.length - 1];
          a.rateHistory.push({ fromYm: m, payRate: last.payRate, billRate: roundQuarter(last.billRate * 0.97) });
        }
      }

      if (c.churnDate && toYm(c.churnDate) === m) {
        for (const a of [...active]) endAssignment(a, minDate(c.churnDate, asOf), "client_lost");
        continue;
      }

      for (const a of [...active]) {
        const plannedYm = toYm(a.plannedEndDate);
        if (a.conversionYm === m && rng.chance(C2H_CONVERSION_PROBABILITY)) {
          const d = dayIn(5, 25);
          if (d > a.startDate) endAssignment(a, d, "converted");
        } else if (plannedYm === m) {
          if (rng.chance(EXTENSION_PROBABILITY)) {
            a.plannedEndDate = addDays(a.plannedEndDate, rng.int(90, 180));
            a.extensions += 1;
          } else if (a.plannedEndDate <= (m === asOfYm ? asOf : monthEnd(m))) {
            endAssignment(a, a.plannedEndDate, "planned");
          }
        } else if (plannedYm < m) {
          endAssignment(a, maxDate(monthStart(m), a.startDate), "planned");
        } else if (rng.chance(EARLY_END_MONTHLY)) {
          const d = dayIn();
          if (d > a.startDate) endAssignment(a, d, rng.weighted([["contractor_quit", 50], ["client_ended", 35], ["performance", 15]]));
        }
      }

      const target = demand(c, m);
      if (active.length > target + 1) {
        const extra = rng.shuffle(active).slice(0, active.length - target);
        for (const a of extra) {
          const d = dayIn();
          if (d > a.startDate) endAssignment(a, d, "client_reduced");
        }
      }
      const need = Math.min(target - active.length, 3 + Math.floor(c.baseHeadcount / 4));
      for (let i = 0; i < need; i++) {
        const start = dayIn();
        if (c.acquiredDate > start) continue;
        startAssignment(c, start);
        // Some requisitions never fill.
        if (rng.chance(0.2)) {
          const opened = addDays(start, -rng.int(10, 40));
          requisitions.push({
            id: `RQ-${String(requisitions.length + 1).padStart(4, "0")}`,
            clientId: c.id,
            openedDate: opened,
            filledDate: null,
            status: rng.chance(0.5) ? "cancelled" : addDays(opened, 45) > asOf ? "open" : "cancelled",
            positions: 1,
          });
        }
      }
    }
  }

  const facts = buildTimeFacts(rng, { assignments, clients, contractors, verticalById, branchById, startYm, asOf });
  const placements = buildPlacements(rng, { clients, verticalById, months, asOf });
  return { contractors, assignments, requisitions, placements, facts: [...facts, ...placementFacts(placements)] };
}

function rateAt(a, m) {
  let r = a.rateHistory[0];
  for (const h of a.rateHistory) if (h.fromYm <= m) r = h;
  return r;
}

function buildTimeFacts(rng, { assignments, clients, contractors, verticalById, branchById, startYm, asOf }) {
  const asOfYm = toYm(asOf);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const contractorById = new Map(contractors.map((c) => [c.id, c]));
  const rows = [];

  for (const a of assignments) {
    const client = clientById.get(a.clientId);
    const vertical = verticalById.get(client.verticalId);
    const contractor = contractorById.get(a.contractorId);
    const endDate = a.actualEndDate || asOf;
    const first = maxDate(toYm(a.startDate), startYm);
    const last = minDate(toYm(endDate), asOfYm);
    for (const m of monthRange(first, last)) {
      const from = maxDate(a.startDate, monthStart(m));
      const to = minDate(minDate(endDate, monthEnd(m)), asOf);
      const days = dayDiff(from, to) + 1;
      if (days <= 0) continue;
      const af = days / daysInMonth(m);
      const billedHours = round2(a.weeklyHours * (days / 7) * rng.float(0.93, 1));
      const otHours = a.weeklyHours > 40 ? round2(billedHours * ((a.weeklyHours - 40) / a.weeklyHours)) : 0;
      const { billRate, payRate } = rateAt(a, m);
      const revenue = round2(timeRevenue(billedHours, otHours, billRate));
      const paidHours = round2(billedHours * rng.float(1, 1.02));
      const paidOt = billedHours ? otHours * (paidHours / billedHours) : 0;
      const wages = round2((paidHours - paidOt) * payRate + paidOt * payRate * 1.5);
      const startMonth = toYm(a.startDate) === m;
      const odc = round2(
        (startMonth && !a.redeployedFrom ? 85 : 0) + // background & drug screen
          (client.isMsp ? revenue * 0.025 : 0) + // VMS fee
          (contractor.travel ? 420 * af : 0) + // per diem
          (startMonth && vertical.id === "IT" ? 150 : 0) // equipment
      );
      rows.push({
        kind: "time",
        ym: m,
        assignmentId: a.id,
        clientId: a.clientId,
        contractorId: a.contractorId,
        placementType: a.placementType,
        af,
        billedHours,
        otHours,
        paidHours,
        billRate,
        payRate,
        revenue,
        wages,
        odc,
        vmsFee: client.isMsp ? round2(revenue * 0.025) : 0,
      });
    }
  }

  // Burden in pay order per contractor, so FUTA/SUTA caps follow real YTD wages.
  rows.sort((x, y) => (x.contractorId === y.contractorId ? (x.ym < y.ym ? -1 : x.ym > y.ym ? 1 : 0) : x.contractorId < y.contractorId ? -1 : 1));
  let current = null;
  let year = null;
  let ytd = 0;
  for (const r of rows) {
    const y = r.ym.slice(0, 4);
    if (r.contractorId !== current || y !== year) {
      current = r.contractorId;
      year = y;
      ytd = 0;
    }
    const contractor = contractorById.get(r.contractorId);
    const branch = branchById.get(contractor.branchId);
    const vertical = verticalById.get(clientById.get(r.clientId).verticalId);
    const b = burdenFor({
      ytdWagesBefore: ytd,
      wages: r.wages,
      sutaRate: branch.sutaRate,
      sutaWageBase: branch.sutaWageBase,
      wcRate: vertical.wcRate,
      paidHours: r.paidHours,
      benefitsPerHour: contractor.benefitsEligible ? contractor.benefitsPerHour : 0,
    });
    ytd += r.wages;
    r.fica = round2(b.fica);
    r.futa = round2(b.futa);
    r.suta = round2(b.suta);
    r.wc = round2(b.wc);
    r.benefits = round2(b.benefits);
    r.burden = round2(r.fica + r.futa + r.suta + r.wc + r.benefits);
    r.directCost = round2(r.wages + r.burden + r.odc);
    r.gp = round2(r.revenue - r.directCost);
    r.fees = 0;
  }
  return rows;
}

function buildPlacements(rng, { clients, verticalById, months, asOf }) {
  const asOfYm = toYm(asOf);
  const out = [];
  for (const m of months) {
    const lastDay = m === asOfYm ? dayOf(asOf) : daysInMonth(m);
    for (const c of clients) {
      if (c.acquiredDate > monthEnd(m) || (c.churnDate && c.churnDate <= monthStart(m))) continue;
      if (!rng.chance(c.serviceLineId === "PERM" ? 0.1 : 0.01)) continue;
      const v = verticalById.get(c.verticalId);
      const salary = Math.round(rng.float(v.salary[0], v.salary[1]) / 500) * 500;
      const feePct = round2(rng.float(0.18, 0.25));
      const fee = round2(salary * feePct);
      const falloff = rng.chance(0.06) && addMonths(m, 1) <= asOfYm;
      out.push({
        id: `P-${String(out.length + 1).padStart(4, "0")}`,
        clientId: c.id,
        placementDate: isoDate(m, rng.int(1, lastDay)),
        salary,
        feePct,
        fee,
        refund: falloff ? round2(fee * rng.float(0.5, 1)) : 0,
        refundYm: falloff ? addMonths(m, 1) : null,
      });
    }
  }
  return out;
}

function placementFacts(placements) {
  const rows = [];
  for (const p of placements) {
    rows.push(feeRow(p, toYm(p.placementDate), p.fee, "placement"));
    if (p.refund) rows.push(feeRow(p, p.refundYm, -p.refund, "refund"));
  }
  return rows;
}

const feeRow = (p, ym, amount, kind) => ({
  kind,
  ym,
  placementId: p.id,
  clientId: p.clientId,
  placementType: "direct",
  revenue: amount,
  fees: amount,
  gp: amount,
  directCost: 0,
  wages: 0,
  burden: 0,
  fica: 0,
  futa: 0,
  suta: 0,
  wc: 0,
  benefits: 0,
  odc: 0,
  billedHours: 0,
  paidHours: 0,
  af: 0,
});
