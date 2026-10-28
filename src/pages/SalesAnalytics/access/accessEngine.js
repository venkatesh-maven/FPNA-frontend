import { MASKED_FIELDS_BY_CAPABILITY } from "./capabilities";

/** A dated grant (exception, delegation) is in force on `asOfDate`; a missing bound is open-ended. */
export const isActiveOn = (item, asOfDate) =>
  (!item?.startDate || item.startDate <= asOfDate) && (!item?.endDate || item.endDate >= asOfDate);

/** Who leads a team for scope: the configured reporting line, else the org record. */
export const teamDirectorOf = (config, team) => config?.hierarchy?.teamDirector?.[team.id] || team.directorId;

/**
 * Effective access for one person on a date: role template capabilities,
 * plus per-person grants and any active delegation, minus per-person denies
 * (an explicit deny always wins); and the data scope (which reps' records
 * they may see). Pure, so the mock service and tests resolve access exactly
 * the same way.
 */
export function resolveEffectiveAccess(config, org, userId, asOfDate) {
  const person = org.people.find((p) => p.id === userId) || null;
  if (!person) return emptyAccess(null);

  const roleId = config.assignments?.[userId] || person.role;
  const role = config.roles[roleId];
  if (!role) return emptyAccess(person, roleId);

  const caps = new Set(role.capabilities);
  const raw = config.userOverrides?.[userId];
  const override = raw && isActiveOn(raw, asOfDate) ? raw : null;
  for (const c of override?.grant || []) caps.add(c);

  const repIds = new Set(scopeRepIds(role.scope, person, org, config));
  const teamIds = new Set(scopeTeamIds(role.scope, person, org, config));
  const baseTeamIds = new Set(teamIds);

  const activeDelegations = (config.delegations || []).filter((d) => d.toUserId === userId && isActiveOn(d, asOfDate));
  for (const d of activeDelegations) {
    for (const c of d.capabilities || []) caps.add(c);
    for (const t of d.scopeTeamIds || []) {
      teamIds.add(t);
      for (const r of org.reps) if (r.teamId === t) repIds.add(r.id);
    }
  }
  for (const c of override?.deny || []) caps.delete(c);
  const delegatedTeamIds = [...teamIds].filter((t) => !baseTeamIds.has(t));

  const maskedFields = new Set();
  for (const [cap, fields] of Object.entries(MASKED_FIELDS_BY_CAPABILITY)) {
    if (!caps.has(cap)) fields.forEach((f) => maskedFields.add(f));
  }

  const widened = (role.scope === "own" && activeDelegations.length) || (role.scope === "none" && delegatedTeamIds.length);
  return {
    user: person,
    roleId,
    roleLabel: role.label,
    capabilities: caps,
    scope: {
      kind: widened ? "teams" : role.scope,
      repIds,
      teamIds,
      label: scopeLabel(role.scope, person, org, teamIds, delegatedTeamIds),
    },
    maskedFields,
    delegations: activeDelegations,
    override,
  };
}

const ledTeams = (person, org, config) => org.teams.filter((t) => teamDirectorOf(config, t) === person.id);

function scopeRepIds(scope, person, org, config) {
  if (scope === "all") return org.reps.map((r) => r.id);
  if (scope === "teams") {
    const teams = new Set(ledTeams(person, org, config).map((t) => t.id));
    return org.reps.filter((r) => teams.has(r.teamId)).map((r) => r.id);
  }
  if (scope === "own") return org.reps.some((r) => r.id === person.id) ? [person.id] : [];
  return [];
}

function scopeTeamIds(scope, person, org, config) {
  if (scope === "all") return org.teams.map((t) => t.id);
  if (scope === "teams") return ledTeams(person, org, config).map((t) => t.id);
  if (scope === "own") {
    const rep = org.reps.find((r) => r.id === person.id);
    return rep ? [rep.teamId] : [];
  }
  return [];
}

function scopeLabel(scope, person, org, teamIds, delegatedTeamIds) {
  const names = (ids) => org.teams.filter((t) => ids.includes(t.id)).map((t) => t.name).join(", ");
  if (scope === "all") return "All teams";
  if (scope === "teams") return names([...teamIds]) || "No teams";
  const delegated = delegatedTeamIds.length ? `${names(delegatedTeamIds)} (delegated)` : "";
  if (scope === "own") return delegated ? `${person.name}'s accounts + ${delegated}` : `${person.name}'s accounts`;
  return delegated || "No business data";
}

const emptyAccess = (person, roleId = null) => ({
  user: person,
  roleId,
  roleLabel: "No access",
  capabilities: new Set(),
  scope: { kind: "none", repIds: new Set(), teamIds: new Set(), label: "No business data" },
  maskedFields: new Set(Object.values(MASKED_FIELDS_BY_CAPABILITY).flat()),
  delegations: [],
  override: null,
});

export const can = (access, cap) => !!access?.capabilities?.has(cap);
export const canAny = (access, caps) => caps.some((c) => can(access, c));
