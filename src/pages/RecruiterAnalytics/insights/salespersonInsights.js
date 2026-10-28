import { gapWords, insight, listNames, pctChange } from "./phrasing";

const col = (key, label, unit = "money") => ({ key, label, unit });

/** Recruiter insights: target gap and levers, spread, expiring assignments, commission, T&E, job-order follow-ups. */
export function buildSalespersonInsights(m) {
  const out = [];
  const { outlook, ytdAtt, clients, endingSoon, openDeals, exp, allowance } = m;

  // Target gap and the levers that close it.
  const gapPct = pctChange(outlook.fullQuarter.gp, outlook.target.gp);
  const gapClients = clients.filter((c) => c.fyGpGap > 0).sort((a, b) => b.fyGpGap - a.fyGpGap);
  out.push(
    insight({
      id: "sp-target-gap",
      section: "my-financial",
      category: "performance",
      severity: (gapPct ?? 0) >= 0 ? "positive" : gapPct > -1 ? "neutral" : "negative",
      title: `At current run-rate your quarter lands ${gapWords(gapPct)} GP target`,
      meaning:
        (gapPct ?? 0) >= 0
          ? `You are on track; YTD you are ${gapWords(pctChange(ytdAtt.gp, ytdAtt.gpTarget))} target, so extra placements now go to upside and accelerator commission.`
          : `The gap is concentrated in ${listNames(gapClients.map((c) => c.client), 3) || "a few clients"}; extensions, new starts and rate reviews there move the number most.`,
      actions:
        (gapPct ?? 0) >= 0
          ? ["Confirm extensions on assignments ending before quarter end to protect run-rate."]
          : ["Ask each gap client for open requisitions you can fill this month.", "Push rate increases on extensions due this quarter."],
      evidence: {
        title: "Full-year GP gap by client",
        columns: [col("client", "Client", "text"), col("gp", "GP this period"), col("gpTarget", "GP target this period"), col("fyGpGap", "Full-year GP still to deliver"), col("commissionUpside", "Commission upside")],
        rows: gapClients.slice(0, 10),
      },
      whatIf: { label: "Model the gap", prefill: { focus: "quarter" } },
    })
  );

  // Spread erosion on a client.
  const thin = clients.filter((c) => c.billedHours > 0 && c.gmPct != null && c.gmTarget != null && c.gmPct < c.gmTarget - 1).sort((a, b) => (a.gmPct - a.gmTarget) - (b.gmPct - b.gmTarget));
  if (thin.length) {
    out.push(
      insight({
        id: "sp-spread",
        section: "my-staffing",
        category: "staffing",
        severity: "negative",
        title: `Margin is below plan at ${listNames(thin.map((c) => c.client), 2)}`,
        meaning: "Pay or burden has risen faster than the bill rate at these clients, so each hour billed earns less than planned.",
        actions: ["Push a rate increase at the next extension and build in escalators.", "Price new starts at these clients at or above the planned spread."],
        evidence: {
          title: "Clients with margin below plan",
          columns: [col("client", "Client", "text"), col("gmPct", "GM", "pct"), col("gmTarget", "GM target", "pct"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate")],
          rows: thin.slice(0, 8),
        },
        whatIf: { label: "Model a rate review", prefill: { focus: "rates", clientIds: thin.slice(0, 3).map((c) => c.clientId) } },
      })
    );
  }

  // Assignments ending soon: extension and redeployment opportunities.
  if (endingSoon.length) {
    out.push(
      insight({
        id: "sp-ending-soon",
        section: "my-staffing",
        category: "staffing",
        severity: "neutral",
        title: endingSoon.length === 1 ? "One assignment is due to end in the next 60 days" : "Several assignments are due to end in the next 60 days",
        meaning: "Each ending assignment is billable run-rate you lose unless it is extended or the contractor is redeployed quickly.",
        actions: ["Ask the hiring manager about extensions two to three weeks before each end date.", "Line up redeployment options for contractors whose roles will not extend."],
        evidence: {
          title: "Assignments ending in the next 60 days",
          columns: [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("plannedEndDate", "Planned end", "date"), col("billRate", "Bill rate", "rate"), col("extensions", "Extensions so far", "count")],
          rows: endingSoon,
        },
        whatIf: { label: "Model extensions", prefill: { focus: "staffing" } },
      })
    );
  }

  // Commission upside (commission visibility only).
  const upside = clients.reduce((s, c) => s + c.commissionUpside, 0);
  if (upside > 0 && m.canSeeCommissions) {
    out.push(
      insight({
        id: "sp-commission",
        section: "my-commission",
        category: "forecast",
        severity: "positive",
        title: "Closing your full-year GP gap carries meaningful commission upside",
        meaning: "GP above your quarterly target earns the higher accelerator rate, so the last placements of a quarter pay more than the first.",
        actions: ["Prioritise job orders at offer that can start before quarter end.", "Focus on the clients with the most full-year GP still to deliver."],
        evidence: {
          title: "Commission upside by client",
          columns: [col("client", "Client", "text"), col("fyGpGap", "GP still to deliver"), col("commissionUpside", "Commission upside")],
          rows: [...clients].filter((c) => c.commissionUpside > 0).sort((a, b) => b.commissionUpside - a.commissionUpside).slice(0, 10),
        },
        whatIf: { label: "Simulate my commission", prefill: { focus: "commission" } },
      })
    );
  }

  // T&E against allowance (cost detail only).
  const tAndE = exp.travel + exp.entertainment;
  if (allowance > 0 && m.canSeeCostDetail) {
    const over = tAndE > allowance * 1.05;
    out.push(
      insight({
        id: "sp-tande",
        section: "my-commission",
        category: "cost",
        severity: over ? "negative" : "positive",
        title: over ? "Travel and entertainment are running over allowance" : "Travel and entertainment are within allowance",
        meaning: over
          ? "Spend above allowance comes straight out of your contribution and draws review from Finance."
          : "Your discretionary spend is in line with the allowance for the period.",
        actions: over ? ["Concentrate visits on the gap clients and pre-approve client entertainment."] : ["Keep visits focused on clients with room to add headcount."],
        evidence: {
          title: "Travel & entertainment",
          columns: [col("label", "Measure", "text"), col("amount", "Amount")],
          rows: [
            { label: "Travel", amount: exp.travel },
            { label: "Client entertainment", amount: exp.entertainment },
            { label: "Allowance for the period", amount: allowance },
          ],
        },
      })
    );
  }

  // Job orders needing follow-up.
  const stale = openDeals.filter((d) => d.daysInStage > 30 || d.pushes > 0).sort((a, b) => b.weightedGp - a.weightedGp);
  if (stale.length) {
    out.push(
      insight({
        id: "sp-follow-up",
        section: "my-pipeline",
        category: "pipeline",
        severity: "neutral",
        title: stale.length === 1 ? "One job order needs follow-up" : "Several job orders need follow-up",
        meaning: "Job orders that sit in a stage or keep slipping are less likely to fill; a dated next step keeps them alive.",
        actions: stale.slice(0, 3).map((d) => `${d.name}: ${d.nextAction || "agree a next step"}.`),
        evidence: {
          title: "Job orders stuck or slipping",
          columns: [col("name", "Job order", "text"), col("stage", "Stage", "text"), col("daysInStage", "Days in stage", "count"), col("pushes", "Fill-date pushes", "count"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")],
          rows: stale,
        },
        whatIf: { label: "Model pipeline fills", prefill: { focus: "pipeline" } },
      })
    );
  }

  // Pipeline coverage of what is still needed this year.
  const pipe = m.pipe;
  if (pipe.openCount || pipe.remainingTarget > 0) {
    const done = pipe.remainingTarget <= 0;
    const covered = done || (pipe.coverage != null && pipe.coverage >= 1);
    const late = openDeals.filter((d) => ["Interviewing", "Offer"].includes(d.stage));
    out.push(
      insight({
        id: "sp-pipeline-coverage",
        section: "my-pipeline",
        category: "pipeline",
        severity: covered ? "positive" : "negative",
        title: done
          ? "You have already met your full-year revenue target"
          : covered
            ? "Your weighted pipeline covers the revenue you still need this year"
            : "Your weighted pipeline does not cover the revenue you still need this year",
        meaning: done
          ? "Every further start this year adds to GP above target, which earns the accelerator commission rate."
          : covered
            ? late.length
              ? "Most of the cover sits in late-stage job orders, so landing start dates on time matters more than finding new job orders."
              : "The cover depends on early-stage job orders progressing, so keep submittals and interviews moving."
            : "Closing the gap needs new job orders or more starts at existing clients, not only the job orders already open.",
        actions: done
          ? ["Pull forward starts on late-stage job orders to bank GP in this quarter."]
          : covered
            ? ["Agree start dates and onboarding steps with each late-stage client.", "Ask existing clients for backfills and new requisitions."]
            : ["Ask your top three clients for open requisitions you can fill this quarter.", "Bring in new job orders in the verticals where you fill most often."],
        evidence: {
          title: "Open job orders by weighted GP",
          columns: [col("name", "Job order", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"), col("weightedRevenue", "Weighted revenue"), col("weightedGp", "Weighted GP"), col("expectedStart", "Expected start", "date")],
          rows: openDeals.slice(0, 12),
        },
        whatIf: { label: "Model pipeline fills", prefill: { focus: "pipeline" } },
      })
    );
  }
  return out;
}
