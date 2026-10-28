import { insight as baseInsight, listNames, pctChange } from "./phrasing";
import { byUnit } from "../utils/format";

// Rule-based insights for the Recruiting Health page (spec 11.4). Text explains
// what the leading indicators mean and what to do; the figures are on the
// tiles and in each insight's evidence. Wording keeps observed facts,
// estimated risk and hypothetical improvement apart.

const col = (key, label, unit = "money") => ({ key, label, unit });
/** Evidence rows keep only their columns, so the AI context carries nothing extra. */
const insight = (o) =>
  baseInsight({
    ...o,
    evidence: o.evidence
      ? { ...o.evidence, rows: (o.evidence.rows || []).map((r) => Object.fromEntries(o.evidence.columns.filter((c) => r[c.key] !== undefined).map((c) => [c.key, r[c.key]]))) }
      : null,
  });
const fmt = (v, unit) => (v == null ? "—" : byUnit(v, unit, { compact: unit === "money" }));
const ppMove = (a, b) => (a != null && b != null ? a - b : null);
const direction = (d, { up = "more", down = "less", flat = "about as", threshold = 2 } = {}) =>
  d == null ? null : d >= threshold ? up : d <= -threshold ? down : flat;
/** "more often than" / "less often than" / "about as often as". */
const oftenThan = (word) => (word === "about as" ? "about as often as" : `${word} often than`);

const STAGE_GUIDANCE = {
  Sourcing: {
    meaning: "Leakage this early usually means job orders are taken before the role, rate and start date are firm, or the candidate pool for the skill is thin.",
    actions: ["Widen sourcing channels for the skill — referrals, job boards and past candidates — so every job order has a shortlist within days.", "Offer redeployable contractors finishing other assignments first; they are already vetted and can start sooner."],
  },
  Submitted: {
    meaning: "Job orders that stall after submittal usually mean candidates did not match the brief closely enough, or the hiring manager has not given feedback.",
    actions: ["Tighten screening so every submittal matches the must-have skills, rate and availability in the brief.", "Chase hiring-manager feedback within two days of each submittal and resubmit quickly when a candidate is declined."],
  },
  Interviewing: {
    meaning: "Fall-out at interview usually comes from under-prepared candidates, slow debriefs or hiring managers moving interview slots, which lets good candidates take other offers.",
    actions: ["Prep every candidate on the role, team and interview format, and debrief both candidate and hiring manager the same day.", "Hold hiring managers to agreed interview slots so candidates are not lost to faster agencies."],
  },
  Offer: {
    meaning: "Late-stage losses usually mean rate, start date or a counter-offer was not settled before the offer went out.",
    actions: ["Confirm rate and start date with the client and candidate early, and pre-close the candidate on counter-offers.", "Run background and reference checks in parallel with the offer so the start date holds."],
  },
};

const LOSS_ACTIONS = {
  "Rate / markup too high": ["Give account managers a markup floor and the authority to trade duration or volume instead of rate.", "Lead with fill speed and candidate quality where clients compare agencies on rate."],
  "Filled by another agency": ["Debrief the largest losses with the hiring manager to learn why another agency's candidate was chosen.", "Get the first strong shortlist in front of the client on multi-agency job orders; speed usually decides who fills them."],
  "Client went quiet": ["Agree interview and decision dates with the hiring manager before sourcing starts.", "Close out job orders with no client response instead of carrying them."],
  "Position put on hold": ["Keep on-hold job orders warm with a check-in tied to the client's budget cycle.", "Shift recruiter effort to clients with approved headcount this quarter."],
  "No qualified candidates": ["Flag hard-to-fill skills before committing to start dates, and widen sourcing channels early.", "Offer contractors coming off assignment who have adjacent skills."],
  "Filled internally": ["Ask hiring managers up front whether internal candidates are in the running, and prioritise job orders where they are not."],
};

const OPP_EVIDENCE = [
  col("client", "Client", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"),
  col("weightedGp", "Weighted GP"), col("daysInStage", "Days in stage", "days"), col("closeDateChanges", "Fill-date changes", "count"), col("expectedStart", "Expected start", "date"),
];

export function buildHealthInsights(m) {
  if (m.kind === "own") return salespersonInsights(m);
  if (m.kind === "teams") return directorInsights(m);
  return executiveInsights(m);
}

// ---------------------------------------------------------------------------
// Shared builders

function coverageInsight(m, id) {
  const { pipeline } = m;
  const c = pipeline.coverage;
  const c3 = pipeline.coverage3m;
  if (!pipeline.totals.count && c.revenue.uncoveredTarget <= 0 && c.gp.uncoveredTarget <= 0) return null;
  const covered = (k) => c[k].uncoveredTarget <= 0 || (c[k].coverage != null && c[k].coverage >= 1);
  const runRateEnough = c.revenue.uncoveredTarget <= 0 && c.gp.uncoveredTarget <= 0;
  const weaker = c.gp.coverage != null && c3.gp.coverage != null && c.gp.coverage < c3.gp.coverage * 0.9;
  const stronger = c.gp.coverage != null && c3.gp.coverage != null && c.gp.coverage > c3.gp.coverage * 1.1;
  const thinGp = c.revenue.coverage != null && c.gp.coverage != null && c.gp.coverage < c.revenue.coverage * 0.85;
  const both = covered("revenue") && covered("gp");
  const title = runRateEnough
    ? `Current billing already covers the ${c.label} target, so open job orders are upside`
    : both
      ? `Weighted pipeline covers the ${c.label} target gap left after current billing${weaker ? ", but by less than three months ago" : ""}`
      : `Weighted pipeline does not cover the ${c.label} target gap left after current billing${weaker ? ", and coverage has weakened" : ""}`;
  const meaning = [
    runRateEnough
      ? "The existing billable base, at today's run-rate, is enough to reach the target; the near-term risk is losing run-rate through assignments that end without a replacement."
      : both
        ? "If open job orders fill at their recorded probabilities and start on schedule, the period reaches target; starts that slip past period end are the main threat."
        : "Even if open job orders fill at their recorded probabilities and start on time, the period lands short unless run-rate grows or more placements start inside the period.",
    thinGp ? "GP coverage trails revenue coverage, so the job orders in hand carry thinner spreads than the plan assumes." : null,
    stronger ? "Coverage is stronger than at the same point three months ago." : null,
  ].filter(Boolean).join(" ");
  const actions = runRateEnough
    ? ["Protect run-rate: confirm extensions on assignments ending before period end.", "Keep bringing in job orders for the next period rather than pulling starts forward."]
    : [
        both ? "Lock start dates on late-stage job orders so the placements bill inside the period." : "Bring in new job orders from active clients that can start inside the period, and put recruiter capacity on them first.",
        thinGp ? "Review markup on the largest open job orders before rates are confirmed." : "Re-confirm job orders past their expected start date with the hiring manager before counting them in the outlook.",
      ];
  const k = (v, unit) => fmt(v, unit);
  return insight({
    id,
    section: "health-pipeline",
    category: "forecast",
    severity: runRateEnough || (both && !weaker) ? "positive" : both ? "neutral" : "negative",
    title,
    meaning,
    actions,
    evidence: {
      title: `${c.label} coverage lineage — now and three months ago (${c3.label})`,
      columns: [col("label", "Measure", "text"), col("revenue", "Revenue", "text"), col("gp", "GP", "text"), col("revenue3m", "Revenue · 3 months ago", "text"), col("gp3m", "GP · 3 months ago", "text")],
      rows: [
        ["Target for the period", "target", "money"],
        ["Actual to date", "actualToDate", "money"],
        ["Run-rate, rest of period", "runRateProjection", "money"],
        ["Target not yet covered", "uncoveredTarget", "money"],
        ["Weighted pipeline landing", "weightedLanding", "money"],
        ["Coverage", "coverage", "ratio"],
      ].map(([label, key, unit]) => ({ label, revenue: k(c.revenue[key], unit), gp: k(c.gp[key], unit), revenue3m: k(c3.revenue[key], unit), gp3m: k(c3.gp[key], unit) })),
    },
    whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
  });
}

function concentrationInsight(m, id) {
  const { pipeline } = m;
  if (!pipeline.totals.count) return null;
  const share = pipeline.concentration.top5Share ?? 0;
  const top = pipeline.concentration.topClient;
  const concentrated = share > 40;
  const oneAccount = top && (top.share ?? 0) > 25;
  return insight({
    id,
    section: "health-pipeline",
    category: "pipeline",
    severity: concentrated || oneAccount ? "negative" : "positive",
    title: concentrated ? "A handful of job orders carry most of the weighted pipeline" : "Weighted pipeline is spread across many job orders",
    meaning: [
      concentrated
        ? "A slip or loss on any one of the largest job orders moves coverage materially, so the outlook is more fragile than the total suggests."
        : "No single slip changes the outlook much, so the pipeline total is a fair guide to what can land.",
      oneAccount ? `${top.name} alone is a large part of the weighted value, which adds single-client exposure.` : null,
    ].filter(Boolean).join(" "),
    actions: concentrated || oneAccount
      ? ["Put the strongest recruiters on the largest job orders and agree interview and decision dates with each hiring manager.", "Bring in job orders from other clients and verticals so the outlook doesn't hinge on a few hiring decisions."]
      : ["Keep weekly job-order reviews so the broad base keeps moving.", "Push the strongest mid-sized job orders to interview to lift near-term coverage."],
    evidence: { title: "Largest open job orders by weighted GP", columns: OPP_EVIDENCE, rows: pipeline.concentration.top5 },
    whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
  });
}

function stageChangeRows(m) {
  const { funnel } = m;
  return funnel.stages.map((s, i) => {
    const p = funnel.priorStages[i];
    return { stage: s.stage, conversion: s.conversion, priorConversion: p.conversion, change: ppMove(s.conversion, p.conversion), eligible: s.eligible, priorEligible: p.eligible };
  });
}

function stuckInsight(m, id, { personal = false } = {}) {
  const { pipeline } = m;
  if (!pipeline.totals.count) return null;
  const stale = pipeline.stale;
  const byOwner = new Map();
  for (const r of stale) byOwner.set(r.owner, (byOwner.get(r.owner) || 0) + r.weightedGp);
  const owners = [...byOwner.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  if (!stale.length) {
    return insight({
      id,
      section: "health-pipeline",
      category: "pipeline",
      severity: "positive",
      title: "No open job orders are stuck beyond their stage thresholds",
      meaning: "Job orders are moving through stages within normal time, so recorded probabilities are a reasonable guide.",
      actions: ["Keep a dated next step on every open job order so it stays that way."],
      evidence: { title: "Open job orders by stage", columns: [col("stage", "Stage", "text"), col("count", "Job orders", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("threshold", "Threshold", "days")], rows: pipeline.byStage },
    });
  }
  return insight({
    id,
    section: "health-pipeline",
    category: "pipeline",
    severity: "negative",
    title: personal || owners.length < 2 ? "Some open job orders are stuck beyond their stage thresholds" : `Job orders stuck beyond stage thresholds sit mostly with ${listNames(owners, 2)}`,
    meaning: "A job order that sits past its stage threshold is less likely to fill at its recorded probability, so the weighted pipeline overstates what will land until these are re-confirmed with the client.",
    actions: [
      "Re-confirm each stuck job order with the hiring manager: set a dated next step or close it out.",
      personal ? "Chase the hiring manager on your oldest stuck job order this week." : "Use the oldest stuck job orders as coaching cases for the recruiters carrying them.",
    ],
    evidence: {
      title: "Job orders stuck beyond stage thresholds",
      columns: [col("client", "Client", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("daysInStage", "Days in stage", "days"), col("stageThreshold", "Threshold", "days"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
      rows: stale.slice(0, 20),
    },
    whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
  });
}

/** No job orders decided in the period: say what that means for the evidence, not the figures. */
function noDecisionsInsight(m, id, { personal = false } = {}) {
  const late = m.pipeline.rows.filter((r) => r.stage === "Offer" || r.stage === "Interviewing");
  return insight({
    id,
    section: "health-winloss",
    category: "pipeline",
    severity: "neutral",
    title: personal ? "None of your job orders were decided this period" : "No job orders were decided this period",
    meaning: "Without fills or losses there is no new evidence on fill rate or loss reasons, so the job orders at interview and offer are where the next read on conversion will come from.",
    actions: late.length
      ? [`Get a dated hiring decision from ${listNames(late.slice(0, 2).map((r) => r.client), 2)}.`, "Record a loss reason on every job order that is lost so patterns are visible."]
      : ["Get submittals in front of hiring managers so interviews and decisions start to flow.", "Record a loss reason on every job order that is lost so patterns are visible."],
    evidence: late.length ? { title: "Late-stage job orders awaiting a decision", columns: OPP_EVIDENCE, rows: late.slice(0, 10) } : null,
    whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
  });
}

/** Where job orders most often stall or are lost, with stage-specific coaching. */
function weakestStageInsight(m, id, { personal = false } = {}) {
  const { funnel } = m;
  const weakest = funnel.stages.filter((x) => x.eligible >= 2).sort((a, b) => (a.conversion ?? 101) - (b.conversion ?? 101))[0];
  const columns = [col("stage", "Stage", "text"), col("entered", "Entered", "count"), col("advanced", "Advanced", "count"), col("lost", "Lost", "count"), col("open", "Still in stage", "count"), col("conversion", "Conversion", "pct"), col("avgStageDays", "Avg stage days", "days")];
  if (funnel.overall.eligible < 3 || !weakest) {
    return insight({
      id,
      section: "health-conversion",
      category: "effectiveness",
      severity: "neutral",
      title: personal ? "Too few of your job orders have finished a stage to judge conversion yet" : "Too few job orders have finished a stage to judge conversion yet",
      meaning: "Conversion is measured only on job orders that have moved on or been lost, so a young or small cohort gives no reliable read; the rate will firm up as current job orders resolve.",
      actions: ["Agree a dated next step on every open job order so stages resolve rather than stall.", "Record losses as they happen so leakage shows up at the right stage."],
      evidence: { title: `Stage conversion · entries ${m.w.cohort.label}`, columns, rows: funnel.stages },
    });
  }
  const g = STAGE_GUIDANCE[weakest.stage];
  return insight({
    id,
    section: "health-conversion",
    category: "effectiveness",
    severity: "neutral",
    title: `${personal ? "Your job orders" : "Job orders"} most often stall or are lost at ${weakest.stage}`,
    meaning: g.meaning,
    actions: g.actions,
    evidence: { title: `${personal ? "Your stage" : "Stage"} conversion · entries ${m.w.cohort.label}`, columns, rows: funnel.stages },
    whatIf: { label: "Model fill probability", prefill: { focus: "pipeline" } },
  });
}

/** Job-order timing: slippage and stage aging, framed for the viewer. */
function timingInsight(m, id, { personal = false } = {}) {
  const { velocity, pipeline } = m;
  if (!pipeline.totals.count) {
    return insight({
      id,
      section: "health-velocity",
      category: "forecast",
      severity: "negative",
      title: personal ? "You have no open job orders to move forward" : "There are no open job orders to move forward",
      meaning: "With nothing in the pipeline, future starts depend entirely on extensions and redeployments at existing clients.",
      actions: ["Ask growing clients for their next job orders first; existing clients fill fastest.", "Re-engage clients that have gone quiet, starting in the strongest verticals."],
      evidence: null,
      whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
    });
  }
  const slipped = velocity.slipped;
  const stuck = pipeline.stale;
  const issues = slipped.length + stuck.length > 0;
  return insight({
    id,
    section: "health-velocity",
    category: "forecast",
    severity: issues ? "neutral" : "positive",
    title: issues
      ? `${personal ? "Some of your job orders" : "Some job orders"} are slipping or ageing in stage`
      : `${personal ? "Your open job orders" : "Open job orders"} are holding their dates and moving through stages on time`,
    meaning: issues
      ? "Pushed fill dates and long stage times usually mean the hiring manager hasn't committed to interviews or a decision; until they do, the expected start dates are optimistic."
      : "No job order has been pushed or sat past its stage threshold, so the timing in the pipeline is a fair guide to when starts will land.",
    actions: issues
      ? ["Agree a dated next step with the hiring manager on each slipping or stuck job order.", "Confirm start dates before counting these job orders in the period outlook."]
      : ["Keep a dated next step on every job order.", "Finish candidate paperwork and checks ahead of expected starts so they happen on the day."],
    evidence: {
      title: "Open job orders by days in stage",
      columns: [col("client", "Client", "text"), col("stage", "Stage", "text"), col("daysInStage", "Days in stage", "days"), col("stageThreshold", "Threshold", "days"), col("closeDateChanges", "Fill-date changes", "count"), col("expectedStart", "Expected start", "date")],
      rows: [...pipeline.rows].sort((a, b) => b.daysInStage - a.daysInStage).slice(0, 10),
    },
    whatIf: { label: "Model pipeline timing", prefill: { focus: "pipeline" } },
  });
}

function winRateInsight(m, id) {
  const { winLoss, w } = m;
  if (!winLoss.all.closed) return noDecisionsInsight(m, id);
  const diff = ppMove(winLoss.newClient.rate, winLoss.base.newClient.rate);
  const word = direction(diff);
  const [first, second] = winLoss.reasons;
  const avoidShare = winLoss.all.lost ? winLoss.avoidableLost / winLoss.all.lost : 0;
  return insight({
    id,
    section: "health-winloss",
    category: "pipeline",
    severity: word === "more" ? "positive" : word === "less" ? "negative" : "neutral",
    title: word ? `New-client job orders are being filled ${oftenThan(word)} in the ${w.baseLabel.toLowerCase()} window` : "How the job orders decided this period were filled and lost",
    meaning: [
      first ? `${first.reason} is the most common reason job orders are lost${second ? `, followed by ${second.reason.toLowerCase()}` : ""}.` : "No job orders were lost in the period.",
      avoidShare >= 0.5 ? "Most losses sit in reasons the team controls — rates, client follow-up and candidate supply — so fill rate can be improved without new demand." : null,
    ].filter(Boolean).join(" "),
    actions: (first && LOSS_ACTIONS[first.reason]) || ["Record a loss reason on every lost job order so patterns are visible."],
    evidence: {
      title: "Lost job orders by reason",
      columns: [col("reason", "Loss reason", "text"), col("avoidableReason", "Avoidable", "text"), col("lost", "Job orders", "count"), col("lostGp", "Expected GP lost")],
      rows: winLoss.reasons,
    },
  });
}

function atRiskInsight(m, id, { personal = false, byOwner = false } = {}) {
  const { retention } = m;
  const list = retention.atRisk;
  const high = list.filter((r) => r.atRisk === "High");
  if (!list.length) {
    return insight({
      id,
      section: "health-churn",
      category: "performance",
      severity: "positive",
      title: personal ? "None of your clients show early warning signs" : "No clients show early warning signs",
      meaning: "No client combines falling GP, shrinking headcount, mostly-ending assignments or a billing gap, so the client base looks stable for now.",
      actions: ["Use the stable base to grow: ask the healthiest clients for next quarter's job orders."],
      evidence: null,
    });
  }
  const names = (high.length ? high : list).map((r) => r.client);
  const owners = [...new Set((high.length ? high : list).map((r) => r.primaryOwner).filter(Boolean))];
  return insight({
    id,
    section: "health-churn",
    category: "performance",
    severity: high.length ? "negative" : "neutral",
    title: personal
      ? `${listNames(names, 2)} ${names.length === 1 ? "shows" : "show"} early signs of risk`
      : byOwner && owners.length
        ? `At-risk clients are concentrated on the desks of ${listNames(owners, 2)}`
        : `GP at risk is concentrated in ${listNames(names, 2)}`,
    meaning: [
      "This is an estimate from falling GP, shrinking headcount, ending assignments and billing gaps — not a recorded loss.",
      high.length
        ? "Clients with several signals at once are the ones most likely to reduce or leave next quarter, which would take their run-rate GP with them."
        : "Each client shows one signal so far, which is worth a conversation before it becomes a trend.",
    ].join(" "),
    actions: [
      personal ? "Call the hiring manager at each at-risk client this week to check on contractor performance and upcoming demand." : "Review each high-risk client with the recruiters placing there and agree a recovery plan.",
      "Line up extensions or replacement roles before assignments at these clients end.",
    ],
    evidence: {
      title: "Clients with early warning signs (estimated)",
      columns: [col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("atRisk", "Risk", "text"), col("riskFlags", "Signals", "text"), col("gpLast3Months", "GP last 3 months"), col("gpPrior3Months", "GP prior 3 months"), col("expiringAssignments", "Ending soon", "count")],
      rows: list.slice(0, 20),
    },
    whatIf: { label: "Model starts and ends", prefill: { focus: "staffing" } },
  });
}

function expiringRows(m) {
  return m.movement.expiring;
}

// ---------------------------------------------------------------------------
// Director view (company-wide: recruiting directors and the CEO)

function executiveInsights(m) {
  const out = [];
  const { funnel, reqs, retention, movement, velocity, w } = m;
  out.push(coverageInsight(m, "health-exec-coverage"));
  out.push(concentrationInsight(m, "health-exec-concentration"));

  // Conversion change by stage against the prior cohort.
  const changes = stageChangeRows(m).filter((r) => r.change != null && r.eligible >= 5 && r.priorEligible >= 5);
  if (changes.length) {
    const biggest = [...changes].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
    const overall = ppMove(funnel.overall.conversion, funnel.priorOverall.conversion);
    const word = direction(overall, { threshold: 1.5 });
    const g = STAGE_GUIDANCE[biggest.stage];
    out.push(
      insight({
        id: "health-exec-conversion",
        section: "health-conversion",
        category: "pipeline",
        severity: word === "more" ? "positive" : word === "less" ? "negative" : "neutral",
        title: `Job orders are advancing ${oftenThan(word)} the prior cohort, with the biggest change at ${biggest.stage}`,
        meaning: `${biggest.change < 0 ? g.meaning : `Conversion at ${biggest.stage} has improved, which is where the funnel is gaining most.`} Cohorts compare only job orders that have left each stage, so younger job orders still in progress don't distort the comparison.`,
        actions: biggest.change < 0 ? g.actions : ["Find what changed at this stage — screening, candidate prep or hiring-manager engagement — and make it standard practice.", "Watch the next stage for the extra volume so it doesn't become the new bottleneck."],
        evidence: {
          title: `Stage conversion: ${w.cohort.label} against ${w.priorCohort.label}`,
          columns: [col("stage", "Stage", "text"), col("conversion", "Conversion", "pct"), col("priorConversion", "Prior cohort", "pct"), col("change", "Change", "pp"), col("eligible", "Resolved entries", "count"), col("priorEligible", "Prior resolved", "count")],
          rows: stageChangeRows(m),
        },
        whatIf: { label: "Model fill probability", prefill: { focus: "pipeline" } },
      })
    );
  }

  // Requisition conversion: fill rate and speed to billing.
  if (reqs.cur.eligible) {
    const fillMove = ppMove(reqs.cur.fillRate, reqs.prior.fillRate);
    const speedMove = pctChange(reqs.cur.avgDaysToFill, reqs.prior.avgDaysToFill);
    const worse = (fillMove ?? 0) <= -2 || (speedMove ?? 0) > 10;
    const better = (fillMove ?? 0) >= 2 || (speedMove ?? 0) < -10;
    const row = (label, key, unit) => ({ label, cur: fmt(reqs.cur[key], unit), base: fmt(reqs.prior[key], unit) });
    out.push(
      insight({
        id: "health-exec-fill",
        section: "health-conversion",
        category: "staffing",
        severity: worse ? "negative" : better ? "positive" : "neutral",
        title: worse
          ? "Requisitions are converting to starts less reliably than in the prior twelve months"
          : better
            ? "Requisitions are converting to starts more reliably than in the prior twelve months"
            : "Requisitions are converting to starts at a steady pace",
        meaning: "Fill rate is the bridge between client demand and billable starts: an unfilled requisition is revenue the client wanted and did not get, and slower fills push first billing out.",
        actions: worse
          ? ["Move recruiter capacity onto the oldest open requisitions at the highest-spread clients.", "Review cancelled requisitions with account managers to separate client changes from fill failures."]
          : ["Keep fill-time targets in recruiter reviews so speed holds as demand grows.", "Use fast-fill clients as references in new-client pursuits."],
        evidence: {
          title: `Requisitions opened ${w.cohort.label} against ${w.priorCohort.label}`,
          columns: [col("label", "Measure", "text"), col("cur", "Last 12 months", "text"), col("base", "Prior 12 months", "text")],
          rows: [row("Opened", "eligible", "count"), row("Filled", "filled", "count"), row("Cancelled", "cancelled", "count"), row("Still open", "open", "count"), row("Fill rate", "fillRate", "pct"), row("Days to fill", "avgDaysToFill", "days"), row("Fill to first billing", "avgFillToBilling", "days")],
        },
        whatIf: { label: "Model requisition fills", prefill: { focus: "staffing" } },
      })
    );
  }

  out.push(winRateInsight(m, "health-exec-winrate"));

  // Churn drivers: lost clients vs contraction, and why headcount ended.
  const gp = retention.gp;
  if (gp.base > 0) {
    const shrinking = gp.churned > gp.expansion;
    const losers = retention.rows.filter((r) => r.lostGp > 0).slice(0, 3);
    const mainlyContraction = gp.contraction >= gp.lost;
    const clientDriven = movement.total.clientDriven >= Math.max(movement.total.early, 1);
    out.push(
      insight({
        id: "health-exec-churn",
        section: "health-churn",
        category: "performance",
        severity: shrinking ? "negative" : "positive",
        title: shrinking ? "GP lost from existing clients is outrunning their growth" : "Growth at existing clients more than offsets the GP they lost",
        meaning: [
          mainlyContraction
            ? "Most of the loss comes from clients shrinking rather than leaving, which is recoverable through backfills and extensions."
            : "Most of the loss comes from clients that stopped billing altogether, which needs replacement demand rather than backfills.",
          losers.length ? `${listNames(losers.map((r) => r.client))} account for the largest share.` : null,
          clientDriven ? "Where assignments ended before plan, it was mostly because clients reduced roles rather than contractors leaving, so the loss is demand-driven." : "Contractor departures rather than client decisions account for most assignments ending before plan.",
          "Planned assignment endings are counted separately and are not treated as client churn.",
        ].filter(Boolean).join(" "),
        actions: shrinking
          ? [mainlyContraction ? "Run recovery calls with the largest shrinking clients to understand demand and which other agencies they are using." : "Agree a win-back plan for each lost client with a named contact and date.", clientDriven ? "Ask stable clients for new job orders to offset reductions elsewhere." : "Review pay and engagement on assignments with early resignations."]
          : ["Keep regular check-ins with the growing clients so the momentum holds.", "Use growing clients as references when pitching clients in the same verticals."],
        evidence: {
          title: `Clients losing the most GP against ${w.base.label}`,
          columns: [col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("status", "Status", "text"), col("baseGp", `GP · ${w.baseLabel}`), col("gp", "GP now"), col("lostGp", "GP lost"), col("contractorEnds", "Contractor ends", "count"), col("churnReason", "Main reason", "text")],
          rows: retention.rows.filter((r) => r.lostGp > 0).slice(0, 15),
        },
        whatIf: { label: "Model retention and starts", prefill: { focus: "staffing" } },
      })
    );
  }

  out.push(atRiskInsight(m, "health-exec-gp-at-risk"));

  // Contractor attrition composition and redeployment.
  const t = movement.total;
  if (t.ends || t.starts) {
    const earlyHeavy = t.ends > 0 && t.early / t.ends >= 0.3;
    const lowRedeploy = t.starts >= 5 && (t.redeployRate ?? 0) < 20;
    out.push(
      insight({
        id: "health-exec-attrition",
        section: "health-movement",
        category: "staffing",
        severity: t.netChange >= 0 && !earlyHeavy ? "positive" : "negative",
        title: t.netChange > 0 ? "More contractors started than ended, so the billable base is growing" : t.netChange === 0 ? "Starts matched ends, so the billable base is holding" : "More contractors ended than started, so the billable base is shrinking",
        meaning: [
          earlyHeavy
            ? "Early terminations are a large share of ends, which points to fit, pay or client-satisfaction problems rather than normal assignment completion."
            : "Most ends were planned completions or conversions to permanent roles — the normal assignment life-cycle rather than client loss.",
          lowRedeploy ? "Few new starts come from contractors finishing other assignments, so experienced people leave the bench and each start costs more to source." : null,
        ].filter(Boolean).join(" "),
        actions: [
          earlyHeavy ? "Review early terminations by client and recruiter to find the common cause." : "Confirm extensions two to three weeks before planned ends.",
          lowRedeploy ? "Make redeployment the first option for every contractor finishing an assignment." : "Keep redeployment matching in the weekly recruiter review.",
        ],
        evidence: {
          title: "Why assignments ended",
          columns: [col("reason", "Reason", "text"), col("endClass", "Type", "text"), col("count", "Ends", "count")],
          rows: movement.endReasons,
        },
        whatIf: { label: "Model starts and ends", prefill: { focus: "staffing" } },
      })
    );
  }

  // Velocity: slippage and time to first billing.
  if (m.pipeline.totals.count) {
    const slipShare = velocity.slipped.length / m.pipeline.totals.count;
    const slow = velocity.avgDaysToFirstBilling != null && velocity.avgDaysToFirstBilling > 45;
    out.push(
      insight({
        id: "health-exec-velocity",
        section: "health-velocity",
        category: "forecast",
        severity: slipShare > 0.3 || slow ? "negative" : "neutral",
        title: slipShare > 0.3 ? "Many open job orders have moved their expected fill dates" : "Most open job orders are holding their expected fill dates",
        meaning: [
          slipShare > 0.3
            ? "Repeated pushes usually mean the hiring decision or start date isn't confirmed, so weighting these job orders at their recorded probabilities overstates near-term revenue."
            : "Fill dates are largely holding, so the timing in the pipeline is a reasonable guide.",
          velocity.avgDaysToFirstBilling != null
            ? slow
              ? "New clients take a long time to reach first billing after their first fill, which delays payback on the effort to win them."
              : "New clients reach first billing soon after their first fill, so the effort to win them turns into GP quickly."
            : null,
        ].filter(Boolean).join(" "),
        actions: [
          slipShare > 0.3 ? "Require confirmed decision and start dates from the hiring manager before a job order moves to offer." : "Keep fill-date discipline in weekly job-order reviews.",
          slow ? "Put a dedicated recruiter on every new client from day one so its next roles fill and start faster." : "Agree a plan for further roles with each new client within its first quarter.",
        ],
        evidence: {
          title: "Open job orders with the most slippage",
          columns: [col("client", "Client", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("originalCloseDate", "Original fill date", "date"), col("closeDate", "Current fill date", "date"), col("closeDateChanges", "Pushes", "count"), col("daysMoved", "Days moved", "days"), col("weightedGp", "Weighted GP")],
          rows: velocity.slipped.slice(0, 15),
        },
        whatIf: { label: "Model pipeline timing", prefill: { focus: "pipeline" } },
      })
    );
  }

  out.push(efficiencyInsight(m, "health-exec-efficiency"));
  return out.filter(Boolean);
}

function efficiencyInsight(m, id) {
  const { efficiency: e, w } = m;
  if (!e.gp) return null;
  const move = ppMove(e.costToGp, e.baseCostToGp);
  const word = direction(move, { up: "more", down: "less", flat: "about the same share", threshold: 1 });
  const rows = [
    ["Gross profit", e.gp, e.baseGp, true],
    ["Commissions", e.exp.commission, e.expBase.commission, m.canSeeCommissions],
    ["Travel", e.exp.travel, e.expBase.travel, m.canSeeCostDetail],
    ["Client entertainment", e.exp.entertainment, e.expBase.entertainment, m.canSeeCostDetail],
    ["Client acquisition", e.exp.acquisition, e.expBase.acquisition, m.canSeeCostDetail],
    ["Salary & benefits allocation", e.exp.salary, e.expBase.salary, m.canSeeCostDetail],
    ["Total recruiting expense", e.exp.total, e.expBase.total, true],
  ].filter(([, , , ok]) => ok).map(([label, cur, base]) => ({ label, cur, base, growth: pctChange(cur, base) }));
  return insight({
    id,
    section: "health-efficiency",
    category: "cost",
    severity: word === "more" ? "negative" : word === "less" ? "positive" : "neutral",
    title: word === "about the same share" ? `Recruiting cost absorbs about the same share of GP as in the ${w.baseLabel.toLowerCase()} window` : `Recruiting cost absorbs ${word} of GP than in the ${w.baseLabel.toLowerCase()} window`,
    meaning: word === "more"
      ? "Each dollar of recruiting spend is buying less GP, so contribution grows more slowly than GP; open job orders need to fill for the spend to pay back."
      : word === "less"
        ? "Recruiting spend is working harder: GP is growing faster than the cost of producing it."
        : "Recruiting cost is moving in line with GP, so contribution tracks GP.",
    actions: word === "more"
      ? ["Concentrate spend on job orders at interview or later, where fills are most likely.", "Review discretionary spend against allowance for the people furthest over."]
      : ["Keep current expense controls and reinvest in the stages with the best conversion."],
    evidence: {
      title: `Recruiting expense against GP · this period and ${w.base.label}`,
      columns: [col("label", "Measure", "text"), col("cur", "This period"), col("base", w.baseLabel), col("growth", "Growth", "pct")],
      rows,
    },
  });
}

// ---------------------------------------------------------------------------
// Account manager (team view)

function directorInsights(m) {
  const out = [];
  const { funnel, winLoss, movement, velocity, efficiency, w } = m;

  // Highest / lowest conversion by recruiter.
  const reps = funnel.byRep.filter((r) => r.eligible >= 5 && r.conversion != null);
  if (reps.length >= 2) {
    const sorted = [...reps].sort((a, b) => b.conversion - a.conversion);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const g = STAGE_GUIDANCE[worst.weakestStage] || STAGE_GUIDANCE.Interviewing;
    out.push(
      insight({
        id: "health-dir-conversion",
        section: "health-conversion",
        category: "effectiveness",
        severity: "neutral",
        title: `${best.name} converts the most stage entries; ${worst.name} the fewest`,
        meaning: `${worst.name}'s job orders most often stall or are lost at ${worst.weakestStage || "Interviewing"}. ${g.meaning}`,
        actions: [`Pair ${worst.name} with ${best.name} to review job orders at the ${worst.weakestStage || "Interviewing"} stage.`, ...g.actions.slice(0, 1)],
        evidence: {
          title: `Conversion by recruiter · stage entries ${w.cohort.label}`,
          columns: [col("name", "Recruiter", "text"), col("eligible", "Resolved entries", "count"), col("advanced", "Advanced", "count"), col("lost", "Lost", "count"), col("conversion", "Conversion", "pct"), col("cohortWinRate", "Sourcing → filled", "pct"), col("weakestStage", "Weakest stage", "text")],
          rows: sorted,
        },
        whatIf: { label: "Model fill probability", prefill: { focus: "pipeline" } },
      })
    );
  } else {
    out.push(weakestStageInsight(m, "health-dir-conversion"));
  }

  // Largest new client brought on.
  const lw = winLoss.largestWin;
  if (lw) {
    const tl = velocity.timeline.find((t) => t.opportunityId === lw.id);
    out.push(
      insight({
        id: "health-dir-largest-win",
        section: "health-winloss",
        category: "pipeline",
        severity: "positive",
        title: `${lw.client} is the largest new client brought on ${lw.inPeriod ? "this period" : "in the last twelve months"}`,
        meaning: [
          "A new client is expected value until contractors start: GP appears only as placements start and timesheets bill, so the first weeks decide how quickly the client pays back.",
          tl && !tl.firstBillingDate ? "It has not billed yet, so getting the first contractors started is the priority." : null,
        ].filter(Boolean).join(" "),
        actions: ["Put a dedicated recruiter on the client's next requisitions and track time to first start.", "Agree a plan for further roles with the hiring manager within the first quarter."],
        evidence: {
          title: "New clients and their first fills, starts and billing",
          columns: [col("client", "Client", "text"), col("owner", "Recruiter", "text"), col("winDate", "Job order filled", "date"), col("expectedGp", "Expected GP"), col("firstFillDate", "First fill", "date"), col("firstStartDate", "First start", "date"), col("firstBillingDate", "First billing", "date")],
          rows: velocity.timeline.slice().sort((a, b) => b.expectedGp - a.expectedGp).slice(0, 10),
        },
      })
    );
  }

  // Avoidable losses.
  if (winLoss.all.lost) {
    const avoidable = winLoss.rows.filter((r) => r.avoidable);
    const owners = [...new Set(avoidable.map((r) => r.owner))];
    const reasons = [...new Set(avoidable.map((r) => r.reason))];
    out.push(
      insight({
        id: "health-dir-avoidable",
        section: "health-winloss",
        category: "effectiveness",
        severity: avoidable.length ? "negative" : "positive",
        title: avoidable.length
          ? owners.length > 1 ? `Avoidable losses cluster with ${listNames(owners, 2)}` : "Some job orders were lost for reasons the team controls"
          : "This period's losses were mostly outside the team's control",
        meaning: avoidable.length
          ? `Losses recorded as ${listNames(reasons.map((r) => r.toLowerCase()), 3)} are within the team's control — rate discipline, client follow-up and candidate supply — so they are the cheapest fill rate to recover.`
          : "Job orders were lost to other agencies, client holds or internal hires rather than rate, follow-up or candidate gaps.",
        actions: avoidable.length ? (LOSS_ACTIONS[reasons[0]] || LOSS_ACTIONS["Client went quiet"]) : ["Keep debriefing losses to other agencies to learn what their candidates offered."],
        evidence: {
          title: "Avoidable losses (rate / markup, client follow-up, candidate supply)",
          columns: [col("client", "Client", "text"), col("owner", "Recruiter", "text"), col("dealType", "Type", "text"), col("decisionDate", "Decided", "date"), col("reason", "Reason", "text"), col("competitor", "Competitor", "text"), col("expectedGp", "Expected GP"), col("cycleDays", "Cycle", "days")],
          rows: avoidable,
        },
      })
    );
  }

  if (!lw && !winLoss.all.lost) out.push(noDecisionsInsight(m, "health-dir-no-decisions"));
  out.push(coverageInsight(m, "health-dir-coverage"));
  out.push(stuckInsight(m, "health-dir-stuck"));
  out.push(atRiskInsight(m, "health-dir-at-risk", { byOwner: true }));

  // Movement by client: expiring assignments.
  const expiring = expiringRows(m);
  if (expiring.length || movement.total.ends) {
    const byClient = new Map();
    for (const r of expiring) {
      const g = byClient.get(r.clientId) || { clientId: r.clientId, client: r.client, owner: r.owner, count: 0, monthlyGp: 0, firstEnd: r.plannedEndDate };
      g.count += 1;
      g.monthlyGp += r.monthlyGp;
      byClient.set(r.clientId, g);
    }
    const grouped = [...byClient.values()].sort((a, b) => b.monthlyGp - a.monthlyGp);
    out.push(
      insight({
        id: "health-dir-movement",
        section: "health-movement",
        category: "staffing",
        severity: grouped.length ? "neutral" : movement.total.netChange >= 0 ? "positive" : "negative",
        title: grouped.length ? `Assignments ending soon are concentrated at ${listNames(grouped.map((g) => g.client), 2)}` : "No assignments are due to end in the next two months",
        meaning: grouped.length
          ? "Each ending assignment is run-rate GP the team loses unless it is extended or the contractor is redeployed; acting before the end date is far cheaper than replacing the headcount later."
          : "Run-rate is protected for now; movement this period came from starts and unplanned ends.",
        actions: grouped.length
          ? ["Have the placing recruiter confirm extensions with the hiring manager two to three weeks before the end date.", "Match contractors who won't extend to open requisitions at the same branch."]
          : ["Use the stable period to push new starts at growing clients."],
        evidence: {
          title: "Assignments ending in the next 60 days, by client",
          columns: [col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("count", "Ending", "count"), col("firstEnd", "First end", "date"), col("monthlyGp", "Monthly GP at stake")],
          rows: grouped,
        },
        whatIf: { label: "Model extensions", prefill: { focus: "staffing" } },
      })
    );
  }

  // Slippage and stage aging by recruiter: coaching.
  const vr = velocity.byRep.filter((r) => r.open > 0);
  if (vr.length) {
    const worst = vr[0];
    const hasIssues = worst.stale + worst.slipped > 0;
    out.push(
      insight({
        id: "health-dir-slippage",
        section: "health-velocity",
        category: "effectiveness",
        severity: hasIssues ? "negative" : "positive",
        title: hasIssues ? `${worst.name} carries the most slipped and stuck job orders` : "Job orders across the team are holding their dates",
        meaning: hasIssues
          ? "A pattern of pushed fill dates and long stage times usually means next steps are not being agreed with the hiring manager, which makes this recruiter's forecast the least reliable on the team."
          : "Fill dates and stage times are within norms, so the team's timing is a fair guide.",
        actions: hasIssues
          ? [`Review each of ${worst.name}'s slipped job orders together and agree a dated next step or close it out.`, "Make a confirmed hiring-decision date a requirement for moving a job order to offer."]
          : ["Keep fill-date discipline in weekly reviews."],
        evidence: {
          title: "Stage aging and slippage by recruiter",
          columns: [col("name", "Recruiter", "text"), col("open", "Open job orders", "count"), col("stale", "Stuck", "count"), col("slipped", "Slipped", "count"), col("delayed", "Past expected start", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("avgWonCycle", "Days to fill", "days")],
          rows: vr,
        },
        whatIf: { label: "Model pipeline timing", prefill: { focus: "pipeline" } },
      })
    );
  } else {
    out.push(timingInsight(m, "health-dir-slippage"));
  }

  // Coaching on recruiting efficiency: cost per fill and contribution.
  const er = efficiency.byRep.filter((r) => r.gp > 0);
  if (er.length >= 2) {
    const byCost = [...er].sort((a, b) => (b.costToGp ?? 0) - (a.costToGp ?? 0));
    const worst = byCost[0];
    const best = byCost[byCost.length - 1];
    out.push(
      insight({
        id: "health-dir-coaching",
        section: "health-efficiency",
        category: "effectiveness",
        severity: "neutral",
        title: `${worst.name} spends the most to produce each dollar of GP; ${best.name} the least`,
        meaning: `${worst.name}'s GP is less profitable after recruiting costs than the headline suggests; the gap usually comes from hard-to-fill desks or job orders that rarely convert rather than the expense line itself.`,
        actions: [`Compare ${worst.name}'s job-order mix and conversion with ${best.name}'s to find what drives the gap.`, "Focus spend on job orders at interview or later and on repeat roles at existing clients."],
        evidence: {
          title: "Recruiting cost against GP by recruiter",
          columns: [col("name", "Recruiter", "text"), col("gp", "GP"), col("salesExpense", "Recruiting expense"), col("costToGp", "Cost-to-GP", "pct"), col("wins", "Fills", "count"), col("costPerWin", "Cost per fill"), col("contribution", "GP after recruiting expense")],
          rows: byCost,
        },
      })
    );
  }
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Recruiter (own desk)

function salespersonInsights(m) {
  const out = [];
  const { pipeline, winLoss, retention, movement, velocity, efficiency, ctx, rep } = m;
  const asOf = ctx.ds.meta.asOf;

  // Job orders requiring follow-up.
  const follow = pipeline.rows
    .map((r) => ({
      ...r,
      why: [r.stale ? "Stuck in stage" : null, r.closeOverdue ? "Fill date passed" : null, r.pastExpectedStart ? "Start date passed" : null, r.closeDateChanges >= 2 ? "Pushed repeatedly" : null].filter(Boolean).join(", "),
    }))
    .filter((r) => r.why);
  if (pipeline.totals.count) {
    const top = follow[0];
    out.push(
      insight({
        id: "health-sp-follow-up",
        section: "health-pipeline",
        category: "pipeline",
        severity: follow.length ? "negative" : "positive",
        title: follow.length ? (follow.length === 1 ? `${top.client} needs a follow-up` : `Several job orders need a follow-up, led by ${top.client}`) : "Your open job orders are moving on schedule",
        meaning: follow.length
          ? `${follow.length === 1 ? "It has" : "Each has"} sat in its stage longer than usual, passed its fill or start date, or been pushed more than once; until the next step is dated, its probability is optimistic.`
          : "None of your job orders is stuck, overdue or repeatedly pushed, so your pipeline timing is a fair guide.",
        actions: follow.length
          ? [`${top.client}: ${top.nextAction || "agree a dated next step"}.`, follow.length > 1 ? "Re-confirm interview, decision and start dates on the others with each hiring manager, or close them out." : "Confirm the hiring decision date with the client, or close the job order out."]
          : ["Keep a dated next step on every job order."],
        evidence: {
          title: "Job orders needing follow-up",
          columns: [col("client", "Client", "text"), col("stage", "Stage", "text"), col("why", "Why", "text"), col("daysInStage", "Days in stage", "days"), col("closeDate", "Expected fill date", "date"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
          rows: follow.slice(0, 15),
        },
        whatIf: { label: "Model these job orders", prefill: { focus: "pipeline" } },
      })
    );
  }

  // Likely lost assignments (estimated) and expiring contracts.
  const expiring = expiringRows(m);
  const riskClients = new Set(retention.atRisk.map((r) => r.clientId));
  const shrinking = new Set(movement.byClient.filter((c) => c.netChange < 0).map((c) => c.clientId));
  const likelyLost = expiring.filter((a) => a.daysLeft <= 30 && a.extensions === 0 && (riskClients.has(a.clientId) || shrinking.has(a.clientId)));
  if (likelyLost.length) {
    out.push(
      insight({
        id: "health-sp-likely-lost",
        section: "health-movement",
        category: "staffing",
        severity: "negative",
        title: likelyLost.length === 1 ? `An assignment at ${likelyLost[0].client} looks unlikely to extend` : "Some assignments ending soon look unlikely to extend",
        meaning: "This is an estimate: these end within weeks, have never been extended and sit at clients that are already shrinking, so an extension is less likely than usual. Each one that lapses without a replacement comes straight off your run-rate GP.",
        actions: ["Ask the hiring manager about extension or a replacement role now, not in the last week.", "Line up redeployment for these contractors at your growing clients."],
        evidence: {
          title: "Ending assignments at shrinking or at-risk clients",
          columns: [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("plannedEndDate", "Planned end", "date"), col("daysLeft", "Days left", "days"), col("monthlyGp", "Monthly GP")],
          rows: likelyLost,
        },
        whatIf: { label: "Model extensions", prefill: { focus: "staffing" } },
      })
    );
  }
  if (expiring.length) {
    out.push(
      insight({
        id: "health-sp-expiring",
        section: "health-movement",
        category: "staffing",
        severity: "neutral",
        title: expiring.length === 1 ? "One assignment is due to end in the next two months" : "Assignments ending in the next two months are your biggest near-term lever",
        meaning: "Extending an existing assignment is the cheapest GP you can add: no sourcing, no ramp-up and the bill rate is already agreed.",
        actions: ["Raise extensions with each hiring manager two to three weeks before the end date.", "Push a rate increase at extension where the contractor has been extended before."],
        evidence: {
          title: "Assignments ending in the next 60 days",
          columns: [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("plannedEndDate", "Planned end", "date"), col("extensions", "Extensions so far", "count"), col("billRate", "Bill rate", "rate"), col("monthlyGp", "Monthly GP")],
          rows: expiring,
        },
        whatIf: { label: "Model extensions", prefill: { focus: "staffing" } },
      })
    );
  }

  // Placement opportunities: open demand at the recruiter's clients for contractors coming off assignment.
  const openReqs = ctx.ds.requisitions
    .filter((r) => r.status === "open" && ctx.credit.has(r.clientId))
    .map((r) => ({ key: r.id, client: ctx.index.clientById.get(r.clientId).name, demand: "Open requisition", headcount: 1, date: r.openedDate }));
  const expansionDeals = pipeline.rows
    .filter((r) => r.clientId && r.type === "Existing client" && r.probability >= 50)
    .map((r) => ({ key: r.id, client: r.client, demand: `Existing-client job order · ${r.stage}`, headcount: r.headcount, date: r.expectedStart }));
  const demand = [...openReqs, ...expansionDeals];
  if (demand.length && expiring.length) {
    out.push(
      insight({
        id: "health-sp-placement",
        section: "health-movement",
        category: "staffing",
        severity: "positive",
        title: "Contractors finishing soon could fill open demand at your clients",
        meaning: "Redeploying someone already vetted into a client's new role keeps their billing continuous and fills the role faster than an external search.",
        actions: ["Match contractors finishing soon to these roles before sourcing externally.", "Tell the hiring managers a proven candidate is available before the role goes to other agencies."],
        evidence: {
          title: "Open demand at your clients",
          columns: [col("client", "Client", "text"), col("demand", "Demand", "text"), col("headcount", "Headcount", "count"), col("date", "Opened / expected start", "date")],
          rows: demand,
        },
        whatIf: { label: "Model starts", prefill: { focus: "staffing" } },
      })
    );
  }

  // Client growth.
  if (retention.expanding.length) {
    const names = retention.expanding.map((r) => r.client);
    out.push(
      insight({
        id: "health-sp-expansion",
        section: "health-churn",
        category: "pipeline",
        severity: "positive",
        title: `${listNames(names, 2)} ${names.length === 1 ? "is" : "are"} growing — the best place to add headcount`,
        meaning: "Clients already growing have budget and a proven relationship, so they convert new requisitions faster and at less cost than new clients.",
        actions: ["Ask each growing client for next quarter's headcount plan and get the job orders opened early.", "Propose a rate review alongside the new roles where spreads have narrowed."],
        evidence: {
          title: `Clients growing against the ${m.w.baseLabel.toLowerCase()} window`,
          columns: [col("client", "Client", "text"), col("baseGp", `GP · ${m.w.baseLabel}`), col("gp", "GP now"), col("contractorsNow", "On billing", "count"), col("nextAssignmentEnd", "Next assignment end", "date")],
          rows: retention.expanding.slice(0, 10),
        },
        whatIf: { label: "Model existing-client starts", prefill: { focus: "staffing" } },
      })
    );
  }
  out.push(atRiskInsight(m, "health-sp-at-risk", { personal: true }));

  // Personal stage conversion.
  out.push(weakestStageInsight(m, "health-sp-conversion", { personal: true }));

  // Own fills and losses.
  if (winLoss.all.closed) {
    const [first] = winLoss.reasons;
    out.push(
      insight({
        id: "health-sp-winloss",
        section: "health-winloss",
        category: "pipeline",
        severity: winLoss.all.won >= winLoss.all.lost ? "positive" : "negative",
        title: first ? `${first.reason} was your most common loss reason this period` : "You filled every job order decided this period",
        meaning: first
          ? `${winLoss.all.won >= winLoss.all.lost ? "You are filling more job orders than you lose, " : "Losses outnumber fills, "}and the main loss reason points to where the next job order can be saved.`
          : "No losses to learn from this period; keep the same screening and follow-up discipline on the next job orders.",
        actions: (first && LOSS_ACTIONS[first.reason]) || ["Ask each hiring manager why your candidate was chosen and use it to shape the next submittals."],
        evidence: {
          title: "Your job orders decided this period",
          columns: [col("client", "Client", "text"), col("dealType", "Type", "text"), col("decisionDate", "Decided", "date"), col("outcome", "Outcome", "text"), col("reason", "Reason", "text"), col("expectedGp", "Expected GP"), col("cycleDays", "Cycle", "days")],
          rows: winLoss.rows,
        },
      })
    );
  } else {
    out.push(noDecisionsInsight(m, "health-sp-winloss", { personal: true }));
  }

  // Delayed starts.
  if (velocity.delayed.length) {
    out.push(
      insight({
        id: "health-sp-delayed",
        section: "health-velocity",
        category: "forecast",
        severity: "negative",
        title: velocity.delayed.length === 1 ? `${velocity.delayed[0].client} is past its expected start date` : "Some job orders are past their expected start dates",
        meaning: "Every week a start slips is a week of billing that cannot be recovered in the period, and a job order still open after its start date usually has an unresolved blocker.",
        actions: ["Confirm with each client what is holding the start — approvals, budget or candidate availability — and agree a new date.", "Keep candidates warm and checks complete so the start can happen the day approval lands."],
        evidence: {
          title: "Open job orders past their expected start",
          columns: [col("client", "Client", "text"), col("stage", "Stage", "text"), col("expectedStart", "Expected start", "date"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
          rows: velocity.delayed,
        },
        whatIf: { label: "Model start dates", prefill: { focus: "pipeline" } },
      })
    );
  } else {
    out.push(timingInsight(m, "health-sp-timing", { personal: true }));
  }

  // Commission upside from modelled actions (commission visibility only); otherwise GP contribution.
  if (m.canSeeCommissions && rep) {
    const fyEnd = `${asOf.slice(0, 4)}-12-31`;
    const rate = rep.commissionPlan?.baseRate ?? 0.08;
    const days = (from, to) => Math.max(0, (Date.parse(to) - Date.parse(from)) / 86400000 + 1);
    const dealRows = follow.concat(pipeline.rows.filter((r) => !r.why && r.probability >= 50)).slice(0, 12).map((r) => {
      const months = Math.min(12, r.durationMonths || 12);
      const total = Math.max(1, Math.round(months * 30.4));
      const start = r.expectedStart > asOf ? r.expectedStart : asOf;
      const gpThisYear = (r.expectedGp / total) * Math.min(total, days(start, fyEnd));
      return { key: r.id, action: "Fill as expected", item: r.client, gpThisYear, commissionUpside: gpThisYear * rate };
    });
    const extRows = expiring.map((a) => {
      const gpThisYear = (a.monthlyGp * days(a.plannedEndDate, fyEnd)) / 30.4;
      return { key: a.assignmentId, action: "Extend to year end", item: `${a.contractor} · ${a.client}`, gpThisYear, commissionUpside: gpThisYear * rate };
    });
    const rows = [...dealRows, ...extRows].filter((r) => r.gpThisYear > 0).sort((a, b) => b.commissionUpside - a.commissionUpside);
    if (rows.length) {
      out.push(
        insight({
          id: "health-sp-commission",
          section: "health-efficiency",
          category: "forecast",
          severity: "positive",
          title: "Filling your follow-up job orders and extending ending assignments carries commission upside",
          meaning: "This is hypothetical, not a forecast: it assumes each job order fills at its expected value and start date and each extension runs to year end, at your base commission rate. None of it is earned until the GP bills.",
          actions: ["Start with the actions that carry the most GP this year.", "Prioritise extensions: they bill immediately, while new placements take weeks to start."],
          evidence: {
            title: "Modelled actions and their commission effect (hypothetical)",
            columns: [col("action", "Action", "text"), col("item", "Job order / assignment", "text"), col("gpThisYear", "GP this year if done"), col("commissionUpside", "Commission at base rate")],
            rows,
          },
          whatIf: { label: "Simulate my commission", prefill: { focus: "pipeline" } },
        })
      );
    }
  } else if (efficiency.gp) {
    out.push(efficiencyInsight(m, "health-sp-efficiency"));
  }
  return out.filter(Boolean);
}
