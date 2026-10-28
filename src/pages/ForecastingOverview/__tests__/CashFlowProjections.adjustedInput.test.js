import { describe, it, expect, beforeEach } from "vitest";
import { toBackendNumber, toCalcNumber, displayEditableNumber } from "../CashFlowProjections.jsx";

/*
 * Same regression coverage as RevenueForecasting — see
 * RevenueForecasting.adjustedInput.test.js for the full root-cause writeup.
 * CashFlowProjections.jsx had the same `parseFloat(val) || 0` +
 * `Number(value).toFixed()` bug on the Summary "Adjusted" cell, and a
 * decimal-truncating `parseFloat` on the Drivers units/rate cells.
 */

describe("Cash Flow Projections — Adjusted amount input empty/zero handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Case 1: initial value 0, typing 13 produces 13 (not 013)", () => {
    expect(displayEditableNumber("13", true)).toBe("13");
    expect(toBackendNumber("13")).toBe(13);
  });

  it("Case 2: initial value 0, Backspace clears the field to empty", () => {
    expect(displayEditableNumber("", true)).toBe("");
    expect(toBackendNumber("")).toBeNull();
  });

  it("Case 3: select-all + typing 5000 over 3895.14 produces 5000", () => {
    expect(displayEditableNumber("5000", true)).toBe("5000");
    expect(displayEditableNumber(5000, false)).toBe(5000);
  });

  it("Case 4: deleting the entire input and blurring saves as 0", () => {
    expect(toBackendNumber("") ?? 0).toBe(0);
    expect(toCalcNumber("")).toBe(0);
  });

  it("keeps decimal values intact", () => {
    expect(toBackendNumber("3895.14")).toBeCloseTo(3895.14);
    expect(displayEditableNumber("13.5", true)).toBe("13.5");
    expect(displayEditableNumber(13.5, false)).toBe(13.5);
  });
});
