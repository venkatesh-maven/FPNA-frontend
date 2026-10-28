// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateDataset } from "../dataset";
import { cyrb53 } from "../prng";
import { timeRevenue } from "../../calc/economics";

const ds = generateDataset();
const fingerprint = (d) =>
  cyrb53(JSON.stringify([d.facts.length, d.facts.slice(0, 50), d.opportunities.slice(0, 20), d.plans.slice(0, 20)]));

describe("sample dataset", () => {
  it("is deterministic per seed", () => {
    expect(fingerprint(generateDataset())).toBe(fingerprint(ds));
    expect(fingerprint(generateDataset({ seed: "other-seed" }))).not.toBe(fingerprint(ds));
  });

  it("has realistic volumes", () => {
    expect(ds.clients).toHaveLength(140);
    expect(ds.org.reps).toHaveLength(28);
    expect(ds.clients.filter((c) => c.isNewLogo)).toHaveLength(30);
    expect(ds.clients.filter((c) => c.churnDate)).toHaveLength(15);
    expect(ds.assignments.length).toBeGreaterThan(900);
    expect(ds.opportunities.length).toBeGreaterThan(350);
    expect(ds.placements.length).toBeGreaterThan(60);
  });

  it("has no orphan references", () => {
    const { index } = ds;
    for (const f of ds.facts) expect(index.clientById.has(f.clientId)).toBe(true);
    for (const a of ds.assignments) {
      expect(index.clientById.has(a.clientId)).toBe(true);
      expect(index.contractorById.has(a.contractorId)).toBe(true);
    }
    for (const c of ds.clients) for (const o of c.owners) expect(index.repById.has(o.repId)).toBe(true);
    for (const c of ds.clients) expect(c.owners.reduce((s, o) => s + o.share, 0)).toBeCloseTo(1);
    for (const o of ds.opportunities) expect(index.repById.has(o.repId)).toBe(true);
    for (const e of ds.expenses) expect(index.repById.has(e.repId)).toBe(true);
  });

  it("keeps staffing economics consistent", () => {
    const bad = ds.facts
      .filter((x) => x.kind === "time")
      .filter(
        (f) =>
          Math.abs(f.revenue - timeRevenue(f.billedHours, f.otHours, f.billRate)) > 0.5 ||
          Math.abs(f.gp - (f.revenue - f.wages - f.burden - f.odc)) > 0.05 ||
          !(f.billRate > f.payRate) ||
          f.ym > ds.meta.asOfYm
      );
    expect(bad).toEqual([]);
  });

  it("orders events: win ≤ requisition ≤ start ≤ first billing", () => {
    const reqById = new Map(ds.requisitions.map((r) => [r.id, r]));
    for (const a of ds.assignments) {
      const client = ds.index.clientById.get(a.clientId);
      if (a.startDate >= "2024-01-01") expect(a.startDate >= client.acquiredDate).toBe(true);
      const req = reqById.get(a.requisitionId);
      expect(req.openedDate <= a.startDate).toBe(true);
      expect(a.firstBilledDate >= a.startDate).toBe(true);
      if (a.actualEndDate) expect(a.actualEndDate >= a.startDate).toBe(true);
    }
    for (const o of ds.opportunities.filter((x) => x.status === "won" && x.type === "new_logo")) {
      expect(ds.index.clientById.get(o.clientId).acquiredDate).toBe(o.wonDate);
    }
  });

  it("prints a summary", () => {
    const year = (y) => ds.facts.filter((f) => f.ym.startsWith(y));
    const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    for (const y of ["2024", "2025", "2026"]) {
      const rows = year(y);
      const rev = sum(rows, "revenue");
      const gp = sum(rows, "gp");
      const time = rows.filter((r) => r.kind === "time");
      console.log(
        y,
        "revenue",
        Math.round(rev).toLocaleString(),
        "GM%",
        ((gp / rev) * 100).toFixed(1),
        "avg active",
        (sum(time, "af") / new Set(time.map((r) => r.ym)).size).toFixed(0),
        "burden% wages",
        ((sum(time, "burden") / sum(time, "wages")) * 100).toFixed(1)
      );
    }
    const plan26 = ds.plans.filter((p) => p.ym.startsWith("2026"));
    console.log("2026 budget revenue", Math.round(plan26.reduce((s, p) => s + p.budget.revenue, 0)).toLocaleString());
    const won = ds.opportunities.filter((o) => o.status === "won").length;
    const lost = ds.opportunities.filter((o) => o.status === "lost").length;
    console.log("opps", ds.opportunities.length, "won", won, "lost", lost, "open", ds.opportunities.length - won - lost);
    console.log("assignments", ds.assignments.length, "contractors", ds.contractors.length, "facts", ds.facts.length, "placements", ds.placements.length);
    const exp26 = ds.expenses.filter((e) => e.ym.startsWith("2026"));
    const byCat = {};
    for (const e of exp26) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    console.log("2026 sales expense", Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, Math.round(v)])));
    expect(true).toBe(true);
  });
});