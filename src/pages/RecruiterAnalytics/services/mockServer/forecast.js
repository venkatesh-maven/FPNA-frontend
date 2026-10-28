// Recruiting forecast workflow (spec 7.3 and 8). Recruiters save What-If
// scenarios, choose one as "My Recruiting Forecast" and submit it; the
// account manager (with the recruiter lead, who can review and return)
// returns, confirms or adjusts each submission, confirms the team forecast
// and sends the confirmed snapshot to Forecasting. Every action checks
// capability and data scope here, on the "server", and snapshots are
// recomputed from the scenario's assumptions rather than trusting numbers
// from the browser. Finance review, adjustments and approval are NOT here:
// they happen only in the Forecasting module after the transfer.

import { getDataset } from "../../mock/dataset";
import { buildQueryContext } from "./queryContext";
import { ForbiddenError, resolveAccess } from "./handle";
import { maskFields } from "./masking";
import { can, canAny } from "../../access/accessEngine";
import { CAPABILITY_IDS } from "../../access/capabilities";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { SOURCES } from "../../config/dataset";
import { addDays, formatDate, formatYm } from "../../calc/dates";
import { CONFIDENCE, emptyAssumptions, forecastRows, simulate } from "../../calc/whatIf";
import { buildWhatIfBaseline, quarterOf } from "./whatIf";
import { forecastStore, scenarioStore } from "../store/stores";
import { money } from "../../utils/format";

/* ---------------- baselines and snapshots ---------------- */

const systemAccess = (ds) => ({
  user: null,
  roleId: "system",
  roleLabel: "System",
  capabilities: new Set(CAPABILITY_IDS),
  scope: { kind: "all", repIds: new Set(ds.org.reps.map((r) => r.id)), teamIds: new Set(ds.org.teams.map((t) => t.id)), label: "All teams" },
  maskedFields: new Set(),
  delegations: [],
});

const baselineCache = new Map();
/** Unmasked baseline for one recruiter, for server-side snapshots and consolidation. */
export function systemBaseline(repId) {
  if (!baselineCache.has(repId)) {
    const ds = getDataset();
    baselineCache.set(repId, buildWhatIfBaseline(buildQueryContext(ds, DEFAULT_FILTERS, systemAccess(ds), { repIds: [repId] })));
  }
  return baselineCache.get(repId);
}

const pick = (t) => ({ revenue: t.revenue, gp: t.gp, directCost: t.directCost, hours: t.hours });

/** Immutable record of a forecast: totals, confidence, monthly client rows and the assumptions behind them. */
export function buildSnapshot(baseline, assumptions) {
  const r = simulate(baseline, assumptions);
  return {
    quarterKey: baseline.quarter.key,
    quarterLabel: baseline.quarter.label,
    actual: pick(r.actual),
    remaining: pick(r.modeled),
    quarter: { ...pick(r.quarter), gmPct: r.quarter.gmPct },
    confidence: Object.fromEntries(CONFIDENCE.map((c) => [c, { revenue: r.confidence[c].revenue, gp: r.confidence[c].gp }])),
    activity: r.activity,
    attainment: r.attainment,
    commission: r.commission ? { quarterTotal: r.commission.quarterTotal, projectedRemaining: r.commission.projectedRemaining, earnedToDate: r.commission.earnedToDate } : null,
    contribution: r.contribution,
    months: r.months.map((m) => ({ ym: m.ym, revenue: m.total.revenue, gp: m.total.gp, actualRevenue: m.actual.revenue, actualGp: m.actual.gp })),
    rows: forecastRows(baseline, r),
    target: baseline.target,
    priorQuarter: baseline.priorQuarter,
    assumptions,
  };
}

const n = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));
const signed = (v, unit = "%") => `${n(v) > 0 ? "+" : ""}${n(v)}${unit}`;

/**
 * Plain-language list of what a scenario changes, for account managers and
 * leads drilling from a submission into its operational assumptions. Pay,
 * burden and expense details are left out for viewers without cost detail.
 */
export function describeAssumptions(b, a, { costDetail = true } = {}) {
  if (!a) return [];
  const out = [];
  const g = a.global || {};
  const clientName = (id) => b.clients.find((c) => c.id === id)?.name || id;
  const firstMonth = b.quarter.months.find((m) => m >= b.quarter.asOf.slice(0, 7));
  if (g.extensionProbability != null && g.extensionProbability !== "") out.push(`Extension probability ${n(g.extensionProbability)}% for assignments ending this quarter (historical ${b.defaults.extensionProbability}%)`);
  if (n(g.hoursPct)) out.push(`Hours worked ${signed(g.hoursPct)} across all clients`);
  if (n(g.billRatePct)) out.push(`Bill rates ${signed(g.billRatePct)} across all clients from ${formatYm(g.rateEffectiveYm || firstMonth)}`);
  if (costDetail && n(g.payRatePct)) out.push(`Pay rates ${signed(g.payRatePct)} across all clients from ${formatYm(g.rateEffectiveYm || firstMonth)}`);
  if (costDetail && n(g.payrollTaxPp)) out.push(`Payroll taxes ${signed(g.payrollTaxPp, " pp")} of wages`);
  if (costDetail && n(g.wcPp)) out.push(`Workers' compensation ${signed(g.wcPp, " pp")} of wages`);
  if (costDetail && n(g.benefitsPerHour)) out.push(`Benefits ${money(n(g.benefitsPerHour))} per paid hour`);
  if (costDetail && n(g.odcPerContractorMonth)) out.push(`Other direct costs ${money(n(g.odcPerContractorMonth))} per contractor per month`);
  for (const [id, o] of Object.entries(a.assignments || {})) {
    const x = b.assignments.find((y) => y.id === id);
    if (!x) continue;
    const parts = [];
    if (o.extensionProbability != null && o.extensionProbability !== "") parts.push(`extension ${n(o.extensionProbability)}%`);
    if (o.endDate) parts.push(`ends ${formatDate(o.endDate)}`);
    if (o.hoursPerWeek != null && o.hoursPerWeek !== "") parts.push(`${n(o.hoursPerWeek)} hrs/week`);
    if (o.billRate != null && o.billRate !== "") parts.push(`bill ${money(n(o.billRate))}/hr`);
    if (costDetail && o.payRate != null && o.payRate !== "") parts.push(`pay ${money(n(o.payRate))}/hr`);
    if (parts.length) out.push(`${x.contractor} at ${clientName(x.clientId)}: ${parts.join(", ")}`);
  }
  for (const [id, c] of Object.entries(a.clients || {})) {
    const parts = [];
    if (n(c.billRatePct)) parts.push(`bill rates ${signed(c.billRatePct)}`);
    if (costDetail && n(c.payRatePct)) parts.push(`pay rates ${signed(c.payRatePct)}`);
    if (n(c.hoursPct)) parts.push(`hours ${signed(c.hoursPct)}`);
    if (c.lose) parts.push(`client lost from ${formatDate(c.loseFrom || addDays(b.quarter.asOf, 1))}`);
    if (n(c.delayStartsWeeks)) parts.push(`starts delayed ${n(c.delayStartsWeeks)} weeks`);
    if (parts.length) out.push(`${clientName(id)}: ${parts.join(", ")}`);
  }
  for (const s of a.newStarts || []) {
    const where = s.clientId ? clientName(s.clientId) : s.name || "a new client";
    out.push(`${n(s.count)} new start${n(s.count) === 1 ? "" : "s"} at ${where} from ${formatDate(s.startDate)} for ${n(s.durationMonths)} months at ${money(n(s.billRate))}/hr${costDetail ? ` (pay ${money(n(s.payRate))}/hr)` : ""}${s.committed ? " — committed" : " — upside"}`);
  }
  for (const [id, o] of Object.entries(a.opportunities || {})) {
    const opp = b.opportunities.find((x) => x.id === id);
    if (!opp) continue;
    if (o.include === false) {
      out.push(`${opp.name}: excluded from the forecast`);
      continue;
    }
    const parts = [];
    if (o.probability != null && o.probability !== "") parts.push(`fill probability ${n(o.probability)}% (stage ${Math.round(opp.probability)}%)`);
    if (o.startDate) parts.push(`start ${formatDate(o.startDate)}`);
    if (o.headcount != null && o.headcount !== "") parts.push(`${n(o.headcount)} contractors`);
    if (n(o.rampMonths)) parts.push(`ramp over ${n(o.rampMonths)} months`);
    if (o.billRate != null && o.billRate !== "") parts.push(`bill ${money(n(o.billRate))}/hr`);
    if (parts.length) out.push(`${opp.name}: ${parts.join(", ")}`);
  }
  if (costDetail) {
    for (const [k, label] of [["travel", "Travel"], ["entertainment", "Client entertainment"], ["acquisition", "Client acquisition"]]) {
      const v = a.expenses?.[k];
      if (v != null && v !== "") out.push(`${label} ${money(n(v))} for the rest of the quarter`);
    }
  }
  return out;
}

/* ---------------- store helpers ---------------- */

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const currentQuarterKey = () => quarterOf(getDataset().meta.asOf).from;

const latestFor = (subs, repId, quarterKey) =>
  subs.filter((s) => s.repId === repId && s.quarterKey === quarterKey && s.status !== "superseded").sort((a, b) => b.version - a.version)[0] || null;

const adjustmentTotal = (s) =>
  (s?.adjustments || []).reduce((t, a) => ({ revenue: t.revenue + n(a.revenue), gp: t.gp + n(a.gp) }), { revenue: 0, gp: 0 });

const SAMPLE_RETURN_COMMENTS = [
  "Please add the extension we discussed on your largest client and re-check the start date on your late-stage job order.",
  "Your job-order fill odds are above stage history — bring them back to stage probability or note what supports them.",
  "Travel for the rest of the quarter looks low for the client visits you have planned — please revisit.",
];

/**
 * Sample submissions so the account manager and lead screens have something
 * to review: most recruiters have submitted, some are confirmed, a few
 * returned and a few missing. Real submissions replace these when made.
 */
export function ensureSeeded() {
  const ds = getDataset();
  const quarterKey = currentQuarterKey();
  const st = forecastStore.read();
  if (st.seededFor === quarterKey) return;
  const subs = [];
  ds.org.reps.forEach((rep, i) => {
    const kind = i % 6; // 0 missing · 1 confirmed · 2 returned · otherwise submitted
    if (kind === 0) return;
    const b = systemBaseline(rep.id);
    const a = emptyAssumptions();
    if (i % 3 === 0) a.global.extensionProbability = Math.min(80, b.defaults.extensionProbability + 15);
    const top = b.opportunities[0];
    if (top && i % 2 === 1) a.opportunities[top.id] = { probability: Math.min(90, Math.round(top.probability + 15)) };
    const day = addDays(ds.meta.asOf, -(1 + (i % 5)));
    const director = ds.index.personById.get(ds.index.teamById.get(rep.teamId).directorId);
    const status = kind === 1 ? "confirmed" : kind === 2 ? "returned" : "submitted";
    subs.push({
      id: `FS-${rep.id}-V1`,
      repId: rep.id,
      teamId: rep.teamId,
      version: 1,
      quarterKey,
      scenarioId: null,
      scenarioName: "My Recruiting Forecast",
      submittedBy: { id: rep.id, name: rep.name },
      submittedAt: `${day}T16:00:00.000Z`,
      note: "",
      status,
      reviews:
        status === "submitted"
          ? []
          : [{ action: status, comment: status === "returned" ? SAMPLE_RETURN_COMMENTS[i % SAMPLE_RETURN_COMMENTS.length] : "", by: { id: director.id, name: director.name }, at: `${ds.meta.asOf}T10:00:00.000Z` }],
      adjustments: [],
      sample: true,
      snapshot: buildSnapshot(b, a),
    });
  });
  forecastStore.write({
    seededFor: quarterKey,
    submissions: [...st.submissions.filter((s) => s.quarterKey !== quarterKey), ...subs],
    confirmations: st.confirmations.filter((c) => c.quarterKey !== quarterKey),
    transfers: st.transfers.filter((t) => t.quarterKey !== quarterKey),
  });
}

/* ---------------- guards ---------------- */

function guard(viewer, caps) {
  const access = resolveAccess(viewer);
  if (caps.length && !canAny(access, caps)) throw new ForbiddenError();
  return access;
}

function requireRep(access, repId) {
  if (!repId || !access.scope.repIds.has(repId)) throw new ForbiddenError("That recruiter isn't in your scope.");
}

const who = (access) => ({ id: access.user.id, name: access.user.name });
const masked = (access, data) => maskFields(data, access.maskedFields);

/** A submission without its heavy rows, for lists and history. */
const light = (s) => {
  if (!s) return null;
  const { snapshot, ...rest } = s;
  const totals = { ...snapshot };
  delete totals.rows;
  delete totals.assumptions;
  delete totals.months;
  return { ...rest, snapshot: totals, adjustmentTotal: adjustmentTotal(s) };
};

/* ---------------- scenarios ---------------- */

export async function listScenarios(viewer, repId) {
  const access = guard(viewer, ["create_scenario"]);
  requireRep(access, repId);
  return scenarioStore
    .read()
    .scenarios.filter((s) => s.repId === repId && s.ownerId === access.user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveScenario(viewer, { id, repId, name, assumptions }) {
  const access = guard(viewer, ["create_scenario"]);
  requireRep(access, repId);
  const label = String(name || "").trim().slice(0, 80);
  if (!label) throw new Error("Give the scenario a name.");
  if (!assumptions || typeof assumptions !== "object") throw new Error("Nothing to save.");
  let saved = null;
  scenarioStore.update((st) => {
    const existing = id ? st.scenarios.find((s) => s.id === id) : null;
    if (existing && (existing.ownerId !== access.user.id || existing.repId !== repId)) throw new ForbiddenError("You can only change your own scenarios.");
    if (existing) {
      Object.assign(existing, { name: label, assumptions, updatedAt: now() });
      saved = existing;
    } else {
      saved = { id: uid("SC"), repId, ownerId: access.user.id, ownerName: access.user.name, name: label, assumptions, isMyForecast: false, createdAt: now(), updatedAt: now() };
      st.scenarios.push(saved);
    }
    return st;
  });
  return saved;
}

export async function deleteScenario(viewer, id) {
  const access = guard(viewer, ["create_scenario"]);
  scenarioStore.update((st) => {
    const s = st.scenarios.find((x) => x.id === id);
    if (!s || s.ownerId !== access.user.id) throw new ForbiddenError("You can only delete your own scenarios.");
    st.scenarios = st.scenarios.filter((x) => x.id !== id);
    return st;
  });
}

/** Mark one of your own scenarios as "My Recruiting Forecast" (one per recruiter). */
export async function setMyForecast(viewer, scenarioId) {
  const access = guard(viewer, ["edit_own_forecast"]);
  const repId = access.user.id;
  requireRep(access, repId);
  scenarioStore.update((st) => {
    const s = st.scenarios.find((x) => x.id === scenarioId);
    if (!s || s.ownerId !== repId || s.repId !== repId) throw new ForbiddenError("Only your own scenarios can be your recruiting forecast.");
    for (const x of st.scenarios) if (x.repId === repId && x.ownerId === repId) x.isMyForecast = x.id === scenarioId;
    return st;
  });
}

/* ---------------- recruiter submission ---------------- */

export async function submitForecast(viewer, { note = "" } = {}) {
  const access = guard(viewer, ["edit_own_forecast"]);
  const repId = access.user.id;
  requireRep(access, repId);
  ensureSeeded();
  const scenario = scenarioStore.read().scenarios.find((s) => s.repId === repId && s.ownerId === repId && s.isMyForecast);
  if (!scenario) throw new Error("Choose a saved scenario as My Recruiting Forecast before submitting.");
  const quarterKey = currentQuarterKey();
  const latest = latestFor(forecastStore.read().submissions, repId, quarterKey);
  if (latest?.status === "confirmed") throw new Error("Your account manager has confirmed this quarter's forecast. Ask them to return it if it needs to change.");
  const rep = getDataset().index.repById.get(repId);
  const snapshot = buildSnapshot(systemBaseline(repId), scenario.assumptions);
  let created = null;
  forecastStore.update((st) => {
    const versions = st.submissions.filter((s) => s.repId === repId && s.quarterKey === quarterKey).map((s) => s.version);
    for (const s of st.submissions) if (s.repId === repId && s.quarterKey === quarterKey && s.status !== "superseded") s.status = "superseded";
    created = {
      id: uid("FS"),
      repId,
      teamId: rep.teamId,
      version: (versions.length ? Math.max(...versions) : 0) + 1,
      quarterKey,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      submittedBy: who(access),
      submittedAt: now(),
      note: String(note || "").slice(0, 500),
      status: "submitted",
      reviews: [],
      adjustments: [],
      snapshot,
    };
    st.submissions.push(created);
    return st;
  });
  return masked(access, light(created));
}

/** A recruiter's submissions this quarter, newest first (the recruiter or their reviewers). */
export async function getForecastStatus(viewer, repId) {
  const access = guard(viewer, ["view_own_analytics", "review_team_forecast"]);
  requireRep(access, repId);
  ensureSeeded();
  const quarterKey = currentQuarterKey();
  const history = forecastStore
    .read()
    .submissions.filter((s) => s.repId === repId && s.quarterKey === quarterKey)
    .sort((a, b) => b.version - a.version)
    .map(light);
  return masked(access, { latest: history.find((s) => s.status !== "superseded") || null, history });
}

/** One submission in full: monthly client rows and the assumptions behind them. */
export async function getSubmission(viewer, submissionId) {
  const access = guard(viewer, ["view_own_analytics", "review_team_forecast"]);
  const s = forecastStore.read().submissions.find((x) => x.id === submissionId);
  if (!s) throw new Error("That submission no longer exists.");
  requireRep(access, s.repId);
  const b = systemBaseline(s.repId);
  return masked(access, {
    ...s,
    adjustmentTotal: adjustmentTotal(s),
    assumptionNotes: describeAssumptions(b, s.snapshot.assumptions, { costDetail: can(access, "view_cost_detail") }),
    rep: b.rep,
  });
}

/* ---------------- account manager / lead review ---------------- */

function updateSubmission(access, submissionId, fn) {
  let out = null;
  forecastStore.update((st) => {
    const s = st.submissions.find((x) => x.id === submissionId);
    if (!s) throw new Error("That submission no longer exists.");
    requireRep(access, s.repId);
    if (s.status === "superseded") throw new Error("A newer version of this forecast has been submitted.");
    fn(s);
    out = s;
    return st;
  });
  return masked(access, light(out));
}

export async function returnSubmission(viewer, { submissionId, comment }) {
  const access = guard(viewer, ["review_team_forecast"]);
  const text = String(comment || "").trim();
  if (!text) throw new Error("Add a comment so the recruiter knows what to revise.");
  return updateSubmission(access, submissionId, (s) => {
    if (!["submitted", "confirmed"].includes(s.status)) throw new Error("Only submitted or confirmed forecasts can be returned.");
    s.status = "returned";
    s.reviews = [...(s.reviews || []), { action: "returned", comment: text.slice(0, 500), by: who(access), at: now() }];
  });
}

export async function confirmSubmission(viewer, { submissionId }) {
  const access = guard(viewer, ["confirm_team_forecast"]);
  return updateSubmission(access, submissionId, (s) => {
    if (s.status !== "submitted") throw new Error("Only a submitted forecast can be confirmed.");
    s.status = "confirmed";
    s.reviews = [...(s.reviews || []), { action: "confirmed", comment: "", by: who(access), at: now() }];
  });
}

/** Account manager adjustment: clearly labelled, with a reason; the recruiter's original stays as submitted. */
export async function addAdjustment(viewer, { submissionId, revenue, gp, reason }) {
  const access = guard(viewer, ["confirm_team_forecast"]);
  const why = String(reason || "").trim();
  if (why.length < 5) throw new Error("Give a reason for the adjustment.");
  const r = Number(revenue || 0);
  const g = Number(gp || 0);
  if (!Number.isFinite(r) || !Number.isFinite(g) || (!r && !g)) throw new Error("Enter a revenue or GP adjustment.");
  return updateSubmission(access, submissionId, (s) => {
    s.adjustments = [...(s.adjustments || []), { id: uid("ADJ"), revenue: r, gp: g, reason: why.slice(0, 300), by: who(access), at: now() }];
  });
}

export async function removeAdjustment(viewer, { submissionId, adjustmentId }) {
  const access = guard(viewer, ["confirm_team_forecast"]);
  return updateSubmission(access, submissionId, (s) => {
    s.adjustments = (s.adjustments || []).filter((a) => a.id !== adjustmentId);
  });
}

/* ---------------- consolidation ---------------- */

const systemCache = new Map();
/** The system baseline (no assumptions) for a recruiter who hasn't submitted. */
function systemForecast(repId) {
  if (!systemCache.has(repId)) systemCache.set(repId, buildSnapshot(systemBaseline(repId), emptyAssumptions()));
  return systemCache.get(repId);
}

const pctChange = (cur, base) => (base ? ((cur - base) / Math.abs(base)) * 100 : null);

/** Rows per recruiter: latest submission (or system baseline), adjustments and comparison to prior quarter and target. */
export function consolidate(repIds) {
  ensureSeeded();
  const ds = getDataset();
  const quarterKey = currentQuarterKey();
  const subs = forecastStore.read().submissions;
  return repIds.map((repId) => {
    const rep = ds.index.repById.get(repId);
    const latest = latestFor(subs, repId, quarterKey);
    const snap = latest ? latest.snapshot : systemForecast(repId);
    const adj = adjustmentTotal(latest);
    const revenue = snap.quarter.revenue + adj.revenue;
    const gp = snap.quarter.gp + adj.gp;
    const conf = snap.confidence;
    return {
      repId,
      name: rep.name,
      teamId: rep.teamId,
      team: ds.index.teamById.get(rep.teamId).name,
      status: latest?.status || "missing",
      source: latest ? `Submission v${latest.version}` : "System baseline",
      submissionId: latest?.id || null,
      version: latest?.version || null,
      submittedAt: latest?.submittedAt || null,
      lastReview: latest?.reviews?.[latest.reviews.length - 1] || null,
      sample: !!latest?.sample,
      priorQuarterRevenue: snap.priorQuarter.revenue,
      priorQuarterGp: snap.priorQuarter.gp,
      actualRevenue: snap.actual.revenue,
      actualGp: snap.actual.gp,
      remainingRevenue: snap.remaining.revenue + adj.revenue,
      remainingGp: snap.remaining.gp + adj.gp,
      forecastRevenue: revenue,
      forecastGp: gp,
      adjustmentRevenue: adj.revenue,
      adjustmentGp: adj.gp,
      adjustmentCount: latest?.adjustments?.length || 0,
      qoqGrowth: pctChange(revenue, snap.priorQuarter.revenue),
      qoqGpGrowth: pctChange(gp, snap.priorQuarter.gp),
      targetRevenue: snap.target.revenue,
      targetGp: snap.target.gp,
      vsTargetRevenue: revenue - snap.target.revenue,
      vsTargetGp: gp - snap.target.gp,
      gpAttainment: snap.target.gp ? (gp / snap.target.gp) * 100 : null,
      confirmedGp: conf.actual.gp + conf.confirmed.gp,
      probableGp: conf.probable.gp,
      upsideGp: conf.upside.gp,
      confidence: conf,
    };
  });
}

const sumBy = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + (r[k] || 0), 0)]));
const TOTAL_KEYS = ["priorQuarterRevenue", "priorQuarterGp", "actualRevenue", "actualGp", "remainingRevenue", "remainingGp", "forecastRevenue", "forecastGp", "adjustmentRevenue", "adjustmentGp", "targetRevenue", "targetGp", "vsTargetRevenue", "vsTargetGp", "confirmedGp", "probableGp", "upsideGp"];

/** Totals for KPI tiles: the consolidated forecast and how much of it is submitted / confirmed. */
export function consolidatedTotals(repIds) {
  const rows = consolidate(repIds);
  const t = sumBy(rows, ["forecastRevenue", "forecastGp", "priorQuarterRevenue", "priorQuarterGp", "targetRevenue", "targetGp"]);
  const count = (st) => rows.filter((r) => r.status === st).length;
  return { ...t, reps: rows.length, submitted: rows.length - count("missing"), confirmed: count("confirmed"), returned: count("returned"), missing: count("missing") };
}

const scopeKeyOf = (teamIds) => [...teamIds].sort().join("+");

/** Lead / account manager / director (and CEO) consolidation of the current quarter's recruiting forecast. */
export function teamForecastView(ctx) {
  const quarter = quarterOf(ctx.ds.meta.asOf);
  const rows = consolidate(ctx.reps.map((r) => r.id));
  const bucket = (pred) => {
    const list = rows.filter(pred);
    return { count: list.length, revenue: list.reduce((s, r) => s + r.forecastRevenue, 0), gp: list.reduce((s, r) => s + r.forecastGp, 0) };
  };
  const confidence = Object.fromEntries(CONFIDENCE.map((c) => [c, { revenue: rows.reduce((s, r) => s + r.confidence[c].revenue, 0), gp: rows.reduce((s, r) => s + r.confidence[c].gp, 0) }]));
  const st = forecastStore.read();
  const scopeTeams = [...ctx.access.scope.teamIds];
  const scopeKey = scopeKeyOf(scopeTeams);
  const inScope = (c) => c.quarterKey === quarter.from && c.teamIds.every((t) => ctx.access.scope.teamIds.has(t));
  const latestByScope = new Map();
  for (const c of st.confirmations.filter(inScope).sort((a, b) => b.version - a.version)) if (!latestByScope.has(c.scopeKey)) latestByScope.set(c.scopeKey, c);
  const subs = st.submissions;
  const confirmations = [...latestByScope.values()].map((c) => ({
    ...c,
    // Stale when an included forecast was returned or resubmitted after the team confirmation.
    stale: c.submissions.some((x) => latestFor(subs, x.repId, c.quarterKey)?.id !== x.id || subs.find((s) => s.id === x.id)?.status !== "confirmed"),
  }));
  const transfers = st.transfers.filter((t) => t.quarterKey === quarter.from && t.teamIds.every((id) => ctx.access.scope.teamIds.has(id))).sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  return {
    data: {
      quarter: { key: quarter.from, label: quarter.label },
      reps: rows,
      totals: sumBy(rows, TOTAL_KEYS),
      buckets: {
        confirmed: bucket((r) => r.status === "confirmed"),
        unconfirmed: bucket((r) => r.status === "submitted" || r.status === "returned"),
        missing: bucket((r) => r.status === "missing"),
      },
      confidence,
      scope: { key: scopeKey, teamIds: scopeTeams, label: ctx.access.scope.label },
      confirmation: confirmations.find((c) => c.scopeKey === scopeKey) || null,
      otherConfirmations: confirmations.filter((c) => c.scopeKey !== scopeKey),
      transfers,
      permissions: {
        review: can(ctx.access, "review_team_forecast"),
        confirm: can(ctx.access, "confirm_team_forecast"),
        push: can(ctx.access, "push_forecast_to_forecasting"),
      },
    },
    families: ["actuals", "plans", "pipeline"],
    sources: [SOURCES.billing, SOURCES.crm, SOURCES.plans, "Recruiting forecast submissions (sample)"],
    notes: [
      "Recruiters without a submission are shown at the system baseline: actual to date plus current assignments' run-rate, extensions at the historical rate and open job orders at stage probability.",
      "Finance review, commentary, adjustments and approval happen only in the Forecasting module after the transfer.",
    ],
  };
}

/** The account manager confirms the team forecast: only confirmed submissions go in; anyone else is listed as excluded. */
export async function confirmTeamForecast(viewer, { note = "", acknowledgeExcluded = false } = {}) {
  const access = guard(viewer, ["confirm_team_forecast"]);
  ensureSeeded();
  const ds = getDataset();
  const quarterKey = currentQuarterKey();
  const repIds = ds.org.reps.filter((r) => access.scope.repIds.has(r.id)).map((r) => r.id);
  const subs = forecastStore.read().submissions;
  const latest = repIds.map((id) => latestFor(subs, id, quarterKey));
  const confirmed = latest.filter((s) => s?.status === "confirmed");
  if (!confirmed.length) throw new Error("Confirm at least one recruiter's forecast first.");
  const excluded = repIds.filter((id, i) => latest[i]?.status !== "confirmed");
  if (excluded.length && !acknowledgeExcluded) {
    throw new Error(`${excluded.length} ${excluded.length === 1 ? "recruiter has" : "recruiters have"} no confirmed forecast. Confirm them first, or confirm the team without them.`);
  }
  const teamIds = [...access.scope.teamIds].sort();
  const scopeKey = scopeKeyOf(teamIds);
  const totals = confirmed.reduce(
    (t, s) => {
      const adj = adjustmentTotal(s);
      return { revenue: t.revenue + s.snapshot.quarter.revenue + adj.revenue, gp: t.gp + s.snapshot.quarter.gp + adj.gp };
    },
    { revenue: 0, gp: 0 }
  );
  let created = null;
  forecastStore.update((st) => {
    const versions = st.confirmations.filter((c) => c.scopeKey === scopeKey && c.quarterKey === quarterKey).map((c) => c.version);
    for (const c of st.confirmations) if (c.scopeKey === scopeKey && c.quarterKey === quarterKey) c.status = "superseded";
    created = {
      id: uid("TC"),
      scopeKey,
      teamIds,
      teamNames: teamIds.map((t) => ds.index.teamById.get(t)?.name),
      quarterKey,
      version: (versions.length ? Math.max(...versions) : 0) + 1,
      confirmedBy: who(access),
      confirmedAt: now(),
      note: String(note || "").slice(0, 500),
      submissions: confirmed.map((s) => ({ id: s.id, repId: s.repId, version: s.version })),
      excludedRepIds: excluded,
      totals,
      status: "confirmed",
    };
    st.confirmations.push(created);
    return st;
  });
  return created;
}

/**
 * "Send to Forecasting": validates the confirmed team snapshot and records
 * an immutable, versioned transfer. Resending the same confirmation returns
 * the original receipt (no duplicate posting); a failed validation leaves the
 * confirmed forecast unchanged and records the errors.
 */
export async function sendToForecasting(viewer, { confirmationId }) {
  const access = guard(viewer, ["push_forecast_to_forecasting"]);
  const ds = getDataset();
  const st = forecastStore.read();
  const c = st.confirmations.find((x) => x.id === confirmationId);
  if (!c) throw new Error("That team confirmation no longer exists.");
  if (!c.teamIds.every((t) => access.scope.teamIds.has(t))) throw new ForbiddenError("That team forecast isn't in your scope.");
  if (c.status === "superseded") throw new Error("A newer team confirmation exists; send that one.");
  const dedupeKey = `${c.quarterKey}|${c.scopeKey}|v${c.version}`;
  const existing = st.transfers.find((t) => t.dedupeKey === dedupeKey && t.status === "received");
  if (existing) return { ...existing, duplicate: true };

  const errors = [];
  const records = [];
  const adjustments = [];
  for (const item of c.submissions) {
    const s = st.submissions.find((x) => x.id === item.id);
    const rep = ds.index.repById.get(item.repId);
    const team = ds.index.teamById.get(rep.teamId);
    if (!s || latestFor(st.submissions, item.repId, c.quarterKey)?.id !== s.id || s.status !== "confirmed") {
      errors.push(`${rep.name}'s forecast changed after the team confirmation. Confirm the team forecast again.`);
      continue;
    }
    for (const r of s.snapshot.rows) {
      records.push({
        reportingMonth: r.ym,
        clientId: r.clientId,
        client: r.client,
        business: r.business,
        repId: rep.id,
        salesperson: rep.name,
        teamId: team.id,
        team: team.name,
        businessUnit: r.bu,
        vertical: r.vertical,
        location: r.location,
        serviceType: r.serviceType,
        contractors: r.fte,
        starts: r.starts,
        ends: r.ends,
        hours: r.hours,
        billRate: r.billRate,
        payRate: r.payRate,
        directCost: r.directCost,
        revenue: r.revenue,
        gp: r.gp,
        gmPct: r.gmPct,
        confidence: r.confidence,
        submissionId: s.id,
        submissionVersion: s.version,
      });
    }
    for (const a of s.adjustments || []) adjustments.push({ ...a, repId: rep.id, submissionId: s.id });
  }
  for (const r of records) {
    const missing = ["reportingMonth", "client", "businessUnit", "vertical", "location"].filter((k) => !r[k]);
    if (missing.length) errors.push(`${r.client || "A row"} (${r.reportingMonth}) is missing ${missing.join(", ")}.`);
    if (!Number.isFinite(r.revenue) || !Number.isFinite(r.gp) || r.revenue < 0) errors.push(`${r.client} (${r.reportingMonth}) has an invalid revenue or GP value.`);
  }
  const sent = {
    revenue: records.reduce((s, r) => s + r.revenue, 0) + adjustments.reduce((s, a) => s + n(a.revenue), 0),
    gp: records.reduce((s, r) => s + r.gp, 0) + adjustments.reduce((s, a) => s + n(a.gp), 0),
  };
  if (!errors.length && (Math.abs(sent.revenue - c.totals.revenue) > 1 || Math.abs(sent.gp - c.totals.gp) > 1)) {
    errors.push("Transfer totals don't reconcile to the confirmed team forecast.");
  }
  const transfer = {
    id: uid("TR"),
    dedupeKey,
    confirmationId: c.id,
    version: c.version,
    quarterKey: c.quarterKey,
    scopeKey: c.scopeKey,
    teamIds: c.teamIds,
    teamNames: c.teamNames,
    sentBy: who(access),
    sentAt: now(),
    status: errors.length ? "failed" : "received",
    errors: [...new Set(errors)].slice(0, 20),
    recordCount: records.length,
    adjustmentCount: adjustments.length,
    totals: c.totals,
    reconciliation: { sentRevenue: sent.revenue, sentGp: sent.gp, confirmedRevenue: c.totals.revenue, confirmedGp: c.totals.gp },
    destination: "Forecasting module — working forecast (sample)",
  };
  forecastStore.update((s) => {
    s.transfers.push(transfer);
    return s;
  });
  return transfer;
}
