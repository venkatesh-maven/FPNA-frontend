import { insight, listNames, pctChange } from "./phrasing";

const col = (key, label, unit = "money") => ({ key, label, unit });

/** The eight team insights (Account Manager and Recruiter Lead pages) the spec makes mandatory, always present. */
export function buildDirectorInsights({ reps, clients, newWins, rateMoves, months, openDeals = [] }) {
  const out = [];
  const byGp = [...reps].sort((a, b) => b.gp - a.gp);

  // 1. Highest GP performer and what drove it.
  const top = byGp[0];
  if (top) {
    const growth = pctChange(top.gp, top.gpPy);
    const drivers = [];
    if (top.contractorGrowth > 0) drivers.push("a growing contractor base");
    if (top.avgBillRate && top.billRatePy && top.avgBillRate > top.billRatePy * 1.01) drivers.push("higher bill rates");
    if (top.newClientsWon > 0) drivers.push("new client wins");
    if (!drivers.length) drivers.push("a large, stable desk of existing clients");
    out.push(
      insight({
        id: "dir-top-gp",
        section: "team-financial",
        category: "performance",
        severity: "positive",
        title: `${top.name} is the highest GP producer this period`,
        meaning: `The result rests on ${listNames(drivers)}${growth != null ? `, and GP is ${growth >= 0 ? "up" : "down"} on the same period last year` : ""}.`,
        actions: [
          `Share ${top.name.split(" ")[0]}'s sourcing approach and rate discipline with the team.`,
          top.endingSoon ? "Protect the desk: confirm extensions on this recruiter's assignments ending in the next 60 days." : "Use this desk as the reference when setting next year's recruiter targets.",
        ],
        evidence: {
          title: "Top GP producers",
          columns: [col("name", "Recruiter", "text"), col("gp", "GP"), col("gpTarget", "GP target"), col("gpAttainment", "Attainment", "pct"), col("contractors", "Contractors", "count"), col("avgBillRate", "Avg bill rate", "rate"), col("billRatePy", "Bill rate PY", "rate")],
          rows: byGp.slice(0, 5),
        },
      })
    );
  }

  // 2. Recruiters above both YTD revenue and GP budget.
  const over = reps.filter((r) => r.ytdOverBudget).sort((a, b) => b.ytdGpOverBudget - a.ytdGpOverBudget);
  const nearest = [...reps].sort((a, b) => (b.ytdGpAttainment ?? 0) - (a.ytdGpAttainment ?? 0))[0];
  out.push(
    insight({
      id: "dir-ytd-over-budget",
      section: "team-financial",
      category: "performance",
      severity: over.length ? "positive" : "negative",
      title: over.length
        ? `${over.length} ${over.length === 1 ? "recruiter is" : "recruiters are"} ahead of both YTD revenue and GP budget`
        : "No recruiter is ahead of both YTD revenue and GP budget",
      meaning: over.length
        ? `${listNames(over.map((r) => r.name))} lead${over.length === 1 ? "s" : ""} on dollars over budget; ranking by attainment shows who is outperforming relative to the size of their desk.`
        : `${nearest ? `${nearest.name} is closest` : "The team is behind"}; the gap is broad rather than one recruiter's shortfall.`,
      actions: over.length
        ? ["Recognise the over-budget recruiters and check their growth comes from repeat clients rather than one-off placements.", "Pair under-budget recruiters with them on sourcing and client calls."]
        : ["Agree a recovery plan per recruiter with named extensions, starts and rate actions.", "Review whether YTD budgets reflect lost or shrinking clients."],
      evidence: {
        title: "YTD against budget",
        columns: [col("name", "Recruiter", "text"), col("ytdRevenue", "YTD revenue"), col("ytdRevenueBudget", "YTD revenue budget"), col("ytdGp", "YTD GP"), col("ytdGpBudget", "YTD GP budget"), col("ytdGpOverBudget", "GP over budget"), col("ytdGpAttainment", "GP attainment vs target", "pct")],
        rows: [...reps].sort((a, b) => b.ytdGpOverBudget - a.ytdGpOverBudget),
      },
    })
  );

  // 3. Top new client won.
  const win = newWins[0];
  out.push(
    insight({
      id: "dir-top-new-client",
      section: "team-pipeline",
      category: "pipeline",
      severity: win ? "positive" : "neutral",
      title: win ? `Top new client won: ${win.name}, credited to ${win.owner}` : "No new clients won in this period",
      meaning: win
        ? win.firstBilledMonth
          ? "The client is already billing, so its first-year value now depends on how fast the remaining positions are filled."
          : "The client has not billed yet; its contribution this quarter depends on hitting the planned start date."
        : "New-client job orders are not filling in this period, so growth relies on existing clients.",
      actions: win
        ? ["Staff the opening requisitions ahead of other work to secure the first-start date.", "Set a 90-day plan for further roles with the client's hiring managers."]
        : ["Review late-stage new-client job orders and what is blocking the fill.", "Check loss reasons on recent new-client job orders for pricing patterns."],
      evidence: win
        ? {
            title: "New client wins",
            columns: [col("name", "Client", "text"), col("owner", "Recruiter", "text"), col("winDate", "Won", "date"), col("headcount", "Projected contractors", "count"), col("billRate", "Bill rate", "rate"), col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"), col("expectedFirstBilling", "Expected first billing", "date"), col("firstBilledMonth", "First billed", "text")],
            rows: newWins,
          }
        : null,
    })
  );

  // 4. Biggest bill / pay rate movements and their GP and margin effect.
  const moves = rateMoves.slice(0, 8);
  const worst = rateMoves.filter((r) => r.gpEffect < 0)[0];
  const best = rateMoves.filter((r) => r.gpEffect > 0)[0];
  out.push(
    insight({
      id: "dir-rate-moves",
      section: "team-staffing",
      category: "staffing",
      severity: worst && (!best || Math.abs(worst.gpEffect) > best.gpEffect) ? "negative" : "positive",
      title: worst ? `Rate spread is narrowing most at ${worst.client}` : best ? `Rate spread is widening most at ${best.client}` : "Bill and pay rates are broadly stable against last year",
      meaning: worst
        ? `Pay has moved faster than bill rates there, eroding GP and margin on the same hours${best ? `; ${best.client} shows the opposite, a spread gain worth protecting` : ""}.`
        : "Rate movements are not a material driver of GP this period.",
      actions: worst
        ? [`Open a rate review with ${worst.client} and add escalators at the next renewal.`, "Set a spread floor for new starts at clients with narrowing spreads."]
        : ["Keep rate cards current at renewal."],
      evidence: {
        title: "Largest rate movements against prior year",
        columns: [col("client", "Client", "text"), col("avgBillRate", "Bill rate", "rate"), col("billRatePy", "Bill rate PY", "rate"), col("avgPayRate", "Pay rate", "rate"), col("payRatePy", "Pay rate PY", "rate"), col("gpEffect", "GP effect"), col("gmChange", "GM change", "pp")],
        rows: moves,
      },
    })
  );

  // 5. Contractors added / lost and the revenue / GP impact.
  const byGrowth = [...reps].sort((a, b) => b.contractorGrowth - a.contractorGrowth);
  const adder = byGrowth[0];
  const loser = byGrowth[byGrowth.length - 1];
  const monthlyGpPer = (r) => (r.contractors > 0 && months > 0 ? r.gp / months / Math.max(1, (r.contractors + r.contractorsAtStart) / 2) : 0);
  const withImpact = byGrowth.map((r) => ({ ...r, monthlyGpImpact: r.contractorGrowth * monthlyGpPer(r) }));
  out.push(
    insight({
      id: "dir-contractor-movement",
      section: "team-staffing",
      category: "staffing",
      severity: (adder?.contractorGrowth || 0) + (loser?.contractorGrowth || 0) >= 0 ? "positive" : "negative",
      title: adder && adder.contractorGrowth > 0 ? `${adder.name} added the most contractors; ${loser.name} lost the most` : `${loser?.name || "The team"} lost the most contractors this period`,
      meaning: "Each contractor carries a monthly GP run-rate, so net headcount change shows up in next month's GP before it shows in revenue totals.",
      actions: [
        loser && loser.contractorGrowth < 0 ? `Review ${loser.name}'s ends: planned completions, client reductions or attrition.` : "Keep backfill requisitions open ahead of planned ends.",
        "Redeploy contractors coming off assignment to clients with open requisitions before they leave the bench.",
      ],
      evidence: {
        title: "Contractor movement by recruiter",
        columns: [col("name", "Recruiter", "text"), col("contractorsAtStart", "At start", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"), col("contractors", "At end", "count"), col("contractorGrowth", "Net change", "count"), col("monthlyGpImpact", "Monthly GP effect")],
        rows: withImpact,
      },
    })
  );

  // 6. Commission and travel growth relative to GP produced.
  const growthRows = reps
    .map((r) => {
      const costNow = r.commission + r.travel;
      const costPy = r.commissionPy + r.travelPy;
      const costGrowth = pctChange(costNow, costPy);
      const gpGrowth = pctChange(r.gp, r.gpPy);
      return { ...r, costGrowth, gpGrowth, gapGrowth: costGrowth != null && gpGrowth != null ? costGrowth - gpGrowth : null };
    })
    .filter((r) => r.gapGrowth != null)
    .sort((a, b) => b.gapGrowth - a.gapGrowth);
  const hot = growthRows.filter((r) => r.gapGrowth > 10);
  out.push(
    insight({
      id: "dir-cost-growth",
      section: "team-costs",
      category: "cost",
      severity: hot.length ? "negative" : "positive",
      title: hot.length ? `Commission and travel are outgrowing GP for ${listNames(hot.map((r) => r.name), 2)}` : "Commission and travel are growing in line with GP",
      meaning: hot.length
        ? "These recruiters are spending more to produce each dollar of GP than a year ago; if it persists their contribution shrinks even while GP grows."
        : "Recruiting spend is scaling with the GP it produces across the team.",
      actions: hot.length
        ? ["Review travel against allowance and require pre-approval above it.", "Check that commission accelerators are not paying on low-margin GP."]
        : ["Keep current expense controls."],
      evidence: {
        title: "Commission + travel growth against GP growth",
        columns: [col("name", "Recruiter", "text"), col("commission", "Commission"), col("commissionPy", "Commission PY"), col("travel", "Travel"), col("travelPy", "Travel PY"), col("costGrowth", "Cost growth", "pct"), col("gpGrowth", "GP growth", "pct")],
        rows: growthRows,
      },
    })
  );

  // 7. Strong revenue, weak contribution.
  const ranked = clients.filter((c) => c.revenue > 0).map((c) => ({ ...c, contributionMargin: (c.contribution / c.revenue) * 100 }));
  const revCut = [...ranked].sort((a, b) => b.revenue - a.revenue)[Math.floor(ranked.length / 4)]?.revenue ?? Infinity;
  const marginCut = [...ranked].sort((a, b) => a.contributionMargin - b.contributionMargin)[Math.floor(ranked.length / 4)]?.contributionMargin ?? -Infinity;
  const weak = ranked.filter((c) => c.revenue >= revCut && c.contributionMargin <= marginCut).sort((a, b) => b.revenue - a.revenue);
  out.push(
    insight({
      id: "dir-weak-contribution",
      section: "team-costs",
      category: "cost",
      severity: weak.length ? "negative" : "positive",
      title: weak.length ? `Large clients with thin contribution: ${listNames(weak.map((c) => c.client), 2)}` : "No large client has unusually thin contribution",
      meaning: weak.length
        ? "These clients are among the biggest by revenue but keep little after direct and recruiting costs, typically from low markups, VMS fees or high burden."
        : "Revenue and contribution are aligned across the largest clients.",
      actions: weak.length
        ? ["Re-price at renewal or negotiate VMS fee terms.", "Limit discretionary recruiting spend (travel, entertainment) on these clients until spread improves."]
        : ["Keep monitoring spread on MSP clients at each renewal."],
      evidence: {
        title: "Revenue against contribution margin (top-quartile revenue, bottom-quartile contribution)",
        columns: [col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("revenue", "Revenue"), col("gp", "GP"), col("gmPct", "GM", "pct"), col("contribution", "Contribution"), col("contributionMargin", "Contribution % of revenue", "pct")],
        rows: weak.length ? weak : ranked.sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      },
    })
  );

  // 8. Underperformers: target gap, aging job orders and the levers they control.
  const under = reps.filter((r) => r.gpAttainment != null && r.gpAttainment < 90).sort((a, b) => a.gpVar - b.gpVar);
  out.push(
    insight({
      id: "dir-underperformers",
      section: "team-financial",
      category: "people",
      severity: under.length ? "negative" : "positive",
      title: under.length ? `${under.length} ${under.length === 1 ? "recruiter is" : "recruiters are"} below 90% of GP target` : "Every recruiter is at or above 90% of GP target",
      meaning: under.length
        ? `${listNames(under.map((r) => r.name), 3)} have the largest gaps; aging job orders and assignments ending soon are the levers within their control.`
        : "The team is broadly on plan; focus shifts to protecting run-rate.",
      actions: under.length
        ? ["For each, agree the extensions due in the next 60 days and the aging job orders to fill or close out.", "Check bill rates against the vertical average and plan rate reviews where they lag."]
        : ["Confirm extensions due in the next 60 days to protect run-rate."],
      evidence: {
        title: "Below 90% of GP target",
        columns: [col("name", "Recruiter", "text"), col("gpAttainment", "GP attainment", "pct"), col("gpVar", "Gap to target"), col("agingOpportunities", "Aging job orders", "count"), col("endingSoon", "Assignments ending ≤60 days", "count"), col("avgBillRate", "Avg bill rate", "rate")],
        rows: under.length ? under : [...reps].sort((a, b) => (a.gpAttainment ?? 0) - (b.gpAttainment ?? 0)).slice(0, 5),
      },
    })
  );

  // 9. Fill rate by recruiter and job orders stuck beyond stage thresholds (Recruiting Health).
  const stuck = openDeals.filter((d) => d.daysInStage > 45 || d.pushes >= 2);
  const closers = reps.filter((r) => r.winRate != null);
  if (stuck.length || closers.length >= 2) {
    const byWin = [...closers].sort((a, b) => b.winRate - a.winRate);
    const best = byWin[0];
    const worst = byWin[byWin.length - 1];
    const stuckOwners = [...new Set(stuck.map((d) => d.owner))];
    out.push(
      insight({
        id: "dir-stuck-deals",
        section: "team-pipeline",
        category: "pipeline",
        severity: stuck.length ? "negative" : "neutral",
        title: stuck.length
          ? `Job orders are stalling in ${stuckOwners.length === 1 ? "one recruiter's" : "several recruiters'"} pipelines`
          : "No job orders are stuck beyond stage thresholds",
        meaning: [
          stuck.length ? `The stalled value sits with ${listNames(stuckOwners, 3)}; job orders that sit in a stage or keep slipping are filled far less often.` : null,
          best && worst && best !== worst ? `${best.name} has the highest fill rate on closed job orders and ${worst.name} the lowest, which shows where coaching will pay back.` : null,
        ].filter(Boolean).join(" "),
        actions: [
          stuck.length ? "Review each stalled job order in one-to-ones: agree a dated next step (new submittals or interview dates), re-qualify it with the client or close it out." : null,
          best && worst && best !== worst ? `Pair ${worst.name} with ${best.name} on job-order intake and candidate submittal reviews.` : null,
        ].filter(Boolean),
        evidence: {
          title: "Open job orders stuck in stage (over 45 days) or pushed twice or more",
          columns: [col("name", "Client / prospect", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("daysInStage", "Days in stage", "count"), col("pushes", "Pushes", "count"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
          rows: stuck.slice(0, 20),
        },
        whatIf: { label: "Model pipeline conversion", prefill: { focus: "pipeline" } },
      })
    );
  }
  return out;
}
