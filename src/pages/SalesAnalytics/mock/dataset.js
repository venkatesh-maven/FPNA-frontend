import { DATASET_AS_OF, DATASET_SEED, DATASET_START_YM, DATASET_VERSION } from "../config/dataset";
import { monthStart, toYm } from "../calc/dates";
import { createRng } from "./prng";
import { generateOrg } from "./generators/org";
import { generateClients } from "./generators/clients";
import { generateOpportunities } from "./generators/pipeline";
import { generateWorkforce } from "./generators/workforce";
import { generatePlans } from "./generators/plans";
import { generateExpenses } from "./generators/expenses";

const groupBy = (rows, keyOf) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
};

/** Builds the whole sample dataset. Pure: same seed → same data. */
export function generateDataset({ seed = DATASET_SEED, asOf = DATASET_AS_OF, startYm = DATASET_START_YM } = {}) {
  const rng = (stream) => createRng(`${seed}:${stream}`);
  const asOfYm = toYm(asOf);
  const startDate = monthStart(startYm);

  const org = generateOrg(rng("org"));
  const clients = generateClients(rng("clients"), { org, startYm, asOfYm });
  const opportunities = generateOpportunities(rng("pipeline"), { org, clients, startDate, asOf });
  const { contractors, assignments, requisitions, placements, facts } = generateWorkforce(rng("workforce"), {
    org, clients, opportunities, startYm, asOf,
  });
  const plans = generatePlans(rng("plans"), { org, clients, facts, startYm, asOf });
  const expenses = generateExpenses(rng("expenses"), { org, clients, facts, plans, opportunities, startYm, asOf });

  const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
  const verticalById = byId(org.verticals);
  const branchById = byId(org.branches);
  const clientById = byId(clients);

  // Client attributes every filter needs, resolved once.
  for (const c of clients) {
    const branch = branchById.get(c.branchId);
    c.regionId = branch.regionId;
    c.buId = verticalById.get(c.verticalId).buId;
    c.acquiredYm = toYm(c.acquiredDate);
    c.churnYm = c.churnDate ? toYm(c.churnDate) : null;
  }
  for (const o of opportunities) {
    o.regionId = branchById.get(o.branchId).regionId;
    o.buId = verticalById.get(o.verticalId).buId;
  }
  for (const p of plans) {
    p.regionId = branchById.get(p.branchId).regionId;
    p.buId = verticalById.get(p.verticalId).buId;
    p.serviceLineId = p.clientId ? clientById.get(p.clientId).serviceLineId : null;
  }

  return {
    meta: { seed, asOf, asOfYm, startYm, version: DATASET_VERSION },
    org,
    clients,
    contractors,
    assignments,
    requisitions,
    placements,
    opportunities,
    facts,
    plans,
    expenses,
    index: {
      clientById,
      repById: byId(org.reps),
      teamById: byId(org.teams),
      personById: byId(org.people),
      verticalById,
      branchById,
      regionById: byId(org.regions),
      buById: byId(org.businessUnits),
      serviceLineById: byId(org.serviceLines),
      assignmentById: byId(assignments),
      contractorById: byId(contractors),
      opportunityById: byId(opportunities),
      factsByYm: groupBy(facts, (f) => f.ym),
      factsByClient: groupBy(facts, (f) => f.clientId),
      plansByYm: groupBy(plans, (p) => p.ym),
      expensesByYm: groupBy(expenses, (e) => e.ym),
      assignmentsByClient: groupBy(assignments, (a) => a.clientId),
      oppsByRep: groupBy(opportunities, (o) => o.repId),
    },
  };
}

let cached = null;

/** The session's dataset, generated once on first use. */
export function getDataset() {
  if (!cached) cached = generateDataset();
  return cached;
}
