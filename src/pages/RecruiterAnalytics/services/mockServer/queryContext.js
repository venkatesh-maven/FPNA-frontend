import { compareWindow, resolvePeriod } from "../../calc/periods";
import { addMonths, toYm } from "../../calc/dates";
import { probabilityBand } from "../../calc/metrics";
import { FISCAL_START_MONTH } from "../../config/dataset";
import { teamDirectorOf } from "../../access/accessEngine";
import { accessStore } from "../store/stores";
import { activeFilterKeys, APPLIES_TO, CLIENT_SLICE_FILTERS, DEFAULT_FILTERS, isActive } from "../../filters/filterSchema";

export const normalizeFilters = (filters) => ({ ...DEFAULT_FILTERS, ...(filters || {}) });

/**
 * Everything a query needs, resolved once: the period and comparison
 * windows, the recruiters in view (the viewer's scope narrowed by People
 * filters), the clients those recruiters work (with their desk share, used to
 * allocate plans), and pass checks for each kind of record. A fact,
 * assignment or requisition passes only when the recruiter who filled it is
 * in view. Scope is applied here and only here; views never filter by scope.
 */
export function buildQueryContext(ds, rawFilters, access, { repIds: onlyReps, clientIds: onlyClients } = {}) {
  const f = normalizeFilters(rawFilters);
  const { index, org } = ds;
  const period = resolvePeriod({ preset: f.period, from: f.from, to: f.to }, { asOf: ds.meta.asOf, fiscalStartMonth: FISCAL_START_MONTH });
  const compare = compareWindow(period, f.compare);
  const has = (list, v) => !list.length || list.includes(v);

  const accessConfig = accessStore.read();
  const reps = org.reps.filter((r) => {
    if (!access.scope.repIds.has(r.id)) return false;
    if (!has(f.director, teamDirectorOf(accessConfig, index.teamById.get(r.teamId)))) return false;
    if (!has(f.team, r.teamId)) return false;
    if (!has(f.rep, r.id)) return false;
    return !onlyReps || onlyReps.includes(r.id);
  });
  const repSet = new Set(reps.map((r) => r.id));

  const endDate = period.endDate || ds.meta.asOf;
  const newCutoff = addMonths(toYm(endDate), -12);
  const isNewClient = (c) => c.acquiredYm > newCutoff;

  const clientAttrPass = (c) =>
    has(f.bu, c.buId) &&
    has(f.region, c.regionId) &&
    has(f.branch, c.branchId) &&
    has(f.vertical, c.verticalId) &&
    has(f.serviceLine, c.serviceLineId) &&
    has(f.client, c.id) &&
    (f.clientType === "all" || (f.clientType === "new") === isNewClient(c)) &&
    (!onlyClients || onlyClients.includes(c.id));

  const credit = new Map(); // clientId → desk share of the recruiters in view, after client filters
  const creditAll = new Map(); // same before client-attribute filters (expense allocation base)
  for (const c of ds.clients) {
    let share = 0;
    for (const o of c.owners) if (repSet.has(o.repId)) share += o.share;
    if (share <= 0 && !c.recruiterIds?.some((id) => repSet.has(id))) continue;
    creditAll.set(c.id, share);
    if (clientAttrPass(c)) credit.set(c.id, share);
  }

  const placementPass = (type) => !f.placementType.length || f.placementType.includes(type);
  const assignmentStatusPass = (a) => {
    if (f.assignmentStatus === "all") return true;
    const ended = !!a.actualEndDate && a.actualEndDate <= endDate;
    return (f.assignmentStatus === "ended") === ended;
  };

  const factPass = (fact) => {
    if (!repSet.has(fact.recruiterId) || !credit.has(fact.clientId) || !placementPass(fact.placementType)) return false;
    if (f.assignmentStatus === "all") return true;
    if (fact.kind !== "time") return false;
    return assignmentStatusPass(index.assignmentById.get(fact.assignmentId));
  };

  const assignmentPass = (a) => repSet.has(a.recruiterId) && credit.has(a.clientId) && placementPass(a.placementType) && assignmentStatusPass(a);
  const requisitionPass = (r) => repSet.has(r.recruiterId) && credit.has(r.clientId);

  const clientSpecific = f.client.length > 0 || f.serviceLine.length > 0 || f.clientType === "existing" || !!onlyClients;
  /** Weight of a plan row in view: a client's desk share in view, or 1 for a recruiter's own new-business row. */
  const planWeight = (p) => {
    if (p.clientId) return credit.get(p.clientId) || 0;
    if (clientSpecific || !repSet.has(p.repId)) return 0;
    if (!has(f.bu, p.buId) || !has(f.region, p.regionId) || !has(f.branch, p.branchId) || !has(f.vertical, p.verticalId)) return 0;
    return 1;
  };

  const oppPass = (o) => {
    if (!repSet.has(o.repId)) return false;
    if (!has(f.bu, o.buId) || !has(f.region, o.regionId) || !has(f.branch, o.branchId) || !has(f.vertical, o.verticalId)) return false;
    const client = o.clientId ? index.clientById.get(o.clientId) : null;
    if (f.serviceLine.length && !(client && f.serviceLine.includes(client.serviceLineId))) return false;
    if (f.client.length && !(o.clientId && f.client.includes(o.clientId))) return false;
    if (onlyClients && !(o.clientId && onlyClients.includes(o.clientId))) return false;
    if (f.clientType === "new" && !(o.type === "new_logo" || (client && isNewClient(client)))) return false;
    if (f.clientType === "existing" && !(o.type === "expansion" && client && !isNewClient(client))) return false;
    if (!has(f.oppStatus, o.status)) return false;
    if (f.stage.length && !(o.status === "open" && f.stage.includes(o.stage))) return false;
    if (f.probBand.length && !f.probBand.includes(probabilityBand(o.probability))) return false;
    if (f.expectedStart && toYm(o.expectedStart) !== f.expectedStart) return false;
    return true;
  };

  const expensePass = (e) => {
    if (!repSet.has(e.repId)) return false;
    const rep = index.repById.get(e.repId);
    const branch = index.branchById.get(rep.branchId);
    if (!has(f.branch, rep.branchId) || !has(f.region, branch.regionId)) return false;
    if (!has(f.salesExpense, e.category)) return false;
    if (e.category === "commission" && !has(f.commissionStatus, e.status)) return false;
    return true;
  };

  const sliceActive = CLIENT_SLICE_FILTERS.some((k) => isActive(f, k)) || !!onlyClients;
  const active = activeFilterKeys(f);
  const notApplied = (family) => active.filter((k) => !APPLIES_TO[family].includes(k));

  return {
    ds,
    index,
    filters: f,
    access,
    period,
    compare,
    reps,
    repSet,
    credit,
    creditAll,
    isNewClient,
    factPass,
    assignmentPass,
    requisitionPass,
    planWeight,
    oppPass,
    expensePass,
    sliceActive,
    notApplied,
    endDate,
    // Windows: actuals in the current period are already part-month, so they
    // scale by 1; comparisons and plans scale by the elapsed fraction.
    currentWindow: period.elapsed.map((e) => ({ ym: e.ym, scale: 1, fraction: e.fraction })),
    planWindow: period.elapsed.map((e) => ({ ym: e.ym, scale: e.fraction, fraction: e.fraction })),
    compareWindow: compare.elapsed.map((e) => ({ ym: e.ym, scale: e.fraction, fraction: e.fraction, mapsTo: e.mapsTo })),
  };
}

/** Window for a list of whole months (trend charts, prior quarter). */
export const monthsWindow = (months, asOfYm, asOfFraction) =>
  months.map((ym) => ({ ym, scale: 1, fraction: ym === asOfYm ? asOfFraction : 1 }));
