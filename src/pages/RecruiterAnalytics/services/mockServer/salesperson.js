import { gmPct, perHour } from "../../calc/economics";
import { pctOf } from "../../calc/metrics";
import { compareWindow, resolvePeriod } from "../../calc/periods";
import { addDays, monthRange, toYm } from "../../calc/dates";
import { FISCAL_START_MONTH, SOURCES } from "../../config/dataset";
import {
  activeContractorsOn,
  averageActiveByMonth,
  expenseRows,
  movements,
  sumExpenses,
  sumFacts,
  sumPlans,
  windowDates,
} from "./aggregate";
import {
  actualCompareWindows,
  comparisonsFor,
  elapsedWindow,
  financialBases,
  opportunityRow,
  pipelineSnapshot,
  quarterOutlook,
  staffingSnapshot,
  tile,
} from "./common";
import { simpleCmp } from "./executive";
import { can } from "../../access/accessEngine";
import { fiscalYearMonths } from "./repMetrics";
import { buildSalespersonInsights } from "../../insights/salespersonInsights";
import { compactMoney, money } from "../../utils/format";

const BASE_RATE = 0.08;
const ACCEL_RATE = 0.12;
const compact = (l) => l.filter(Boolean);
const fullMonths = (months) => months.map((ym) => ({ ym, scale: 1, fraction: 1 }));

/** The recruiter a My Performance view is about: yourself, or a recruiter in your scope. */
export function resolveRepId(args, access, ds) {
  if (access.scope.kind === "own") return [...access.scope.repIds][0];
  if (args.repId && access.scope.repIds.has(args.repId)) return args.repId;
  return ds.org.reps.filter((r) => access.scope.repIds.has(r.id)).sort((a, b) => a.name.localeCompare(b.name))[0]?.id;
}

export function salespersonView(ctx) {
  const asOf = ctx.ds.meta.asOf;
  const rep = ctx.reps[0];
  if (!rep) return { data: { rep: null }, families: ["actuals"], sources: [] };
  const opts = { asOf, fiscalStartMonth: FISCAL_START_MONTH };

  const cur = sumFacts(ctx, ctx.currentWindow);
  const bases = financialBases(ctx);
  const gm = gmPct(cur.gp, cur.revenue);
  const staff = staffingSnapshot(ctx, ctx.currentWindow, cur);
  const staffPy = staffingSnapshot(ctx, actualCompareWindows(ctx).py, bases.py.totals);
  const vsPy = (curV, pyV, o) => compact([simpleCmp("py", "Prior Year", curV, pyV, o)]);
  const pipe = pipelineSnapshot(ctx);
  const outlook = quarterOutlook(ctx);
  const exp = sumExpenses(ctx, ctx.currentWindow);
  const pyWin = compareWindow(ctx.period, "py").elapsed.map((e) => ({ ym: e.ym, scale: e.fraction, fraction: e.fraction }));
  const expPy = sumExpenses(ctx, pyWin);
  const months = ctx.currentWindow.reduce((s, w) => s + w.fraction, 0);
  const allowance = (rep.travelAllowance + rep.entertainmentAllowance) * months;

  // QTD / YTD attainment against target, whatever period is selected.
  const qtd = resolvePeriod({ preset: "QTD" }, opts);
  const ytd = resolvePeriod({ preset: "YTD" }, opts);
  const att = (p) => {
    const a = sumFacts(ctx, elapsedWindow(p, false));
    const t = sumPlans(ctx, elapsedWindow(p, true), "target");
    return { gp: a.gp, revenue: a.revenue, gpTarget: t.gp, revenueTarget: t.revenue, gpAttainment: pctOf(a.gp, t.gp), revenueAttainment: pctOf(a.revenue, t.revenue) };
  };
  const qtdAtt = att(qtd);
  const ytdAtt = att(ytd);

  // Commission: earned (accrued) and approved are actuals; projected applies the plan to the run-rate quarter.
  const quarterTargetGp = outlook.target.gp;
  const projectedQuarterCommission =
    Math.min(outlook.fullQuarter.gp, quarterTargetGp) * BASE_RATE + Math.max(0, outlook.fullQuarter.gp - quarterTargetGp) * ACCEL_RATE;
  const commissionToDateQuarter = sumExpenses(ctx, elapsedWindow(resolvePeriod({ preset: "CQ" }, opts), false)).commission;
  const commissionProjected = Math.max(0, projectedQuarterCommission - commissionToDateQuarter);

  const tAndE = exp.travel + exp.entertainment;
  // My contractors and billing lead; revenue & GP, commission and pipeline follow.
  const kpiSections = [
    {
      id: "my-staffing",
      title: "My contractors & billing",
      tiles: [
        tile({ key: "activeContractors", label: "My active contractors", unit: "count", value: staff.activeAtEnd, comparisons: vsPy(staff.activeAtEnd, staffPy.activeAtEnd), sub: `${staff.starts} starts · ${staff.ends} ends · average ${Math.round(staff.avgActive)}` }),
        tile({ key: "billedHours", label: "Billed hours", unit: "hours", value: staff.billedHours, comparisons: vsPy(staff.billedHours, staffPy.billedHours), sub: `${Math.round(staff.paidHours).toLocaleString("en-US")} paid hours` }),
        tile({ key: "billRevenue", label: "My bill revenue", value: cur.timeRevenue, comparisons: vsPy(cur.timeRevenue, bases.py.totals.timeRevenue), sub: "Contractor hours billed to clients" }),
        tile({ key: "payroll", label: "Contractor payroll", value: cur.wages, comparisons: vsPy(cur.wages, bases.py.totals.wages).map((c) => ({ ...c, favorable: null })), sub: "Wages paid to my contractors, before burden" }),
        tile({ key: "avgBillRate", label: "Average bill rate", unit: "rate", value: staff.avgBillRate, comparisons: vsPy(staff.avgBillRate, staffPy.avgBillRate) }),
        tile({ key: "avgPayRate", label: "Average pay rate", unit: "rate", value: staff.avgPayRate, lowerIsBetter: true, comparisons: vsPy(staff.avgPayRate, staffPy.avgPayRate, { lowerIsBetter: true }) }),
        tile({ key: "spread", label: "Bill–pay spread", unit: "rate", value: staff.spread, comparisons: vsPy(staff.spread, staffPy.spread), sub: "Per billed hour, before burden" }),
      ],
    },
    {
      id: "my-financial",
      title: "My revenue & gross profit",
      tiles: [
        tile({ key: "revenue", label: "My revenue", value: cur.revenue, comparisons: comparisonsFor(ctx, bases, "revenue", cur.revenue, { only: [ctx.filters.compare, ...["target", "py"].filter((b) => b !== ctx.filters.compare)] }), sub: `QTD ${Math.round(qtdAtt.revenueAttainment || 0)}% · YTD ${Math.round(ytdAtt.revenueAttainment || 0)}% of target` }),
        tile({ key: "gp", label: "My GP", value: cur.gp, comparisons: comparisonsFor(ctx, bases, "gp", cur.gp, { only: [ctx.filters.compare, ...["target", "py"].filter((b) => b !== ctx.filters.compare)] }), sub: `QTD ${Math.round(qtdAtt.gpAttainment || 0)}% · YTD ${Math.round(ytdAtt.gpAttainment || 0)}% of target` }),
        tile({ key: "gmPct", label: "My gross margin", unit: "pct", value: gm, comparisons: comparisonsFor(ctx, bases, "gm", gm, { unit: "pct", only: ["target", "py"] }) }),
        tile({ key: "salesContribution", label: "My recruiting contribution", value: cur.gp - exp.total, comparisons: compact([simpleCmp("py", "Prior Year", cur.gp - exp.total, bases.py.gp - expPy.total)]), sub: "GP less my recruiting expense (not EBITDA)" }),
      ],
    },
    {
      id: "my-commission",
      title: "My commission & expenses",
      tiles: [
        tile({ key: "commissionEarned", label: "Commission earned", value: exp.commission, sub: "Accrued for the period, approved and not yet approved" }),
        tile({ key: "commissionApproved", label: "Commission approved", value: exp.commissionApproved, sub: "Approved / payable" }),
        tile({ key: "commissionProjected", label: "Projected commission", value: commissionProjected, sub: `Rest of ${outlook.label} at run-rate (not yet earned)` }),
        tile({ key: "tAndE", label: "Travel & entertainment", value: tAndE, lowerIsBetter: true, comparisons: compact([simpleCmp("allowance", "Allowance", tAndE, allowance, { lowerIsBetter: true })]) }),
      ],
    },
    {
      id: "my-pipeline",
      title: "My pipeline & forecast",
      tiles: [
        tile({ key: "weightedPipeline", label: "Weighted pipeline", value: pipe.weightedRevenue, sub: `Weighted GP ${compactMoney(pipe.weightedGp)} · ${pipe.openCount} open job order${pipe.openCount === 1 ? "" : "s"}` }),
        tile({ key: "coverage", label: "Coverage of remaining FY target", unit: "ratio", value: pipe.coverage }),
        tile({ key: "winRate", label: "Fill rate", unit: "pct", value: pipe.winRate, sub: `${pipe.newLogoWins} new-client job order${pipe.newLogoWins === 1 ? "" : "s"} filled in period` }),
        tile({
          key: "myForecast",
          label: `My quarter outlook · ${outlook.label}`,
          value: outlook.fullQuarter.revenue,
          comparisons: compact([
            simpleCmp("pq", "Prior quarter actual", outlook.fullQuarter.revenue, outlook.priorQuarter.revenue),
            simpleCmp("target", "Quarter target", outlook.fullQuarter.revenue, outlook.target.revenue),
          ]),
          sub: `GP gap to target ${money(outlook.targetGap.gp)} · system run-rate`,
        }),
      ],
    },
  ];

  const clients = portfolioRows(ctx, rep);
  // Projected commission spread over clients by their share of the recruiter's GP.
  const positiveGp = clients.reduce((s, r) => s + Math.max(0, r.gp), 0);
  for (const r of clients) r.commissionProjected = positiveGp > 0 ? (commissionProjected * Math.max(0, r.gp)) / positiveGp : 0;

  // Fiscal-year months: actual vs target, contractors, commission and T&E.
  const fyMonths = fiscalYearMonths(ctx);
  const asOfYm = ctx.ds.meta.asOfYm;
  const fyActualMonths = fyMonths.filter((m) => m <= asOfYm);
  const actualByMonth = sumFacts(ctx, fullMonths(fyActualMonths), (f) => f.ym);
  const targetByMonth = sumPlans(ctx, fullMonths(fyMonths), "target", (p) => p.ym);
  const activeByMonth = averageActiveByMonth(ctx, fullMonths(fyActualMonths));
  const expByMonth = sumExpenses(ctx, fullMonths(fyActualMonths), (e) => e.ym);
  const monthly = fyMonths.map((ym) => {
    const a = actualByMonth.get(ym);
    const t = targetByMonth.get(ym);
    const e = expByMonth.get(ym);
    const isActual = ym <= asOfYm;
    return {
      ym,
      revenue: isActual ? a?.revenue || 0 : null,
      gp: isActual ? a?.gp || 0 : null,
      revenueTarget: t?.revenue ?? null,
      gpTarget: t?.gp ?? null,
      contractors: isActual ? activeByMonth.get(ym) || 0 : null,
      commissionApproved: isActual ? e?.commissionApproved || 0 : null,
      commissionAccrued: isActual ? e?.commissionAccrued || 0 : null,
      travel: isActual ? e?.travel || 0 : null,
      entertainment: isActual ? e?.entertainment || 0 : null,
      tAndEAllowance: rep.travelAllowance + rep.entertainmentAllowance,
      partial: ym === asOfYm,
    };
  });

  const openDeals = pipe.open.map((o) => opportunityRow(ctx, o)).sort((a, b) => b.weightedGp - a.weightedGp);
  const endingSoonHorizon = addDays(asOf, 60);
  const endingSoon = ctx.ds.assignments
    .filter((a) => !a.actualEndDate && a.plannedEndDate <= endingSoonHorizon && ctx.assignmentPass(a))
    .map((a) => ({
      assignmentId: a.id,
      clientId: a.clientId,
      client: ctx.index.clientById.get(a.clientId).name,
      contractor: ctx.index.contractorById.get(a.contractorId).name,
      title: ctx.index.contractorById.get(a.contractorId).title,
      plannedEndDate: a.plannedEndDate,
      billRate: a.rateHistory[a.rateHistory.length - 1].billRate,
      extensions: a.extensions,
    }))
    .sort((a, b) => a.plannedEndDate.localeCompare(b.plannedEndDate));

  const model = {
    rep, cur, bases, exp, expPy, allowance, staff, pipe, outlook, clients, openDeals, endingSoon, qtdAtt, ytdAtt, commissionProjected, ctx,
    canSeeCostDetail: can(ctx.access, "view_cost_detail"),
    canSeeCommissions: can(ctx.access, "view_commissions"),
  };
  return {
    data: {
      rep: { id: rep.id, name: rep.name, title: rep.title, team: ctx.index.teamById.get(rep.teamId).name, branch: ctx.index.branchById.get(rep.branchId).name },
      kpiSections,
      clients,
      monthly,
      openDeals,
      endingSoon,
      commission: {
        earned: exp.commission,
        commissionApproved: exp.commissionApproved,
        commissionAccrued: exp.commissionAccrued,
        commissionProjected,
        plan: "8% of credited GP, 12% on GP above the quarterly GP target",
      },
      insights: buildSalespersonInsights(model),
    },
    families: ["actuals", "plans", "pipeline", "expenses"],
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.crm, SOURCES.expenses, SOURCES.commission, SOURCES.plans],
  };
}

/** One row per client the recruiter has placed with, with every column group in the spec. */
function portfolioRows(ctx, rep) {
  const asOf = ctx.ds.meta.asOf;
  const { from, to } = windowDates(ctx.currentWindow, asOf);
  const cur = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
  const target = sumPlans(ctx, ctx.planWindow, "target", (p) => p.clientId);
  const fy = resolvePeriod({ preset: "FY" }, { asOf, fiscalStartMonth: FISCAL_START_MONTH });
  const fyTarget = sumPlans(ctx, fullMonths(fy.months), "target", (p) => p.clientId);
  const fyActual = sumFacts(ctx, elapsedWindow(fy, false), (f) => f.clientId);
  const fractions = ctx.planWindow.reduce((s, w) => s + w.fraction, 0);
  const activeNow = activeContractorsOn(ctx, to, (a) => a.clientId);
  const mv = movements(ctx, from, to, (a) => a.clientId);
  const acquisition = new Map();
  for (const e of expenseRows(ctx, ctx.currentWindow, (x) => x.category === "acquisition" && x.clientId)) {
    acquisition.set(e.clientId, (acquisition.get(e.clientId) || 0) + e.amount);
  }
  const opps = ctx.ds.opportunities.filter((o) => ctx.oppPass(o) && o.status === "open" && o.clientId);
  const oppsByClient = new Map();
  for (const o of opps) {
    if (!oppsByClient.has(o.clientId)) oppsByClient.set(o.clientId, []);
    oppsByClient.get(o.clientId).push(o);
  }

  const ids = new Set([...cur.keys(), ...[...ctx.credit.keys()].filter((id) => {
    const c = ctx.index.clientById.get(id);
    return !c.churnDate || c.churnDate >= ctx.period.from;
  })]);
  const rows = [];
  for (const clientId of ids) {
    const c = ctx.index.clientById.get(clientId);
    const t = cur.get(clientId);
    const tg = target.get(clientId);
    const share = c.owners.find((o) => o.repId === rep.id)?.share || 0;
    const gp = t?.gp || 0;
    const commission = Math.max(0, gp) * BASE_RATE;
    const fyGap = (fyTarget.get(clientId)?.gp || 0) - (fyActual.get(clientId)?.gp || 0);
    const list = oppsByClient.get(clientId) || [];
    const m = mv.get(clientId);
    rows.push({
      clientId,
      client: c.name,
      share: share * 100,
      vertical: ctx.index.verticalById.get(c.verticalId)?.name,
      location: ctx.index.branchById.get(c.branchId)?.name,
      serviceType: ctx.index.serviceLineById.get(c.serviceLineId)?.name,
      status: c.churnDate && c.churnDate <= asOf ? "Lost" : "Active",
      revenue: t?.revenue || 0,
      revenueTarget: tg?.revenue ?? null,
      revenueVar: tg ? (t?.revenue || 0) - tg.revenue : null,
      gp,
      gpTarget: tg?.gp ?? null,
      gpVar: tg ? gp - tg.gp : null,
      gmPct: gmPct(gp, t?.revenue || 0),
      gmTarget: tg ? gmPct(tg.gp, tg.revenue) : null,
      contractors: activeNow.get(clientId)?.size || 0,
      contractorsTarget: tg && fractions ? tg.N / fractions / Math.max(share, 0.0001) : null,
      starts: m?.starts || 0,
      ends: m?.ends || 0,
      billedHours: t?.billedHours || 0,
      paidHours: t?.paidHours || 0,
      avgBillRate: perHour(t?.timeRevenue || 0, t?.billedHours || 0),
      avgPayRate: perHour(t?.wages || 0, t?.paidHours || 0),
      payroll: t?.wages || 0,
      wages: t?.wages || 0,
      payrollTaxes: (t?.fica || 0) + (t?.futa || 0) + (t?.suta || 0),
      workersComp: t?.wc || 0,
      benefits: t?.benefits || 0,
      otherDirect: t?.odc || 0,
      directCost: t?.directCost || 0,
      commission,
      commissionProjected: null,
      acquisition: acquisition.get(clientId) || 0,
      clientContribution: gp - commission - (acquisition.get(clientId) || 0),
      openOpportunities: list.length,
      weightedRevenue: list.reduce((s, o) => s + o.expectedRevenue * o.probability, 0),
      weightedGp: list.reduce((s, o) => s + o.expectedGp * o.probability, 0),
      expectedStarts: list.reduce((s, o) => s + o.headcount * o.probability, 0),
      fyGpGap: Math.max(0, fyGap),
      commissionUpside: Math.max(0, fyGap) * BASE_RATE,
    });
  }
  return rows.sort((a, b) => b.gp - a.gp);
}

/** One client for the recruiter's drawer: months, assignments and open job orders. */
export function clientDetailView(ctx, { clientId }) {
  const client = ctx.index.clientById.get(clientId);
  if (!client || !ctx.credit.has(clientId)) return { data: { client: null }, families: ["actuals"], sources: [] };
  const asOfYm = ctx.ds.meta.asOfYm;
  const fyMonths = fiscalYearMonths(ctx);
  const actual = sumFacts(ctx, fullMonths(fyMonths.filter((m) => m <= asOfYm)), (f) => f.ym);
  const target = sumPlans(ctx, fullMonths(fyMonths), "target", (p) => p.ym);
  const activeByMonth = averageActiveByMonth(ctx, fullMonths(fyMonths.filter((m) => m <= asOfYm)));
  const monthly = fyMonths.map((ym) => ({
    ym,
    revenue: ym <= asOfYm ? actual.get(ym)?.revenue || 0 : null,
    gp: ym <= asOfYm ? actual.get(ym)?.gp || 0 : null,
    gmPct: ym <= asOfYm ? gmPct(actual.get(ym)?.gp || 0, actual.get(ym)?.revenue || 0) : null,
    revenueTarget: target.get(ym)?.revenue ?? null,
    gpTarget: target.get(ym)?.gp ?? null,
    contractors: ym <= asOfYm ? activeByMonth.get(ym) || 0 : null,
  }));

  // Assignments that billed in the period, with their drivers credited to the view.
  const byAssignment = sumFacts(ctx, ctx.currentWindow, (f) => (f.kind === "time" ? f.assignmentId : null));
  const assignments = [...byAssignment].map(([id, t]) => {
    const a = ctx.index.assignmentById.get(id);
    const ctr = ctx.index.contractorById.get(a.contractorId);
    return {
      assignmentId: id,
      contractor: ctr.name,
      title: ctr.title,
      placementType: a.placementType === "c2h" ? "Contract-to-hire" : "Contract",
      startDate: a.startDate,
      endDate: a.actualEndDate || a.plannedEndDate,
      ended: !!a.actualEndDate,
      billedHours: t.billedHours,
      paidHours: t.paidHours,
      avgBillRate: perHour(t.timeRevenue, t.billedHours),
      avgPayRate: perHour(t.wages, t.paidHours),
      wages: t.wages,
      burden: t.burden,
      otherDirect: t.odc,
      revenue: t.revenue,
      gp: t.gp,
      gmPct: gmPct(t.gp, t.revenue),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const opps = ctx.ds.opportunities.filter((o) => o.clientId === clientId && ctx.oppPass(o) && o.status === "open").map((o) => opportunityRow(ctx, o));
  const totals = sumFacts(ctx, ctx.currentWindow);
  return {
    data: {
      client: {
        id: client.id,
        name: client.name,
        vertical: ctx.index.verticalById.get(client.verticalId)?.name,
        location: ctx.index.branchById.get(client.branchId)?.name,
        serviceType: ctx.index.serviceLineById.get(client.serviceLineId)?.name,
        owners: client.owners.map((o) => ({ name: ctx.index.repById.get(o.repId)?.name, share: o.share * 100 })),
        acquiredDate: client.acquiredDate,
        isMsp: client.isMsp,
      },
      totals: { revenue: totals.revenue, gp: totals.gp, gmPct: gmPct(totals.gp, totals.revenue), billedHours: totals.billedHours },
      monthly,
      assignments,
      openOpportunities: opps,
      months: monthRange(ctx.period.from, toYm(ctx.endDate)),
    },
    families: ["actuals", "plans", "pipeline"],
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.crm, SOURCES.plans],
  };
}
