import { STATIC_OPTIONS } from "../../filters/filterSchema";
import { addMonths, formatYm, monthRange } from "../../calc/dates";
import { teamDirectorOf } from "../../access/accessEngine";
import { accessStore } from "../store/stores";

const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * The viewer's people and clients: the salespeople in their access scope, the
 * teams and directors over them, and the clients those salespeople own.
 */
function visibleIds(ds, access, teams) {
  const repIds = new Set([...access.scope.repIds]);
  const teamIds = new Set(ds.org.reps.filter((r) => repIds.has(r.id)).map((r) => r.teamId));
  const config = accessStore.read();
  const directorIds = new Set(teams.filter((t) => teamIds.has(t.id)).map((t) => teamDirectorOf(config, t)));
  const clientIds = new Set(ds.clients.filter((c) => c.owners.some((o) => repIds.has(o.repId))).map((c) => c.id));
  return { repIds, teamIds, directorIds, clientIds };
}

/**
 * Filter-bar options from the server (GET /company/staffing-analytics/filters),
 * narrowed to what the viewer may see. Everything else comes as the server sent it.
 */
export function narrowServerOptions(server, ds, access) {
  const { repIds, teamIds, directorIds, clientIds } = visibleIds(ds, access, server.teams);
  return {
    ...server,
    directors: server.directors.filter((d) => directorIds.has(d.id)),
    teams: server.teams.filter((t) => teamIds.has(t.id)).map(({ id, name }) => ({ id, name })),
    // Sorted here as the screens always have (locale order), whatever order the server used.
    reps: server.reps.filter((r) => repIds.has(r.id)).sort(byName),
    clients: server.clients.filter((c) => clientIds.has(c.id)).sort(byName),
  };
}

/** The same lists built in the browser, used only if the filters API can't be reached. */
export function filterOptionsFor(ds, access) {
  const { repIds, teamIds, directorIds, clientIds } = visibleIds(ds, access, ds.org.teams);
  const asOfYm = ds.meta.asOfYm;

  return {
    businessUnits: ds.org.businessUnits,
    regions: ds.org.regions,
    branches: ds.org.branches,
    verticals: ds.org.verticals.map(({ id, name }) => ({ id, name })),
    serviceLines: ds.org.serviceLines,
    directors: ds.org.people.filter((p) => directorIds.has(p.id)).map(({ id, name }) => ({ id, name })),
    teams: ds.org.teams.filter((t) => teamIds.has(t.id)).map(({ id, name }) => ({ id, name })),
    reps: ds.org.reps.filter((r) => repIds.has(r.id)).map((r) => ({ id: r.id, name: r.name, teamId: r.teamId })).sort(byName),
    clients: ds.clients.filter((c) => clientIds.has(c.id)).map((c) => ({ id: c.id, name: c.name })).sort(byName),
    months: monthRange(addMonths(asOfYm, -2), addMonths(asOfYm, 9)).map((m) => ({ id: m, name: formatYm(m) })),
    periodMonths: monthRange(ds.meta.startYm, asOfYm).map((m) => ({ id: m, name: formatYm(m) })),
    ...STATIC_OPTIONS,
  };
}
