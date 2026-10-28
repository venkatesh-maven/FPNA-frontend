import { insight as baseInsight, listNames, pctChange } from "./phrasing";
import { byUnit } from "../utils/format";

// Rule-based insights for the Sales Health page (spec 11.4). Text explains
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
  Prospect: {
    meaning: "Leakage this early usually means pursuits are opened before there is a named need, budget or decision date.",
    actions: ["Qualify need, budget and decision date before opening a deal.", "Retire prospects with no response after two touches so effort goes to live demand."],
  },
  Qualified: {
    meaning: "Deals that stall after qualification usually lack confirmed roles, volumes or a rate expectation.",
    actions: ["Confirm role count, start window and rate range before writing a proposal.", "Bring a recruiter into discovery so the proposal reflects what can actually be filled."],
  },
  Proposal: {
    meaning: "Losses at proposal usually come down to price, markup or the client's confidence that the roles can be filled.",
    actions: ["Lead proposals with fill speed and candidate quality, and give directors a markup floor with room to trade duration for rate.", "Follow up every proposal within a week with a dated decision step."],
  },
  Negotiation: {
    meaning: "Late-stage losses usually mean markup, terms or start dates were not settled with the real decision maker.",
    actions: ["Agree markup and start dates with the decision maker before final terms.", "Hold a joint call with the director on any late-stage deal that has not moved in two weeks."],
  },
};

const LOSS_ACTIONS = {
  "Price / markup": ["Give directors a markup floor and the authority to trade volume or duration instead of rate.", "Lead with fill speed and candidate quality where clients compare on price."],
  "Lost to competitor": ["Debrief the largest competitive losses with the client to learn what won the deal.", "Build battlecards for the competitors that appear most often."],
  "No decision": ["Qualify budget and decision date before proposals are written.", "Close out deals with no dated next step instead of carrying them."],
  "Timing / budget freeze": ["Keep frozen deals warm with a check-in tied to the client's budget cycle.", "Shift effort to accounts with approved spend this quarter."],
  "Could not fill skills": ["Share hard-to-fill roles with recruiting before committing to start dates.", "Use contractors coming off assignment for adjacent skills."],
  "Incumbent retained": ["Track incumbents' renewal dates and get onto the vendor list ahead of time."],
};

const OPP_EVIDENCE = [
  col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"),
  col("weightedGp", "Weighted GP"), col("daysInStage", "Days in stage", "days"), col("closeDateChanges", "Close-date changes", "count"), col("expectedStart", "Expected start", "date"),
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
    ? `Current billing already covers the ${c.label} target, so open deals are upside`
    : both
      ? `Weighted pipeline covers the ${c.label} target gap left after current billing${weaker ? ", but by less than three months ago" : ""}`
      : `Weighted pipeline does not cover the ${c.label} target gap left after current billing${weaker ? ", and coverage has weakened" : ""}`;
  const meaning = [
    runRateEnough
      ? "The existing billable base, at today's run-rate, is enough to reach the target; the near-term risk is losing run-rate through assignments that end without a replacement."
      : both
        ? "If open deals convert at their recorded probabilities and start on schedule, the period reaches target; deals that slip past period end are the main threat."
        : "Even if open deals convert at their recorded probabilities and start on time, the period lands short unless run-rate grows or more deals start inside the period.",
    thinGp ? "GP coverage trails revenue coverage, so the deals in hand carry thinner margins than the plan assumes." : null,
    stronger ? "Coverage is stronger than at the same point three months ago." : null,
  ].filter(Boolean).join(" ");
  const actions = runRateEnough
    ? ["Protect run-rate: confirm extensions on assignments ending before period end.", "Keep building pipeline for the next period rather than pulling deals forward."]
    : [
        both ? "Lock start dates on late-stage deals so they bill inside the period." : "Ask each owner for new qualified deals that can start inside the period, with dates.",
        thinGp ? "Review markup on the largest open deals before terms are agreed." : "Re-qualify deals past their expected start date before counting them in the outlook.",
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
    title: concentrated ? "A handful of deals carry most of the weighted pipeline" : "Weighted pipeline is spread across many deals",
    meaning: [
      concentrated
        ? "A slip or loss on any one of the largest deals moves coverage materially, so the outlook is more fragile than the total suggests."
        : "No single slip changes the outlook much, so the pipeline total is a fair guide to what can land.",
      oneAccount ? `${top.name} alone is a large part of the weighted value, which adds single-account exposure.` : null,
    ].filter(Boolean).join(" "),
    actions: concentrated || oneAccount
      ? ["Put a senior sponsor on each of the largest deals and agree a mutual close plan with dated steps.", "Build second-tier pipeline in other accounts and verticals so the outlook doesn't hinge on a few decisions."]
      : ["Keep weekly stage reviews so the broad base keeps moving.", "Push the strongest mid-sized deals toward proposal to lift near-term coverage."],
    evidence: { title: "Largest open deals by weighted GP", columns: OPP_EVIDENCE, rows: pipeline.concentration.top5 },
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
      title: "No open deals are stuck beyond their stage thresholds",
      meaning: "Deals are moving through stages within normal time, so recorded probabilities are a reasonable guide.",
      actions: ["Keep a dated next step on every open deal so it stays that way."],
      evidence: { title: "Open deals by stage", columns: [col("stage", "Stage", "text"), col("count", "Deals", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("threshold", "Threshold", "days")], rows: pipeline.byStage },
    });
  }
  return insight({
    id,
    section: "health-pipeline",
    category: "pipeline",
    severity: "negative",
    title: personal || owners.length < 2 ? "Some open deals are stuck beyond their stage thresholds" : `Deals stuck beyond stage thresholds sit mostly with ${listNames(owners, 2)}`,
    meaning: "A deal that sits past its stage threshold is less likely to close at its recorded probability, so the weighted pipeline overstates what will land until these are re-qualified.",
    actions: [
      "Re-qualify each stuck deal in the next pipeline review: set a dated next step or close it out.",
      personal ? "Book the next-step meeting on the oldest stuck deal this week." : "Use the oldest stuck deals as coaching cases for the owners carrying them.",
    ],
    evidence: {
      title: "Deals stuck beyond stage thresholds",
      columns: [col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text"), col("daysInStage", "Days in stage", "days"), col("stageThreshold", "Threshold", "days"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
      rows: stale.slice(0, 20),
    },
    whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
  });
}

/** No deals decided in the period: say what that means for the evidence, not the figures. */
function noDecisionsInsight(m, id, { personal = false } = {}) {
  const late = m.pipeline.rows.filter((r) => r.stage === "Negotiation" || r.stage === "Proposal");
  return insight({
    id,
    section: "health-winloss",
    category: "pipeline",
    severity: "neutral",
    title: personal ? "None of your deals were decided this period" : "No deals were decided this period",
    meaning: "Without decisions there is no new evidence on win rate or loss reasons, so the late-stage deals are where the next read on conversion will come from.",
    actions: late.length
      ? [`Push ${listNames(late.slice(0, 2).map((r) => r.client), 2)} to a dated decision.`, "Record a loss reason on every deal that closes so patterns are visible."]
      : ["Move qualified deals to proposal so decisions start to flow.", "Record a loss reason on every deal that closes so patterns are visible."],
    evidence: late.length ? { title: "Late-stage deals awaiting a decision", columns: OPP_EVIDENCE, rows: late.slice(0, 10) } : null,
    whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
  });
}

/** Where deals most often stall or are lost, with stage-specific coaching. */
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
      title: personal ? "Too few of your deals have finished a stage to judge conversion yet" : "Too few deals have finished a stage to judge conversion yet",
      meaning: "Conversion is measured only on deals that have moved on or been lost, so a young or small cohort gives no reliable read; the rate will firm up as current deals resolve.",
      actions: ["Agree a dated next step on every open deal so stages resolve rather than stall.", "Record losses as they happen so leakage shows up at the right stage."],
      evidence: { title: `Stage conversion · entries ${m.w.cohort.label}`, columns, rows: funnel.stages },
    });
  }
  const g = STAGE_GUIDANCE[weakest.stage];
  return insight({
    id,
    section: "health-conversion",
    category: "effectiveness",
    severity: "neutral",
    title: `${personal ? "Your deals" : "Deals"} most often stall or are lost at ${weakest.stage}`,
    meaning: g.meaning,
    actions: g.actions,
    evidence: { title: `${personal ? "Your stage" : "Stage"} conversion · entries ${m.w.cohort.label}`, columns, rows: funnel.stages },
    whatIf: { label: "Model win probability", prefill: { focus: "pipeline" } },
  });
}

/** Deal timing: slippage and stage aging, framed for the viewer. */
function timingInsight(m, id, { personal = false } = {}) {
  const { velocity, pipeline } = m;
  if (!pipeline.totals.count) {
    return insight({
      id,
      section: "health-velocity",
      category: "forecast",
      severity: "negative",
      title: personal ? "You have no open deals to move forward" : "There are no open deals to move forward",
      meaning: "With nothing in the pipeline, future starts depend entirely on extensions and redeployments at existing clients.",
      actions: ["Open expansion deals with the growing accounts first; they convert fastest.", "Book discovery meetings with prospects in the strongest verticals."],
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
      ? `${personal ? "Some of your deals" : "Some deals"} are slipping or ageing in stage`
      : `${personal ? "Your open deals" : "Open deals"} are holding their dates and moving through stages on time`,
    meaning: issues
      ? "Pushed close dates and long stage times usually mean the next step hasn't been agreed with the decision maker; until it is, the expected start dates are optimistic."
      : "No deal has been pushed or sat past its stage threshold, so the timing in the pipeline is a fair guide to when starts will land.",
    actions: issues
      ? ["Agree a dated next step with the decision maker on each slipping or stuck deal.", "Confirm start dates before counting these deals in the period outlook."]
      : ["Keep a dated next step on every deal.", "Line up candidates ahead of expected starts so they happen on the day."],
    evidence: {
      title: "Open deals by days in stage",
      columns: [col("client", "Client / prospect", "text"), col("stage", "Stage", "text"), col("daysInStage", "Days in stage", "days"), col("stageThreshold", "Threshold", "days"), col("closeDateChanges", "Close-date changes", "count"), col("expectedStart", "Expected start", "date")],
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
    title: word ? `New clients are being won ${oftenThan(word)} in the ${w.baseLabel.toLowerCase()} window` : "How the deals decided this period were won and lost",
    meaning: [
      first ? `${first.reason} is the most common reason deals are lost${second ? `, followed by ${second.reason.toLowerCase()}` : ""}.` : "No deals were lost in the period.",
      avoidShare >= 0.5 ? "Most losses sit in reasons the team controls — pricing, qualification and fill readiness — so win rate can be improved without new demand." : null,
    ].filter(Boolean).join(" "),
    actions: (first && LOSS_ACTIONS[first.reason]) || ["Record a loss reason on every closed deal so patterns are visible."],
    evidence: {
      title: "Lost deals by reason",
      columns: [col("reason", "Loss reason", "text"), col("avoidableReason", "Avoidable", "text"), col("lost", "Deals", "count"), col("lostGp", "Expected GP lost")],
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
      title: personal ? "None of your accounts show early warning signs" : "No accounts show early warning signs",
      meaning: "No client combines falling GP, shrinking headcount, mostly-ending assignments or a billing gap, so the account base looks stable for now.",
      actions: ["Use the stable base to push expansion: ask the healthiest accounts for their next quarter's demand."],
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
        ? `Accounts at risk sit mostly with ${listNames(owners, 2)}`
        : `GP at risk is concentrated in ${listNames(names, 2)}`,
    meaning: [
      "This is an estimate from falling GP, shrinking headcount, ending assignments and billing gaps — not a recorded loss.",
      high.length
        ? "Accounts with several signals at once are the ones most likely to reduce or leave next quarter, which would take their run-rate GP with them."
        : "Each account shows one signal so far, which is worth a conversation before it becomes a trend.",
    ].join(" "),
    actions: [
      personal ? "Call the hiring manager at each at-risk account this week to understand demand and satisfaction." : "Hold an account review with each owner of a high-risk client and agree a recovery plan.",
      "Line up extensions or replacement roles before assignments at these clients end.",
    ],
    evidence: {
      title: "Accounts with early warning signs (estimated)",
      columns: [col("client", "Client", "text"), col("owner", "Owner", "text"), col("atRisk", "Risk", "text"), col("riskFlags", "Signals", "text"), col("gpLast3Months", "GP last 3 months"), col("gpPrior3Months", "GP prior 3 months"), col("expiringAssignments", "Ending soon", "count")],
      rows: list.slice(0, 20),
    },
    whatIf: { label: "Model starts and ends", prefill: { focus: "staffing" } },
  });
}

function expiringRows(m) {
  return m.movement.expiring;
}

// ---------------------------------------------------------------------------
// Executive

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
        title: `Deals are advancing ${oftenThan(word)} the prior cohort, with the biggest change at ${biggest.stage}`,
        meaning: `${biggest.change < 0 ? g.meaning : `Conversion at ${biggest.stage} has improved, which is where the funnel is gaining most.`} Cohorts compare only deals that have left each stage, so younger deals still in progress don't distort the comparison.`,
        actions: biggest.change < 0 ? g.actions : ["Find what changed at this stage — pricing, proposal format or who is involved — and make it standard practice.", "Watch the next stage for the extra volume so it doesn't become the new bottleneck."],
        evidence: {
          title: `Stage conversion: ${w.cohort.label} against ${w.priorCohort.label}`,
          columns: [col("stage", "Stage", "text"), col("conversion", "Conversion", "pct"), col("priorConversion", "Prior cohort", "pct"), col("change", "Change", "pp"), col("eligible", "Resolved entries", "count"), col("priorEligible", "Prior resolved", "count")],
          rows: stageChangeRows(m),
        },
        whatIf: { label: "Model win probability", prefill: { focus: "pipeline" } },
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
          ? ["Move recruiter capacity onto the oldest open requisitions at the highest-spread clients.", "Review cancelled requisitions with account owners to separate client changes from fill failures."]
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
        title: shrinking ? "GP lost from existing clients is outrunning their expansion" : "Expansion at existing clients more than offsets the GP they lost",
        meaning: [
          mainlyContraction
            ? "Most of the loss comes from clients shrinking rather than leaving, which is recoverable through backfills and extensions."
            : "Most of the loss comes from clients that stopped billing altogether, which needs replacement demand rather than backfills.",
          losers.length ? `${listNames(losers.map((r) => r.client))} account for the largest share.` : null,
          clientDriven ? "Where assignments ended before plan, it was mostly because clients reduced roles rather than contractors leaving, so the loss is demand-driven." : "Contractor departures rather than client decisions account for most assignments ending before plan.",
          "Planned assignment endings are counted separately and are not treated as client churn.",
        ].filter(Boolean).join(" "),
        actions: shrinking
          ? [mainlyContraction ? "Run recovery calls with the largest contracting accounts to understand demand and competitor activity." : "Ask owners of lost accounts for a win-back plan with a named contact and date.", clientDriven ? "Prioritise expansion at stable accounts to offset client reductions." : "Review pay and engagement on assignments with early resignations."]
          : ["Keep account plans on the expanding clients so the momentum is repeatable.", "Use expanding accounts as references in the same verticals."],
        evidence: {
          title: `Clients losing the most GP against ${w.base.label}`,
          columns: [col("client", "Client", "text"), col("owner", "Owner", "text"), col("status", "Status", "text"), col("baseGp", `GP · ${w.baseLabel}`), col("gp", "GP now"), col("lostGp", "GP lost"), col("contractorEnds", "Contractor ends", "count"), col("churnReason", "Main reason", "text")],
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
        title: slipShare > 0.3 ? "Many open deals have moved their close dates" : "Most open deals are holding their close dates",
        meaning: [
          slipShare > 0.3
            ? "Repeated pushes usually mean the decision process or start date isn't confirmed, so weighting these deals at their recorded probabilities overstates near-term revenue."
            : "Close dates are largely holding, so the timing in the pipeline is a reasonable guide.",
          velocity.avgDaysToFirstBilling != null
            ? slow
              ? "New clients take a long time to reach first billing after the win, which delays payback on acquisition effort."
              : "New clients reach first billing soon after the win, so acquisition effort turns into GP quickly."
            : null,
        ].filter(Boolean).join(" "),
        actions: [
          slipShare > 0.3 ? "Require a confirmed decision date and start date before a deal moves to negotiation." : "Keep close-date discipline in pipeline reviews.",
          slow ? "Assign a recruiter to every new-client win on day one so the first requisition fills faster." : "Agree an expansion plan with each new client within its first quarter.",
        ],
        evidence: {
          title: "Open deals with the most slippage",
          columns: [col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text"), col("originalCloseDate", "Original close", "date"), col("closeDate", "Current close", "date"), col("closeDateChanges", "Pushes", "count"), col("daysMoved", "Days moved", "days"), col("weightedGp", "Weighted GP")],
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
    ["Total sales expense", e.exp.total, e.expBase.total, true],
  ].filter(([, , , ok]) => ok).map(([label, cur, base]) => ({ label, cur, base, growth: pctChange(cur, base) }));
  return insight({
    id,
    section: "health-efficiency",
    category: "cost",
    severity: word === "more" ? "negative" : word === "less" ? "positive" : "neutral",
    title: word === "about the same share" ? `Sales cost absorbs about the same share of GP as in the ${w.baseLabel.toLowerCase()} window` : `Sales cost absorbs ${word} of GP than in the ${w.baseLabel.toLowerCase()} window`,
    meaning: word === "more"
      ? "Each dollar of sales spend is buying less GP, so contribution grows more slowly than GP; the pipeline needs to convert for the spend to pay back."
      : word === "less"
        ? "Sales spend is working harder: GP is growing faster than the cost of selling it."
        : "Selling cost is moving in line with GP, so contribution tracks GP.",
    actions: word === "more"
      ? ["Concentrate pursuit spend on deals at proposal or later, where conversion is highest.", "Review discretionary spend against allowance for the people furthest over."]
      : ["Keep current expense controls and reinvest in the stages with the best conversion."],
    evidence: {
      title: `Sales expense against GP · this period and ${w.base.label}`,
      columns: [col("label", "Measure", "text"), col("cur", "This period"), col("base", w.baseLabel), col("growth", "Growth", "pct")],
      rows,
    },
  });
}

// ---------------------------------------------------------------------------
// Sales Director

function directorInsights(m) {
  const out = [];
  const { funnel, winLoss, movement, velocity, efficiency, w } = m;

  // Highest / lowest conversion by salesperson.
  const reps = funnel.byRep.filter((r) => r.eligible >= 5 && r.conversion != null);
  if (reps.length >= 2) {
    const sorted = [...reps].sort((a, b) => b.conversion - a.conversion);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const g = STAGE_GUIDANCE[worst.weakestStage] || STAGE_GUIDANCE.Proposal;
    out.push(
      insight({
        id: "health-dir-conversion",
        section: "health-conversion",
        category: "effectiveness",
        severity: "neutral",
        title: `${best.name} converts the most stage entries; ${worst.name} the fewest`,
        meaning: `${worst.name}'s deals most often stall or are lost at ${worst.weakestStage || "proposal"}. ${g.meaning}`,
        actions: [`Pair ${worst.name} with ${best.name} for deal reviews at ${worst.weakestStage || "proposal"} stage.`, ...g.actions.slice(0, 1)],
        evidence: {
          title: `Conversion by salesperson · stage entries ${w.cohort.label}`,
          columns: [col("name", "Salesperson", "text"), col("eligible", "Resolved entries", "count"), col("advanced", "Advanced", "count"), col("lost", "Lost", "count"), col("conversion", "Conversion", "pct"), col("cohortWinRate", "Prospect → won", "pct"), col("weakestStage", "Weakest stage", "text")],
          rows: sorted,
        },
        whatIf: { label: "Model win probability", prefill: { focus: "pipeline" } },
      })
    );
  } else {
    out.push(weakestStageInsight(m, "health-dir-conversion"));
  }

  // Largest client win.
  const lw = winLoss.largestWin;
  if (lw) {
    const tl = velocity.timeline.find((t) => t.opportunityId === lw.id);
    out.push(
      insight({
        id: "health-dir-largest-win",
        section: "health-winloss",
        category: "pipeline",
        severity: "positive",
        title: `${lw.client} is the largest new client won ${lw.inPeriod ? "this period" : "in the last twelve months"}`,
        meaning: [
          "The win is expected value until contractors start: GP appears only as requisitions fill and timesheets bill, so the first weeks decide how quickly it pays back.",
          tl && !tl.firstBillingDate ? "It has not billed yet, so staffing the first roles is the priority." : null,
        ].filter(Boolean).join(" "),
        actions: ["Put a recruiter on the client's first requisitions and track time to first start.", "Agree an expansion plan with the hiring manager within the first quarter."],
        evidence: {
          title: "New-client wins and their first fills, starts and billing",
          columns: [col("client", "Client", "text"), col("owner", "Owner", "text"), col("winDate", "Won", "date"), col("expectedGp", "Expected GP"), col("firstFillDate", "First fill", "date"), col("firstStartDate", "First start", "date"), col("firstBillingDate", "First billing", "date")],
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
          ? owners.length > 1 ? `Avoidable losses cluster with ${listNames(owners, 2)}` : "Some deals were lost for reasons the team controls"
          : "This period's losses were mostly outside the team's control",
        meaning: avoidable.length
          ? `Losses to ${listNames(reasons.map((r) => r.toLowerCase()), 3)} are within the team's control — pricing discipline, qualification and fill readiness — so they are the cheapest win rate to recover.`
          : "Deals were lost to competitors, timing or incumbents rather than pricing or qualification gaps.",
        actions: avoidable.length ? (LOSS_ACTIONS[reasons[0]] || LOSS_ACTIONS["No decision"]) : ["Keep debriefing competitive losses to sharpen positioning."],
        evidence: {
          title: "Avoidable losses (price / markup, no decision, could not fill skills)",
          columns: [col("client", "Client / prospect", "text"), col("owner", "Owner", "text"), col("dealType", "Type", "text"), col("decisionDate", "Decided", "date"), col("reason", "Reason", "text"), col("competitor", "Competitor", "text"), col("expectedGp", "Expected GP"), col("cycleDays", "Cycle", "days")],
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
          ? ["Have each owner confirm extensions with the hiring manager two to three weeks before the end date.", "Match contractors who won't extend to open requisitions at the same branch."]
          : ["Use the stable period to push new starts at expanding clients."],
        evidence: {
          title: "Assignments ending in the next 60 days, by client",
          columns: [col("client", "Client", "text"), col("owner", "Owner", "text"), col("count", "Ending", "count"), col("firstEnd", "First end", "date"), col("monthlyGp", "Monthly GP at stake")],
          rows: grouped,
        },
        whatIf: { label: "Model extensions", prefill: { focus: "staffing" } },
      })
    );
  }

  // Slippage and stage aging by rep: coaching.
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
        title: hasIssues ? `${worst.name} carries the most slipped and stuck deals` : "Deals across the team are holding their dates",
        meaning: hasIssues
          ? "A pattern of pushed close dates and long stage times usually means next steps are not being agreed with the client, which makes this person's forecast the least reliable on the team."
          : "Close dates and stage times are within norms, so the team's timing is a fair guide.",
        actions: hasIssues
          ? [`Review each of ${worst.name}'s slipped deals together and agree a dated next step or close it out.`, "Make a confirmed decision date a requirement for moving a deal to negotiation."]
          : ["Keep close-date discipline in weekly reviews."],
        evidence: {
          title: "Stage aging and slippage by salesperson",
          columns: [col("name", "Salesperson", "text"), col("open", "Open deals", "count"), col("stale", "Stuck", "count"), col("slipped", "Slipped", "count"), col("delayed", "Past expected start", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("avgWonCycle", "Won-deal cycle", "days")],
          rows: vr,
        },
        whatIf: { label: "Model pipeline timing", prefill: { focus: "pipeline" } },
      })
    );
  } else {
    out.push(timingInsight(m, "health-dir-slippage"));
  }

  // Coaching on sales efficiency: cost per win and contribution.
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
        meaning: `${worst.name}'s GP is less profitable after sales costs than the headline suggests; the gap usually comes from pursuit-heavy territories or low-converting deals rather than the expense line itself.`,
        actions: [`Compare ${worst.name}'s deal mix and conversion with ${best.name}'s to find what drives the gap.`, "Focus pursuit spend on deals at proposal or later and on expansion at existing accounts."],
        evidence: {
          title: "Sales cost against GP by salesperson",
          columns: [col("name", "Salesperson", "text"), col("gp", "GP"), col("salesExpense", "Sales expense"), col("costToGp", "Cost-to-GP", "pct"), col("wins", "Wins", "count"), col("costPerWin", "Cost per win"), col("contribution", "GP after sales expense")],
          rows: byCost,
        },
      })
    );
  }
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Salesperson

function salespersonInsights(m) {
  const out = [];
  const { pipeline, winLoss, retention, movement, velocity, efficiency, ctx, rep } = m;
  const asOf = ctx.ds.meta.asOf;

  // Deals requiring follow-up.
  const follow = pipeline.rows
    .map((r) => ({
      ...r,
      why: [r.stale ? "Stuck in stage" : null, r.closeOverdue ? "Close date passed" : null, r.pastExpectedStart ? "Start date passed" : null, r.closeDateChanges >= 2 ? "Pushed repeatedly" : null].filter(Boolean).join(", "),
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
        title: follow.length ? (follow.length === 1 ? `${top.client} needs a follow-up` : `Several deals need a follow-up, led by ${top.client}`) : "Your open deals are moving on schedule",
        meaning: follow.length
          ? `${follow.length === 1 ? "It has" : "Each has"} sat in its stage longer than usual, passed its close or start date, or been pushed more than once; until the next step is dated, its probability is optimistic.`
          : "None of your deals is stuck, overdue or repeatedly pushed, so your pipeline timing is a fair guide.",
        actions: follow.length
          ? [`${top.client}: ${top.nextAction || "agree a dated next step"}.`, follow.length > 1 ? "Re-confirm decision and start dates on the others, or close them out." : "Confirm the decision date with the client, or close the deal out."]
          : ["Keep a dated next step on every deal."],
        evidence: {
          title: "Deals needing follow-up",
          columns: [col("client", "Client / prospect", "text"), col("stage", "Stage", "text"), col("why", "Why", "text"), col("daysInStage", "Days in stage", "days"), col("closeDate", "Close date", "date"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
          rows: follow.slice(0, 15),
        },
        whatIf: { label: "Model these deals", prefill: { focus: "pipeline" } },
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
        meaning: "This is an estimate: these end within weeks, have never been extended and sit at accounts that are already shrinking, so an extension is less likely than usual. Each one that lapses without a replacement comes straight off your run-rate GP.",
        actions: ["Ask the hiring manager about extension or a replacement role now, not in the last week.", "Line up redeployment for these contractors at your growing accounts."],
        evidence: {
          title: "Ending assignments at shrinking or at-risk accounts",
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
        meaning: "Extending an existing assignment is the cheapest GP you can add: no recruiting, no ramp-up and the bill rate is already agreed.",
        actions: ["Raise extensions with each hiring manager two to three weeks before the end date.", "Use the renewal conversation to propose a rate review where the contractor has been extended before."],
        evidence: {
          title: "Assignments ending in the next 60 days",
          columns: [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("plannedEndDate", "Planned end", "date"), col("extensions", "Extensions so far", "count"), col("billRate", "Bill rate", "rate"), col("monthlyGp", "Monthly GP")],
          rows: expiring,
        },
        whatIf: { label: "Model extensions", prefill: { focus: "staffing" } },
      })
    );
  }

  // Placement opportunities: open demand at own clients for contractors coming off assignment.
  const openReqs = ctx.ds.requisitions
    .filter((r) => r.status === "open" && ctx.credit.has(r.clientId))
    .map((r) => ({ key: r.id, client: ctx.index.clientById.get(r.clientId).name, demand: "Open requisition", headcount: 1, date: r.openedDate }));
  const expansionDeals = pipeline.rows
    .filter((r) => r.clientId && r.type === "Expansion" && r.probability >= 50)
    .map((r) => ({ key: r.id, client: r.client, demand: `Expansion deal · ${r.stage}`, headcount: r.headcount, date: r.expectedStart }));
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
        actions: ["Share the list of contractors finishing soon with recruiting and match them to these roles first.", "Tell the hiring managers a proven candidate is available before the role goes to other suppliers."],
        evidence: {
          title: "Open demand at your clients",
          columns: [col("client", "Client", "text"), col("demand", "Demand", "text"), col("headcount", "Headcount", "count"), col("date", "Opened / expected start", "date")],
          rows: demand,
        },
        whatIf: { label: "Model starts", prefill: { focus: "staffing" } },
      })
    );
  }

  // Client expansion.
  if (retention.expanding.length) {
    const names = retention.expanding.map((r) => r.client);
    out.push(
      insight({
        id: "health-sp-expansion",
        section: "health-churn",
        category: "pipeline",
        severity: "positive",
        title: `${listNames(names, 2)} ${names.length === 1 ? "is" : "are"} growing — the best place to add headcount`,
        meaning: "Accounts already expanding have budget and a proven relationship, so they convert new requisitions faster and at less cost than new clients.",
        actions: ["Ask each growing account for next quarter's headcount plan and open an expansion deal for it.", "Propose a rate review alongside the expansion where spreads have narrowed."],
        evidence: {
          title: `Accounts growing against the ${m.w.baseLabel.toLowerCase()} window`,
          columns: [col("client", "Client", "text"), col("baseGp", `GP · ${m.w.baseLabel}`), col("gp", "GP now"), col("contractorsNow", "On billing", "count"), col("nextAssignmentEnd", "Next assignment end", "date")],
          rows: retention.expanding.slice(0, 10),
        },
        whatIf: { label: "Model expansion starts", prefill: { focus: "staffing" } },
      })
    );
  }
  out.push(atRiskInsight(m, "health-sp-at-risk", { personal: true }));

  // Personal stage conversion.
  out.push(weakestStageInsight(m, "health-sp-conversion", { personal: true }));

  // Own wins and losses.
  if (winLoss.all.closed) {
    const [first] = winLoss.reasons;
    out.push(
      insight({
        id: "health-sp-winloss",
        section: "health-winloss",
        category: "pipeline",
        severity: winLoss.all.won >= winLoss.all.lost ? "positive" : "negative",
        title: first ? `Your losses this period came mostly from ${first.reason.toLowerCase()}` : "You won every deal decided this period",
        meaning: first
          ? `${winLoss.all.won >= winLoss.all.lost ? "You are winning more than you lose, " : "Losses outnumber wins, "}and the main loss reason points to where the next deal can be saved.`
          : "No losses to learn from this period; keep the same qualification discipline on the next deals.",
        actions: (first && LOSS_ACTIONS[first.reason]) || ["Ask each new client what decided it in your favour and reuse it in open proposals."],
        evidence: {
          title: "Your deals decided this period",
          columns: [col("client", "Client / prospect", "text"), col("dealType", "Type", "text"), col("decisionDate", "Decided", "date"), col("outcome", "Outcome", "text"), col("reason", "Reason", "text"), col("expectedGp", "Expected GP"), col("cycleDays", "Cycle", "days")],
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
        title: velocity.delayed.length === 1 ? `${velocity.delayed[0].client} is past its expected start date` : "Some deals are past their expected start dates",
        meaning: "Every week a start slips is a week of billing that cannot be recovered in the period, and a deal still open after its start date usually has an unresolved blocker.",
        actions: ["Confirm with each client what is holding the start — approvals, budget or candidate availability — and agree a new date.", "Have candidates ready so the start can happen the day approval lands."],
        evidence: {
          title: "Open deals past their expected start",
          columns: [col("client", "Client / prospect", "text"), col("stage", "Stage", "text"), col("expectedStart", "Expected start", "date"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
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
      return { key: r.id, action: "Close as expected", item: r.client, gpThisYear, commissionUpside: gpThisYear * rate };
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
          title: "Closing your follow-up deals and extending ending assignments carries commission upside",
          meaning: "This is hypothetical, not a forecast: it assumes each deal closes at its expected value and start date and each extension runs to year end, at your base commission rate. None of it is earned until the GP bills.",
          actions: ["Start with the actions that carry the most GP this year.", "Prioritise extensions: they bill immediately, while new deals take weeks to ramp."],
          evidence: {
            title: "Modelled actions and their commission effect (hypothetical)",
            columns: [col("action", "Action", "text"), col("item", "Deal / assignment", "text"), col("gpThisYear", "GP this year if done"), col("commissionUpside", "Commission at base rate")],
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
