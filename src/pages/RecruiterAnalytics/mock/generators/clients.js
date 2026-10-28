import { addMonths, isoDate, monthDiff } from "../../calc/dates";
import { CHURN_REASONS, COMPANY_STEMS, COMPANY_SUFFIXES_BY_VERTICAL, LEAD_SOURCES } from "../seedLists";

const CLIENTS_PER_REP = 5;
const NEW_LOGOS = 30;
const CHURNED = 15;
const SHARED_SHARE = 0.12;

const SIZE_TIERS = [
  ["S", 0.5, [1, 3]],
  ["M", 0.35, [4, 7]],
  ["L", 0.15, [8, 14]],
];

/**
 * ~140 clients, each starting on one recruiter's desk. Thirty are new clients
 * acquired since Jan 2024 (their filled job order is created by the pipeline
 * generator); fifteen existing clients churn during the window; ~12% are
 * split between two desks. The final desk split is recomputed from who filled
 * what (recruiting.js).
 */
export function generateClients(rng, { org, startYm, asOfYm }) {
  const usedNames = new Set();
  const nameFor = (verticalId) => {
    for (;;) {
      const n = `${rng.pick(COMPANY_STEMS)} ${rng.pick(COMPANY_SUFFIXES_BY_VERTICAL[verticalId])}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };

  const teamById = new Map(org.teams.map((t) => [t.id, t]));
  const clients = [];
  let n = 1;
  for (const rep of org.reps) {
    const team = teamById.get(rep.teamId);
    for (let i = 0; i < CLIENTS_PER_REP; i++) {
      const verticalId = rng.chance(0.5) ? rep.primaryVerticalId : rng.pick(team.verticals);
      const [sizeTier, , [lo, hi]] = rng.weighted(SIZE_TIERS.map((t) => [t, t[1]]));
      const trend = rng.weighted([["growth", 30], ["flat", 45], ["contraction", 25]]);
      const msp = rng.chance(verticalId === "LI" || verticalId === "HC" ? 0.4 : 0.18);
      clients.push({
        id: `CL-${String(n).padStart(3, "0")}`,
        name: nameFor(verticalId),
        verticalId,
        branchId: rep.branchId,
        serviceLineId: rng.weighted([["AUG", 60], ["SOW", 15], ["PAY", 10], ["PERM", 15]]),
        isMsp: msp,
        sizeTier,
        baseHeadcount: rng.int(lo, hi),
        trend,
        trendRate: trend === "growth" ? rng.float(0.008, 0.018) : trend === "contraction" ? -rng.float(0.006, 0.014) : rng.float(-0.002, 0.003),
        acquiredDate: isoDate(`${rng.int(2017, 2023)}-${String(rng.int(1, 12)).padStart(2, "0")}`, rng.int(1, 28)),
        isNewLogo: false,
        leadSource: null,
        churnDate: null,
        churnReason: null,
        owners: [{ repId: rep.id, share: 1 }],
      });
      n++;
    }
  }

  // New clients: spread acquisitions across the window, one in six clients.
  const span = monthDiff(startYm, addMonths(asOfYm, -1));
  rng.shuffle(clients).slice(0, NEW_LOGOS).forEach((c, i) => {
    const m = addMonths(startYm, Math.min(span, Math.round(((i + rng.float(0.1, 0.9)) / NEW_LOGOS) * span)));
    c.acquiredDate = isoDate(m, rng.int(2, 26));
    c.isNewLogo = true;
    c.leadSource = rng.weighted(LEAD_SOURCES);
    c.trend = "growth";
    c.trendRate = rng.float(0.006, 0.015);
  });

  // Churn: existing clients only, between May 2024 and two months before as-of.
  const lastChurn = addMonths(asOfYm, -2);
  rng
    .shuffle(clients.filter((c) => !c.isNewLogo))
    .slice(0, CHURNED)
    .forEach((c) => {
      const m = addMonths("2024-05", rng.int(0, monthDiff("2024-05", lastChurn)));
      c.churnDate = isoDate(m, 10);
      c.churnReason = rng.pick(CHURN_REASONS);
    });

  // Shared desks: mostly with a teammate, sometimes across teams.
  rng
    .shuffle(clients)
    .slice(0, Math.round(clients.length * SHARED_SHARE))
    .forEach((c) => {
      const owner = org.reps.find((r) => r.id === c.owners[0].repId);
      const sameTeam = org.reps.filter((r) => r.teamId === owner.teamId && r.id !== owner.id);
      const other = org.reps.filter((r) => r.teamId !== owner.teamId);
      const second = rng.chance(0.7) ? rng.pick(sameTeam) : rng.pick(other);
      const split = rng.pick([0.5, 0.6]);
      c.owners = [
        { repId: owner.id, share: split },
        { repId: second.id, share: Math.round((1 - split) * 100) / 100 },
      ];
    });

  return clients;
}
