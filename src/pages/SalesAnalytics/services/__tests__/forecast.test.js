import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mockConfig } from "../mockServer/handle";
import { getTeamForecast, salesForecast, scenarios } from "../salesAnalyticsApi";
import { forecastStore, scenarioStore } from "../store/stores";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { emptyAssumptions } from "../../calc/whatIf";
import { getDataset } from "../../mock/dataset";

mockConfig.latency = false;

const REP = { userId: "R03" };
const OTHER_REP = { userId: "R04" };
const DIRECTOR = { userId: "D1" };
const OTHER_DIRECTOR = { userId: "D2" };
const EXEC = { userId: "E1" };
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

const reset = () => {
  forecastStore.reset();
  scenarioStore.reset();
};
beforeEach(reset);
afterAll(reset);

async function submitAsRep(viewer = REP, tweak = (a) => a) {
  const a = emptyAssumptions();
  tweak(a);
  const s = await scenarios.save(viewer, { repId: viewer.userId, name: "Plan A", assumptions: a });
  await scenarios.setMyForecast(viewer, s.id);
  return salesForecast.submit(viewer, { note: "test" });
}

describe("sales forecast workflow", { timeout: 60000 }, () => {
  it("salespeople only model and submit their own book", async () => {
    await expect(scenarios.save(REP, { repId: "R04", name: "x", assumptions: emptyAssumptions() })).rejects.toThrow();
    await expect(salesForecast.status(REP, "R04")).rejects.toThrow();
    await expect(salesForecast.submit(REP)).rejects.toThrow(/My Sales Forecast/);
    const first = await submitAsRep();
    expect(first.status).toBe("submitted");
    const second = await submitAsRep();
    expect(second.version).toBe(first.version + 1);
    const { latest, history } = await salesForecast.status(REP, "R03");
    expect(latest.id).toBe(second.id);
    expect(history.find((h) => h.id === first.id).status).toBe("superseded");
  });

  it("snapshot rows reconcile to the submitted quarter", async () => {
    const sub = await submitAsRep(REP, (a) => (a.global.billRatePct = 4));
    const full = await salesForecast.submission(REP, sub.id);
    expect(sum(full.snapshot.rows, (r) => r.revenue)).toBeCloseTo(full.snapshot.quarter.revenue, 2);
    expect(full.assumptionNotes.some((t) => /Bill rates \+4%/.test(t))).toBe(true);
  });

  it("director returns, salesperson revises, director confirms; confirmed forecasts are locked", async () => {
    const v1 = await submitAsRep();
    await expect(salesForecast.returnToRep(DIRECTOR, { submissionId: v1.id, comment: "" })).rejects.toThrow(/comment/);
    await expect(salesForecast.returnToRep(OTHER_DIRECTOR, { submissionId: v1.id, comment: "no" })).rejects.toThrow();
    const returned = await salesForecast.returnToRep(DIRECTOR, { submissionId: v1.id, comment: "Add the extension" });
    expect(returned.status).toBe("returned");
    const v2 = await submitAsRep(REP, (a) => (a.global.extensionProbability = 70));
    expect(v2.version).toBe(v1.version + 1);
    await expect(salesForecast.confirm(EXEC, { submissionId: v2.id })).rejects.toThrow();
    const confirmed = await salesForecast.confirm(DIRECTOR, { submissionId: v2.id });
    expect(confirmed.status).toBe("confirmed");
    await expect(submitAsRep()).rejects.toThrow(/confirmed/);
  });

  it("director adjustments need a reason and keep the salesperson's original", async () => {
    const sub = await submitAsRep();
    await expect(salesForecast.addAdjustment(DIRECTOR, { submissionId: sub.id, revenue: 1000, gp: 300, reason: "" })).rejects.toThrow(/reason/);
    const adj = await salesForecast.addAdjustment(DIRECTOR, { submissionId: sub.id, revenue: 1000, gp: 300, reason: "Known extension at Acme" });
    expect(adj.adjustmentTotal.gp).toBe(300);
    const full = await salesForecast.submission(DIRECTOR, sub.id);
    const team = (await getTeamForecast(DEFAULT_FILTERS, DIRECTOR)).data;
    const row = team.reps.find((r) => r.repId === "R03");
    expect(row.forecastGp).toBeCloseTo(full.snapshot.quarter.gp + 300, 2);
    expect(row.adjustmentGp).toBe(300);
  });

  it("team view respects scope and totals add up", async () => {
    const ds = getDataset();
    const d1 = (await getTeamForecast(DEFAULT_FILTERS, DIRECTOR)).data;
    const d1Teams = ds.org.teams.filter((t) => t.directorId === "D1").map((t) => t.id);
    expect(d1.reps.every((r) => d1Teams.includes(r.teamId))).toBe(true);
    const all = (await getTeamForecast(DEFAULT_FILTERS, EXEC)).data;
    expect(all.reps.length).toBe(ds.org.reps.length);
    expect(all.totals.forecastRevenue).toBeCloseTo(sum(all.reps, (r) => r.forecastRevenue), 2);
    const b = all.buckets;
    expect(b.confirmed.count + b.unconfirmed.count + b.missing.count).toBe(all.reps.length);
    expect(b.confirmed.gp + b.unconfirmed.gp + b.missing.gp).toBeCloseTo(all.totals.forecastGp, 2);
    await expect(getTeamForecast(DEFAULT_FILTERS, REP)).rejects.toThrow();
  });

  it("team confirmation and Send to Forecasting are versioned, validated and idempotent", async () => {
    const sub = await submitAsRep();
    await salesForecast.confirm(DIRECTOR, { submissionId: sub.id });
    await expect(salesForecast.confirmTeam(DIRECTOR, {})).rejects.toThrow(/no confirmed forecast/);
    const c1 = await salesForecast.confirmTeam(DIRECTOR, { acknowledgeExcluded: true });
    expect(c1.version).toBeGreaterThanOrEqual(1);
    expect(c1.submissions.some((s) => s.id === sub.id)).toBe(true);

    await expect(salesForecast.sendToForecasting(EXEC, { confirmationId: c1.id })).rejects.toThrow();
    await expect(salesForecast.sendToForecasting(OTHER_DIRECTOR, { confirmationId: c1.id })).rejects.toThrow();
    const t1 = await salesForecast.sendToForecasting(DIRECTOR, { confirmationId: c1.id });
    expect(t1.status).toBe("received");
    expect(t1.reconciliation.sentGp).toBeCloseTo(c1.totals.gp, 0);
    const again = await salesForecast.sendToForecasting(DIRECTOR, { confirmationId: c1.id });
    expect(again.duplicate).toBe(true);
    expect(again.id).toBe(t1.id);

    // A forecast returned after confirmation makes a new confirmation fail validation until re-confirmed.
    const c2 = await salesForecast.confirmTeam(DIRECTOR, { acknowledgeExcluded: true });
    expect(c2.version).toBe(c1.version + 1);
    await salesForecast.returnToRep(DIRECTOR, { submissionId: sub.id, comment: "Revise" });
    const failed = await salesForecast.sendToForecasting(DIRECTOR, { confirmationId: c2.id });
    expect(failed.status).toBe("failed");
    expect(failed.errors.length).toBeGreaterThan(0);
    await expect(salesForecast.sendToForecasting(DIRECTOR, { confirmationId: c1.id })).rejects.toThrow(/newer/);
  });
});
