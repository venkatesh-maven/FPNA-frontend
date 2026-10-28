import { gmPct, perHour } from "../../calc/economics";
import { variance } from "../../calc/variance";
import { gpPerSalesDollar, pctOf } from "../../calc/metrics";
import { can } from "../../access/accessEngine";
import { SOURCES } from "../../config/dataset";
import { activeContractorsOn, averageActive, averageActiveByMonth, sumExpenses, sumFacts, sumFactsByRep, windowDates } from "./aggregate";
import {
  actualCompareWindows,
  clientDynamics,
  comparisonsFor,
  financialBases,
  gpBridgeView,
  opportunityRow,
  pipelineByStage,
  pipelineSnapshot,
  quarterOutlook,
  salesCostTrend,
  segmentTable,
  staffingSnapshot,
  tile,
  trendSeries,
  winLossSummary,
} from "./common";
import { buildExecutiveInsights } from "../../insights/executiveInsights";
import { clientRows } from "./clientRows";
import { count } from "../../utils/format";
import { buildRecruitingInsights } from "../../insights/recruitingInsights";
import { teamDirectorOf } from "../../access/accessEngine";
import { accessStore } from "../store/stores";
import { AGING_DAYS, addCounts, deriveRecruiting, emptyCounts, openJobOrders, recruitingByMonth, recruitingCounts, retention } from "./recruitingMetrics";

// Sections the staffing-finance insights still belong to on this recruiting page.
const FINANCE_INSIGHT_SECTIONS = new Set(["staffing", "financial", "clients", "economics"]);

/** Billing figures for a recruiter or group, from summed facts: rates are recalculated from the totals. */
function billing(t) {
  const billRevenue = t?.timeRevenue || 0;
  const payroll = t?.wages || 0;
  const billedHours = t?.billedHours || 0;
  return {
    billRevenue,
    payroll,
    billedHours,
    paidHours: t?.paidHours || 0,
    revenue: t?.revenue || 0,
    gp: t?.gp || 0,
    gmPct: gmPct(t?.gp || 0, t?.revenue || 0),
    avgBillRate: perHour(billRevenue, billedHours),
    avgPayRate: perHour(payroll, t?.paidHours || 0),
    spread: perHour(billRevenue - payroll, billedHours),
  };
}

/** Recruiting and billing rows for a group of recruiters: counts and money summed first, then rates. */
function groupRow(counts, extra) {
  return { ...deriveRecruiting(counts), ...extra };
}

/** Last 12 months of contractors and billing: average active, hours, bill revenue, payroll and GP. */
function billingByMonth(ctx, trend) {
  const window = trend.map((t) => ({ ym: t.ym, scale: 1, fraction: 1 }));
  const facts = sumFacts(ctx, window, (f) => f.ym);
  const avg = averageActiveByMonth(ctx, window);
  const asOfYm = ctx.ds.meta.asOfYm;
  return trend.map(({ ym, label }) => ({
    ym,
    label,
    avgActive: ym > asOfYm ? null : Math.round(avg.get(ym) || 0),
    ...billing(facts.get(ym)),
  }));
}

/** A comparison entry for a non-money metric against one other value. */
export const simpleCmp = (basis, label, actual, base, { lowerIsBetter = false, unit } = {}) => {
  if (actual == null || base == null) return null;
  if (unit === "pct") {
    const pp = actual - base;
    return { basis, label, value: base, pp, favorable: pp === 0 ? null : (pp > 0) !== lowerIsBetter };
  }
  const v = variance(actual, base, { lowerIsBetter });
  return v && { basis, label, value: base, abs: v.abs, pct: v.pct, favorable: v.favorable };
};

const compact = (list) => list.filter(Boolean);

export function executiveView(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const cur = sumFacts(ctx, ctx.currentWindow);
  const bases = financialBases(ctx);
  const pyWin = actualCompareWindows(ctx).py;

  const staff = staffingSnapshot(ctx, ctx.currentWindow, cur);
  const staffPy = staffingSnapshot(ctx, pyWin, bases.py.totals);

  const clients = clientDynamics(ctx, ctx.currentWindow, pyWin);
  const pyRange = windowDates(pyWin, asOf);
  const newWinsPy = ctx.ds.clients.filter((c) => ctx.credit.has(c.id) && c.acquiredDate >= pyRange.from && c.acquiredDate <= pyRange.to).length;
  const churnedPy = ctx.ds.clients.filter((c) => ctx.credit.has(c.id) && c.churnDate && c.churnDate >= pyRange.from && c.churnDate <= pyRange.to).length;

  const pipe = pipelineSnapshot(ctx);
  const exp = sumExpenses(ctx, ctx.currentWindow);
  const expPy = sumExpenses(ctx, pyWin);
  const contribution = cur.gp - exp.total;
  const contributionPy = bases.py.gp - expPy.total;
  const outlook = quarterOutlook(ctx);
  const trend = trendSeries(ctx);
  const gm = gmPct(cur.gp, cur.revenue);

  // Recruiting: funnel, quality, speed and productivity for the recruiters in view.
  const range = windowDates(ctx.currentWindow, asOf);
  const rc = deriveRecruiting(recruitingCounts(ctx, range.from, range.to));
  const rcPy = deriveRecruiting(recruitingCounts(ctx, pyRange.from, pyRange.to));
  const open = openJobOrders(ctx, range.to);
  const openPy = openJobOrders(ctx, pyRange.to);
  const ret = retention(ctx, range.to);
  const retPy = retention(ctx, pyRange.to);
  const perRecruiter = (v) => (ctx.reps.length && v != null ? v / ctx.reps.length : null);
  const vsPy = (key, opts) => compact([simpleCmp("py", "Prior Year", rc[key], rcPy[key], opts)]);
  const vsPyOf = (cur, py, opts) => compact([simpleCmp("py", "Prior Year", cur, py, opts)]);
  const neutral = (list) => list.map((c) => ({ ...c, favorable: null }));
  const costPerPlacement = rc.placements ? exp.total / rc.placements : null;
  const costPerPlacementPy = rcPy.placements ? expPy.total / rcPy.placements : null;

  // Contractors and billing lead; recruiting activity, conversion and speed
  // follow as the pipeline that feeds them.
  const kpiSections = [
    {
      id: "staffing",
      title: "Active contractors & billing",
      tiles: [
        tile({ key: "activeContractors", label: "Active contractors", unit: "count", value: staff.activeAtEnd, comparisons: vsPyOf(staff.activeAtEnd, staffPy.activeAtEnd), sub: `On assignment at period end · average ${Math.round(staff.avgActive)} across the period` }),
        tile({ key: "billedHours", label: "Billed hours", unit: "hours", value: staff.billedHours, comparisons: vsPyOf(staff.billedHours, staffPy.billedHours), sub: `${Math.round(staff.paidHours).toLocaleString("en-US")} paid hours` }),
        tile({ key: "billRevenue", label: "Bill revenue", value: cur.timeRevenue, comparisons: vsPyOf(cur.timeRevenue, bases.py.totals.timeRevenue), sub: "Contractor hours billed to clients (permanent fees not included)" }),
        tile({ key: "payroll", label: "Contractor payroll", value: cur.wages, comparisons: neutral(vsPyOf(cur.wages, bases.py.totals.wages)), sub: "Wages paid to contractors, before burden" }),
        tile({ key: "avgBillRate", label: "Average bill rate", unit: "rate", value: staff.avgBillRate, comparisons: vsPyOf(staff.avgBillRate, staffPy.avgBillRate) }),
        tile({ key: "avgPayRate", label: "Average pay rate", unit: "rate", lowerIsBetter: true, value: staff.avgPayRate, comparisons: vsPyOf(staff.avgPayRate, staffPy.avgPayRate, { lowerIsBetter: true }) }),
        tile({ key: "spread", label: "Bill–pay spread", unit: "rate", value: staff.spread, comparisons: vsPyOf(staff.spread, staffPy.spread), sub: "Per billed hour, before burden" }),
        tile({ key: "starts", label: "Contractor starts", unit: "count", value: staff.starts, comparisons: vsPyOf(staff.starts, staffPy.starts), sub: `${staff.ends} ends · net ${staff.netChange >= 0 ? "+" : ""}${staff.netChange} · ${rc.extensions} extended · ${rc.redeployed} redeployed` }),
      ],
    },
    {
      id: "financial",
      title: "Revenue & gross profit",
      tiles: [
        tile({ key: "revenue", label: "Revenue", value: cur.revenue, comparisons: comparisonsFor(ctx, bases, "revenue", cur.revenue), series: trend.map((t) => t.revenue) }),
        tile({ key: "gp", label: "Gross profit", value: cur.gp, comparisons: comparisonsFor(ctx, bases, "gp", cur.gp), series: trend.map((t) => t.gp) }),
        tile({ key: "gmPct", label: "Gross margin", unit: "pct", value: gm, comparisons: comparisonsFor(ctx, bases, "gm", gm, { unit: "pct" }), series: trend.map((t) => t.gmPct) }),
        tile({ key: "permFees", label: "Permanent placement fees", value: rc.permFees, comparisons: vsPy("permFees"), sub: `${rc.permPlacements} permanent placements` }),
      ],
    },
    {
      id: "productivity",
      title: "Recruiter billing",
      tiles: [
        tile({ key: "contractorsPerRecruiter", label: "Active contractors per recruiter", unit: "decimal", value: perRecruiter(staff.activeAtEnd), comparisons: vsPyOf(perRecruiter(staff.activeAtEnd), perRecruiter(staffPy.activeAtEnd)), sub: `${ctx.reps.length} recruiters in view` }),
        tile({ key: "billRevenuePerRecruiter", label: "Bill revenue per recruiter", value: perRecruiter(cur.timeRevenue), comparisons: vsPyOf(perRecruiter(cur.timeRevenue), perRecruiter(bases.py.totals.timeRevenue)) }),
        tile({ key: "gpPerRecruiter", label: "GP per recruiter", value: perRecruiter(cur.gp), comparisons: vsPyOf(perRecruiter(cur.gp), perRecruiter(bases.py.gp)), sub: "From the contractors and placements each one filled" }),
        tile({ key: "placementsPerRecruiter", label: "Placements per recruiter", unit: "decimal", value: perRecruiter(rc.placements), comparisons: vsPyOf(perRecruiter(rc.placements), perRecruiter(rcPy.placements)) }),
      ],
    },
    {
      id: "clients",
      title: "Clients",
      tiles: [
        tile({ key: "activeClients", label: "Active clients", unit: "count", value: clients.activeClients, comparisons: compact([simpleCmp("py", "Prior Year", clients.activeClients, clients.categories.lost.length + clients.categories.retained.length + clients.categories.expanded.length + clients.categories.contracted.length)]) }),
        tile({ key: "clientsWithOpenJobOrders", label: "Clients with open job orders", unit: "count", value: new Set(open.rows.map((r) => r.clientId)).size, drill: false, sub: `${open.count} open job orders between them` }),
        tile({ key: "newClients", label: "New clients won", unit: "count", value: clients.newWins.length, comparisons: compact([simpleCmp("py", "Prior Year", clients.newWins.length, newWinsPy)]) }),
        tile({ key: "churnedClients", label: "Clients lost", unit: "count", value: clients.churned.length, lowerIsBetter: true, comparisons: compact([simpleCmp("py", "Prior Year", clients.churned.length, churnedPy, { lowerIsBetter: true })]) }),
      ],
    },
    {
      id: "economics",
      title: "Recruiting cost",
      tiles: [
        tile({ key: "costPerPlacement", label: "Recruiting cost per placement", lowerIsBetter: true, value: costPerPlacement, comparisons: vsPyOf(costPerPlacement, costPerPlacementPy, { lowerIsBetter: true }), sub: "Recruiting expense ÷ placements" }),
        tile({ key: "salesContribution", label: "Recruiting contribution", value: contribution, comparisons: compact([simpleCmp("py", "Prior Year", contribution, contributionPy)]), sub: "GP less recruiting expense (not EBITDA)" }),
        tile({ key: "gpPerSalesDollar", label: "GP per $ of recruiting expense", unit: "ratio", value: gpPerSalesDollar(cur.gp, exp.total), comparisons: compact([simpleCmp("py", "Prior Year", gpPerSalesDollar(cur.gp, exp.total), gpPerSalesDollar(bases.py.gp, expPy.total))]) }),
      ],
    },
    {
      id: "activity",
      title: "Recruiting activity",
      tiles: [
        tile({ key: "opened", label: "Job orders opened", unit: "count", value: rc.opened, comparisons: vsPy("opened") }),
        tile({ key: "submittals", label: "Submittals", unit: "count", value: rc.submittals, comparisons: vsPy("submittals"), sub: rc.submittalsPerHire != null ? `${count(rc.submittalsPerHire, 1)} submittals per accepted offer` : null }),
        tile({ key: "interviews", label: "Interviews", unit: "count", value: rc.interviews, comparisons: vsPy("interviews") }),
        tile({ key: "offers", label: "Offers extended", unit: "count", value: rc.offers, comparisons: vsPy("offers"), sub: `${rc.accepted} accepted · ${rc.declined} declined` }),
        tile({ key: "placements", label: "Placements", unit: "count", value: rc.placements, comparisons: vsPy("placements"), sub: `${rc.contractStarts} contractors started · ${rc.permPlacements} permanent hires` }),
      ],
    },
    {
      id: "conversion",
      title: "Conversion & quality",
      tiles: [
        tile({ key: "subToInterview", label: "Submittal → interview", unit: "pct", value: rc.subToInterview, comparisons: vsPy("subToInterview", { unit: "pct" }), sub: "Submittals that reached interview" }),
        tile({ key: "interviewToOffer", label: "Interview → offer", unit: "pct", value: rc.interviewToOffer, comparisons: vsPy("interviewToOffer", { unit: "pct" }), sub: "Interviews that led to an offer" }),
        tile({ key: "offerAcceptance", label: "Offer acceptance", unit: "pct", value: rc.offerAcceptance, comparisons: vsPy("offerAcceptance", { unit: "pct" }), sub: "Accepted ÷ offers decided" }),
        tile({ key: "fillRate", label: "Fill rate", unit: "pct", value: rc.fillRate, comparisons: vsPy("fillRate", { unit: "pct" }), sub: `${rc.filled} filled · ${rc.cancelled} cancelled` }),
        tile({ key: "fallOffRate", label: "Fall-off rate", unit: "pct", lowerIsBetter: true, value: rc.fallOffRate, comparisons: vsPy("fallOffRate", { unit: "pct", lowerIsBetter: true }), sub: `${rc.fallOffs} early ends · ${rc.refunds} permanent refunds` }),
        tile({ key: "retention90", label: "90-day retention", unit: "pct", value: ret.rate, comparisons: vsPyOf(ret.rate, retPy.rate, { unit: "pct" }), sub: `Of ${ret.cohort} contractors who started 3–6 months ago` }),
      ],
    },
    {
      id: "speed",
      title: "Speed & open job orders",
      tiles: [
        tile({ key: "daysToSubmit", label: "Time to first submittal", unit: "days", lowerIsBetter: true, value: rc.daysToSubmit, comparisons: vsPy("daysToSubmit", { lowerIsBetter: true }), sub: "Job order opened → first candidate sent" }),
        tile({ key: "daysToFill", label: "Time to fill", unit: "days", lowerIsBetter: true, value: rc.daysToFill, comparisons: vsPy("daysToFill", { lowerIsBetter: true }), sub: "Job order opened → filled" }),
        tile({ key: "daysToStart", label: "Time to start", unit: "days", lowerIsBetter: true, value: rc.daysToStart, comparisons: vsPy("daysToStart", { lowerIsBetter: true }), sub: "Filled → contractor's first day" }),
        tile({ key: "openJobOrders", label: "Open job orders", unit: "count", value: open.count, comparisons: vsPyOf(open.count, openPy.count), sub: `${open.aging} open more than ${AGING_DAYS} days` }),
      ],
    },
  ];

  // Leaderboards: recruiters, then their lead teams and account managers (counts summed, then rates).
  const config = accessStore.read();
  const byRecruiter = recruitingCounts(ctx, range.from, range.to, (x) => x.recruiterId);
  const activeByRecruiter = activeContractorsOn(ctx, range.to, (a) => a.recruiterId);
  const openByRecruiter = new Map();
  for (const r of open.rows) openByRecruiter.set(r.recruiterId, (openByRecruiter.get(r.recruiterId) || 0) + 1);
  const finByRecruiter = sumFactsByRep(ctx, ctx.currentWindow);
  const avgActiveByRecruiter = averageActive(ctx, ctx.currentWindow, (f) => f.recruiterId);
  const personName = (id) => ctx.index.personById.get(id)?.name || null;
  const recruiterRows = ctx.reps.map((rep) => {
    const team = ctx.index.teamById.get(rep.teamId);
    return groupRow(byRecruiter.get(rep.id) || emptyCounts(), {
      repId: rep.id, name: rep.name, teamId: rep.teamId, team: team.name, accountManager: personName(teamDirectorOf(config, team)),
      activeContractors: activeByRecruiter.get(rep.id)?.size || 0, avgActive: avgActiveByRecruiter.get(rep.id) || 0,
      openJobOrders: openByRecruiter.get(rep.id) || 0,
      ...billing(finByRecruiter.get(rep.id)),
    });
  });
  const rollUp = (keyOf, describe) => {
    const groups = new Map();
    for (const row of recruiterRows) {
      const k = keyOf(row);
      const g = groups.get(k) || { counts: emptyCounts(), recruiters: 0, activeContractors: 0, avgActive: 0, openJobOrders: 0, fin: { revenue: 0, gp: 0, timeRevenue: 0, wages: 0, billedHours: 0, paidHours: 0 } };
      addCounts(g.counts, byRecruiter.get(row.repId));
      g.recruiters += 1;
      g.activeContractors += row.activeContractors;
      g.avgActive += row.avgActive;
      g.openJobOrders += row.openJobOrders;
      g.fin.revenue += row.revenue;
      g.fin.gp += row.gp;
      g.fin.timeRevenue += row.billRevenue;
      g.fin.wages += row.payroll;
      g.fin.billedHours += row.billedHours;
      g.fin.paidHours += row.paidHours;
      groups.set(k, g);
    }
    return [...groups].map(([k, g]) => groupRow(g.counts, {
      key: k, ...describe(k), recruiters: g.recruiters, activeContractors: g.activeContractors, avgActive: g.avgActive,
      openJobOrders: g.openJobOrders, ...billing(g.fin),
    }));
  };
  const leadTeamRows = rollUp((r) => r.teamId, (id) => {
    const t = ctx.index.teamById.get(id);
    return { name: t.name, lead: personName(t.leadId), accountManager: personName(teamDirectorOf(config, t)) };
  });
  const managerRows = rollUp((r) => teamDirectorOf(config, ctx.index.teamById.get(r.teamId)), (id) => ({ name: personName(id) || id }));

  // Client table: recruiting activity and money side by side.
  const finByClient = new Map(clientRows(ctx).map((r) => [r.clientId, r]));
  const recByClient = recruitingCounts(ctx, range.from, range.to, (x) => x.clientId);
  const openByClient = new Map();
  for (const r of open.rows) openByClient.set(r.clientId, (openByClient.get(r.clientId) || 0) + 1);
  const clientTable = [...new Set([...finByClient.keys(), ...recByClient.keys(), ...openByClient.keys()])]
    .map((clientId) => {
      const c = ctx.index.clientById.get(clientId);
      const fin = finByClient.get(clientId) || {
        clientId,
        client: c.name,
        owner: c.owners.filter((o) => ctx.repSet.has(o.repId)).map((o) => ctx.index.repById.get(o.repId).name).join(", "),
        vertical: ctx.index.verticalById.get(c.verticalId)?.name,
        revenue: 0,
        gp: 0,
        gmPct: null,
        contractors: 0,
      };
      const t = deriveRecruiting(recByClient.get(clientId) || emptyCounts());
      return { ...fin, opened: t.opened, submittals: t.submittals, interviews: t.interviews, placements: t.placements, fillRate: t.fillRate, daysToFill: t.daysToFill, openJobOrders: openByClient.get(clientId) || 0 };
    })
    .sort((x, y) => y.revenue - x.revenue || y.placements - x.placements);

  const bridge = gpBridgeView(ctx, { canSeeCostDetail: can(ctx.access, "view_cost_detail") });
  const salesCost = salesCostTrend(ctx, trend);
  const stages = pipelineByStage(pipe, asOf);

  // Team economics for recruiting-effectiveness insights.
  const byRep = sumFactsByRep(ctx, ctx.currentWindow);
  const expByRep = sumExpenses(ctx, ctx.currentWindow, (e) => e.repId);
  const teams = new Map();
  for (const rep of ctx.reps) {
    const t = teams.get(rep.teamId) || { teamId: rep.teamId, name: ctx.index.teamById.get(rep.teamId).name, revenue: 0, gp: 0, salesExpense: 0, reps: 0 };
    const f = byRep.get(rep.id);
    t.revenue += f?.revenue || 0;
    t.gp += f?.gp || 0;
    t.salesExpense += expByRep.get(rep.id)?.total || 0;
    t.reps += 1;
    teams.set(rep.teamId, t);
  }
  const teamRows = [...teams.values()].map((t) => ({
    ...t,
    contribution: t.gp - t.salesExpense,
    contributionMargin: pctOf(t.gp - t.salesExpense, t.gp),
    gmPct: gmPct(t.gp, t.revenue),
  }));

  const growth = Object.entries(clients.categories).map(([key, list]) => ({
    key,
    label: { new: "New", retained: "Retained", expanded: "Expanded", contracted: "Contracted", lost: "Lost" }[key],
    count: list.length,
    revenue: list.reduce((s, c) => s + c.revenue, 0),
    revenueBase: list.reduce((s, c) => s + c.revenueBase, 0),
    change: list.reduce((s, c) => s + c.change, 0),
    clients: list.slice(0, 40),
  }));

  const geo = {
    region: segmentTable(ctx, "regionId", (k) => ctx.index.regionById.get(k)?.name || k),
    branch: segmentTable(ctx, "branchId", (k) => ctx.index.branchById.get(k)?.name || k),
    vertical: segmentTable(ctx, "verticalId", (k) => ctx.index.verticalById.get(k)?.name || k),
  };

  const curRange = windowDates(ctx.currentWindow, asOf);
  const pipelineRows = pipe.open.map((o) => opportunityRow(ctx, o)).sort((a, b) => b.weightedGp - a.weightedGp);
  const winLoss = winLossSummary(ctx, curRange.from, curRange.to);
  const winLossPy = winLossSummary(ctx, pyRange.from, pyRange.to);

  const model = {
    basisLabel: ctx.compare.label,
    cur, bases, gm, staff, staffPy, clients, pipe, exp, expPy, contribution, contributionPy,
    outlook, bridge, growth, teamRows, newClients: clients.newWins, pipelineRows, winLoss, winLossPy, ctx,
    canSeeCostDetail: can(ctx.access, "view_cost_detail"),
    canSeeCommissions: can(ctx.access, "view_commissions"),
  };

  return {
    data: {
      kpiSections,
      trend,
      billingMonthly: billingByMonth(ctx, trend),
      bridge,
      salesCost,
      growth,
      pipeline: stages,
      outlook,
      geo,
      clientPerformance: clientTable,
      teams: teamRows,
      recruiting: {
        monthly: recruitingByMonth(ctx),
        funnel: [
          { stage: "Submittals", count: rc.submittals },
          { stage: "Interviews", count: rc.interviews },
          { stage: "Offers", count: rc.offers },
          { stage: "Offers accepted", count: rc.accepted },
        ],
        recruiters: recruiterRows,
        leadTeams: leadTeamRows,
        accountManagers: managerRows,
        openJobOrders: open.rows.slice(0, 60),
      },
      insights: [
        ...buildRecruitingInsights({ rc, rcPy, open, openPy, ret, retPy, recruiters: recruiterRows, leadTeams: leadTeamRows, staff, staffPy, costPerPlacement, costPerPlacementPy, ctx }),
        ...buildExecutiveInsights(model).filter((i) => FINANCE_INSIGHT_SECTIONS.has(i.section)),
      ],
    },
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.crm, SOURCES.expenses, SOURCES.plans],
  };
}
