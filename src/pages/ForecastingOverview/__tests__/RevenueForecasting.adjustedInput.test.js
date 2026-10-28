import { describe, it, expect, beforeEach } from "vitest";
import { toBackendNumber, toCalcNumber, displayEditableNumber } from "../RevenueForecasting.jsx";

/*
 * Regression tests for the "Adjusted" amount input bug:
 *   - Backspace/Delete couldn't fully clear a "0" default value.
 *   - Typing after a "0" appended instead of replacing ("0" + "13" -> "013").
 *
 * Root cause: `handleAdjChange` ran every keystroke through
 * `parseFloat(val) || 0`, which collapsed "" (and any not-yet-finished
 * number) straight back to 0, and the input's `value` was always
 * `Number(adj).toFixed(precision)`, which turns "" into "0.00".
 *
 * Fix: the input selects its text on focus (so the first keystroke replaces
 * "0" instead of appending), the stored value is the raw typed string while
 * editing, and `displayEditableNumber` only rounds the value once the field
 * is no longer focused. `toBackendNumber`/`toCalcNumber` are what convert
 * that raw string to a real number for calculations and for the save payload.
 */

describe("Adjusted amount input — empty/zero handling", () => {
  beforeEach(() => {
    localStorage.clear(); // getDecimalPrecision() falls back to 2 decimals
  });

  it("Case 1: initial value 0, typing 13 produces 13 (not 013)", () => {
    // onFocus selects the existing "0", so the browser replaces it as the
    // user types; onChange ends up receiving "13" as the raw value.
    expect(displayEditableNumber("13", /* isFocused */ true)).toBe("13");
    expect(toBackendNumber("13")).toBe(13);
  });

  it("Case 2: initial value 0, Backspace clears the field to empty", () => {
    expect(displayEditableNumber("", true)).toBe("");
    // Empty stays empty while editing — toBackendNumber returns null here,
    // it is only coerced to 0 at save time (Case 4).
    expect(toBackendNumber("")).toBeNull();
  });

  it("Case 3: select-all + typing 5000 over 3895.14 produces 5000", () => {
    // While focused, the raw typed string is shown as-is.
    expect(displayEditableNumber("5000", true)).toBe("5000");
    // Once the field blurs, the committed number is rounded/displayed cleanly.
    expect(displayEditableNumber(5000, false)).toBe(5000);
  });

  it("Case 4: deleting the entire input and blurring saves as 0", () => {
    // This mirrors `_doSave`: `toBackendNumber(r.month1_adjusted) ?? 0`.
    expect(toBackendNumber("") ?? 0).toBe(0);
    expect(toCalcNumber("")).toBe(0);
  });

  it("keeps decimal values intact", () => {
    expect(toBackendNumber("3895.14")).toBeCloseTo(3895.14);
    expect(displayEditableNumber("13.5", true)).toBe("13.5");
    expect(displayEditableNumber(13.5, false)).toBe(13.5);
  });
});

/*
 * Regression tests for the "Quarter Total Adjusted" staleness bug: editing a
 * monthly Adjusted cell left the row's Quarter Total Adjusted column showing
 * the server's last-fetched `quarter_total_adjusted_raw` instead of the sum
 * of the (edited) monthly values, and the reduce that computes that sum used
 * raw `+ (value || 0)`, which silently did string concatenation instead of
 * addition whenever a cell held a raw not-yet-finished typed string (the same
 * state `handleAdjChange` stores while a cell is focused/mid-edit).
 *
 * The fix (RevenueForecasting.jsx, the Summary monthly-breakdown table row
 * render): `months.reduce((s, _, i) => s + toCalcNumber(row[...]), 0)`, and
 * the displayed Quarter Total Adjusted is always this live sum — never the
 * stale server-provided raw total.
 */
describe("Quarter Total Adjusted — live recalculation from monthly cells", () => {
  const sumAdjusted = (row, monthCount) => {
    let s = 0;
    for (let i = 1; i <= monthCount; i++) s += toCalcNumber(row[`month${i}_adjusted`]);
    return s;
  };

  it("defaults to the AI total when no month has been edited", () => {
    const row = { month1_adjusted: 100, month2_adjusted: 200, month3_adjusted: 300 };
    expect(sumAdjusted(row, 3)).toBe(600);
  });

  it("recalculates as the sum of edited monthly values, not the stale server total", () => {
    // Simulates: server originally returned quarter_total_adjusted_raw = 600,
    // then the user edited month1 from 100 -> 5999. The displayed quarter
    // total must follow the edit, not stay pinned to the stale raw figure.
    const row = { month1_adjusted: 5999, month2_adjusted: 200, month3_adjusted: 300 };
    expect(sumAdjusted(row, 3)).toBe(6499);
  });

  it("does not corrupt the sum via string concatenation while a cell is mid-edit", () => {
    // month1 is mid-typed ("5999" as a raw string, per the focused-cell
    // pattern) while month2/month3 are already-committed numbers. Plain
    // `0 + "5999" + 200 + 300` would produce the string "5999200300".
    const row = { month1_adjusted: "5999", month2_adjusted: 200, month3_adjusted: 300 };
    expect(sumAdjusted(row, 3)).toBe(6499);
  });

  it("treats an empty in-progress cell as 0, not NaN or a skipped term", () => {
    const row = { month1_adjusted: "", month2_adjusted: 200, month3_adjusted: 300 };
    expect(sumAdjusted(row, 3)).toBe(500);
  });
});
