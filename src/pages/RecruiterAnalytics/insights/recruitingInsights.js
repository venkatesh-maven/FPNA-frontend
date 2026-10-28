// Rule-based insights for the recruiting sections of the Director Overview:
// activity, conversion & quality, speed, recruiter billing, contractors on
// assignment and recruiting cost. Each explains what the numbers mean for
// the recruiting org and what to do next; the figures stay in the evidence.

import { byUnit } from "../utils/format";
import { gapWords, growthWords, insight, listNames, pctChange } from "./phrasing";

const col = (key, label, unit = "text") => ({ key, label, unit });
const VS_PY = [col("label", "Measure"), col("cur", "This period"), col("py", "Prior year"), col("change", "Change", "pct")];
const pyRow = (label, cur, py, unit) => ({ label, cur: byUnit(cur, unit), py: byUnit(py, unit), change: unit === "pct" ? null : pctChange(cur, py) });
const ppMove = (cur, py) => (cur == null || py == null ? null : cur - py);

// What a weak step in the candidate funnel usually means, and what fixes it.
const STAGE_GUIDANCE = {
  subToInterview: {
    title: "Fewer submittals are turning into interviews",
    meaning: "Candidates are reaching clients but not getting past the hiring manager's first look, which usually means submittals drift from the brief or feedback is slow to come back.",
    actions: ["Re-brief hiring managers on must-have skills before the next round of submittals.", "Add a quick quality check so every submittal is matched to the brief before it goes out.", "Chase hiring-manager feedback within 48 hours and resubmit while the job order is still warm."],
  },
  interviewToOffer: {
    title: "Interviews are turning into offers less often",
    meaning: "Candidates are getting through screening but losing at the final stage, which points to interview preparation or shortlists that are wide rather than strong.",
    actions: ["Prepare candidates on the client, the team and the role before every interview.", "Debrief with the hiring manager after each interview and tighten the shortlist accordingly.", "Send fewer, stronger candidates per job order rather than more of them."],
  },
  offerAcceptance: {
    title: "More candidates are turning down offers",
    meaning: "Offers are being lost at the last step, typically to counter-offers, competing agencies or pay that falls short of expectations.",
    actions: ["Confirm pay expectations and notice periods before submitting, not at offer.", "Pre-close candidates on the offer and prepare them for counter-offers.", "Shorten the time from final interview to offer so competing offers don't land first."],
  },
};

/** Insights for the recruiting sections; `m` carries this period's and the prior year's recruiting figures. */
export function buildRecruitingInsights(m) {
  const { rc, rcPy, open, ret, retPy, recruiters, leadTeams, staff, staffPy } = m;
  const out = [];

  // 1. Activity — what is moving placements.
  const placeChange = pctChange(rc.placements, rcPy.placements);
  const subChange = pctChange(rc.submittals, rcPy.submittals);
  const placementsUp = (placeChange ?? 0) >= 0;
  const subsUp = (subChange ?? 0) >= 2;
  const subsDown = (subChange ?? 0) <= -2;
  let activity;
  if (placementsUp && subsUp) {
    activity = {
      title: `Placements are ${growthWords(placeChange)} on last year, carried by more candidates in front of clients`,
      meaning: "Volume is doing the work: more submittals are going out, while conversion is roughly where it was, so each placement still takes as much recruiter effort as before.",
      actions: ["Protect sourcing capacity on the busiest desks so the submittal volume holds.", "Tighten screening on the largest job orders to turn the extra volume into more interviews."],
    };
  } else if (placementsUp) {
    activity = {
      title: `Placements are ${growthWords(placeChange)} on last year without more submittals`,
      meaning: "Conversion is doing the work: candidates are better matched, so fewer submittals produce each placement.",
      actions: ["Capture what the strongest recruiters do differently at screening and share it across teams.", "Ask account managers for more job orders, since the team can convert them efficiently."],
    };
  } else if (subsDown) {
    activity = {
      title: "Placements are down on last year because fewer candidates are reaching clients",
      meaning: "Submittal volume has dropped, so the funnel is starved at the top rather than leaking further down.",
      actions: ["Check job-order intake with each account manager and confirm demand is still there.", "Re-engage previously shortlisted candidates and contractors coming off assignment for open roles.", "Move recruiter time onto the clients with the most open job orders."],
    };
  } else {
    activity = {
      title: "Placements are down on last year even though submittal volume is holding",
      meaning: "Candidates are reaching clients but more are dropping out along the way, so the problem is conversion rather than effort.",
      actions: ["Recalibrate briefs with hiring managers on the job orders with the most rejections.", "Review the conversion steps below to find where candidates are being lost."],
    };
  }
  out.push(
    insight({
      id: "rec-activity",
      section: "activity",
      category: "performance",
      severity: placementsUp ? "positive" : "negative",
      ...activity,
      evidence: {
        title: "Recruiting activity against the same period last year",
        columns: VS_PY,
        rows: [
          pyRow("Job orders opened", rc.opened, rcPy.opened, "count"),
          pyRow("Submittals", rc.submittals, rcPy.submittals, "count"),
          pyRow("Interviews", rc.interviews, rcPy.interviews, "count"),
          pyRow("Offers", rc.offers, rcPy.offers, "count"),
          pyRow("Placements", rc.placements, rcPy.placements, "count"),
        ],
      },
    })
  );

  // 2. Conversion — the weakest funnel step against last year.
  const steps = ["subToInterview", "interviewToOffer", "offerAcceptance"].map((k) => ({ key: k, move: ppMove(rc[k], rcPy[k]) })).filter((s) => s.move != null);
  const conversionEvidence = {
    title: "Funnel conversion against the same period last year",
    columns: VS_PY,
    rows: [
      pyRow("Submittal → interview", rc.subToInterview, rcPy.subToInterview, "pct"),
      pyRow("Interview → offer", rc.interviewToOffer, rcPy.interviewToOffer, "pct"),
      pyRow("Offer acceptance", rc.offerAcceptance, rcPy.offerAcceptance, "pct"),
      pyRow("Fill rate", rc.fillRate, rcPy.fillRate, "pct"),
    ],
  };
  const worst = [...steps].sort((a, b) => a.move - b.move)[0];
  if (worst && worst.move < -1) {
    out.push(insight({ id: "rec-conversion", section: "conversion", category: "effectiveness", severity: "negative", ...STAGE_GUIDANCE[worst.key], evidence: conversionEvidence }));
  } else if (steps.length) {
    out.push(
      insight({
        id: "rec-conversion",
        section: "conversion",
        category: "effectiveness",
        severity: "positive",
        title: "The candidate funnel is converting at least as well as last year",
        meaning: "No step from submittal to accepted offer has weakened, so the team's screening and candidate management are holding up.",
        actions: ["Write down the screening and interview-prep habits that are working and use them in onboarding.", "Raise job-order intake to put the conversion strength to work."],
        evidence: conversionEvidence,
      })
    );
  }

  // 3. Quality — do placements stick?
  const fallOff = rc.fallOffRate;
  const fallOffBad = fallOff != null && (fallOff > 5 || (rcPy.fallOffRate != null && fallOff > rcPy.fallOffRate + 1));
  out.push(
    insight({
      id: "rec-quality",
      section: "conversion",
      category: "effectiveness",
      severity: fallOffBad ? "negative" : "positive",
      title: fallOffBad ? "Early fall-offs are eating into placements" : "Placements are sticking once they start",
      meaning: fallOffBad
        ? "Too many contractors leave within their first month or permanent hires fall through, which wastes the recruiting effort and strains client trust."
        : `Few contractors leave in their first month, and 90-day retention is ${gapWords(pctChange(ret.rate, retPy.rate))} last year.`,
      actions: fallOffBad
        ? ["Check in with every new contractor and their manager in the first week.", "Review fall-off reasons by client and recruiter, and fix the brief or the screening that let them through.", "Tighten guarantee terms on permanent placements with repeat refunds."]
        : ["Use retention as a selling point when pitching for new job orders.", "Keep first-week check-ins in place as volume grows."],
      evidence: {
        title: "Placement quality",
        columns: VS_PY,
        rows: [
          pyRow("Fall-off rate", rc.fallOffRate, rcPy.fallOffRate, "pct"),
          pyRow("Early ends (first 30 days)", rc.fallOffs, rcPy.fallOffs, "count"),
          pyRow("Permanent placement refunds", rc.refunds, rcPy.refunds, "count"),
          pyRow("90-day retention", ret.rate, retPy.rate, "pct"),
        ],
      },
    })
  );

  // 4. Speed — fill time and aging job orders.
  const fillMove = rc.daysToFill != null && rcPy.daysToFill != null ? rc.daysToFill - rcPy.daysToFill : null;
  const slower = (fillMove ?? 0) > 0.5;
  const agingShare = open.count ? open.aging / open.count : 0;
  out.push(
    insight({
      id: "rec-speed",
      section: "speed",
      category: "effectiveness",
      severity: slower || agingShare > 0.4 ? "negative" : "positive",
      title: slower ? "Job orders are taking longer to fill than last year" : "Job orders are filling at least as fast as last year",
      meaning: `${slower ? "Slower fills give competing agencies time to place their candidates first." : "Speed is a competitive edge: the first strong candidate in front of a hiring manager usually wins."} ${agingShare > 0.4 ? "A large share of open job orders has been open for over a month, which usually means they need re-pricing, a new brief or closing." : "Most open job orders are recent, so the backlog is under control."}`,
      actions: [
        "Aim for a first submittal within 48 hours of every new job order.",
        agingShare > 0.2 ? "Review job orders open longer than 30 days with account managers: re-price, re-brief, reassign or close them." : "Keep a bench of pre-screened candidates for roles clients hire repeatedly.",
      ],
      evidence: {
        title: "Oldest open job orders",
        columns: [col("client", "Client"), col("recruiter", "Recruiter"), col("daysOpen", "Days open", "count"), col("stage", "Stage"), col("submittals", "Submittals", "count"), col("interviews", "Interviews", "count")],
        rows: open.rows.slice(0, 10),
      },
    })
  );

  // 5. Recruiter billing — how much of the billing rests on a few desks.
  if (recruiters.length > 1) {
    const ranked = [...recruiters].sort((a, b) => b.billRevenue - a.billRevenue);
    const total = ranked.reduce((s, r) => s + r.billRevenue, 0);
    const topN = Math.max(1, Math.round(ranked.length / 4));
    const topShare = total ? ranked.slice(0, topN).reduce((s, r) => s + r.billRevenue, 0) / total : 0;
    const none = ranked.filter((r) => r.activeContractors === 0);
    const concentrated = topShare > 0.5 || none.length > ranked.length / 4;
    out.push(
      insight({
        id: "rec-productivity",
        section: "productivity",
        category: "people",
        severity: concentrated ? "negative" : "positive",
        title: concentrated ? `Billing is concentrated in a few desks, led by ${listNames(ranked.slice(0, 2).map((r) => r.name))}` : "Billing is spread evenly across recruiters",
        meaning: concentrated
          ? `The top quarter of recruiters bill most of the contractor revenue${none.length ? `, and ${none.length} recruiter${none.length === 1 ? " has" : "s have"} no contractors on assignment` : ""}, so losing one of those desks or its largest client would hit revenue hard.`
          : "No single desk carries the billing, so revenue is resilient to a recruiter leaving or a client cutting back.",
        actions: concentrated
          ? ["Give recruiters with few contractors on assignment the open job orders at clients the top desks already bill.", "Plan cover for the top desks' largest assignments so extensions and redeployments don't depend on one person.", "Check whether low-billing desks are short of job orders or short of starts, and coach accordingly."]
          : ["Keep sharing client relationships and redeployment practice across teams.", "Point the strongest desks at higher bill-rate job orders to lift spread."],
        evidence: {
          title: "Recruiters by bill revenue",
          columns: [col("name", "Recruiter"), col("team", "Team"), col("activeContractors", "Active contractors", "count"), col("billedHours", "Billed hours", "hours"), col("billRevenue", "Bill revenue", "money"), col("gp", "GP", "money"), col("avgBillRate", "Bill rate", "rate")],
          rows: ranked.slice(0, 12),
        },
      })
    );
  }
  if (leadTeams.length > 1) {
    const perHead = leadTeams.map((t) => ({ ...t, perRecruiter: t.recruiters ? t.gp / t.recruiters : 0 })).sort((a, b) => b.perRecruiter - a.perRecruiter);
    const best = perHead[0];
    const weakest = perHead[perHead.length - 1];
    if (best.perRecruiter > 0 && weakest.perRecruiter < best.perRecruiter * 0.6) {
      out.push(
        insight({
          id: "rec-productivity-teams",
          section: "productivity",
          category: "people",
          severity: "negative",
          title: `${weakest.name} earns far less GP per recruiter than ${best.name}`,
          meaning: "The gap is in what each desk bills and keeps, not only in headcount, so fewer contractors on assignment, lower bill rates or thinner spread are holding the team back.",
          actions: [`Have ${weakest.lead || "the team's lead"} compare contractors per recruiter and spread with ${best.lead || "the strongest team's lead"}.`, "Prioritise extensions and redeployments on the weaker team's desks before new sourcing.", "Review bill rates at the team's largest clients against market before the next renewal."],
          evidence: {
            title: "Lead teams by GP per recruiter",
            columns: [col("name", "Lead team"), col("lead", "Recruiter lead"), col("recruiters", "Recruiters", "count"), col("activeContractors", "Active contractors", "count"), col("billRevenue", "Bill revenue", "money"), col("gp", "GP", "money"), col("perRecruiter", "GP per recruiter", "money"), col("spread", "Spread", "rate")],
            rows: perHead,
          },
        })
      );
    }
  }

  // 6. Keeping contractors billing — extensions and redeployment at each assignment end.
  // (Whether the billable base is growing is the staffing-finance insight.)
  const redeployShare = staff.ends ? rc.redeployed / staff.ends : null;
  const extensionChange = pctChange(rc.extensions, rcPy.extensions);
  const leaking = (redeployShare != null && redeployShare < 0.2) || (extensionChange != null && extensionChange < 0);
  out.push(
    insight({
      id: "rec-contractors",
      section: "staffing",
      category: "staffing",
      severity: leaking ? "negative" : "positive",
      title: leaking
        ? "Billing is leaking at assignment ends: few contractors are extended or redeployed"
        : "Extensions and redeployments are keeping contractors billing",
      meaning: leaking
        ? "Contractors coming off assignment are leaving the bench instead of moving to another billable role, so each end costs revenue the team has to replace with new starts."
        : `Most assignment ends roll into an extension or another placement, so billing carries over without new sourcing; extensions are ${growthWords(extensionChange)} on last year.`,
      actions: leaking
        ? ["Review every assignment ending in the next 30 days and push for an extension or a redeployment.", "Point recruiters at open job orders that fit contractors already coming off assignment."]
        : ["Start extension conversations 30 days before each planned end to keep the run going.", "Offer contractors coming off assignment to open job orders before they leave the bench."],
      evidence: {
        title: "Contractors on assignment against the same period last year",
        columns: VS_PY,
        rows: [
          pyRow("Active at period end", staff.activeAtEnd, staffPy.activeAtEnd, "count"),
          pyRow("Starts", staff.starts, staffPy.starts, "count"),
          pyRow("Ends", staff.ends, staffPy.ends, "count"),
          pyRow("Extensions", rc.extensions, rcPy.extensions, "count"),
          pyRow("Redeployments", rc.redeployed, rcPy.redeployed, "count"),
        ],
      },
    })
  );

  // 7. Cost per placement.
  if (m.costPerPlacement != null && m.costPerPlacementPy != null) {
    const up = m.costPerPlacement > m.costPerPlacementPy;
    out.push(
      insight({
        id: "rec-cost-per-placement",
        section: "economics",
        category: "cost",
        severity: up ? "negative" : "positive",
        title: up ? "Each placement costs more in recruiting expense than last year" : "Each placement costs less in recruiting expense than last year",
        meaning: up
          ? "Spend is growing faster than placements, so some effort is going into job orders that don't fill or channels that don't convert."
          : "Placements are growing faster than recruiting spend, so the team is getting more out of each dollar.",
        actions: up
          ? ["Shift sourcing spend toward the channels that produced this period's placements.", "Close or re-price job orders that have stalled, so effort stops going into roles that won't fill."]
          : ["Reinvest part of the saving in sourcing for hard-to-fill verticals.", "Keep cancelled job orders low by qualifying demand before sourcing starts."],
        evidence: {
          title: "Recruiting cost per placement",
          columns: VS_PY,
          rows: [pyRow("Cost per placement", m.costPerPlacement, m.costPerPlacementPy, "money"), pyRow("Placements", rc.placements, rcPy.placements, "count")],
        },
      })
    );
  }
  return out;
}
