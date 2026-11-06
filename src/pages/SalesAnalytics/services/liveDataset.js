// Turns the server's dataset (POST /company/staffing-analytics, action "load")
// into the shape every view reads, the same shape as the sample in
// mock/dataset.js. The server sends columns; this expands them into rows.
//
// What the ledger, CRM and HR don't hold is left empty rather than invented:
// no contractors, assignments, timesheets or commissions, no close-date history,
// and deals carry no headcount or rates. Those figures show as empty or zero.

import { addDays } from "../calc/dates";
import { indexDataset } from "../mock/dataset";

export const COMPANY_VIEW_ID = "E1";
const NO_TEAM = "NO-TEAM";
const STAGE_START = "Prospect";

const unique = (values) => [...new Set(values.filter((v) => v != null))].sort();
const named = (ids) => ids.map((id) => ({ id, name: id }));
const rows = (columns) => {
  const keys = Object.keys(columns);
  return columns[keys[0]].map((_, i) => Object.fromEntries(keys.map((k) => [k, columns[k][i]])));
};

/** GP rate for months without actuals (forecast months): the last twelve months' COGS share. */
function trailingCogsRate(payload) {
  const { months, cogsRate, companyRevenue, meta } = payload;
  const last = months.indexOf(meta.asOf.slice(0, 7));
  let revenue = 0;
  let cogs = 0;
  for (let m = Math.max(0, last - 11); m <= last; m++) {
    revenue += companyRevenue[m];
    cogs += companyRevenue[m] * cogsRate[m];
  }
  return revenue ? cogs / revenue : 0;
}

/** Owner shares that add up to exactly one, so a client's revenue is never partly lost or counted twice. */
function wholeShares(owners) {
  const total = owners.reduce((s, [, share]) => s + share, 0);
  return total ? owners.map(([rep, share]) => [rep, share / total]) : owners;
}

export function buildLiveDataset(payload) {
  const { meta, months } = payload;
  const asOf = meta.asOf;
  const asOfYm = asOf.slice(0, 7);
  const staffingFigures = { wages: 0, burden: 0, fica: 0, futa: 0, suta: 0, wc: 0, benefits: 0, odc: 0, vmsFee: 0, billedHours: 0, paidHours: 0, otHours: 0, af: 0 };

  // ---- org ----
  const clientCols = payload.clients;
  const regions = named(unique(clientCols.region));
  // No branches in the ledger: each region stands in as its own branch, so branch and region filters agree.
  const branches = regions.map((r) => ({ id: r.id, name: r.name, regionId: r.id, state: "", sutaRate: 0, sutaWageBase: 0 }));
  const businessUnits = named(unique(clientCols.segment));
  const verticals = unique(clientCols.vertical).map((id) => ({
    id, name: id, buId: null, pay: [0, 0], markup: [1, 1], weeklyHours: [40, 40], wcRate: 0, salary: [0, 0],
  }));

  const repRows = rows(payload.reps);
  const teams = payload.teams.map((t) => ({ id: t.id, name: t.name, directorId: t.directorId || null, branchIds: [], verticals: [] }));
  if (repRows.some((r) => !r.teamId)) teams.push({ id: NO_TEAM, name: "No manager", directorId: null, branchIds: [], verticals: [] });
  const fallbackRegion = regions[0]?.id || null;
  const reps = repRows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title || "Salesperson",
    role: "salesperson",
    teamId: r.teamId || NO_TEAM,
    branchId: r.region || fallbackRegion,
    primaryVerticalId: r.vertical,
    hireDate: r.hireDate,
    baseSalary: r.baseSalary || 0,
    salesAllocationPct: 1,
    travelAllowance: 0,
    entertainmentAllowance: 0,
    commissionPlan: { baseRate: 0, accelRate: 0 },
    overspender: false,
    restricted: false,
  }));
  for (const t of teams) t.size = reps.filter((r) => r.teamId === t.id).length;

  const directorIds = new Set(payload.directors.map((d) => d.id));
  const people = [
    { id: COMPANY_VIEW_ID, name: "Company view", role: "executive", title: "All salespeople" },
    { id: "F1", name: "Finance view", role: "finance", title: "All salespeople, no planning" },
    { id: "A1", name: "Access administrator", role: "access_admin", title: "Roles and access" },
    ...payload.directors.map((d) => ({ id: d.id, name: d.name, role: "director", title: d.title || "Sales Director" })),
    ...reps.filter((r) => !directorIds.has(r.id)).map((r) => ({ id: r.id, name: r.name, role: "salesperson", title: r.title, teamId: r.teamId })),
  ];

  // ---- deals ----
  const dealCols = payload.deals;
  const clientIds = clientCols.id;
  const opportunities = dealCols.id.map((id, i) => {
    const status = dealCols.status[i];
    const created = dealCols.created[i];
    const closed = dealCols.closed[i];
    const clientId = dealCols.client[i] == null ? null : clientIds[dealCols.client[i]];
    const open = status === "open";
    // The CRM keeps the current stage only: a deal enters at Prospect when created, and closes on its close date.
    const stageHistory = open ? [{ stage: dealCols.stage[i], date: created }] : [{ stage: STAGE_START, date: created }, { stage: dealCols.stage[i], date: closed }];
    const expectedStart = open ? addDays(asOf, 1) : closed;
    const amount = dealCols.amount[i];
    return {
      id,
      type: dealCols.type[i],
      clientId,
      prospectName: dealCols.name[i],
      repId: reps[dealCols.rep[i]].id,
      verticalId: dealCols.vertical[i],
      branchId: dealCols.region[i],
      regionId: dealCols.region[i],
      buId: dealCols.segment[i],
      stage: dealCols.stage[i],
      status,
      stageHistory,
      stageEnteredDate: stageHistory[stageHistory.length - 1].date || created,
      probability: dealCols.probability[i],
      expectedRevenue: amount,
      expectedGp: amount * payload.margin,
      headcount: 0,
      billRate: 0,
      payRate: 0,
      hoursPerWeek: 0,
      durationMonths: dealCols.duration[i] || meta.defaultDurationMonths,
      expectedStart,
      expectedFirstBilling: expectedStart,
      createdDate: created,
      closeDate: closed,
      originalCloseDate: closed,
      pushes: [],
      wonDate: status === "won" ? closed : null,
      lostDate: status === "lost" ? closed : null,
      lossReason: null,
      competitor: null,
      leadSource: dealCols.source[i],
      nextAction: null,
    };
  });

  // ---- clients ----
  const firstWin = new Map();
  for (const o of opportunities) {
    if (o.status !== "won" || !o.clientId || !o.wonDate) continue;
    const seen = firstWin.get(o.clientId);
    if (!seen || o.wonDate < seen.wonDate) firstWin.set(o.clientId, o);
  }
  const clients = clientIds.map((id, i) => {
    const acquiredDate = clientCols.acquiredDate[i] || null;
    return {
      id,
      name: id,
      verticalId: clientCols.vertical[i],
      branchId: clientCols.region[i],
      regionId: clientCols.region[i],
      buId: clientCols.segment[i],
      serviceLineId: null,
      isMsp: false,
      sizeTier: null,
      acquiredDate,
      acquiredYm: acquiredDate ? acquiredDate.slice(0, 7) : null,
      isNewLogo: !!acquiredDate && acquiredDate.slice(0, 7) >= meta.startYm,
      leadSource: firstWin.get(id)?.leadSource || null,
      churnDate: null,
      churnYm: null,
      churnReason: null,
      owners: wholeShares(clientCols.owners[i]).map(([rep, share]) => ({ repId: reps[rep].id, share })),
    };
  });
  const clientByIndex = (c) => clients[c];

  // ---- monthly actuals: GL revenue per client, GP at each month's COGS rate ----
  const facts = [];
  const revenueCells = payload.revenue;
  for (let i = 0; i < revenueCells.c.length; i++) {
    const ym = months[revenueCells.m[i]];
    if (ym > asOfYm) continue;
    const revenue = revenueCells.v[i];
    const directCost = revenue * payload.cogsRate[revenueCells.m[i]];
    facts.push({
      id: `F-${i}`, ym, clientId: clientByIndex(revenueCells.c[i]).id, kind: "invoice", placementType: null,
      assignmentId: null, placementId: null, revenue, directCost, gp: revenue - directCost, ...staffingFigures,
    });
  }

  // ---- plans: budget (also the Sales Target) and Revenue Forecasting, per client and month ----
  const forecastCogs = trailingCogsRate(payload);
  const planByKey = new Map();
  const planFor = (c, m) => {
    const key = `${c}|${m}`;
    if (!planByKey.has(key)) {
      const client = clientByIndex(c);
      planByKey.set(key, {
        ym: months[m], clientId: client.id, repId: null, verticalId: client.verticalId, branchId: client.branchId,
        regionId: client.regionId, buId: client.buId, serviceLineId: null, budget: null, target: null, board: null, forecast: null,
      });
    }
    return planByKey.get(key);
  };
  const budgetCells = payload.budget;
  for (let i = 0; i < budgetCells.c.length; i++) {
    const m = budgetCells.m[i];
    const revenue = budgetCells.v[i];
    const plan = { revenue, gp: revenue * (1 - payload.budgetCogsRate[m]) };
    Object.assign(planFor(budgetCells.c[i], m), { budget: plan, target: plan });
  }
  if (payload.forecast) {
    const cells = payload.forecast;
    for (let i = 0; i < cells.c.length; i++) {
      const m = cells.m[i];
      const rate = months[m] <= asOfYm && payload.companyRevenue[m] ? payload.cogsRate[m] : forecastCogs;
      planFor(cells.c[i], m).forecast = { revenue: cells.v[i], gp: cells.v[i] * (1 - rate) };
    }
  }
  const plans = [...planByKey.values()];

  // ---- sales expense: the Sales department's payroll and travel, shared by each person's revenue ----
  const repRevenue = new Map(); // `${repId}|${ym}` → credited revenue
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const ownersByClient = new Map(clients.map((c) => [c.id, c.owners]));
  for (const f of facts) {
    for (const o of ownersByClient.get(f.clientId) || []) {
      const key = `${o.repId}|${f.ym}`;
      repRevenue.set(key, (repRevenue.get(key) || 0) + f.revenue * o.share);
    }
  }
  const expenses = [];
  for (const [key, revenue] of repRevenue) {
    const [repId, ym] = key.split("|");
    const m = monthIndex.get(ym);
    const total = payload.companyRevenue[m];
    if (!total) continue;
    const share = revenue / total;
    const salary = payload.pools.salary[m] * share;
    const travel = payload.pools.travel[m] * share;
    if (salary) expenses.push({ id: `X-S-${key}`, ym, repId, clientId: null, category: "salary", status: "posted", amount: salary, memo: "Sales department payroll, shared by revenue" });
    if (travel) expenses.push({ id: `X-T-${key}`, ym, repId, clientId: null, category: "travel", status: "posted", amount: travel, memo: "Sales department travel, shared by revenue" });
  }

  return indexDataset({
    meta: { seed: null, asOf, asOfYm, startYm: meta.startYm, version: meta.version, live: true, hasForecast: meta.hasForecast },
    org: { businessUnits, regions, branches, verticals, serviceLines: [], teams, reps, people },
    clients,
    contractors: [],
    assignments: [],
    requisitions: [],
    placements: [],
    opportunities,
    facts,
    plans,
    expenses,
  });
}
