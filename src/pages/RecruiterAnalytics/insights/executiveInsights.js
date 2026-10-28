import { gapWords, growthWords, insight, listNames, pctChange } from "./phrasing";
import { byUnit } from "../utils/format";

// What each GP bridge step means, and what to do when it helps or hurts.
const STEP_GUIDANCE = {
  volume: {
    up: ["more contractors on billing than the comparison", ["Lock in the gains: confirm extensions on assignments ending this quarter.", "Keep recruiter capacity on backfills so headcount doesn't slip back."]],
    down: ["fewer contractors on billing than the comparison", ["Prioritise backfills and redeploy contractors coming off assignment before they leave the bench.", "Ask each account manager for the clients where headcount fell and the reason (demand, attrition or slow fills)."]],
  },
  hours: {
    up: ["contractors working more hours each (overtime or longer weeks)", ["Check the extra hours are approved in client contracts and billed at overtime rates.", "Treat the uplift as temporary in the outlook unless clients have committed to it."]],
    down: ["fewer hours per contractor (shorter weeks, holidays or client cutbacks)", ["Identify clients cutting weekly hours and agree minimum-hour commitments at renewal.", "Move under-utilised contractors to clients with open requisitions."]],
  },
  mix: {
    up: ["growth concentrated in higher-spread clients", ["Go after more job orders at these high-spread clients.", "Use their rates as the reference rate card when pricing similar new clients."]],
    down: ["growth concentrated in lower-spread clients", ["Set a minimum spread for new starts at low-margin and MSP clients.", "Steer recruiter effort toward higher-spread clients' open requisitions."]],
  },
  billRate: {
    up: ["bill rates rising", ["Make sure renewals carry the higher rates forward.", "Use the increases as precedent in upcoming rate reviews."]],
    down: ["bill rates slipping, typically from MSP renegotiations or discounting", ["Escalate the clients where bill rates fell and add rate escalators to renewals.", "Require account manager approval for markups below the floor."]],
  },
  payRate: {
    up: ["pay rates rising more slowly than planned", ["Hold the line on pay packages where fill times allow.", "Reinvest part of the saving in hard-to-fill roles."]],
    down: ["pay increases outpacing bill rates", ["Pass pay increases through to bill rates at renewal.", "Set spread floors so new starts can't be priced below margin."]],
  },
  burden: {
    up: ["lower payroll burden (statutory caps reached or better workers' comp classes)", ["Check workers' comp classifications are current before renewal.", "Expect burden to rise again when wage caps reset in January."]],
    down: ["higher payroll burden — statutory taxes, workers' comp or benefits", ["Review SUTA experience rates and workers' comp class codes by state.", "Price burden into bill rates for benefits-eligible contractors."]],
  },
  directLabor: {
    up: ["lower direct labor cost per hour", ["Hold pay discipline on new starts while fill times allow."]],
    down: ["higher direct labor cost per hour (pay and burden)", ["Pass cost increases through to bill rates at renewal.", "Set spread floors for new starts."]],
  },
  odc: {
    up: ["lower other direct costs", ["Keep VMS fee and per-diem approvals tight."]],
    down: ["higher other direct costs such as VMS fees, screening and per diems", ["Review VMS fee terms with MSP clients at renewal.", "Check per-diem approvals against client contracts."]],
  },
  fees: {
    up: ["more permanent-placement fee income", ["Keep converting strong contract-to-hire candidates into fee income."]],
    down: ["less permanent-placement fee income (or fall-off refunds)", ["Review recent fall-offs and tighten candidate guarantees.", "Ask existing clients for direct-hire roles to rebuild placement fees."]],
  },
  margin: {
    up: ["a better gross margin rate on the revenue billed", ["Hold rate discipline; the margin gain is what is lifting GP."]],
    down: ["a weaker gross margin rate on the revenue billed", ["Review bill/pay spreads at the largest clients.","Check for burden or VMS fee increases not passed through."]],
  },
};

const bridgeEvidence = (bridge) => ({
  title: `GP bridge · ${bridge.method}`,
  columns: [
    { key: "label", label: "Step", unit: "text" },
    { key: "amount", label: "Effect on GP", unit: "money" },
  ],
  rows: [
    { label: bridge.start.label, amount: bridge.start.amount },
    ...bridge.steps.map((s) => ({ label: s.label, amount: s.amount })),
    { label: bridge.end.label, amount: bridge.end.amount },
  ],
});

export function buildExecutiveInsights(m) {
  const out = [];
  const { bridge, bases, cur, ctx } = m;
  const basis = ctx.filters.compare;
  const base = bases[basis];

  // 1. Performance drivers — the bridge step that moved GP most.
  if (bridge.steps.length) {
    const ranked = [...bridge.steps].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const top = ranked[0];
    const second = ranked[1];
    const gpGap = pctChange(cur.gp, base?.gp);
    const dir = top.amount >= 0 ? "up" : "down";
    const g = STEP_GUIDANCE[top.key]?.[dir];
    const g2 = second && Math.abs(second.amount) > Math.abs(top.amount) * 0.4 ? STEP_GUIDANCE[second.key]?.[second.amount >= 0 ? "up" : "down"] : null;
    out.push(
      insight({
        id: "exec-gp-driver",
        section: "financial",
        category: "performance",
        severity: (gpGap ?? 0) >= 0 ? "positive" : "negative",
        // The biggest step can work against the overall result (GP ahead while bill rates slip).
        title:
          (gpGap ?? 0) >= 0 === top.amount >= 0
            ? `GP is ${gapWords(gpGap)} ${m.basisLabel}, driven mostly by ${top.label.toLowerCase()}`
            : `GP is ${gapWords(gpGap)} ${m.basisLabel} even though ${top.label.toLowerCase()} ${top.amount >= 0 ? "is working in its favour" : "is holding it back"}`,
        meaning: `The largest single effect is ${g ? g[0] : top.label.toLowerCase()}${g2 ? `, with ${g2[0]} the next biggest factor` : ""}.`,
        actions: g ? g[1] : [],
        evidence: bridgeEvidence(bridge),
        whatIf: { label: "Model the lever", prefill: { lever: top.key } },
      })
    );
  }

  // 2. Client base momentum — lost and contracting revenue vs new and expanding.
  const cat = Object.fromEntries(m.growth.map((g) => [g.key, g]));
  const gained = (cat.new?.change || 0) + (cat.expanded?.change || 0);
  const shed = (cat.lost?.change || 0) + (cat.contracted?.change || 0);
  if (gained || shed) {
    const net = gained + shed;
    const topLosers = [...(cat.lost?.clients || []), ...(cat.contracted?.clients || [])].sort((a, b) => a.change - b.change).slice(0, 3);
    out.push(
      insight({
        id: "exec-account-momentum",
        section: "clients",
        category: "performance",
        severity: net >= 0 ? "positive" : "negative",
        title: net >= 0 ? "New and growing clients are more than replacing the revenue lost from shrinking ones" : "Revenue lost from shrinking and lapsed clients is outrunning new and growing clients",
        meaning: topLosers.length
          ? `Most of the shrinkage sits with ${listNames(topLosers.map((c) => c.name))}; whether the client base grows depends on winning back or replacing that headcount demand.`
          : "Growth is broad-based with little revenue leaking from existing clients.",
        actions:
          net >= 0
            ? ["Hold regular workforce-planning reviews with the growing clients so their next requisitions come to us first.", "Use recent placements at these clients as references to win clients in the same verticals."]
            : ["Call the largest contracting clients to learn whether demand fell or the work moved to another agency.", "Push for more job orders at stable clients to offset the shrinkage."],
        evidence: {
          title: "Client movement against prior year",
          columns: [
            { key: "label", label: "Category", unit: "text" },
            { key: "count", label: "Clients", unit: "count" },
            { key: "revenue", label: "Revenue now", unit: "money" },
            { key: "revenueBase", label: "Revenue prior year", unit: "money" },
            { key: "change", label: "Change", unit: "money" },
          ],
          rows: m.growth.map(({ label, count, revenue, revenueBase, change }) => ({ label, count, revenue, revenueBase, change })),
        },
      })
    );
  }

  // 3. Cost intelligence — recruiting expense growing faster than GP.
  const gpGrowth = pctChange(cur.gp, bases.py.gp);
  const expGrowth = pctChange(m.exp.total, m.expPy.total);
  const commGrowth = pctChange(m.exp.commission, m.expPy.commission);
  const teGrowth = pctChange(m.exp.travel + m.exp.entertainment, m.expPy.travel + m.expPy.entertainment);
  if (expGrowth != null && gpGrowth != null) {
    const outpacing = expGrowth > gpGrowth + 2;
    const teHot = teGrowth != null && teGrowth > (gpGrowth ?? 0) + 10;
    out.push(
      insight({
        id: "exec-cost-efficiency",
        section: "economics",
        category: "cost",
        severity: outpacing || teHot ? "negative" : "positive",
        title: outpacing
          ? "Recruiting expense is growing faster than the GP it produces"
          : teHot
            ? "Travel and entertainment are rising faster than GP"
            : "Recruiting expense is growing no faster than GP",
        meaning: outpacing
          ? `Each dollar of recruiting spend is buying less GP than a year ago${commGrowth != null && commGrowth > expGrowth ? ", with commissions the fastest-growing line" : teHot ? ", led by travel and entertainment" : ""}.`
          : teHot
            ? "Overall efficiency is holding, but discretionary spend is creeping up and will erode contribution if it continues."
            : "Recruiting efficiency is holding: contribution grows as GP grows.",
        actions: outpacing || teHot
          ? ["Review T&E against allowance for the recruiters furthest over, and require pre-approval for client entertainment.", "Check commission accrual against plan rules for any accelerators paid on low-margin GP."]
          : ["Keep current expense controls; revisit allowances only for recruiters whose desks are growing."],
        evidence: {
          title: "Recruiting expense against prior year",
          columns: [
            { key: "label", label: "Category", unit: "text" },
            { key: "cur", label: "This period", unit: "money" },
            { key: "py", label: "Prior year", unit: "money" },
            { key: "growth", label: "Growth", unit: "pct" },
          ],
          // Category detail only for viewers allowed to see it; the total is an aggregate.
          rows: [
            ["Commissions", "commission", m.canSeeCommissions], ["Travel", "travel", m.canSeeCostDetail],
            ["Client entertainment", "entertainment", m.canSeeCostDetail], ["Client acquisition", "acquisition", m.canSeeCostDetail],
            ["Salary & benefits allocation", "salary", m.canSeeCostDetail], ["Total recruiting expense", "total", true],
          ].filter(([, , allowed]) => allowed)
            .map(([label, k]) => ({ label, cur: m.exp[k], py: m.expPy[k], growth: pctChange(m.exp[k], m.expPy[k]) }))
            .concat([{ label: "Gross profit", cur: cur.gp, py: bases.py.gp, growth: gpGrowth }]),
        },
      })
    );
  }

  // 4. Recruiting effectiveness — strongest and weakest team on contribution after recruiting expense.
  const teams = m.teamRows.filter((t) => t.gp > 0);
  if (teams.length >= 2) {
    const sorted = [...teams].sort((a, b) => (b.contributionMargin ?? 0) - (a.contributionMargin ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    out.push(
      insight({
        id: "exec-team-effectiveness",
        section: "economics",
        category: "effectiveness",
        severity: "neutral",
        title: `${best.name} converts the most GP into contribution; ${worst.name} keeps the least`,
        meaning: `${worst.name} spends proportionally more on recruiting costs for the GP it brings in, so its revenue is less profitable after those costs than the headline margin suggests.`,
        actions: [
          `Compare ${worst.name}'s commission and T&E mix with ${best.name}'s to find what drives the gap.`,
          "Point the weaker team at more job orders from existing high-spread clients rather than costly new-client pursuit.",
        ],
        evidence: {
          title: "Team contribution after recruiting expense",
          columns: [
            { key: "name", label: "Team", unit: "text" },
            { key: "revenue", label: "Revenue", unit: "money" },
            { key: "gp", label: "GP", unit: "money" },
            { key: "salesExpense", label: "Recruiting expense", unit: "money" },
            { key: "contribution", label: "Contribution", unit: "money" },
            { key: "contributionMargin", label: "Contribution % of GP", unit: "pct" },
          ],
          rows: sorted,
        },
      })
    );
  }

  // New-client acquisition economics.
  if (m.newClients.length) {
    out.push(
      insight({
        id: "exec-acquisition",
        section: "clients",
        category: "effectiveness",
        severity: "positive",
        title: m.newClients.length > 1 ? "New clients are joining the client base this period" : "One new client was added this period",
        meaning: "New clients ramp over their first months, so their GP contribution builds through the next two quarters; early staffing speed decides how fast that happens.",
        actions: ["Track time-to-first-start at each new client and escalate any requisition open beyond two weeks.", "Agree a plan for further roles with each new client within 90 days of the first start."],
        evidence: {
          title: "New clients won",
          columns: [
            { key: "name", label: "Client", unit: "text" },
            { key: "acquiredDate", label: "Won", unit: "date" },
            { key: "vertical", label: "Vertical", unit: "text" },
            { key: "owner", label: "Recruiters", unit: "text" },
          ],
          rows: m.newClients.map((c) => ({
            name: c.name,
            acquiredDate: c.acquiredDate,
            vertical: ctx.index.verticalById.get(c.verticalId)?.name,
            owner: c.owners.map((o) => ctx.index.repById.get(o.repId)?.name).join(", "),
          })),
        },
      })
    );
  }

  // 5. Forecast confidence — quarter outlook against target, with pipeline coverage.
  const o = m.outlook;
  const gapPct = pctChange(o.fullQuarter.gp, o.target.gp);
  const coverageOk = m.pipe.coverage != null && m.pipe.coverage >= 1;
  out.push(
    insight({
      id: "exec-forecast-confidence",
      section: "forecast",
      category: "forecast",
      severity: (gapPct ?? 0) >= 0 ? "positive" : coverageOk ? "neutral" : "negative",
      title: `At the current run-rate the quarter lands ${gapWords(gapPct)} its GP target`,
      meaning:
        (gapPct ?? 0) >= 0
          ? "Existing billing is enough to meet the quarter; job orders filled from the pipeline are upside rather than a requirement."
          : coverageOk
            ? "Run-rate alone falls short, but the weighted pipeline is large enough to close the gap if job orders fill and start on time."
            : "Run-rate falls short and the weighted pipeline does not cover what is still needed this year, so the gap depends on improving fill rates or start dates.",
      actions:
        (gapPct ?? 0) >= 0
          ? ["Protect run-rate: confirm extensions on assignments ending before quarter end."]
          : ["Ask account managers for the specific starts and extensions that close the gap, with dates.", "Pull forward start dates on late-stage job orders where the client is ready."],
      evidence: {
        title: `${o.label} outlook (${o.method})`,
        columns: [
          { key: "label", label: "Measure", unit: "text" },
          { key: "revenue", label: "Revenue", unit: "money" },
          { key: "gp", label: "GP", unit: "money" },
        ],
        rows: [
          { label: `${o.priorLabel} actual`, ...o.priorQuarter },
          { label: "Actual to date", ...o.actualToDate },
          { label: "Projected remaining (run-rate)", ...o.projectedRemaining },
          { label: "Full-quarter outlook", ...o.fullQuarter },
          { label: "Recruiting Target", ...o.target },
          { label: "Finance Forecast (read-only)", ...o.financeForecast },
        ],
      },
      whatIf: { label: "Model the gap", prefill: { focus: "quarter" } },
    })
  );

  // Revenue momentum vs prior year (forecast confidence context).
  const revGrowth = pctChange(cur.revenue, bases.py.revenue);
  if (revGrowth != null) {
    out.push(
      insight({
        id: "exec-growth",
        section: "financial",
        category: "forecast",
        severity: revGrowth >= 0 ? "positive" : "negative",
        title: `Revenue is ${growthWords(revGrowth)} against the same period last year`,
        meaning:
          revGrowth >= 0
            ? "Year-on-year growth gives the plan a solid base; the risk is concentration in a few growing clients."
            : "The business is billing less than a year ago, so plans built on last year's run-rate are at risk.",
        actions:
          revGrowth >= 0
            ? ["Check that growth is spread across verticals rather than one or two clients."]
            : ["Re-baseline the remaining-year outlook with account managers and identify which verticals must recover."],
        evidence: {
          title: "This period against the same period last year",
          columns: [
            { key: "label", label: "Measure", unit: "text" },
            { key: "cur", label: "This period", unit: "money" },
            { key: "py", label: "Prior year", unit: "money" },
            { key: "growth", label: "Growth", unit: "pct" },
          ],
          rows: [
            { label: "Revenue", cur: cur.revenue, py: bases.py.revenue, growth: revGrowth },
            { label: "Gross profit", cur: cur.gp, py: bases.py.gp, growth: pctChange(cur.gp, bases.py.gp) },
          ],
        },
      })
    );
  }

  // Billable contractors — is the billable base growing, and is each hour earning as much?
  const s = m.staff;
  const sPy = m.staffPy;
  if (s.starts || s.ends) {
    const growing = s.netChange >= 0;
    const headcountUp = (pctChange(s.avgActive, sPy.avgActive) ?? 0) >= 0;
    const spreadMove = m.canSeeCostDetail ? pctChange(s.spreadAfterBurden, sPy.spreadAfterBurden) : null;
    const spreadText =
      spreadMove == null
        ? ""
        : spreadMove < -1
          ? " Each billed hour also earns less after burden than a year ago, so added headcount is not fully reaching GP."
          : spreadMove > 1
            ? " Each billed hour also earns more after burden than a year ago, so the growth is reaching GP."
            : " Spread per hour is holding, so GP moves with headcount.";
    const row = (label, key, unit) => ({ label, cur: byUnit(s[key], unit), py: byUnit(sPy[key], unit), change: pctChange(s[key], sPy[key]) });
    out.push(
      insight({
        id: "exec-staffing-base",
        section: "staffing",
        category: "staffing",
        severity: growing && (spreadMove == null || spreadMove >= -1) ? "positive" : "negative",
        title: growing ? "More contractors started than ended, so the billable base is growing" : "More contractors ended than started, so the billable base is shrinking",
        meaning: `Average headcount on billing is ${headcountUp ? "above" : "below"} the same period last year.${spreadText}`,
        actions: growing
          ? [
              "Keep start-to-bill times short so new starts reach billing in their first week.",
              spreadMove != null && spreadMove < -1 ? "Price new starts at or above the current spread after burden." : "Confirm extensions on assignments ending this quarter to hold the gains.",
            ]
          : ["Review assignments ending in the next 60 days and push for extensions or redeployment.", "Point recruiters at open requisitions at the highest-spread clients."],
        evidence: {
          title: "Billable contractors against the same period last year",
          columns: [
            { key: "label", label: "Measure", unit: "text" },
            { key: "cur", label: "This period", unit: "text" },
            { key: "py", label: "Prior year", unit: "text" },
            { key: "change", label: "Change", unit: "pct" },
          ],
          rows: [
            row("Active at period end", "activeAtEnd", "count"),
            row("Average active", "avgActive", "count"),
            row("Starts", "starts", "count"),
            row("Ends", "ends", "count"),
            row("Billed hours", "billedHours", "hours"),
            row("Average bill rate", "avgBillRate", "rate"),
            ...(m.canSeeCostDetail ? [row("Average pay rate", "avgPayRate", "rate"), row("Spread after burden", "spreadAfterBurden", "rate")] : []),
          ],
        },
        whatIf: { label: "Model starts and extensions", prefill: { focus: "staffing" } },
      })
    );
  }

  // Pipeline health — coverage, concentration and stalled job orders.
  const p = m.pipe;
  if (p.openCount) {
    const rows = m.pipelineRows;
    const totalW = rows.reduce((sum, r) => sum + r.weightedGp, 0);
    const top3 = rows.slice(0, 3).reduce((sum, r) => sum + r.weightedGp, 0);
    const concentrated = totalW > 0 && top3 / totalW > 0.35;
    const stale = rows.filter((r) => r.daysInStage > 45 || r.pushes >= 2);
    const done = p.remainingTarget <= 0;
    const covered = done || (p.coverage != null && p.coverage >= 1);
    out.push(
      insight({
        id: "exec-pipeline-health",
        section: "pipeline",
        category: "pipeline",
        severity: covered && !concentrated ? "positive" : covered ? "neutral" : "negative",
        title: done
          ? "The full-year revenue target is already met, so the pipeline is upside"
          : covered
            ? "Weighted pipeline covers the revenue target still to go this year"
            : "Weighted pipeline does not cover the revenue target still to go this year",
        meaning: [
          concentrated
            ? "A large share of the weighted value sits in a few job orders, so a slip on any one of them moves the outlook."
            : "Pipeline value is spread across many job orders, so no single slip changes the outlook much.",
          stale.length ? "Job orders stalled in a stage or with pushed fill dates are where fills are most at risk." : null,
        ].filter(Boolean).join(" "),
        actions: [
          !covered ? "Ask each account manager for new qualified job orders that can start before year end." : null,
          concentrated ? "Have a recruiting director sponsor each of the largest job orders and agree a shortlist and start date with the client." : null,
          stale.length ? "Re-qualify stalled job orders in pipeline reviews: set a dated next step or close them out." : "Keep weekly stage reviews so job orders keep moving.",
        ].filter(Boolean),
        evidence: {
          title: "Largest open job orders by weighted GP",
          columns: [
            { key: "name", label: "Client / prospect", unit: "text" },
            { key: "owner", label: "Recruiter", unit: "text" },
            { key: "stage", label: "Stage", unit: "text" },
            { key: "probability", label: "Probability", unit: "pct" },
            { key: "weightedGp", label: "Weighted GP", unit: "money" },
            { key: "daysInStage", label: "Days in stage", unit: "count" },
            { key: "pushes", label: "Fill-date pushes", unit: "count" },
            { key: "expectedStart", label: "Expected start", unit: "date" },
          ],
          rows: rows.slice(0, 15),
        },
        whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
      })
    );
  }

  // Fill / loss — direction of the fill rate and the main loss reason.
  const wl = m.winLoss;
  if (wl.won + wl.lost > 0) {
    const diff = wl.winRate != null && m.winLossPy.winRate != null ? wl.winRate - m.winLossPy.winRate : null;
    const [first, second] = wl.reasons;
    out.push(
      insight({
        id: "exec-win-loss",
        section: "pipeline",
        category: "pipeline",
        severity: diff == null ? "neutral" : diff >= 1 ? "positive" : diff <= -1 ? "negative" : "neutral",
        title:
          diff == null
            ? "How the job orders closed this period were filled and lost"
            : diff >= 1
              ? "Job orders are being filled more often than a year ago"
              : diff <= -1
                ? "Job orders are being filled less often than a year ago"
                : "Job orders are being filled about as often as a year ago",
        meaning: first
          ? `${first.reason} is the most common reason job orders are lost${second ? `, followed by ${second.reason.toLowerCase()}` : ""}.`
          : "No job orders were lost in the period.",
        actions: (first && LOSS_ACTIONS[first.reason]) || ["Record a loss reason on every closed job order so patterns are visible."],
        evidence: {
          title: "Lost job orders by reason",
          columns: [
            { key: "reason", label: "Loss reason", unit: "text" },
            { key: "count", label: "Job orders", unit: "count" },
            { key: "expectedGp", label: "Expected GP lost", unit: "money" },
          ],
          rows: wl.reasons,
        },
      })
    );
  }
  return out;
}

const LOSS_ACTIONS = {
  "Rate / markup too high": ["Give account managers a clear markup floor and the authority to trade terms (volume, duration) instead of rate.", "Lead with fill speed and quality where clients compare on price."],
  "Filled by another agency": ["Debrief the largest competitive losses with the client to learn what the winning agency offered.", "Profile the competing agencies that appear most often (rates, speed, candidate quality) and brief recruiters on how to beat them."],
  "Client went quiet": ["Confirm budget, approval and interview dates when taking the job order, before sourcing starts.", "Close out job orders with no dated next step instead of carrying them."],
  "Position put on hold": ["Keep frozen job orders warm with a check-in date tied to the client's budget cycle, and keep shortlisted candidates engaged.", "Shift recruiter effort to clients with approved headcount this quarter."],
  "No qualified candidates": ["Check candidate supply for hard-to-fill skills before committing to start dates.", "Use the redeployment bench for adjacent skills."],
  "Filled internally": ["Target incumbents' renewal dates and get onto the vendor list ahead of time."],
};
