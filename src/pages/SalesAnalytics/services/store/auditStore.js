import { createVersionedStore } from "./versionedStore";

// Append-only log of privileged access changes (roles, assignments,
// exceptions, delegations, reporting lines) and refused admin attempts.
// Newest last; capped so browser storage stays small. "Reset to defaults"
// resets the access rules, never this log.
// { events: [{ id, at, by: { id, name }, action, target: { type, id, label }, summary, before, after, reason? }] }
export const AUDIT_LIMIT = 500;
export const auditStore = createVersionedStore({ key: "accessAudit", defaults: { events: [] } });
