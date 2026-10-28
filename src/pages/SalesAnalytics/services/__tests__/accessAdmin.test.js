// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useSalesQuery", async (importOriginal) => ({ ...(await importOriginal()), clearSalesQueryCache: vi.fn() }));

import { ForbiddenError, mockConfig } from "../mockServer/handle";
import * as admin from "../accessAdminApi";
import { AccessValidationError } from "../accessAdminApi";
import { getDirectorView, getExecutiveOverview, getMyAccess, getSalespersonView } from "../salesAnalyticsApi";
import { accessStore } from "../store/stores";
import { auditStore } from "../store/auditStore";
import { clearSalesQueryCache } from "../../hooks/useSalesQuery";
import { DEFAULT_ACCESS_CONFIG } from "../../access/capabilities";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { DATASET_AS_OF } from "../../config/dataset";

const ADMIN = { userId: "A1" };
const EXEC = { userId: "E1" };
const YTD = { ...DEFAULT_FILTERS, period: "YTD" };
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const kpi = (data, key) => data.kpiSections.flatMap((s) => s.tiles).find((t) => t.key === key);
const teamsOf = (leaderboard) => [...new Set(leaderboard.map((r) => r.teamId))].sort();

const resetStores = () => {
  accessStore.reset();
  auditStore.reset();
};

beforeAll(() => {
  mockConfig.latency = false;
});
beforeEach(() => {
  resetStores();
  clearSalesQueryCache.mockClear();
});
afterAll(resetStores);

// One representative call per admin endpoint. The completeness check below
// fails if an endpoint is added without being listed here.
const ADMIN_CALLS = {
  getAccessAdmin: (v) => admin.getAccessAdmin(v),
  previewAccess: (v) => admin.previewAccess(v, "R03", DATASET_AS_OF),
  listAudit: (v) => admin.listAudit(v),
  updateRole: (v) => admin.updateRole(v, "salesperson", { capabilities: ["view_own_analytics", "view_executive_analytics"] }),
  createRole: (v) => admin.createRole(v, { label: "Shadow", scope: "all", capabilities: ["view_executive_analytics"] }),
  deleteRole: (v) => admin.deleteRole(v, "finance"),
  setAssignment: (v) => admin.setAssignment(v, "R03", "executive"),
  setOverride: (v) => admin.setOverride(v, v.userId, { grant: ["view_executive_analytics"] }),
  clearOverride: (v) => admin.clearOverride(v, "R07"),
  addDelegation: (v) =>
    admin.addDelegation(v, { fromUserId: "E1", toUserId: v.userId, capabilities: ["view_executive_analytics"], scopeTeamIds: ["T1"], startDate: "2026-10-01", endDate: "2026-12-31", reason: "x" }),
  removeDelegation: (v) => admin.removeDelegation(v, "dg-anything"),
  setTeamDirector: (v) => admin.setTeamDirector(v, "T3", "D1"),
  resetToDefaults: (v) => admin.resetToDefaults(v),
};

describe("access administration is deny-by-default", { timeout: 60000 }, () => {
  it("covers every exported admin endpoint", () => {
    const endpoints = Object.entries(admin)
      .filter(([, v]) => typeof v === "function" && v !== AccessValidationError)
      .map(([k]) => k)
      .sort();
    expect(endpoints).toEqual(Object.keys(ADMIN_CALLS).sort());
  });

  it("refuses every admin endpoint to an executive, a director and a salesperson", async () => {
    for (const userId of ["E1", "D1", "R03"]) {
      for (const [name, call] of Object.entries(ADMIN_CALLS)) {
        await expect(call({ userId }), `${userId} → ${name}`).rejects.toBeInstanceOf(ForbiddenError);
      }
    }
    await expect(admin.getAccessAdmin(null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(admin.getAccessAdmin({ userId: "NOBODY" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(accessStore.read()).toEqual(DEFAULT_ACCESS_CONFIG);
    expect(clearSalesQueryCache).not.toHaveBeenCalled();
    // Refused write attempts are recorded; nothing else is.
    const events = auditStore.read().events;
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.action === "access.denied")).toBe(true);
    expect(new Set(events.map((e) => e.by.id))).toEqual(new Set(["E1", "D1", "R03"]));
  });

  it("gives the access admin no business data", async () => {
    await expect(getExecutiveOverview(DEFAULT_FILTERS, ADMIN)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getDirectorView(DEFAULT_FILTERS, ADMIN)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getSalespersonView(DEFAULT_FILTERS, ADMIN)).rejects.toBeInstanceOf(ForbiddenError);
    const mine = await getMyAccess(ADMIN);
    expect(mine.capabilities).toEqual(["manage_access"]);
    expect(mine.scope.repIds).toEqual([]);
    const preview = await admin.previewAccess(ADMIN, "A1", DATASET_AS_OF);
    expect(preview.businessData).toBe(false);
    expect(preview.scope.repCount).toBe(0);
    // The admin screen itself carries no figures.
    const screen = JSON.stringify(await admin.getAccessAdmin(ADMIN));
    expect(screen).not.toMatch(/"(revenue|gp|commission|wages|payRate)"\s*:/);
  });

  it("won't let an administrator widen their own access or lock everyone out", async () => {
    const own = [
      () => admin.setAssignment(ADMIN, "A1", "executive"),
      () => admin.updateRole(ADMIN, "access_admin", { capabilities: ["manage_access", "view_executive_analytics"] }),
      () => admin.updateRole(ADMIN, "access_admin", { scope: "all" }),
      () => admin.setOverride(ADMIN, "A1", { grant: ["view_team_analytics"], startDate: "2026-11-01", endDate: "2026-11-30" }),
      () => admin.addDelegation(ADMIN, { fromUserId: "E1", toUserId: "A1", capabilities: ["view_executive_analytics"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "cover" }),
    ];
    await expect(own[0]()).rejects.toBeInstanceOf(AccessValidationError);
    await expect(own[1]()).rejects.toBeInstanceOf(AccessValidationError);
    await expect(own[2]()).rejects.toBeInstanceOf(AccessValidationError); // a wider record scope counts, even without analytics
    await expect(own[3]()).rejects.toBeInstanceOf(AccessValidationError); // a future-dated grant counts too
    await expect(own[4]()).rejects.toBeInstanceOf(AccessValidationError);
    await expect(admin.updateRole(ADMIN, "access_admin", { capabilities: [] })).rejects.toThrow(/nobody able to manage access/);
    await expect(admin.setOverride(ADMIN, "A1", { deny: ["manage_access"] })).rejects.toThrow(/nobody able to manage access/);
    expect(accessStore.read()).toEqual(DEFAULT_ACCESS_CONFIG);
    expect(auditStore.read().events).toEqual([]);
  });

  it("validates ids, dates and lists", async () => {
    const bad = [
      () => admin.updateRole(ADMIN, "nope", { label: "X" }),
      () => admin.updateRole(ADMIN, "finance", { capabilities: ["view_everything"] }),
      () => admin.updateRole(ADMIN, "finance", { scope: "galaxy" }),
      () => admin.updateRole(ADMIN, "finance", { label: "Executive" }),
      () => admin.updateRole(ADMIN, "finance", { label: "  " }),
      () => admin.setAssignment(ADMIN, "ZZ9", "finance"),
      () => admin.setAssignment(ADMIN, "R03", "ghost"),
      () => admin.setOverride(ADMIN, "R03", { deny: ["export_data"], startDate: "2026-10-10", endDate: "2026-10-01" }),
      () => admin.setOverride(ADMIN, "R03", { deny: ["export_data"], startDate: "10/01/2026" }),
      () => admin.setOverride(ADMIN, "R03", { grant: ["export_data"], deny: ["export_data"] }),
      () => admin.setOverride(ADMIN, "R03", {}),
      () => admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D2", scopeTeamIds: ["T9"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "x" }),
      () => admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D2", scopeTeamIds: ["T1"], startDate: "2026-10-31", endDate: "2026-10-01", reason: "x" }),
      () => admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D2", scopeTeamIds: ["T1"], startDate: "2026-10-01", endDate: "2026-10-31" }),
      () => admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D1", scopeTeamIds: ["T1"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "x" }),
      // least privilege: D1 can't hand on a team or a permission they don't hold
      () => admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D2", scopeTeamIds: ["T3"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "x" }),
      () => admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D2", capabilities: ["view_executive_analytics"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "x" }),
      () => admin.setTeamDirector(ADMIN, "T9", "D2"),
      () => admin.setTeamDirector(ADMIN, "T1", "ZZ9"),
      () => admin.previewAccess(ADMIN, "ZZ9", DATASET_AS_OF),
      () => admin.previewAccess(ADMIN, "R03", "yesterday"),
      () => admin.deleteRole(ADMIN, "director"), // built-in
      () => admin.removeDelegation(ADMIN, "dg-missing"),
    ];
    for (const [i, call] of bad.entries()) await expect(call(), `case ${i}`).rejects.toBeInstanceOf(AccessValidationError);
    expect(accessStore.read()).toEqual(DEFAULT_ACCESS_CONFIG);
  });

  it("won't delete a role that is in use", async () => {
    const { roleId } = await admin.createRole(ADMIN, { label: "Account Manager", copyFrom: "salesperson" });
    expect(accessStore.read().roles[roleId].capabilities).toEqual(DEFAULT_ACCESS_CONFIG.roles.salesperson.capabilities);
    await admin.setAssignment(ADMIN, "R03", roleId);
    await expect(admin.deleteRole(ADMIN, roleId)).rejects.toThrow(/assigned to 1 person/);
    await admin.setAssignment(ADMIN, "R03", null);
    await admin.deleteRole(ADMIN, roleId);
    expect(accessStore.read().roles[roleId]).toBeUndefined();
  });
});

describe("effective dates and delegated cover", { timeout: 60000 }, () => {
  it("applies an exception only between its start and end dates", async () => {
    await admin.setOverride(ADMIN, "R03", { deny: ["view_commissions"], note: "Plan dispute", startDate: "2026-01-01", endDate: "2026-06-30" });
    // Expired on the data date: R03 still sees commissions.
    const sp = await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" });
    expect(sp.meta.maskedFields).not.toContain("commission");
    expect((await admin.previewAccess(ADMIN, "R03", "2026-07-01")).maskedFields).not.toContain("commission");
    const march = await admin.previewAccess(ADMIN, "R03", "2026-03-15");
    expect(march.maskedFields).toContain("commission");
    expect(march.withheld.map((c) => c.id)).toEqual(["view_commissions"]);
    expect(march.override.active).toBe(true);

    // Not started yet: doesn't apply either.
    await admin.setOverride(ADMIN, "R03", { deny: ["view_commissions"], startDate: "2026-11-01" });
    expect((await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" })).meta.maskedFields).not.toContain("commission");

    // In force today: applies on the server.
    await admin.setOverride(ADMIN, "R03", { deny: ["view_commissions"], startDate: "2026-10-01", endDate: "2026-12-31" });
    expect((await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" })).meta.maskedFields).toContain("commission");
  });

  it("gives delegated team scope only within the delegation's dates", async () => {
    const before = await getDirectorView(DEFAULT_FILTERS, { userId: "D2" });
    expect(teamsOf(before.data.leaderboard)).toEqual(["T3"]);

    const { delegationId } = await admin.addDelegation(ADMIN, {
      fromUserId: "D1", toUserId: "D2", capabilities: [], scopeTeamIds: ["T1"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "Leave cover",
    });
    const during = await admin.previewAccess(ADMIN, "D2", "2026-10-20");
    expect(during.scope.teams.map((t) => [t.id, t.via])).toEqual([["T1", "delegation"], ["T3", "role"]]);
    expect(during.delegations[0]).toMatchObject({ fromName: "Elena Novak", active: true });
    for (const date of ["2026-09-30", "2026-11-01"]) {
      const p = await admin.previewAccess(ADMIN, "D2", date);
      expect(p.scope.teams.map((t) => t.id), date).toEqual(["T3"]);
      expect(p.delegations[0].active).toBe(false);
    }
    // On the data date the server includes T1 for D2, and nobody else gains it.
    const covered = await getDirectorView(DEFAULT_FILTERS, { userId: "D2" });
    expect(teamsOf(covered.data.leaderboard)).toEqual(["T1", "T3"]);
    expect(teamsOf((await getDirectorView(DEFAULT_FILTERS, { userId: "D3" })).data.leaderboard)).toEqual(["T4"]);

    // An expired delegation gives nothing.
    await admin.removeDelegation(ADMIN, delegationId);
    await admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "D2", scopeTeamIds: ["T1"], startDate: "2026-09-01", endDate: "2026-10-15", reason: "Ended" });
    expect(teamsOf((await getDirectorView(DEFAULT_FILTERS, { userId: "D2" })).data.leaderboard)).toEqual(["T3"]);
  });

  it("an explicit withhold wins over a delegation", async () => {
    await admin.addDelegation(ADMIN, { fromUserId: "D1", toUserId: "R07", capabilities: ["view_cost_detail"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "x" });
    const sp = await getSalespersonView(DEFAULT_FILTERS, { userId: "R07" });
    expect(sp.meta.maskedFields).toContain("avgPayRate");
  });
});

describe("reporting lines", { timeout: 60000 }, () => {
  it("moving a team to another director moves its scope, totals and rankings", async () => {
    const teamRevenue = async (teamId) => kpi((await getDirectorView({ ...YTD, team: [teamId] }, EXEC)).data, "revenue").value;
    const t2 = await teamRevenue("T2");
    const t3 = await teamRevenue("T3");
    const t2Reps = (await getDirectorView({ ...YTD, team: ["T2"] }, EXEC)).data.leaderboard.map((r) => r.repId);
    expect(teamsOf((await getDirectorView(YTD, { userId: "D1" })).data.leaderboard)).toEqual(["T1", "T2"]);

    await admin.setTeamDirector(ADMIN, "T2", "D2");

    const d1 = (await getDirectorView(YTD, { userId: "D1" })).data;
    const d2 = (await getDirectorView(YTD, { userId: "D2" })).data;
    expect(teamsOf(d1.leaderboard)).toEqual(["T1"]);
    expect(teamsOf(d2.leaderboard)).toEqual(["T2", "T3"]);
    expect(d1.leaderboard.some((r) => t2Reps.includes(r.repId))).toBe(false);
    expect(t2Reps.every((id) => d2.leaderboard.some((r) => r.repId === id))).toBe(true);
    expect(kpi(d2, "revenue").value).toBeCloseTo(t2 + t3, 2);
    expect(sum(d2.leaderboard.map((r) => r.revenue))).toBeCloseTo(kpi(d2, "revenue").value, 2);
    expect(kpi(d1, "revenue").value).toBeCloseTo(await teamRevenue("T1"), 2);
    // D1 can't reach a moved rep directly either.
    expect((await getSalespersonView(YTD, { userId: "D1" }, { repId: t2Reps[0] })).data.rep.id).not.toBe(t2Reps[0]);
    expect((await getMyAccess({ userId: "D2" })).scope.label).toMatch(/Northeast Commercial/);

    const screen = await admin.getAccessAdmin(ADMIN);
    expect(screen.teams.find((t) => t.id === "T2")).toMatchObject({ directorId: "D2", defaultDirectorId: "D1", reassigned: true });

    await admin.setTeamDirector(ADMIN, "T2", null);
    expect(teamsOf((await getDirectorView(YTD, { userId: "D1" })).data.leaderboard)).toEqual(["T1", "T2"]);
    expect(accessStore.read().hierarchy.teamDirector).toEqual({});
  });
});

describe("audit and reset", { timeout: 60000 }, () => {
  it("records every change with who, what, before and after, and re-scopes cached analytics", async () => {
    let delegationId;
    const writes = [
      ["role.update", () => admin.updateRole(ADMIN, "finance", { capabilities: [...DEFAULT_ACCESS_CONFIG.roles.finance.capabilities, "view_commissions"] })],
      ["role.create", () => admin.createRole(ADMIN, { label: "Regional Analyst", scope: "teams", capabilities: ["view_team_analytics"] })],
      ["assignment.set", () => admin.setAssignment(ADMIN, "D4", "regional_analyst")],
      ["assignment.set", () => admin.setAssignment(ADMIN, "D4", null)],
      ["role.delete", () => admin.deleteRole(ADMIN, "regional_analyst")],
      ["override.set", () => admin.setOverride(ADMIN, "R03", { deny: ["export_data"], note: "Audit hold" })],
      ["override.clear", () => admin.clearOverride(ADMIN, "R03")],
      ["delegation.add", async () => ({ delegationId } = await admin.addDelegation(ADMIN, { fromUserId: "D3", toUserId: "D4", scopeTeamIds: ["T4"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "Cover" }))],
      ["delegation.remove", () => admin.removeDelegation(ADMIN, delegationId)],
      ["hierarchy.set", () => admin.setTeamDirector(ADMIN, "T5", "D3")],
      ["config.reset", () => admin.resetToDefaults(ADMIN)],
    ];
    for (const [i, [action, run]] of writes.entries()) {
      await run();
      const log = await admin.listAudit(ADMIN);
      expect(log.length, action).toBe(i + 1);
      expect(log[0]).toMatchObject({ action, by: { id: "A1", name: "Sam Ortega" } });
      expect(log[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(log[0].summary.length).toBeGreaterThan(5);
      expect(log[0].target.id).toBeTruthy();
      expect(clearSalesQueryCache).toHaveBeenCalledTimes(i + 1);
    }
    const log = await admin.listAudit(ADMIN);
    expect(log.find((e) => e.action === "override.set")).toMatchObject({ before: null, after: { deny: ["export_data"] }, reason: "Audit hold" });
    expect(log.find((e) => e.action === "hierarchy.set")).toMatchObject({ before: { directorId: "D4" }, after: { directorId: "D3" } });

    // A save that changes nothing isn't a change.
    expect(await admin.setAssignment(ADMIN, "D1", "director")).toEqual({ changed: false });
    expect((await admin.listAudit(ADMIN)).length).toBe(writes.length);
  });

  it("reset restores the default rules and keeps the audit history", async () => {
    await admin.updateRole(ADMIN, "director", { capabilities: ["view_team_analytics"] });
    await admin.setAssignment(ADMIN, "R03", "finance");
    await admin.setTeamDirector(ADMIN, "T1", "D3");
    await admin.addDelegation(ADMIN, { fromUserId: "E1", toUserId: "F1", capabilities: ["view_commissions"], startDate: "2026-10-01", endDate: "2026-10-31", reason: "Close" });
    expect(accessStore.read()).not.toEqual(DEFAULT_ACCESS_CONFIG);

    await admin.resetToDefaults(ADMIN, { reason: "Start over" });
    expect(accessStore.read()).toEqual(DEFAULT_ACCESS_CONFIG);
    expect(teamsOf((await getDirectorView(DEFAULT_FILTERS, { userId: "D1" })).data.leaderboard)).toEqual(["T1", "T2"]);
    const log = await admin.listAudit(ADMIN);
    expect(log.map((e) => e.action)).toEqual(["config.reset", "delegation.add", "hierarchy.set", "assignment.set", "role.update"]);
    expect(log[0]).toMatchObject({ reason: "Start over", after: DEFAULT_ACCESS_CONFIG });
  });
});
