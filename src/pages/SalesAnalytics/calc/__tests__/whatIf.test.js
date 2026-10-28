import { beforeAll, describe, expect, it } from "vitest";
import { mockConfig } from "../../services/mockServer/handle";
import { getWhatIfBaseline } from "../../services/salesAnalyticsApi";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { CONFIDENCE, emptyAssumptions, forecastRows, gpForCommission, planCommission, scenarioBridge, simulate } from "../whatIf";

mockConfig.latency = false;

const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
const close = (a, b, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThan(tol);
const hasBad = (v) =>
  typeof v === "number" ? !Number.isFinite(v) : Array.isArray(v) ? v.some(hasBad) : v && typeof v === "object" ? Object.values(v).some(hasBad) : false;
const withA = (fn) => {
  const a = emptyAssumptions();
  fn(a);
  return a;
};

let base;
let restricted;
beforeAll(async () => {
  base = (await getWhatIfBaseline(DEFAULT_FILTERS, { userId: "R03" })).data;
  restricted = (await getWhatIfBaseline(DEFAULT_FILTERS, { userId: "R07" })).data;
});

describe("What-If engine", () => {
  it("baseline reconciles: months, clients and confidence all add up to the quarter", () => {
    const r = simulate(base);
    expect(hasBad(r)).toBe(false);
    close(r.quarter.revenue, r.actual.revenue + r.modeled.revenue);
    close(sum(r.months, (m) => m.total.revenue), r.quarter.revenue);
    close(sum(r.clients, (c) => c.total.gp), r.quarter.gp);
    close(sum(CONFIDENCE, (c) => r.confidence[c].revenue), r.quarter.revenue);
    close(r.confidence.actual.revenue, sum(base.actuals, (x) => x.revenue));
    close(sum(forecastRows(base, r), (x) => x.revenue), r.quarter.revenue);
    expect(r.modeled.revenue).toBeGreaterThan(0);
  });

  it("assumptions never change actual to date", () => {
    const a = withA((x) => {
      x.global.billRatePct = 10;
      x.global.payRatePct = 5;
      x.clients[base.clients[0].id] = { lose: true };
    });
    expect(simulate(base, a).actual).toEqual(simulate(base).actual);
  });

  it("a bill-rate rise adds the same amount to revenue and GP; a pay rise only lowers GP", () => {
    const b0 = simulate(base).quarter;
    const bill = simulate(base, withA((x) => (x.global.billRatePct = 5))).quarter;
    close(bill.revenue - b0.revenue, bill.gp - b0.gp, 1);
    expect(bill.gp).toBeGreaterThan(b0.gp);
    const pay = simulate(base, withA((x) => (x.global.payRatePct = 5))).quarter;
    close(pay.revenue, b0.revenue, 0.01);
    expect(pay.gp).toBeLessThan(b0.gp);
  });

  it("commission: earned stays unchanged, the plan's tiers apply to the quarter's GP", () => {
    const plan = { baseRate: 0.08, accelRate: 0.12 };
    expect(planCommission(100, 200, plan)).toBeCloseTo(8);
    expect(planCommission(300, 200, plan)).toBeCloseTo(16 + 12);
    expect(gpForCommission(planCommission(300, 200, plan), 200, plan)).toBeCloseTo(300);
    const r0 = simulate(base);
    const r1 = simulate(base, withA((x) => (x.global.billRatePct = 8)));
    expect(r1.commission.earnedToDate).toBe(r0.commission.earnedToDate);
    close(r1.commission.quarterTotal, planCommission(r1.quarter.gp, base.target.gp, base.commission));
    expect(r1.commission.quarterTotal).toBeGreaterThan(r0.commission.quarterTotal);
    close(r1.contribution, r1.quarter.gp - r1.salesExpense);
  });

  it("the GP bridge walks from baseline to scenario", () => {
    const a = withA((x) => {
      x.global.billRatePct = 3;
      x.global.extensionProbability = 80;
      x.newStarts.push({ id: "n1", clientId: base.clients[0].id, count: 2, startDate: base.quarter.asOf, durationMonths: 6, hoursPerWeek: 40, billRate: 80, payRate: 55, committed: false });
    });
    const br = scenarioBridge(base, a);
    close(br.start.gp + sum(br.steps, (s) => s.amount), br.end.gp, 0.5);
    close(br.end.gp, simulate(base, a).quarter.gp, 0.5);
    close(br.start.gp, simulate(base).quarter.gp, 0.5);
  });

  it("confidence: committed starts are confirmed, uncommitted are upside; higher win odds go to upside", () => {
    const start = (committed) => withA((x) => x.newStarts.push({ id: "n", clientId: base.clients[0].id, count: 1, startDate: base.quarter.asOf, durationMonths: 6, hoursPerWeek: 40, billRate: 90, payRate: 60, committed }));
    const r0 = simulate(base);
    expect(simulate(base, start(true)).confidence.confirmed.revenue).toBeGreaterThan(r0.confidence.confirmed.revenue);
    expect(simulate(base, start(false)).confidence.upside.revenue).toBeGreaterThan(r0.confidence.upside.revenue);
    const opp = base.opportunities[0];
    if (opp) {
      const up = simulate(base, withA((x) => (x.opportunities[opp.id] = { probability: 100 })));
      expect(up.confidence.upside.revenue).toBeGreaterThanOrEqual(r0.confidence.upside.revenue);
      const out = simulate(base, withA((x) => (x.opportunities[opp.id] = { include: false })));
      expect(out.confidence.probable.revenue).toBeLessThanOrEqual(r0.confidence.probable.revenue);
    }
  });

  it("losing a client removes its modeled revenue", () => {
    const client = base.assignments[0].clientId;
    const r = simulate(base, withA((x) => (x.clients[client] = { lose: true })));
    const c = r.clients.find((x) => x.key === client);
    expect(c.modeled.revenue).toBeCloseTo(0, 6);
    expect(r.activity.ends).toBeGreaterThan(simulate(base).activity.ends);
  });

  it("restricted viewers model with cost ratios — no pay data, no NaN", () => {
    expect(restricted.assignments.every((x) => x.payRate == null)).toBe(true);
    expect(restricted.defaults.burdenRate).toBeNull();
    const r = simulate(restricted, withA((x) => (x.global.billRatePct = 5)));
    expect(hasBad(r)).toBe(false);
    expect(r.quarter.gp).toBeGreaterThan(0);
    expect(r.expenses).toBeNull();
  });
});
