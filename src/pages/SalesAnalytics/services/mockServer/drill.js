// In-place drills: the trend chart (month → vertical → client → assignment)
// and the breakdown behind any KPI tile.

import { addMonths, dayOf, daysInMonth, formatYm } from "../../calc/dates";
import { compareLabel } from "../../calc/periods";
import { gmPct, perHour } from "../../calc/economics";
import { SOURCES } from "../../config/dataset";
import { activeContractorsOn, averageActive, emptyTotals, movements, sumExpenses, sumFacts, sumFactsByRep, sumPlans, windowDates } from "./aggregate";
import { clientDynamics, opportunityRow, PLAN_BASES, pipelineSnapshot, trendSeries, actualCompareWindows } from "./common";
import { buildRepRows } from "./repMetrics";

const col = (key, label, unit = "money") => ({ key, label, unit });
const FIN_COLUMNS = [col("revenue", "Revenue"), col("cmpRevenue", "Comparison revenue"), col("gp", "GP"), col("cmpGp", "Comparison GP"), col("gmPct", "GM", "pct")];

/** Trend drill: rows for the next level under `path`. */
export function trendDrillView(ctx, { path = [] }) {
  const [month, vertical, client] = path;
  const basis = ctx.filters.compare;
  if (!month) {
    return { data: { level: "month", title: "Revenue & GP by month", columns: [col("label", "Month", "text"), ...FIN_COLUMNS], rows: trendSeries(ctx).map((t) => ({ ...t, key: t.ym })) }, sources: [SOURCES.billing] };
  }
  const asOfYm = ctx.ds.meta.asOfYm;
  const fraction = month.key === asOfYm ? dayOf(ctx.ds.meta.asOf) / daysInMonth(asOfYm) : 1;
  const win = [{ ym: month.key, scale: 1, fraction }];
  const cmpWin = PLAN_BASES.includes(basis)
    ? [{ ym: month.key, scale: fraction, fraction }]
    : [{ ym: addMonths(month.key, basis === "py" ? -12 : -(ctx.period.lengthMonths || 1)), scale: fraction, fraction }];
  const verticalOf = (clientId) => ctx.index.clientById.get(clientId).verticalId;

  const level = !vertical ? "vertical" : !client ? "client" : "assignment";
  let keyFact;
  let keyPlan;
  let nameOf;
  if (level === "vertical") {
    keyFact = (f) => verticalOf(f.clientId);
    keyPlan = (p) => p.verticalId;
    nameOf = (k) => ctx.index.verticalById.get(k)?.name || k;
  } else if (level === "client") {
    keyFact = (f) => (verticalOf(f.clientId) === vertical.key ? f.clientId : null);
    keyPlan = (p) => (p.clientId && verticalOf(p.clientId) === vertical.key ? p.clientId : null);
    nameOf = (k) => ctx.index.clientById.get(k)?.name || k;
  } else {
    keyFact = (f) => (f.clientId === client.key ? f.assignmentId || f.placementId : null);
    keyPlan = () => null;
    nameOf = (k) => {
      const a = ctx.index.assignmentById.get(k);
      if (!a) return `Direct-hire placement ${k}`;
      const c = ctx.index.contractorById.get(a.contractorId);
      return `${c.name} · ${c.title}`;
    };
  }
  const cur = sumFacts(ctx, win, keyFact);
  const cmp = PLAN_BASES.includes(basis) ? sumPlans(ctx, cmpWin, basis, keyPlan) : sumFacts(ctx, cmpWin, keyFact);
  const rows = [...new Set([...cur.keys(), ...cmp.keys()])].map((k) => {
    const c = cur.get(k);
    const b = cmp.get(k);
    return {
      key: k,
      label: nameOf(k),
      revenue: c?.revenue || 0,
      gp: c?.gp || 0,
      gmPct: gmPct(c?.gp || 0, c?.revenue || 0),
      cmpRevenue: b?.revenue ?? null,
      cmpGp: b?.gp ?? null,
      billedHours: c?.billedHours || 0,
      avgBillRate: perHour(c?.timeRevenue || 0, c?.billedHours || 0),
      avgPayRate: perHour(c?.wages || 0, c?.paidHours || 0),
      burden: c?.burden || 0,
    };
  }).filter((r) => r.revenue || r.cmpRevenue).sort((a, b) => b.revenue - a.revenue);

  const labelFor = { vertical: "Vertical", client: "Client", assignment: "Assignment" }[level];
  const extra = level === "assignment" ? [col("billedHours", "Billed hours", "hours"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate"), col("burden", "Burden")] : [];
  return {
    data: {
      level,
      title: `${formatYm(month.key)}${vertical ? ` · ${ctx.index.verticalById.get(vertical.key)?.name}` : ""}${client ? ` · ${ctx.index.clientById.get(client.key)?.name}` : ""} — vs ${compareLabel(basis)}`,
      columns: [col("label", labelFor, "text"), ...FIN_COLUMNS, ...extra],
      rows,
      drillable: level !== "assignment",
    },
    sources: [SOURCES.billing, SOURCES.payroll, SOURCES.plans],
  };
}

const FINANCIAL = ["revenue", "gp", "gmPct", "quotaAttainment"];
const STAFFING = ["activeContractors", "avgActive", "starts", "ends", "billedHours", "avgBillRate", "avgPayRate", "spread", "spreadAfterBurden"];
const CLIENTS = ["newClients", "activeClients", "churnedClients", "expandingClients"];
const PIPELINE = ["openPipeline", "weightedPipeline", "coverage", "winRate"];
const EXPENSES = ["salesContribution", "salesExpenseRatio", "gpPerSalesDollar", "commission", "travel", "entertainment", "tAndE", "commissionEarned", "commissionApproved", "commissionProjected"];
const FORECAST = ["quarterForecast", "quarterForecastGp", "teamForecast", "myForecast"];

/** Breakdown behind a KPI tile, as one or more tables. */
export function kpiBreakdownView(ctx, { kpiKey, label }) {
  const sections = [];
  const verticalName = (k) => ctx.index.verticalById.get(k)?.name || k;
  const verticalOf = (f) => ctx.index.clientById.get(f.clientId).verticalId;

  if (FINANCIAL.includes(kpiKey) || EXPENSES.includes(kpiKey)) {
    const reps = buildRepRows(ctx);
    if (FINANCIAL.includes(kpiKey)) {
      const cur = sumFacts(ctx, ctx.currentWindow, verticalOf);
      const basis = ctx.filters.compare;
      const cmp = PLAN_BASES.includes(basis)
        ? sumPlans(ctx, ctx.planWindow, basis, (p) => p.verticalId)
        : sumFacts(ctx, ctx.compareWindow, verticalOf);
      sections.push({
        title: `By vertical — vs ${compareLabel(basis)}`,
        columns: [col("name", "Vertical", "text"), ...FIN_COLUMNS],
        rows: [...new Set([...cur.keys(), ...cmp.keys()])].map((k) => ({
          name: verticalName(k), revenue: cur.get(k)?.revenue || 0, cmpRevenue: cmp.get(k)?.revenue ?? null,
          gp: cur.get(k)?.gp || 0, cmpGp: cmp.get(k)?.gp ?? null, gmPct: gmPct(cur.get(k)?.gp || 0, cur.get(k)?.revenue || 0),
        })).sort((a, b) => b.revenue - a.revenue),
      });
      sections.push({
        title: "By salesperson",
        columns: [col("name", "Salesperson", "text"), col("team", "Team", "text"), col("revenue", "Revenue"), col("revenueTarget", "Revenue target"), col("gp", "GP"), col("gpTarget", "GP target"), col("gpAttainment", "GP attainment", "pct"), col("gmPct", "GM", "pct")],
        rows: [...reps].sort((a, b) => b.gp - a.gp),
      });
    } else {
      sections.push({
        title: "Sales expense and contribution by salesperson",
        columns: [col("name", "Salesperson", "text"), col("gp", "GP"), col("commission", "Commission"), col("commissionApproved", "of which approved"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("acquisition", "Acquisition"), col("salary", "Salary allocation"), col("salesExpense", "Total sales expense"), col("contribution", "Contribution")],
        rows: [...reps].sort((a, b) => b.contribution - a.contribution),
      });
      const asOfYm = ctx.ds.meta.asOfYm;
      const months = ctx.currentWindow.map((w) => w.ym);
      const byMonth = sumExpenses(ctx, ctx.currentWindow, (e) => e.ym);
      const gpByMonth = sumFacts(ctx, ctx.currentWindow, (f) => f.ym);
      sections.push({
        title: "By month",
        columns: [col("label", "Month", "text"), col("gp", "GP"), col("commission", "Commission"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("total", "Total sales expense"), col("contribution", "Contribution")],
        rows: months.map((ym) => {
          const e = byMonth.get(ym) || {};
          const g = gpByMonth.get(ym)?.gp || 0;
          return { label: `${formatYm(ym)}${ym === asOfYm ? " (to date)" : ""}`, gp: g, commission: e.commission || 0, travel: e.travel || 0, entertainment: e.entertainment || 0, total: e.total || 0, contribution: g - (e.total || 0) };
        }),
      });
    }
  } else if (STAFFING.includes(kpiKey)) {
    const { from, to } = windowDates(ctx.currentWindow, ctx.ds.meta.asOf);
    // Contractors, revenue and GP side by side for one grouping of clients (vertical or client).
    const staffingBy = (groupOf) => {
      const factKey = (f) => groupOf(ctx.index.clientById.get(f.clientId));
      const asgKey = (a) => groupOf(ctx.index.clientById.get(a.clientId));
      const totals = sumFacts(ctx, ctx.currentWindow, factKey);
      const active = activeContractorsOn(ctx, to, asgKey);
      const avg = averageActive(ctx, ctx.currentWindow, factKey);
      const mv = movements(ctx, from, to, asgKey);
      return [...new Set([...totals.keys(), ...active.keys()])].map((k) => {
        const t = totals.get(k) || emptyTotals();
        return {
          key: k, activeContractors: active.get(k)?.size || 0, avgActive: avg.get(k) || 0, starts: mv.get(k)?.starts || 0, ends: mv.get(k)?.ends || 0,
          revenue: t.revenue, gp: t.gp, gmPct: gmPct(t.gp, t.revenue), wages: t.wages,
          billedHours: t.billedHours, avgBillRate: perHour(t.timeRevenue, t.billedHours), avgPayRate: perHour(t.wages, t.paidHours),
          spreadAfterBurden: perHour(t.timeRevenue - t.wages - t.burden, t.billedHours),
        };
      });
    };
    const staffingColumns = [
      col("activeContractors", "Active at end", "count"), col("avgActive", "Average active", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"),
      col("revenue", "Revenue"), col("gp", "GP"), col("gmPct", "GM", "pct"),
      col("billedHours", "Billed hours", "hours"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate"), col("wages", "Payroll (wages)"), col("spreadAfterBurden", "Spread after burden", "rate"),
    ];
    sections.push({
      title: "By vertical",
      columns: [col("name", "Vertical", "text"), ...staffingColumns],
      rows: staffingBy((c) => c.verticalId).map((r) => ({ ...r, name: verticalName(r.key) })).sort((a, b) => b.revenue - a.revenue),
    });
    sections.push({
      title: "By client",
      columns: [col("name", "Client", "text"), col("vertical", "Vertical", "text"), ...staffingColumns],
      rows: staffingBy((c) => c.id)
        .map((r) => {
          const c = ctx.index.clientById.get(r.key);
          return { ...r, name: c.name, vertical: verticalName(c.verticalId) };
        })
        .sort((a, b) => b.revenue - a.revenue),
    });
    const ends = ctx.ds.assignments.filter((a) => a.actualEndDate && a.actualEndDate >= from && a.actualEndDate <= to && ctx.credit.has(a.clientId));
    const reasons = new Map();
    for (const a of ends) reasons.set(a.endReason, (reasons.get(a.endReason) || 0) + 1);
    sections.push({
      title: "Assignment ends by reason",
      columns: [col("reason", "Reason", "text"), col("count", "Ends", "count")],
      rows: [...reasons].map(([reason, count]) => ({ reason: END_LABELS[reason] || reason, count })).sort((a, b) => b.count - a.count),
    });
  } else if (CLIENTS.includes(kpiKey)) {
    const dyn = clientDynamics(ctx, ctx.currentWindow, actualCompareWindows(ctx).py);
    const clientRow = (c) => ({
      name: c.name, vertical: verticalName(c.verticalId), acquiredDate: c.acquiredDate, churnDate: c.churnDate, churnReason: c.churnReason,
      owner: c.owners.map((o) => ctx.index.repById.get(o.repId)?.name).join(", "),
    });
    if (kpiKey === "newClients") {
      sections.push({ title: "New clients won", columns: [col("name", "Client", "text"), col("vertical", "Vertical", "text"), col("acquiredDate", "Won", "date"), col("owner", "Owner", "text")], rows: dyn.newWins.map(clientRow) });
    } else if (kpiKey === "churnedClients") {
      sections.push({ title: "Clients lost", columns: [col("name", "Client", "text"), col("vertical", "Vertical", "text"), col("churnDate", "Lost", "date"), col("churnReason", "Reason", "text"), col("owner", "Owner", "text")], rows: dyn.churned.map(clientRow) });
    } else {
      for (const [key, title] of [["expanded", "Expanding"], ["contracted", "Contracting"], ["new", "New billing"], ["lost", "Stopped billing"]]) {
        sections.push({
          title: `${title} against prior year`,
          columns: [col("name", "Client", "text"), col("revenue", "Revenue"), col("revenueBase", "Revenue PY"), col("change", "Change")],
          rows: dyn.categories[key],
        });
      }
    }
  } else if (PIPELINE.includes(kpiKey)) {
    const pipe = pipelineSnapshot(ctx);
    if (kpiKey === "winRate") {
      sections.push({
        title: "Closed in the period",
        columns: [col("name", "Opportunity", "text"), col("owner", "Owner", "text"), col("status", "Outcome", "text"), col("expectedRevenue", "Expected revenue"), col("lossReason", "Loss reason", "text"), col("competitor", "Competitor", "text")],
        rows: [...pipe.won, ...pipe.lost].map((o) => opportunityRow(ctx, o)),
      });
    } else {
      sections.push({
        title: "Open opportunities",
        columns: [col("name", "Opportunity", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"), col("expectedRevenue", "Expected revenue"), col("weightedRevenue", "Weighted revenue"), col("weightedGp", "Weighted GP"), col("expectedStart", "Expected start", "date")],
        rows: pipe.open.map((o) => opportunityRow(ctx, o)).sort((a, b) => b.weightedRevenue - a.weightedRevenue),
      });
    }
  } else if (FORECAST.includes(kpiKey)) {
    const reps = buildRepRows(ctx);
    sections.push({
      title: "Quarter outlook by salesperson (system run-rate)",
      columns: [col("name", "Salesperson", "text"), col("priorQuarterRevenue", "Prior quarter actual"), col("quarterActualRevenue", "Actual to date"), col("quarterRemainingRevenue", "Remaining (run-rate)"), col("quarterForecastRevenue", "Full quarter"), col("quarterTargetRevenue", "Quarter target"), col("qoqGrowth", "QoQ", "pct")],
      rows: reps,
    });
  } else {
    const byRep = sumFactsByRep(ctx, ctx.currentWindow);
    sections.push({
      title: "By salesperson",
      columns: [col("name", "Salesperson", "text"), col("revenue", "Revenue"), col("gp", "GP")],
      rows: ctx.reps.map((r) => ({ name: r.name, revenue: byRep.get(r.id)?.revenue || 0, gp: byRep.get(r.id)?.gp || 0 })),
    });
  }

  return {
    data: { kpiKey, title: label || kpiKey, sections },
    families: FINANCIAL.includes(kpiKey) ? ["actuals", "plans"] : EXPENSES.includes(kpiKey) ? ["actuals", "expenses"] : PIPELINE.includes(kpiKey) ? ["pipeline"] : ["actuals"],
    sources: [SOURCES.billing, SOURCES.crm, SOURCES.expenses],
  };
}

const END_LABELS = {
  planned: "Planned completion",
  converted: "Converted to permanent",
  client_reduced: "Client reduced headcount",
  client_lost: "Client lost",
  contractor_quit: "Contractor resigned",
  client_ended: "Client ended early",
  performance: "Performance",
};

