import { describe, it, expect } from "vitest";
import {
  fiscalYearPeriods, periodBucketLabel, fiscalQuarterPeriods,
  displayPeriods, bucketMonths, proportionalSplit,
} from "../budgetHelpers.jsx";

/*
 * Planning Frequency (Monthly/Quarterly/Annual) bucketing — these pure
 * functions must mirror FPNA-Backend/src/budget/fiscal_utils.py's
 * fiscal_year_periods()/period_bucket_label()/fiscal_quarter_periods()/
 * resolve_bucket_periods() byte-for-byte, since a bucket label generated
 * here is sent straight back to the backend in a PATCH and re-parsed there.
 * A January-start fiscal year collapses to plain calendar-year math, so the
 * highest-risk case (and the one most likely to expose an off-by-one) is a
 * non-January fiscal year start.
 */

describe("fiscalYearPeriods", () => {
  it("January-start collapses to the plain calendar year", () => {
    expect(fiscalYearPeriods(2027, 1)).toEqual([
      "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06",
      "2027-07", "2027-08", "2027-09", "2027-10", "2027-11", "2027-12",
    ]);
  });

  it("non-January start rolls over into the next calendar year", () => {
    // FY2027 starting in April means Apr 2027 - Mar 2028.
    expect(fiscalYearPeriods(2027, 4)).toEqual([
      "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09",
      "2027-10", "2027-11", "2027-12", "2028-01", "2028-02", "2028-03",
    ]);
  });
});

describe("periodBucketLabel", () => {
  it("formats annual and quarterly labels", () => {
    expect(periodBucketLabel(2027)).toBe("FY2027");
    expect(periodBucketLabel(2027, 1)).toBe("Q1 FY2027");
    expect(periodBucketLabel(2027, 4)).toBe("Q4 FY2027");
  });
});

describe("fiscalQuarterPeriods", () => {
  it("chunks a January-start year into 4 groups of 3, in order", () => {
    const q = fiscalQuarterPeriods(2027, 1);
    expect(Object.keys(q)).toEqual(["Q1 FY2027", "Q2 FY2027", "Q3 FY2027", "Q4 FY2027"]);
    expect(q["Q1 FY2027"]).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(q["Q4 FY2027"]).toEqual(["2027-10", "2027-11", "2027-12"]);
  });

  it("chunks a non-January-start year correctly, including the calendar-year rollover", () => {
    const q = fiscalQuarterPeriods(2027, 4); // FY2027 = Apr 2027 - Mar 2028
    expect(Object.keys(q)).toEqual(["Q1 FY2027", "Q2 FY2027", "Q3 FY2027", "Q4 FY2027"]);
    expect(q["Q1 FY2027"]).toEqual(["2027-04", "2027-05", "2027-06"]);
    expect(q["Q4 FY2027"]).toEqual(["2028-01", "2028-02", "2028-03"]);
  });
});

describe("displayPeriods / bucketMonths — round trip", () => {
  const months = fiscalYearPeriods(2027, 4);

  it("Monthly passes the real periods through unchanged", () => {
    expect(displayPeriods("Monthly", 4, 2027, months)).toEqual(months);
    months.forEach((m) => expect(bucketMonths("Monthly", 4, 2027, m)).toEqual([m]));
  });

  it("Annual collapses to one label covering all 12 months", () => {
    const labels = displayPeriods("Annual", 4, 2027, months);
    expect(labels).toEqual(["FY2027"]);
    expect(bucketMonths("Annual", 4, 2027, "FY2027")).toEqual(months);
  });

  it("Quarterly produces 4 labels whose months round-trip back to the original chunks", () => {
    const labels = displayPeriods("Quarterly", 4, 2027, months);
    expect(labels).toEqual(["Q1 FY2027", "Q2 FY2027", "Q3 FY2027", "Q4 FY2027"]);
    labels.forEach((label, i) => {
      const expectedChunk = months.slice(i * 3, i * 3 + 3);
      expect(bucketMonths("Quarterly", 4, 2027, label)).toEqual(expectedChunk);
    });
  });
});

describe("proportionalSplit", () => {
  it("splits proportional to each weight's share of the total, preserving shape", () => {
    // 40/30/30 AI shape -> a typed 1000 total splits 400/300/300.
    expect(proportionalSplit(1000, [40, 30, 30])).toEqual([400, 300, 300]);
  });

  it("falls back to an even split when every weight is 0 (no AI shape to preserve)", () => {
    expect(proportionalSplit(900, [0, 0, 0])).toEqual([300, 300, 300]);
  });

  it("returns an empty array for an empty weight list", () => {
    expect(proportionalSplit(1000, [])).toEqual([]);
  });

  it("handles a single non-zero weight among zeros as taking the full share", () => {
    expect(proportionalSplit(500, [0, 500, 0])).toEqual([0, 500, 0]);
  });
});
