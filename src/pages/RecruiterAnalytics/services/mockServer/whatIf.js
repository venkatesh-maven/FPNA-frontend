// Baseline for the What-If workspace: one recruiter's current quarter —
// actual to date plus every active assignment's recent run-rate, open job
// orders, target, commission plan and recruiting expense. Field names follow
// the capability masks (payRate, burdenRate, wages, burden, commission,
// travel…), so viewers without cost or commission access get those values
// empty and the engine falls back to client cost ratios.

import { resolvePeriod } from "../../calc/periods";
import { addDays, addMonths, dayDiff, daysInMonth, maxDate, minDate, monthEnd, monthStart, toYm } from "../../calc/dates";
import { FISCAL_START_MONTH, SOURCES } from "../../config/dataset";
import { movements, sumExpenses, sumFacts, sumPlans } from "./aggregate";
import { elapsedWindow } from "./common";

const fullMonths = (months) => months.map((ym) => ({ ym, scale: 1, fraction: 1 }));
const DEFAULT_UTILIZATION = 0.965;

let historicalExtension = null;
/** Share of assignments that reached their original planned end and were extended (company-wide). */
function historicalExtensionRate(ds) {
  if (historicalExtension == null) {
    const reached = ds.assignments.filter((a) => a.originalPlannedEndDate <= ds.meta.asOf);
    historicalExtension = reached.length ? reached.filter((a) => a.extensions > 0).length / reached.length : 0.5;
  }
  return historicalExtension;
}

export const quarterOf = (asOf) => resolvePeriod({ preset: "CQ" }, { asOf, fiscalStartMonth: FISCAL_START_MONTH });

export function buildWhatIfBaseline(ctx) {
  const rep = ctx.reps[0];
  if (!rep) return { rep: null };
  const { ds, index } = ctx;
  const asOf = ds.meta.asOf;
  const asOfYm = ds.meta.asOfYm;
  const opts = { asOf, fiscalStartMonth: FISCAL_START_MONTH };
  const cq = resolvePeriod({ preset: "CQ" }, opts);
  const pq = resolvePeriod({ preset: "PQ" }, opts);
  const qFrom = monthStart(cq.from);
  const qTo = monthEnd(cq.to);

  // Recent economics (last three complete months) per assignment, client and for the recruiter.
  const recentMonths = [3, 2, 1].map((i) => addMonths(asOfYm, -i));
  const perAsg = new Map();
  const perClient = new Map();
  const rep0 = { wages: 0, burden: 0, odc: 0, af: 0, revenue: 0, directCost: 0 };
  for (const ym of recentMonths) {
    for (const f of index.factsByYm.get(ym) || []) {
      if (f.kind !== "time" || !ctx.repSet.has(f.recruiterId) || !ctx.credit.has(f.clientId)) continue;
      const asg = index.assignmentById.get(f.assignmentId);
      const startMonth = toYm(asg.startDate) === ym;
      let r = perAsg.get(f.assignmentId);
      if (!r) perAsg.set(f.assignmentId, (r = { billed: 0, weeks: 0, wages: 0, burden: 0, odc: 0, af: 0 }));
      r.billed += f.billedHours;
      r.weeks += (f.af * daysInMonth(ym)) / 7;
      r.wages += f.wages;
      r.burden += f.burden;
      if (!startMonth) {
        r.odc += f.odc;
        r.af += f.af;
        rep0.odc += f.odc;
        rep0.af += f.af;
      }
      let c = perClient.get(f.clientId);
      if (!c) perClient.set(f.clientId, (c = { revenue: 0, directCost: 0 }));
      c.revenue += f.revenue;
      c.directCost += f.directCost;
      rep0.wages += f.wages;
      rep0.burden += f.burden;
      rep0.revenue += f.revenue;
      rep0.directCost += f.directCost;
    }
  }
  const repBurden = rep0.wages ? rep0.burden / rep0.wages : 0.13;
  const repOdc = rep0.af ? rep0.odc / rep0.af : 0;
  const repCostRatio = rep0.revenue ? rep0.directCost / rep0.revenue : 0.78;

  const name = (map, id) => map.get(id)?.name || null;
  const clientInfo = (c) => ({
    id: c.id,
    name: c.name,
    share: 1, // a recruiter's assignments and new starts are wholly theirs
    isMsp: c.isMsp,
    bu: name(index.buById, c.buId),
    vertical: name(index.verticalById, c.verticalId),
    location: name(index.branchById, c.branchId),
    serviceType: name(index.serviceLineById, c.serviceLineId),
    costRatio: perClient.get(c.id)?.revenue ? perClient.get(c.id).directCost / perClient.get(c.id).revenue : repCostRatio,
  });

  const assignments = ds.assignments
    .filter((a) => ctx.assignmentPass(a) && a.startDate <= asOf && (!a.actualEndDate || a.actualEndDate > asOf))
    .map((a) => {
      const r = perAsg.get(a.id);
      const last = a.rateHistory[a.rateHistory.length - 1];
      const contractor = index.contractorById.get(a.contractorId);
      return {
        id: a.id,
        clientId: a.clientId,
        contractor: contractor.name,
        title: contractor.title,
        placementType: a.placementType === "c2h" ? "Contract-to-hire" : "Contract",
        startDate: a.startDate,
        plannedEndDate: maxDate(a.plannedEndDate, addDays(asOf, 1)),
        extensions: a.extensions,
        weeklyHours: a.weeklyHours,
        effWeeklyHours: r && r.weeks ? r.billed / r.weeks : a.weeklyHours * DEFAULT_UTILIZATION,
        otShare: a.weeklyHours > 40 ? (a.weeklyHours - 40) / a.weeklyHours : 0,
        billRate: last.billRate,
        payRate: last.payRate,
        burdenRate: r && r.wages ? r.burden / r.wages : repBurden,
        odcPerMonth: r && r.af ? r.odc / r.af : repOdc,
      };
    })
    .sort((x, y) => x.plannedEndDate.localeCompare(y.plannedEndDate));

  // Actual to date by month and client.
  const actualMap = sumFacts(ctx, elapsedWindow(cq, false), (f) => `${f.ym}|${f.clientId}`);
  const actuals = [...actualMap].map(([k, t]) => {
    const [ym, clientId] = k.split("|");
    return { ym, clientId, revenue: t.revenue, gp: t.gp, directCost: t.directCost, wages: t.wages, burden: t.burden, odc: t.odc, hours: t.billedHours };
  });

  const opportunities = ds.opportunities
    .filter((o) => ctx.oppPass(o) && o.status === "open")
    .map((o) => {
      const client = o.clientId ? index.clientById.get(o.clientId) : null;
      return {
        id: o.id,
        name: o.prospectName,
        clientId: o.clientId,
        type: o.type === "new_logo" ? "New client" : "Existing client",
        stage: o.stage,
        probability: o.probability * 100,
        headcount: o.headcount,
        billRate: o.billRate,
        payRate: o.payRate,
        hoursPerWeek: o.hoursPerWeek,
        expectedStart: o.expectedStart,
        durationMonths: o.durationMonths,
        expectedRevenue: o.expectedRevenue,
        expectedGp: o.expectedGp,
        bu: name(index.buById, o.buId),
        vertical: name(index.verticalById, o.verticalId),
        location: name(index.branchById, o.branchId),
        serviceType: client ? name(index.serviceLineById, client.serviceLineId) : "Assigned on fill",
      };
    })
    .sort((x, y) => y.expectedGp * y.probability - x.expectedGp * x.probability);

  const clientIds = new Set([...assignments.map((a) => a.clientId), ...actuals.map((a) => a.clientId), ...opportunities.map((o) => o.clientId).filter(Boolean)]);
  for (const id of ctx.credit.keys()) {
    const c = index.clientById.get(id);
    if (!c.churnDate || c.churnDate > asOf) clientIds.add(id);
  }
  const clients = [...clientIds].filter((id) => ctx.credit.has(id)).map((id) => clientInfo(index.clientById.get(id))).sort((a, b) => a.name.localeCompare(b.name));

  // Recruiting expense: to date, and run-rate / allowance for the rest of the quarter.
  const elapsed = elapsedWindow(cq, false);
  const exp = sumExpenses(ctx, elapsed);
  const elapsedFraction = cq.elapsed.reduce((s, e) => s + e.fraction, 0);
  const remainingFraction = cq.months.reduce((s, ym) => s + daysIn(addDays(asOf, 1), qTo, ym) / daysInMonth(ym), 0);
  const plan = rep.commissionPlan || { baseRate: 0.08, accelRate: 0.12 };
  const mv = movements(ctx, qFrom, asOf);
  const target = sumPlans(ctx, fullMonths(cq.months), "target");
  const finance = sumPlans(ctx, fullMonths(cq.months), "forecast");
  const prior = sumFacts(ctx, fullMonths(pq.months));

  return {
    rep: {
      id: rep.id,
      name: rep.name,
      title: rep.title,
      teamId: rep.teamId,
      team: name(index.teamById, rep.teamId),
      branch: name(index.branchById, rep.branchId),
    },
    quarter: { key: cq.from, label: cq.label, priorLabel: pq.label, months: cq.months, from: qFrom, to: qTo, asOf },
    target: { revenue: target.revenue, gp: target.gp },
    priorQuarter: { revenue: prior.revenue, gp: prior.gp },
    financeForecast: { revenue: finance.revenue, gp: finance.gp },
    actuals,
    activityToDate: { starts: mv.starts, ends: mv.ends },
    clients,
    assignments,
    opportunities,
    commission: { baseRate: plan.baseRate, accelRate: plan.accelRate, earnedToDate: exp.commission, approvedToDate: exp.commissionApproved },
    expenses: {
      toDate: { travel: exp.travel, entertainment: exp.entertainment, acquisition: exp.acquisition, salary: exp.salary },
      remainingDefaults: {
        travel: rep.travelAllowance * remainingFraction,
        entertainment: rep.entertainmentAllowance * remainingFraction,
        salary: elapsedFraction ? (exp.salary / elapsedFraction) * remainingFraction : 0,
      },
      remainingFraction,
    },
    defaults: {
      extensionProbability: Math.round(historicalExtensionRate(ds) * 100),
      burdenRate: repBurden,
      odcPerContractorMonth: repOdc,
      costRatio: repCostRatio,
    },
  };
}

const daysIn = (from, to, ym) => {
  const a = maxDate(from, monthStart(ym));
  const b = minDate(to, monthEnd(ym));
  return a > b ? 0 : dayDiff(a, b) + 1;
};

export function whatIfBaselineView(ctx) {
  return {
    data: buildWhatIfBaseline(ctx),
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.crm, SOURCES.expenses, SOURCES.commission, SOURCES.plans],
    notes: ["What-If models the recruiter's whole desk for the current quarter; page filters don't apply. Scenarios never change actuals, official forecasts, approved commission or ATS records."],
  };
}
