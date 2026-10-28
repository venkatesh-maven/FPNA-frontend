import { describe, it, expect } from "vitest";
import {
  DEFAULT_BASIS, basisLabels, basisQueryParams, decodeBasis, encodeBasis,
  isPlanAvailableForFilters, normalizeBasisState, periodSourceBadge,
} from "../comparisonBasis";

const OPTIONS = {
  fingerprint: "Q4:9v2",
  scenarios: { system: ["Base Case", "Best Case", "Worst Case"], custom: { Q4: [{ id: 12, scenario_name: "Upside" }] } },
  final_versions: [{ id: 9, quarter: "Q4", version_number: 2, scenario_name: "Best Case", status: "final" }],
};

describe("comparison basis", () => {
  it("Budget adds no query params, so its URL is unchanged", () => {
    expect(basisQueryParams(DEFAULT_BASIS, "fp")).toEqual({});
  });

  it("query params per basis", () => {
    expect(basisQueryParams({ basis: "forecast" }, "Q4:9v2")).toEqual({ basis: "forecast", basis_rev: "Q4:9v2" });
    expect(basisQueryParams(decodeBasis("system:Best Case"))).toEqual({ basis: "scenario", scenario_name: "Best Case" });
    expect(basisQueryParams(decodeBasis("custom:12:Q4", OPTIONS))).toEqual({ basis: "scenario", scenario_id: 12, basis_quarter: "Q4" });
    expect(basisQueryParams(decodeBasis("version:9", OPTIONS))).toEqual({ basis: "scenario", final_version_id: 9 });
  });

  it("encode / decode round-trip", () => {
    ["budget", "forecast", "system:Worst Case", "custom:12:Q4", "version:9"].forEach((v) => {
      expect(encodeBasis(decodeBasis(v, OPTIONS))).toBe(v);
    });
    expect(decodeBasis("custom:12:Q4", OPTIONS).scenarioName).toBe("Upside");
  });

  it("labels", () => {
    expect(basisLabels(null).columnTop).toBe("Budget");
    expect(basisLabels({ basis: "forecast" })).toMatchObject({ label: "Official Forecast", noun: "forecast" });
    expect(basisLabels(decodeBasis("system:Best Case"))).toMatchObject({ columnBottom: "Best Case", noun: "the Best Case scenario" });
    expect(basisLabels(null, { label: "Scenario: Upside", short_label: "Upside", noun: "the Upside scenario", column_top: "Scenario", column_bottom: "Upside" }).shortLabel).toBe("Upside");
  });

  it("a deleted scenario falls back to the Official Forecast", () => {
    expect(normalizeBasisState(decodeBasis("custom:99:Q4"), OPTIONS).basis).toBe("forecast");
    expect(normalizeBasisState(decodeBasis("version:1"), OPTIONS).basis).toBe("forecast");
    expect(normalizeBasisState(decodeBasis("system:Best Case"), OPTIONS).scenarioName).toBe("Best Case");
    expect(normalizeBasisState(decodeBasis("custom:12:Q4"), OPTIONS).scenarioName).toBe("Upside");
  });

  it("plan is company level only", () => {
    expect(isPlanAvailableForFilters({ entity: null, customer: "" })).toBe(true);
    expect(isPlanAvailableForFilters({ entity: 3 })).toBe(false);
  });

  it("per-month source chips", () => {
    const v = { version_number: 2 };
    expect(periodSourceBadge({ source: "final_snapshot", version: v, quarter: "Q4", source_at_final: "forecast" }, "2025-11").text).toBe("Final v2");
    expect(periodSourceBadge({ source: "final_snapshot", version: v, quarter: "Q4", source_at_final: "actual" }, "2025-10").text).toBe("Actual at finalisation");
    expect(periodSourceBadge({ source: "baseline_forecast", quarter: "Q2" }, "2025-04").text).toBe("Baseline");
    expect(periodSourceBadge({ source: "none" }, "2025-01").text).toBe("—");
  });
});
