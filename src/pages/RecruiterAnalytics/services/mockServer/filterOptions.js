import { STATIC_OPTIONS } from "../../filters/filterSchema";
import { addMonths, formatYm, monthRange } from "../../calc/dates";
import { teamDirectorOf } from "../../access/accessEngine";
import { accessStore } from "../store/stores";

/** Option lists for the filter bar, limited to what the viewer may see. */
export function filterOptionsFor(ds, access) {
  const reps = ds.org.reps.filter((r) => access.scope.repIds.has(r.id));
  const teamIds = new Set(reps.map((r) => r.teamId));
  const teams = ds.org.teams.filter((t) => teamIds.has(t.id));
  const config = accessStore.read();
  const directorIds = new Set(teams.map((t) => teamDirectorOf(config, t)));
  const repSet = new Set(reps.map((r) => r.id));
  const clients = ds.clients.filter((c) => c.owners.some((o) => repSet.has(o.repId)) || c.recruiterIds?.some((id) => repSet.has(id)));
  const byName = (a, b) => a.name.localeCompare(b.name);
  const asOfYm = ds.meta.asOfYm;

  return {
    businessUnits: ds.org.businessUnits,
    regions: ds.org.regions,
    branches: ds.org.branches,
    verticals: ds.org.verticals.map(({ id, name }) => ({ id, name })),
    serviceLines: ds.org.serviceLines,
    directors: ds.org.people.filter((p) => directorIds.has(p.id)).map(({ id, name }) => ({ id, name })),
    teams: teams.map(({ id, name }) => ({ id, name })),
    reps: reps.map((r) => ({ id: r.id, name: r.name, teamId: r.teamId })).sort(byName),
    clients: clients.map((c) => ({ id: c.id, name: c.name })).sort(byName),
    months: monthRange(addMonths(asOfYm, -2), addMonths(asOfYm, 9)).map((m) => ({ id: m, name: formatYm(m) })),
    periodMonths: monthRange(ds.meta.startYm, asOfYm).map((m) => ({ id: m, name: formatYm(m) })),
    ...STATIC_OPTIONS,
  };
}
