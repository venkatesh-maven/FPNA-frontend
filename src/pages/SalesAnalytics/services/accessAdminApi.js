// Access administration endpoints (roles, assignments, exceptions,
// delegations, reporting lines). Same contract as salesAnalyticsApi: async,
// `viewer` identifies the caller, and the "server" re-resolves the caller's
// access on every call. Deny by default: every function needs
// manage_access, which on its own carries no business-data visibility.
// Rules live in accessStore until the backend exists; the production API
// must enforce the same checks server-side.

import { getDataset } from "../mock/dataset";
import { ForbiddenError, mockConfig, resolveAccess } from "./mockServer/handle";
import { can, isActiveOn, resolveEffectiveAccess, teamDirectorOf } from "../access/accessEngine";
import { CAPABILITIES, CAPABILITY_IDS, MASKED_FIELDS_BY_CAPABILITY, ROLE_IDS } from "../access/capabilities";
import { accessStore } from "./store/stores";
import { AUDIT_LIMIT, auditStore } from "./store/auditStore";
import { clearSalesQueryCache } from "../hooks/useSalesQuery";
import { MOCK_LATENCY_MS } from "../config/dataset";

export class AccessValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccessValidationError";
    this.status = 400;
  }
}

export const SCOPES = [
  { id: "all", label: "All teams", description: "Every team and salesperson" },
  { id: "teams", label: "Teams they lead", description: "Teams where the person is director in the reporting line" },
  { id: "own", label: "Own records", description: "Only the person's own clients, pipeline and costs" },
  { id: "none", label: "No business data", description: "Administration only" },
];

export const AUDIT_ACTIONS = {
  "role.create": "Role created",
  "role.update": "Role changed",
  "role.delete": "Role deleted",
  "assignment.set": "Role assigned",
  "override.set": "Exception set",
  "override.clear": "Exception removed",
  "delegation.add": "Delegation added",
  "delegation.remove": "Delegation removed",
  "hierarchy.set": "Reporting line changed",
  "config.reset": "Reset to defaults",
  "access.denied": "Refused (no permission)",
};

const latency = () => (mockConfig.latency ? new Promise((r) => setTimeout(r, MOCK_LATENCY_MS.min)) : Promise.resolve());
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const capLabel = (id) => CAPABILITIES.find((c) => c.id === id)?.label || id;
const scopeName = (id) => SCOPES.find((s) => s.id === id)?.label || id;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function context() {
  const ds = getDataset();
  const { org } = ds;
  return {
    org,
    asOf: ds.meta.asOf,
    person: (id) => org.people.find((p) => p.id === id) || null,
    team: (id) => org.teams.find((t) => t.id === id) || null,
  };
}

/* ---------- authorization ---------- */

/** The caller must hold manage_access; refused write attempts are logged. */
function authorize(viewer, endpoint, { logDenied = false } = {}) {
  const access = resolveAccess(viewer);
  if (can(access, "manage_access")) return access;
  if (logDenied) {
    appendAudit({
      by: { id: viewer?.userId || null, name: access.user?.name || "Unknown user" },
      action: "access.denied",
      target: { type: "endpoint", id: endpoint, label: endpoint },
      summary: `${endpoint} refused: the caller doesn't hold Manage roles & access`,
      before: null,
      after: null,
    });
  }
  throw new ForbiddenError("Managing access needs the “Manage roles & access” permission.");
}

/* ---------- validation ---------- */

const fail = (msg) => {
  throw new AccessValidationError(msg);
};

function cleanText(value, label, { required = false, max = 200 } = {}) {
  if (value != null && typeof value !== "string") fail(`${label} must be text.`);
  const v = (value || "").trim();
  if (required && !v) fail(`${label} is required.`);
  if (v.length > max) fail(`${label} can be at most ${max} characters.`);
  return v;
}

function cleanCaps(list, label = "Permissions") {
  if (list == null) return [];
  if (!Array.isArray(list)) fail(`${label} must be a list.`);
  const unknown = list.filter((c) => !CAPABILITY_IDS.includes(c));
  if (unknown.length) fail(`Unknown permission: ${unknown.join(", ")}.`);
  return CAPABILITY_IDS.filter((c) => list.includes(c));
}

function cleanTeams(c, list) {
  if (list == null) return [];
  if (!Array.isArray(list)) fail("Teams must be a list.");
  const unknown = list.filter((t) => !c.team(t));
  if (unknown.length) fail(`Unknown team: ${unknown.join(", ")}.`);
  return c.org.teams.map((t) => t.id).filter((t) => list.includes(t));
}

function cleanDate(value, label, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) fail(`${label} is required.`);
    return null;
  }
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) fail(`${label} must be a date (YYYY-MM-DD).`);
  return value;
}

function cleanRange(start, end) {
  if (start && end && end < start) fail("End date can't be before the start date.");
}

function cleanScope(scope) {
  if (!SCOPES.some((s) => s.id === scope)) fail(`Unknown data scope: ${scope}.`);
  return scope;
}

function requirePerson(c, id) {
  const p = c.person(id);
  if (!p) fail(`Unknown person: ${id}.`);
  return p;
}

function requireRole(config, id) {
  const r = config.roles?.[id];
  if (!r) fail(`Unknown role: ${id}.`);
  return r;
}

function uniqueLabel(config, label, exceptId) {
  const clash = Object.entries(config.roles).find(([id, r]) => id !== exceptId && r.label.toLowerCase() === label.toLowerCase());
  if (clash) fail(`A role named “${label}” already exists.`);
}

/* ---------- write pipeline ---------- */

let auditSeq = 0;
function appendAudit(event) {
  const full = {
    id: `au-${Date.now().toString(36)}-${(auditSeq++).toString(36)}`,
    at: new Date().toISOString(),
    ...event,
  };
  auditStore.update((s) => ({ events: [...(s?.events || []), full].slice(-AUDIT_LIMIT) }));
  return full;
}

/** Does the change give the caller any capability or record they didn't have, on any date it touches? */
function widensOwnAccess(before, after, org, callerId, asOf) {
  const dates = new Set([asOf]);
  for (const cfg of [before, after]) {
    const o = cfg.userOverrides?.[callerId];
    if (o) [o.startDate, o.endDate].forEach((d) => d && dates.add(d));
    for (const d of cfg.delegations || []) if (d.toUserId === callerId) [d.startDate, d.endDate].forEach((x) => x && dates.add(x));
  }
  for (const date of dates) {
    const a = resolveEffectiveAccess(before, org, callerId, date);
    const b = resolveEffectiveAccess(after, org, callerId, date);
    if ([...b.capabilities].some((x) => !a.capabilities.has(x))) return true;
    if ([...b.scope.repIds].some((x) => !a.scope.repIds.has(x))) return true;
  }
  return false;
}

/**
 * Every change goes through here: authorize, apply to a copy, check the
 * invariants (someone can still administer access; nobody widens their own
 * access), save, audit, and drop cached analytics so they're re-scoped.
 * `apply(draft, ctx)` returns the audit description, or null for no change.
 */
async function write(viewer, endpoint, apply) {
  await latency();
  const caller = authorize(viewer, endpoint, { logDenied: true });
  const c = context();
  const current = accessStore.read();
  const draft = clone(current);
  const change = apply(draft, c, caller);
  if (!change) return { changed: false };

  if (!c.org.people.some((p) => can(resolveEffectiveAccess(draft, c.org, p.id, c.asOf), "manage_access"))) {
    fail("This would leave nobody able to manage access. Give another person “Manage roles & access” first.");
  }
  if (widensOwnAccess(current, draft, c.org, caller.user.id, c.asOf)) {
    fail("This would widen your own access. Another administrator has to make that change.");
  }

  accessStore.write(draft);
  const event = appendAudit({
    by: { id: caller.user.id, name: caller.user.name },
    action: change.action,
    target: change.target,
    summary: change.summary,
    before: change.before ?? null,
    after: change.after ?? null,
    ...(change.reason ? { reason: change.reason } : {}),
  });
  clearSalesQueryCache();
  return { changed: true, auditId: event.id, ...(change.result || {}) };
}

function roleSummary(a, b) {
  const parts = [];
  if (a.label !== b.label) parts.push(`renamed from “${a.label}”`);
  if (a.scope !== b.scope) parts.push(`scope ${scopeName(a.scope)} → ${scopeName(b.scope)}`);
  const added = b.capabilities.filter((x) => !a.capabilities.includes(x));
  const removed = a.capabilities.filter((x) => !b.capabilities.includes(x));
  if (added.length) parts.push(`added ${added.map(capLabel).join(", ")}`);
  if (removed.length) parts.push(`removed ${removed.map(capLabel).join(", ")}`);
  return `${b.label}: ${parts.join("; ")}`;
}

const overrideSummary = (o) => {
  if (!o) return "none";
  const parts = [];
  if (o.grant?.length) parts.push(`grant ${o.grant.map(capLabel).join(", ")}`);
  if (o.deny?.length) parts.push(`withhold ${o.deny.map(capLabel).join(", ")}`);
  if (o.startDate || o.endDate) parts.push(`${o.startDate || "open"} to ${o.endDate || "open"}`);
  return parts.join("; ");
};

const dateStatus = (item, asOf) => {
  if (isActiveOn(item, asOf)) return "active";
  return item.startDate && item.startDate > asOf ? "scheduled" : "expired";
};

/* ---------- reads ---------- */

/** Everything the Access screen needs. No business data. */
export async function getAccessAdmin(viewer) {
  await latency();
  const caller = authorize(viewer, "getAccessAdmin");
  const c = context();
  const config = clone(accessStore.read());
  const teamName = (id) => c.team(id)?.name || null;
  const roleOf = (p) => config.assignments?.[p.id] || p.role;

  const people = c.org.people.map((p) => {
    const roleId = roleOf(p);
    const override = config.userOverrides?.[p.id] || null;
    const access = resolveEffectiveAccess(config, c.org, p.id, c.asOf);
    return {
      id: p.id,
      name: p.name,
      title: p.title,
      orgRole: p.role,
      orgRoleLabel: config.roles[p.role]?.label || p.role,
      teamId: p.teamId || null,
      teamName: p.teamId ? teamName(p.teamId) : null,
      isRep: c.org.reps.some((r) => r.id === p.id),
      assignedRoleId: config.assignments?.[p.id] || null,
      roleId,
      roleLabel: config.roles[roleId]?.label || "Missing role",
      scopeKind: access.scope.kind,
      scopeLabel: access.scope.label,
      override: override ? { ...override, status: dateStatus(override, c.asOf) } : null,
      activeDelegations: access.delegations.length,
    };
  });

  const roles = Object.entries(config.roles).map(([id, r]) => ({
    id,
    ...r,
    builtIn: ROLE_IDS.includes(id),
    usedBy: people.filter((p) => p.roleId === id).length,
  }));

  return {
    caller: { id: caller.user.id, name: caller.user.name },
    asOf: c.asOf,
    config,
    capabilities: CAPABILITIES,
    maskedFieldsByCapability: MASKED_FIELDS_BY_CAPABILITY,
    scopes: SCOPES,
    roles,
    people,
    teams: c.org.teams.map((t) => ({
      id: t.id,
      name: t.name,
      defaultDirectorId: t.directorId,
      directorId: teamDirectorOf(config, t),
      reassigned: teamDirectorOf(config, t) !== t.directorId,
      repCount: c.org.reps.filter((r) => r.teamId === t.id).length,
    })),
    delegations: (config.delegations || []).map((d) => ({ ...d, status: dateStatus(d, c.asOf) })),
  };
}

/** What a person can do and see on a date, and why. */
export async function previewAccess(viewer, personId, asOfDate) {
  await latency();
  authorize(viewer, "previewAccess");
  const c = context();
  const person = requirePerson(c, personId);
  const date = cleanDate(asOfDate, "As-of date") || c.asOf;
  const config = accessStore.read();
  const access = resolveEffectiveAccess(config, c.org, person.id, date);
  const role = config.roles[access.roleId] || { capabilities: [], scope: "none" };
  const rawOverride = config.userOverrides?.[person.id] || null;
  const grants = new Set(access.override?.grant || []);
  const delegated = new Set(access.delegations.flatMap((d) => d.capabilities || []));
  const sourceOf = (id) => (role.capabilities.includes(id) ? "role" : grants.has(id) ? "exception" : delegated.has(id) ? "delegation" : "role");
  const ownTeams = resolveEffectiveAccess({ ...config, delegations: [] }, c.org, person.id, date).scope.teamIds;
  const wouldHave = new Set([...role.capabilities, ...grants, ...delegated]);
  const name = (id) => c.person(id)?.name || id;

  return {
    person: { id: person.id, name: person.name, title: person.title, orgRole: person.role, teamName: person.teamId ? c.team(person.teamId)?.name : null },
    asOf: date,
    datasetAsOf: c.asOf,
    role: { id: access.roleId, label: access.roleLabel, source: config.assignments?.[person.id] ? "assigned" : "default", scope: role.scope },
    capabilities: CAPABILITIES.filter((x) => access.capabilities.has(x.id)).map((x) => ({ ...x, source: sourceOf(x.id) })),
    withheld: CAPABILITIES.filter((x) => wouldHave.has(x.id) && !access.capabilities.has(x.id)),
    scope: {
      kind: access.scope.kind,
      label: access.scope.label,
      teams: c.org.teams
        .filter((t) => access.scope.teamIds.has(t.id))
        .map((t) => ({ id: t.id, name: t.name, via: ownTeams.has(t.id) ? "role" : "delegation" })),
      repCount: access.scope.repIds.size,
    },
    businessData: access.scope.repIds.size > 0 && ["view_executive_analytics", "view_team_analytics", "view_own_analytics"].some((x) => access.capabilities.has(x)),
    maskedFields: [...access.maskedFields],
    maskedGroups: Object.entries(MASKED_FIELDS_BY_CAPABILITY)
      .filter(([cap]) => !access.capabilities.has(cap))
      .map(([cap, fields]) => ({ capability: cap, label: capLabel(cap), fields })),
    override: rawOverride ? { ...rawOverride, active: !!access.override, status: dateStatus(rawOverride, date) } : null,
    delegations: (config.delegations || [])
      .filter((d) => d.toUserId === person.id)
      .map((d) => ({
        ...d,
        fromName: name(d.fromUserId),
        teamNames: (d.scopeTeamIds || []).map((t) => c.team(t)?.name || t),
        status: dateStatus(d, date),
        active: isActiveOn(d, date),
      })),
  };
}

/** Privileged-change log, newest first. */
export async function listAudit(viewer, { limit = AUDIT_LIMIT } = {}) {
  await latency();
  authorize(viewer, "listAudit");
  return [...(auditStore.read()?.events || [])].reverse().slice(0, limit);
}

/* ---------- role templates ---------- */

export function updateRole(viewer, roleId, patch = {}) {
  return write(viewer, "updateRole", (cfg) => {
    const role = requireRole(cfg, roleId);
    const next = { ...role };
    if (patch.label !== undefined) next.label = cleanText(patch.label, "Role name", { required: true, max: 60 });
    if (patch.scope !== undefined) next.scope = cleanScope(patch.scope);
    if (patch.capabilities !== undefined) next.capabilities = cleanCaps(patch.capabilities);
    uniqueLabel(cfg, next.label, roleId);
    const reason = cleanText(patch.reason, "Reason");
    if (same(role, next)) return null;
    cfg.roles[roleId] = next;
    return { action: "role.update", target: { type: "role", id: roleId, label: next.label }, summary: roleSummary(role, next), before: role, after: next, reason };
  });
}

export function createRole(viewer, { label, scope, capabilities, copyFrom, reason } = {}) {
  return write(viewer, "createRole", (cfg) => {
    const base = copyFrom ? requireRole(cfg, copyFrom) : null;
    const role = {
      label: cleanText(label, "Role name", { required: true, max: 60 }),
      scope: cleanScope(scope ?? base?.scope ?? "none"),
      capabilities: cleanCaps(capabilities ?? base?.capabilities ?? []),
    };
    uniqueLabel(cfg, role.label);
    const slug = role.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "role";
    let id = slug;
    for (let n = 2; cfg.roles[id]; n++) id = `${slug}_${n}`;
    cfg.roles[id] = role;
    const caps = role.capabilities.length ? role.capabilities.map(capLabel).join(", ") : "no permissions";
    return {
      action: "role.create",
      target: { type: "role", id, label: role.label },
      summary: `${role.label}${base ? ` (copied from ${base.label})` : ""}: ${scopeName(role.scope)}; ${caps}`,
      before: null,
      after: role,
      reason: cleanText(reason, "Reason"),
      result: { roleId: id },
    };
  });
}

export function deleteRole(viewer, roleId, { reason } = {}) {
  return write(viewer, "deleteRole", (cfg, c) => {
    const role = requireRole(cfg, roleId);
    if (ROLE_IDS.includes(roleId)) fail(`“${role.label}” is a default role behind people's org roles, so it can't be deleted. Edit its permissions instead.`);
    const users = c.org.people.filter((p) => (cfg.assignments?.[p.id] || p.role) === roleId);
    if (users.length) {
      const names = users.slice(0, 3).map((p) => p.name).join(", ");
      fail(`“${role.label}” is assigned to ${users.length} ${users.length === 1 ? "person" : "people"} (${names}${users.length > 3 ? "…" : ""}). Reassign them first.`);
    }
    delete cfg.roles[roleId];
    return { action: "role.delete", target: { type: "role", id: roleId, label: role.label }, summary: `${role.label} deleted`, before: role, after: null, reason: cleanText(reason, "Reason") };
  });
}

/* ---------- people ---------- */

export function setAssignment(viewer, personId, roleId, { reason } = {}) {
  return write(viewer, "setAssignment", (cfg, c) => {
    const person = requirePerson(c, personId);
    const next = roleId || null;
    if (next) requireRole(cfg, next);
    const prev = cfg.assignments?.[person.id] || null;
    const stored = next && next !== person.role ? next : null; // the org role needs no assignment
    if (prev === stored) return null;
    cfg.assignments = { ...(cfg.assignments || {}) };
    if (stored) cfg.assignments[person.id] = stored;
    else delete cfg.assignments[person.id];
    const label = (id) => cfg.roles[id || person.role]?.label || id;
    return {
      action: "assignment.set",
      target: { type: "person", id: person.id, label: person.name },
      summary: `${person.name}: ${label(prev)} → ${label(stored)}${stored ? "" : " (default for their org role)"}`,
      before: { roleId: prev || person.role },
      after: { roleId: stored || person.role },
      reason: cleanText(reason, "Reason"),
    };
  });
}

export function setOverride(viewer, personId, { grant, deny, note, startDate, endDate } = {}) {
  return write(viewer, "setOverride", (cfg, c) => {
    const person = requirePerson(c, personId);
    const g = cleanCaps(grant, "Granted permissions");
    const d = cleanCaps(deny, "Withheld permissions");
    const both = g.filter((x) => d.includes(x));
    if (both.length) fail(`${both.map(capLabel).join(", ")} can't be both granted and withheld.`);
    if (!g.length && !d.length) fail("Choose at least one permission to grant or withhold, or remove the exception.");
    const start = cleanDate(startDate, "Start date");
    const end = cleanDate(endDate, "End date");
    cleanRange(start, end);
    const next = { grant: g, deny: d, note: cleanText(note, "Note", { max: 200 }), ...(start ? { startDate: start } : {}), ...(end ? { endDate: end } : {}) };
    const prev = cfg.userOverrides?.[person.id] || null;
    if (same(prev, next)) return null;
    cfg.userOverrides = { ...(cfg.userOverrides || {}), [person.id]: next };
    return {
      action: "override.set",
      target: { type: "person", id: person.id, label: person.name },
      summary: `${person.name}: ${overrideSummary(next)}`,
      before: prev,
      after: next,
      reason: next.note,
    };
  });
}

export function clearOverride(viewer, personId, { reason } = {}) {
  return write(viewer, "clearOverride", (cfg, c) => {
    const person = requirePerson(c, personId);
    const prev = cfg.userOverrides?.[person.id];
    if (!prev) return null;
    cfg.userOverrides = { ...cfg.userOverrides };
    delete cfg.userOverrides[person.id];
    return {
      action: "override.clear",
      target: { type: "person", id: person.id, label: person.name },
      summary: `${person.name}: removed (${overrideSummary(prev)})`,
      before: prev,
      after: null,
      reason: cleanText(reason, "Reason"),
    };
  });
}

/* ---------- delegations ---------- */

/** Temporary cover: the delegate gets some of the delegator's permissions and teams for a dated window. */
export function addDelegation(viewer, { fromUserId, toUserId, capabilities, scopeTeamIds, startDate, endDate, reason } = {}) {
  return write(viewer, "addDelegation", (cfg, c) => {
    const from = requirePerson(c, fromUserId);
    const to = requirePerson(c, toUserId);
    if (from.id === to.id) fail("A person can't delegate to themselves.");
    const caps = cleanCaps(capabilities);
    const teams = cleanTeams(c, scopeTeamIds);
    if (!caps.length && !teams.length) fail("Choose at least one permission or team to delegate.");
    const start = cleanDate(startDate, "Start date", { required: true });
    const end = cleanDate(endDate, "End date", { required: true });
    cleanRange(start, end);
    const why = cleanText(reason, "Reason", { required: true, max: 200 });

    // Least privilege: nobody can hand on more than they hold when the cover starts.
    const fromAccess = resolveEffectiveAccess(cfg, c.org, from.id, start);
    const extraCaps = caps.filter((x) => !fromAccess.capabilities.has(x));
    if (extraCaps.length) fail(`${from.name} doesn't hold ${extraCaps.map(capLabel).join(", ")} on ${start}, so it can't be delegated.`);
    const extraTeams = teams.filter((t) => !fromAccess.scope.teamIds.has(t));
    if (extraTeams.length) fail(`${extraTeams.map((t) => c.team(t).name).join(", ")} isn't in ${from.name}'s scope on ${start}.`);

    const delegation = {
      id: `dg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      fromUserId: from.id,
      toUserId: to.id,
      capabilities: caps,
      scopeTeamIds: teams,
      startDate: start,
      endDate: end,
      reason: why,
    };
    cfg.delegations = [...(cfg.delegations || []), delegation];
    const what = [caps.length ? caps.map(capLabel).join(", ") : null, teams.length ? teams.map((t) => c.team(t).name).join(", ") : null].filter(Boolean).join("; ");
    return {
      action: "delegation.add",
      target: { type: "delegation", id: delegation.id, label: `${from.name} → ${to.name}` },
      summary: `${from.name} → ${to.name}, ${start} to ${end}: ${what}`,
      before: null,
      after: delegation,
      reason: why,
      result: { delegationId: delegation.id },
    };
  });
}

export function removeDelegation(viewer, delegationId, { reason } = {}) {
  return write(viewer, "removeDelegation", (cfg, c) => {
    const d = (cfg.delegations || []).find((x) => x.id === delegationId);
    if (!d) fail(`Unknown delegation: ${delegationId}.`);
    cfg.delegations = cfg.delegations.filter((x) => x.id !== delegationId);
    const label = `${c.person(d.fromUserId)?.name || d.fromUserId} → ${c.person(d.toUserId)?.name || d.toUserId}`;
    return {
      action: "delegation.remove",
      target: { type: "delegation", id: d.id, label },
      summary: `${label}, ${d.startDate} to ${d.endDate} removed`,
      before: d,
      after: null,
      reason: cleanText(reason, "Reason"),
    };
  });
}

/* ---------- reporting lines ---------- */

/** Move a team to another director (null restores the org record). Sales history keeps its original salesperson. */
export function setTeamDirector(viewer, teamId, directorId, { reason } = {}) {
  return write(viewer, "setTeamDirector", (cfg, c) => {
    const team = c.team(teamId);
    if (!team) fail(`Unknown team: ${teamId}.`);
    const next = directorId ? requirePerson(c, directorId).id : team.directorId;
    const prev = teamDirectorOf(cfg, team);
    if (prev === next) return null;
    const map = { ...(cfg.hierarchy?.teamDirector || {}) };
    if (next === team.directorId) delete map[team.id];
    else map[team.id] = next;
    cfg.hierarchy = { ...(cfg.hierarchy || {}), teamDirector: map };
    const name = (id) => c.person(id)?.name || id;
    return {
      action: "hierarchy.set",
      target: { type: "team", id: team.id, label: team.name },
      summary: `${team.name}: ${name(prev)} → ${name(next)}`,
      before: { directorId: prev },
      after: { directorId: next },
      reason: cleanText(reason, "Reason"),
    };
  });
}

/* ---------- reset ---------- */

/** Restore the shipped roles, assignments, exceptions, delegations and reporting lines. The audit log is kept. */
export async function resetToDefaults(viewer, { reason } = {}) {
  await latency();
  const caller = authorize(viewer, "resetToDefaults", { logDenied: true });
  const why = cleanText(reason, "Reason");
  const before = clone(accessStore.read());
  accessStore.reset();
  const event = appendAudit({
    by: { id: caller.user.id, name: caller.user.name },
    action: "config.reset",
    target: { type: "config", id: "access", label: "All access rules" },
    summary: "Restored the default roles, assignments, exceptions, delegations and reporting lines",
    before,
    after: clone(accessStore.read()),
    ...(why ? { reason: why } : {}),
  });
  clearSalesQueryCache();
  return { changed: true, auditId: event.id };
}
