import { describe, it, expect } from "vitest";
import { toCalcNumber } from "../ScenarioModeling.jsx";

/*
 * ScenarioModeling.jsx's "Create/Edit Scenario" driver_value inputs had the
 * same `parseFloat(val) || 0` bug as the other Adjusted inputs: the input's
 * value is bound directly to the numeric state with no formatting layer, so
 * the fix here is to stop coercing to 0 on every keystroke (updateRev/
 * updateCost now store the raw value) and only resolve to a number via
 * toCalcNumber when actually needed (cross-calc / save-time filtering).
 */

describe("Scenario Modeling — driver_value input empty/zero handling", () => {
  it("Case 1: typing 13 keeps the raw value (no leading-zero corruption)", () => {
    expect(toCalcNumber("13")).toBe(13);
  });

  it("Case 2: clearing the field resolves to 0 instead of NaN", () => {
    expect(toCalcNumber("")).toBe(0);
  });

  it("Case 3: a fully retyped value resolves correctly", () => {
    expect(toCalcNumber("5000")).toBe(5000);
  });

  it("Case 4: invalid/empty input saves as 0", () => {
    expect(toCalcNumber(null)).toBe(0);
    expect(toCalcNumber(undefined)).toBe(0);
  });

  it("keeps decimal values intact", () => {
    expect(toCalcNumber("13.5")).toBeCloseTo(13.5);
  });
});
