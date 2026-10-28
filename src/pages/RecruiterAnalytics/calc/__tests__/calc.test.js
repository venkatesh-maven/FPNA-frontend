// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addMonths, dayDiff, fiscalQuarterStart, fiscalYearLabel, monthRange } from "../dates";
import { compareWindow, resolvePeriod } from "../periods";
import { burdenFor, FUTA_WAGE_BASE } from "../economics";
import { ppDelta, variance } from "../variance";
import { roundPreservingSum } from "../rounding";
import { gpBridge, twoFactorBridge } from "../bridge";
import { toWaterfallRows } from "../waterfall";
import { applySortPreset, sortRows, toCsvRows, visibleColumns } from "../table";
import { winRate } from "../metrics";

const AS_OF = "2026-10-16";
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

describe("dates", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(dayDiff("2026-02-27", "2026-03-02")).toBe(3);
  });

  it("handles a non-January fiscal year", () => {
    expect(fiscalQuarterStart("2026-06", 4)).toBe("2026-04");
    expect(fiscalQuarterStart("2026-03", 4)).toBe("2026-01");
    expect(fiscalYearLabel("2026-05", 4)).toBe("FY2027");
  });
});

describe("periods", () => {
  it("marks the as-of month as partial", () => {
    const p = resolvePeriod({ preset: "QTD" }, { asOf: AS_OF });
    expect(p.months).toEqual(["2026-10"]);
    expect(p.elapsed[0].fraction).toBeCloseTo(16 / 31);
    expect(p.isPartial).toBe(true);
    expect(p.endDate).toBe(AS_OF);
  });

  it("YTD, FY, R12 and prior quarter", () => {
    expect(resolvePeriod({ preset: "YTD" }, { asOf: AS_OF }).months).toHaveLength(10);
    const fy = resolvePeriod({ preset: "FY" }, { asOf: AS_OF });
    expect(fy.months).toHaveLength(12);
    expect(fy.elapsed).toHaveLength(10);
    const r12 = resolvePeriod({ preset: "R12" }, { asOf: AS_OF });
    expect(r12.from).toBe("2025-10");
    expect(r12.to).toBe("2026-09");
    expect(r12.elapsed.every((e) => e.fraction === 1)).toBe(true);
    const pq = resolvePeriod({ preset: "PQ" }, { asOf: AS_OF });
    expect(pq.months).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("compares like-for-like elapsed days", () => {
    const p = resolvePeriod({ preset: "MTD" }, { asOf: AS_OF });
    const py = compareWindow(p, "py");
    expect(py.elapsed[0]).toMatchObject({ ym: "2025-10", mapsTo: "2026-10" });
    expect(py.elapsed[0].fraction).toBeCloseTo(16 / 31);
    const pp = compareWindow(resolvePeriod({ preset: "PQ" }, { asOf: AS_OF }), "pp");
    expect(pp.elapsed.map((e) => e.ym)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(compareWindow(p, "budget").kind).toBe("plan");
  });

  it("custom ranges never invert", () => {
    const p = resolvePeriod({ preset: "CUSTOM", from: "2026-03", to: "2026-01" }, { asOf: AS_OF });
    expect(p.months).toEqual(["2026-03"]);
  });
});

describe("economics", () => {
  it("caps FUTA and SUTA at the wage base", () => {
    const first = burdenFor({ ytdWagesBefore: 0, wages: 5000, sutaRate: 0.03, sutaWageBase: 10000, wcRate: 0.01, paidHours: 100, benefitsPerHour: 2 });
    expect(first.futa).toBeCloseTo(30);
    expect(first.suta).toBeCloseTo(150);
    expect(first.benefits).toBe(200);
    const later = burdenFor({ ytdWagesBefore: FUTA_WAGE_BASE + 5000, wages: 5000, sutaRate: 0.03, sutaWageBase: 10000, wcRate: 0.01, paidHours: 100 });
    expect(later.futa).toBe(0);
    expect(later.suta).toBe(0);
    expect(later.fica).toBeCloseTo(382.5);
  });
});

describe("variance", () => {
  it("handles cost direction and zero bases", () => {
    expect(variance(110, 100)).toMatchObject({ abs: 10, pct: 10, favorable: true });
    expect(variance(110, 100, { lowerIsBetter: true }).favorable).toBe(false);
    expect(variance(5, 0).pct).toBeNull();
    expect(variance(null, 4)).toBeNull();
    expect(ppDelta(31.5, 30).pp).toBeCloseTo(1.5);
  });

  it("win rate", () => {
    expect(winRate(3, 1)).toBe(75);
    expect(winRate(0, 0)).toBeNull();
  });
});

describe("rounding", () => {
  it("keeps rounded parts adding up to the rounded total", () => {
    const parts = [10.4, 20.4, 30.4, -5.6];
    const r = roundPreservingSum(parts);
    expect(sum(r)).toBe(Math.round(sum(parts)));
    expect(r.every(Number.isInteger)).toBe(true);
  });
});

const seg = (H, N, bill, pay, u) => ({ H, N, R: H * bill, W: H * pay, burden: H * pay * u });

describe("GP bridge", () => {
  const base = {
    segments: new Map([
      ["a", seg(1000, 6, 60, 40, 0.15)],
      ["b", seg(500, 3, 30, 21, 0.2)],
    ]),
    odc: 300,
    fees: 1000,
  };
  const current = {
    segments: new Map([
      ["a", seg(1200, 7, 62, 42, 0.14)],
      ["c", seg(300, 2, 45, 30, 0.18)], // new client
    ]),
    odc: 450,
    fees: 0,
  };

  it("steps sum exactly to the GP change", () => {
    const b = gpBridge(base, current);
    expect(sum(b.steps.map((s) => s.amount))).toBeCloseTo(b.currentGp - b.baseGp, 6);
  });

  it("puts a new client's effect in mix, not in rates", () => {
    const only = gpBridge(
      { segments: new Map([["a", seg(1000, 6, 60, 40, 0.15)]]), odc: 0, fees: 0 },
      { segments: new Map([["a", seg(1000, 6, 60, 40, 0.15)], ["c", seg(300, 2, 45, 30, 0.18)]]), odc: 0, fees: 0 }
    );
    const step = (k) => only.steps.find((s) => s.key === k).amount;
    expect(step("billRate")).toBeCloseTo(0);
    expect(step("payRate")).toBeCloseTo(0);
    expect(step("burden")).toBeCloseTo(0);
    expect(sum(only.steps.map((s) => s.amount))).toBeCloseTo(only.currentGp - only.baseGp, 6);
  });

  it("isolates a pure bill-rate change", () => {
    const b = gpBridge(
      { segments: new Map([["a", seg(1000, 6, 60, 40, 0.15)]]), odc: 0, fees: 0 },
      { segments: new Map([["a", seg(1000, 6, 62, 40, 0.15)]]), odc: 0, fees: 0 }
    );
    expect(b.steps.find((s) => s.key === "billRate").amount).toBeCloseTo(2000);
    expect(b.steps.find((s) => s.key === "volume").amount).toBeCloseTo(0);
  });

  it("treats an empty base as all volume", () => {
    const b = gpBridge({ segments: new Map(), odc: 0, fees: 0 }, current);
    expect(sum(b.steps.map((s) => s.amount))).toBeCloseTo(b.currentGp - b.baseGp, 6);
  });

  it("two-factor bridge adds up", () => {
    const b = twoFactorBridge({ revenue: 1000, gp: 250 }, { revenue: 1200, gp: 330 });
    expect(sum(b.steps.map((s) => s.amount))).toBeCloseTo(80);
    expect(b.steps[0].amount).toBeCloseTo(50);
  });
});

describe("waterfall", () => {
  it("floats effects from the running total", () => {
    const rows = toWaterfallRows([
      { label: "Base", amount: 100, type: "total" },
      { label: "Up", amount: 30 },
      { label: "Down", amount: -50 },
      { label: "End", amount: 80, type: "total" },
    ]);
    expect(rows[1]).toMatchObject({ base: 100, value: 30, kind: "up" });
    expect(rows[2]).toMatchObject({ base: 80, value: 50, kind: "down" });
  });
});

describe("table helpers", () => {
  const rows = [{ n: "a", v: 3 }, { n: "b", v: null }, { n: "c", v: 9 }];
  it("sorts with blanks last", () => {
    expect(sortRows(rows, "v", "desc").map((r) => r.n)).toEqual(["c", "a", "b"]);
    expect(sortRows(rows, "v", "asc").map((r) => r.n)).toEqual(["a", "c", "b"]);
  });
  it("applies preset filters", () => {
    expect(applySortPreset(rows, { key: "v", dir: "desc", filter: (r) => r.v > 5 })).toHaveLength(1);
  });
  it("exports visible columns and marks restricted cells", () => {
    const cols = visibleColumns(
      [{ id: "id", always: true, columns: [{ key: "n", label: "Name" }] }, { id: "x", columns: [{ key: "v", label: "Value" }] }],
      ["x"]
    );
    const csv = toCsvRows(cols, [{ n: "a", v: 1.234, __masked: [] }, { n: "b", v: 2, __masked: ["v"] }]);
    expect(csv).toEqual([["Name", "Value"], ["a", 1.23], ["b", "Restricted"]]);
  });
});