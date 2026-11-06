import { describe, expect, it } from "vitest";
import {
  badgeFor,
  formatDay,
  formatPct,
  formatUsd,
  grantSourceLabel,
  headerPillFor,
  providerIssueText,
  requestStatusInfo,
  statusInfo,
  validateRequest,
} from "../creditFormat";

describe("formatUsd", () => {
  it("keeps 4 decimals for sub-dollar amounts and 2 otherwise", () => {
    expect(formatUsd(0.0051)).toBe("$0.0051");
    expect(formatUsd(37.6)).toBe("$37.60");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(null)).toBe("$0.00");
  });
});

describe("formatPct / formatDay", () => {
  it("formats percentages and handles missing values", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(75.24)).toBe("75.2%");
  });
  it("formats UTC days without shifting them", () => {
    expect(formatDay("2026-11-04")).toBe("Nov 4");
    expect(formatDay("bad")).toBe("bad");
  });
});

describe("badgeFor", () => {
  const ok = { status: "ok", remaining_pct: 75 };
  it("admins always see the percentage", () => {
    expect(badgeFor(ok, true)).toEqual({ status: "ok", text: "75.0% credits left" });
  });
  it("other users only see low / used-up warnings", () => {
    expect(badgeFor(ok, false)).toBeNull();
    expect(badgeFor({ status: "low", remaining_pct: 12 }, false).text).toBe("AI credits low · 12.0% left");
    expect(badgeFor({ status: "exhausted" }, false).text).toBe("AI credits used up — ask your admin");
  });
  it("tells admins what to do when used up, and shows a pending request", () => {
    expect(badgeFor({ status: "exhausted" }, true).text).toBe("AI credits used up · request more");
    expect(badgeFor({ status: "exhausted", has_pending_request: true }, false).text).toBe("AI credits used up · request pending");
  });
  it("shows nothing before the summary loads", () => {
    expect(badgeFor(null, true)).toBeNull();
  });
});

describe("headerPillFor", () => {
  it("shows a rounded percentage with a plain tooltip", () => {
    expect(headerPillFor({ status: "ok", remaining_pct: 74.6 })).toEqual({
      text: "AI credits 75%", title: "75% of your AI credits left",
    });
    expect(headerPillFor({ status: "low", remaining_pct: 12.2 }).title).toBe("AI credits running low: 12% left");
  });
  it("explains a used-up balance, with or without a pending request", () => {
    expect(headerPillFor({ status: "exhausted", remaining_pct: 0 }).text).toBe("AI credits 0%");
    expect(headerPillFor({ status: "exhausted", remaining_pct: 0 }).title).toMatch(/paused/);
    expect(headerPillFor({ status: "exhausted", remaining_pct: 0, has_pending_request: true }).title).toMatch(/waiting/);
  });
  it("shows nothing until loaded", () => {
    expect(headerPillFor(null)).toBeNull();
    expect(headerPillFor({ status: "ok" })).toBeNull();
  });
});

describe("validateRequest", () => {
  it("accepts 0 < amount <= 10,000", () => {
    expect(validateRequest("20")).toBeNull();
    expect(validateRequest("10000")).toBeNull();
    expect(validateRequest("")).toMatch(/Enter an amount/);
    expect(validateRequest("abc")).toMatch(/Enter an amount/);
    expect(validateRequest("0")).toMatch(/more than/);
    expect(validateRequest("10001")).toMatch(/10,000/);
  });
});

describe("labels", () => {
  it("maps statuses, sources and provider issues", () => {
    expect(statusInfo("weird").label).toBe("Used up");
    expect(requestStatusInfo("granted").label).toBe("Approved");
    expect(grantSourceLabel("starting")).toBe("Starting credits");
    expect(providerIssueText(null)).toBeNull();
    expect(providerIssueText("insufficient_quota")).toMatch(/topped up/);
    expect(providerIssueText("http_500")).toMatch(/provider side/);
  });
});
