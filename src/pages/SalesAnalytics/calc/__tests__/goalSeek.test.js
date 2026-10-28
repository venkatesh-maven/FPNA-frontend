import { beforeAll, describe, expect, it } from "vitest";
import { mockConfig } from "../../services/mockServer/handle";
import { getWhatIfBaseline } from "../../services/salesAnalyticsApi";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { emptyAssumptions, simulate } from "../whatIf";
import { GOAL_METRICS, goalTarget, parseGoal, planForGoal } from "../goalSeek";

mockConfig.latency = false;

let base;
let restricted;
beforeAll(async () => {
  base = (await getWhatIfBaseline(DEFAULT_FILTERS, { userId: "R03" })).data;
  restricted = (await getWhatIfBaseline(DEFAULT_FILTERS, { userId: "R07" })).data;
});

describe("parseGoal", () => {
  it.each([
    ["I need to increase my commision to 15%", { metric: "commission", mode: "pct", value: 15, readAs: "growth" }],
    ["Increase my commission by 15%", { metric: "commission", mode: "pct", value: 15, readAs: null }],
    ["Commission $30K this quarter", { metric: "commission", mode: "abs", value: 30000 }],
    ["add $25K GP", { metric: "gp", mode: "add", value: 25000 }],
    ["Reach 110% of my GP target", { metric: "attainment", mode: "abs", value: 110 }],
    ["hit my target", { metric: "attainment", mode: "abs", value: 100 }],
    ["grow my sales contribution by 10%", { metric: "contribution", mode: "pct", value: 10 }],
    ["revenue 1.2m", { metric: "revenue", mode: "abs", value: 1200000 }],
    ["50,000 more revenue", { metric: "revenue", mode: "add", value: 50000 }],
    ["double my comission", { metric: "commission", mode: "pct", value: 100 }],
  ])("%s", (text, expected) => {
    expect(parseGoal(text)).toMatchObject(expected);
  });

  it("says what's missing", () => {
    expect(parseGoal("make things better").error).toBe("metric");
    expect(parseGoal("increase my commission").error).toBe("amount");
  });

  it("targets", () => {
    expect(goalTarget({ mode: "pct", value: 15 }, 20000)).toBeCloseTo(23000);
    expect(goalTarget({ mode: "add", value: 5000 }, 20000)).toBe(25000);
    expect(goalTarget({ mode: "abs", value: 30000 }, 20000)).toBe(30000);
  });
});

describe("planForGoal", () => {
  const commissionOf = (a) => GOAL_METRICS.commission.value(simulate(base, a));

  it("every reached plan hits the goal with the smallest step of its lever", () => {
    const a0 = emptyAssumptions();
    const target = commissionOf(a0) * 1.15;
    const out = planForGoal(base, a0, "commission", target);
    expect(out.alreadyMet).toBe(false);
    expect(out.plans.length).toBeGreaterThan(2);
    expect(out.plans[0].id).toBe("balanced");
    for (const p of out.plans.filter((x) => x.reached)) {
      expect(commissionOf(p.assumptions)).toBeGreaterThanOrEqual(target - 0.01);
      expect(p.value).toBeCloseTo(commissionOf(p.assumptions), 6);
    }
    const bill = out.plans.find((p) => p.id === "billRate");
    expect(bill.reached).toBe(true);
    const less = emptyAssumptions();
    less.global.billRatePct = Number((bill.levers.billRatePct - 0.1).toFixed(2));
    expect(commissionOf(less)).toBeLessThan(target);
  });

  it("builds on the scenario's own changes and never touches actuals", () => {
    const a0 = emptyAssumptions();
    a0.global.billRatePct = 2;
    const out = planForGoal(base, a0, "gp", simulate(base, a0).quarter.gp + 20000);
    const bill = out.plans.find((p) => p.id === "billRate");
    expect(bill.assumptions.global.billRatePct).toBeGreaterThan(2);
    for (const p of out.plans) expect(simulate(base, p.assumptions).actual).toEqual(simulate(base).actual);
  });

  it("a goal already reached needs no plan", () => {
    const out = planForGoal(base, emptyAssumptions(), "gp", 1);
    expect(out.alreadyMet).toBe(true);
    expect(out.plans).toEqual([]);
  });

  it("a goal out of reach says how far each plan gets", () => {
    const out = planForGoal(base, emptyAssumptions(), "gp", simulate(base).quarter.gp * 10);
    expect(out.plans.every((p) => !p.reached)).toBe(true);
    for (const p of out.plans) expect(p.value).toBeGreaterThan(simulate(base).quarter.gp);
  });

  it("commission goals need commission access; cost-restricted viewers still get plans", () => {
    const out = planForGoal({ ...base, commission: null }, emptyAssumptions(), "commission", 1e6);
    expect(out.now).toBeNull();
    expect(out.plans).toEqual([]);
    expect(restricted.defaults.burdenRate).toBeNull();
    const gp = planForGoal(restricted, emptyAssumptions(), "gp", simulate(restricted).quarter.gp * 1.05, { costDetail: false });
    expect(gp.plans.some((p) => p.reached)).toBe(true);
    const starts = gp.plans.find((p) => p.id === "starts");
    if (starts) expect(starts.assumptions.newStarts[0].payRate).toBeNull();
  });
});
