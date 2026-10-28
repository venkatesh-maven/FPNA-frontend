import { addDays, dayDiff, toYm } from "../../calc/dates";
import { COMPANY_STEMS, COMPANY_SUFFIXES_BY_VERTICAL, COMPETITORS, LEAD_SOURCES, LOSS_REASONS, NEXT_ACTIONS } from "../seedLists";

export const OPEN_STAGES = ["Sourcing", "Submitted", "Interviewing", "Offer"];
export const STAGE_PROBABILITY = { Sourcing: 0.1, Submitted: 0.25, Interviewing: 0.5, Offer: 0.7 };
const HOURS_PER_MONTH_FACTOR = 4.33;

const round2 = (v) => Math.round(v * 100) / 100;

function estimate(rng, vertical, headcount, durationMonths, isMsp = false) {
  const hoursPerWeek = vertical.weeklyHours[1];
  const payRate = round2(rng.float(vertical.pay[0], vertical.pay[1]));
  const markup = rng.float(vertical.markup[0], vertical.markup[1]) - (isMsp ? 0.05 : 0);
  const billRate = Math.round(payRate * markup * 4) / 4;
  const monthlyHours = headcount * hoursPerWeek * HOURS_PER_MONTH_FACTOR;
  const months = Math.min(12, durationMonths);
  const expectedRevenue = monthlyHours * billRate * months;
  // ~13% burden and a little ODC on top of wages.
  const expectedGp = expectedRevenue - monthlyHours * payRate * 1.13 * months - 150 * headcount;
  return { hoursPerWeek, payRate, billRate, expectedRevenue: round2(expectedRevenue), expectedGp: round2(expectedGp) };
}

function buildOpportunity(rng, { id, type, rep, client, prospectName, vertical, createdDate, outcome, closeDate, asOf }) {
  const dwell = OPEN_STAGES.map(() => rng.int(6, 28));
  const stageHistory = [];
  let d = createdDate;
  let stage;
  let status;

  if (outcome === "won" || outcome === "lost") {
    const reach = outcome === "won" ? OPEN_STAGES.length : rng.int(1, OPEN_STAGES.length);
    const cycle = Math.max(dayDiff(createdDate, closeDate), reach);
    const total = dwell.slice(0, reach).reduce((s, x) => s + x, 0);
    for (let i = 0; i < reach; i++) {
      stageHistory.push({ stage: OPEN_STAGES[i], date: d });
      d = addDays(d, Math.max(1, Math.round((dwell[i] / total) * cycle)));
    }
    stage = outcome === "won" ? "Filled" : "Lost";
    stageHistory.push({ stage, date: closeDate });
    status = outcome;
  } else {
    const elapsed = dayDiff(createdDate, asOf);
    let i = 0;
    let acc = 0;
    stageHistory.push({ stage: OPEN_STAGES[0], date: d });
    while (i < OPEN_STAGES.length - 1 && acc + dwell[i] < elapsed) {
      acc += dwell[i];
      i++;
      d = addDays(createdDate, acc);
      stageHistory.push({ stage: OPEN_STAGES[i], date: d });
    }
    stage = OPEN_STAGES[i];
    status = "open";
  }

  const headcount = type === "new_logo" ? rng.int(2, 8) : rng.int(1, 5);
  const durationMonths = rng.int(6, 12);
  const est = estimate(rng, vertical, headcount, durationMonths, client?.isMsp);

  // Expected fill dates: an original plan plus any pushes recorded along the way.
  const pushes = [];
  const pushCount = rng.chance(status === "open" ? 0.35 : 0.2) ? rng.int(1, 3) : 0;
  let expectedClose = status === "open" ? addDays(asOf, rng.int(10, 75)) : closeDate;
  const pushDays = Array.from({ length: pushCount }, () => rng.int(14, 45));
  let originalCloseDate = addDays(expectedClose, -pushDays.reduce((s, x) => s + x, 0));
  if (originalCloseDate < createdDate) originalCloseDate = addDays(createdDate, 21);
  let cursor = originalCloseDate;
  for (const days of pushDays) {
    const next = addDays(cursor, days);
    pushes.push({ from: cursor, to: next, on: addDays(cursor, -rng.int(2, 10)) });
    cursor = next;
  }
  if (pushCount) expectedClose = cursor;

  const expectedStart = addDays(expectedClose, rng.int(14, 30));
  const probability =
    status === "won" ? 1 : status === "lost" ? 0 : Math.min(0.9, Math.max(0.05, STAGE_PROBABILITY[stage] + rng.float(-0.05, 0.05)));
  const lastEntry = stageHistory[stageHistory.length - 1];

  return {
    id,
    type,
    clientId: client?.id || null,
    prospectName: client?.name || prospectName,
    repId: rep.id,
    verticalId: vertical.id,
    branchId: client?.branchId || rep.branchId,
    createdDate,
    stageHistory,
    stage,
    status,
    stageEnteredDate: lastEntry.date,
    probability: round2(probability),
    headcount,
    durationMonths,
    ...est,
    expectedStart,
    expectedFirstBilling: addDays(expectedStart, 7),
    originalCloseDate,
    closeDate: expectedClose,
    pushes,
    wonDate: status === "won" ? closeDate : null,
    lostDate: status === "lost" ? closeDate : null,
    lossReason: status === "lost" ? rng.weighted(LOSS_REASONS) : null,
    competitor: status === "lost" && rng.chance(0.6) ? rng.pick(COMPETITORS) : null,
    leadSource: client?.leadSource || rng.weighted(LEAD_SOURCES),
    nextAction: status === "open" ? NEXT_ACTIONS[stage] : null,
  };
}

/**
 * Job orders: one filled job order per new client (decided on its
 * acquisition date), extra new-client pursuits that were lost or are open,
 * and job orders at existing clients (filled ones add demand later).
 */
export function generateOpportunities(rng, { org, clients, startDate, asOf }) {
  const repById = new Map(org.reps.map((r) => [r.id, r]));
  const verticalById = new Map(org.verticals.map((v) => [v.id, v]));
  const opps = [];
  const nextId = () => `OP-${String(opps.length + 1).padStart(4, "0")}`;
  const usedProspects = new Set(clients.map((c) => c.name));
  const span = dayDiff(startDate, asOf);

  for (const c of clients.filter((x) => x.isNewLogo)) {
    const rep = repById.get(c.owners[0].repId);
    const createdDate = addDays(c.acquiredDate, -rng.int(45, 120));
    opps.push(
      buildOpportunity(rng, {
        id: nextId(), type: "new_logo", rep, client: c, vertical: verticalById.get(c.verticalId),
        createdDate, outcome: "won", closeDate: c.acquiredDate, asOf,
      })
    );
  }

  for (const rep of org.reps) {
    const team = org.teams.find((t) => t.id === rep.teamId);
    for (let i = 0; i < 4; i++) {
      const vertical = verticalById.get(rng.chance(0.6) ? rep.primaryVerticalId : rng.pick(team.verticals));
      let prospectName;
      do {
        prospectName = `${rng.pick(COMPANY_STEMS)} ${rng.pick(COMPANY_SUFFIXES_BY_VERTICAL[vertical.id])}`;
      } while (usedProspects.has(prospectName));
      usedProspects.add(prospectName);
      const createdDate = addDays(startDate, rng.int(0, span - 5));
      const closeDate = addDays(createdDate, rng.int(40, 120));
      const outcome = closeDate <= asOf ? "lost" : "open";
      opps.push(
        buildOpportunity(rng, { id: nextId(), type: "new_logo", rep, prospectName, vertical, createdDate, outcome, closeDate, asOf })
      );
    }
  }

  for (const c of clients) {
    const life0 = c.acquiredDate > startDate ? c.acquiredDate : startDate;
    const life1 = c.churnDate && c.churnDate < asOf ? c.churnDate : asOf;
    const days = dayDiff(life0, life1);
    if (days < 60) continue;
    const count = rng.weighted([[1, 40], [2, 40], [3, 20]]);
    for (let i = 0; i < count; i++) {
      const rep = repById.get(rng.pick(c.owners).repId);
      const createdDate = addDays(life0, rng.int(0, days - 30));
      const closeDate = addDays(createdDate, rng.int(25, 90));
      const outcome = closeDate <= asOf ? (rng.chance(0.55) ? "won" : "lost") : "open";
      opps.push(
        buildOpportunity(rng, {
          id: nextId(), type: "expansion", rep, client: c, vertical: verticalById.get(c.verticalId),
          createdDate, outcome, closeDate, asOf,
        })
      );
    }
  }

  // Current pipeline: each recruiter is working a few recent job orders that are still open.
  for (const rep of org.reps) {
    const team = org.teams.find((t) => t.id === rep.teamId);
    const own = clients.filter(
      (c) => c.owners.some((o) => o.repId === rep.id) && c.acquiredDate < asOf && !(c.churnDate && c.churnDate <= asOf)
    );
    const count = rng.int(2, 4);
    for (let i = 0; i < count; i++) {
      const createdDate = addDays(asOf, -rng.int(5, 150));
      if (own.length && rng.chance(0.5)) {
        const c = rng.pick(own);
        opps.push(
          buildOpportunity(rng, {
            id: nextId(), type: "expansion", rep, client: c, vertical: verticalById.get(c.verticalId),
            createdDate, outcome: "open", closeDate: asOf, asOf,
          })
        );
      } else {
        const vertical = verticalById.get(rng.chance(0.6) ? rep.primaryVerticalId : rng.pick(team.verticals));
        let prospectName;
        do {
          prospectName = `${rng.pick(COMPANY_STEMS)} ${rng.pick(COMPANY_SUFFIXES_BY_VERTICAL[vertical.id])}`;
        } while (usedProspects.has(prospectName));
        usedProspects.add(prospectName);
        opps.push(
          buildOpportunity(rng, { id: nextId(), type: "new_logo", rep, prospectName, vertical, createdDate, outcome: "open", closeDate: asOf, asOf })
        );
      }
    }
  }

  return opps.map((o) => ({ ...o, closeYm: toYm(o.closeDate) }));
}
