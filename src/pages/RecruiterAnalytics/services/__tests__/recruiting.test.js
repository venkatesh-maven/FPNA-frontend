import { describe, expect, it } from "vitest";
import { mockConfig } from "../mockServer/handle";
import { getDirectorView, getExecutiveOverview, getKpiBreakdown, getSalespersonView } from "../salesAnalyticsApi";
import { getDataset } from "../../mock/dataset";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";

mockConfig.latency = false;

const EXEC = { userId: "E2" };
const kpi = (data, key) => data.kpiSections.flatMap((s) => s.tiles).find((t) => t.key === key);
const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
const RATES = ["subToInterview", "interviewToOffer", "offerAcceptance", "fillRate", "fallOffRate", "retention90"];

describe("recruiting metrics", { timeout: 60000 }, () => {
  it("every requisition has a consistent candidate funnel", () => {
    const { requisitions, meta } = getDataset();
    for (const r of requisitions) {
      for (const s of r.submittals) {
        expect(s.date >= r.openedDate && s.date <= meta.asOf).toBe(true);
        if (s.interviewDate) expect(s.interviewDate >= s.date).toBe(true);
        if (s.offerDate) expect(s.offerDate >= s.interviewDate).toBe(true);
      }
      if (r.status === "filled") expect(r.submittals.filter((s) => s.outcome === "placed")).toHaveLength(1);
      if (r.status === "open") expect(r.closedDate).toBeNull();
    }
    expect(requisitions.some((r) => r.status === "open")).toBe(true);
  });

  it("recruiters, lead teams and account managers add up to the overview, and rates stay within 0–100%", async () => {
    for (const period of ["QTD", "YTD", "R12"]) {
      const { data } = await getExecutiveOverview({ ...DEFAULT_FILTERS, period }, EXEC);
      const { recruiters, leadTeams, accountManagers } = data.recruiting;
      for (const key of ["opened", "submittals", "interviews", "offers", "placements"]) {
        const total = kpi(data, key).value;
        expect(sum(recruiters, key)).toBe(total);
        expect(sum(leadTeams, key)).toBe(total);
        expect(sum(accountManagers, key)).toBe(total);
      }
      for (const key of RATES) {
        const v = kpi(data, key).value;
        if (v != null) expect(v >= 0 && v <= 100, `${period} ${key} = ${v}`).toBe(true);
      }
      expect(kpi(data, "openJobOrders").value).toBeGreaterThan(0);
    }
  });

  it("a recruiting director sees only their own org", async () => {
    const company = (await getExecutiveOverview({ ...DEFAULT_FILTERS, period: "YTD" }, EXEC)).data;
    const east = (await getExecutiveOverview({ ...DEFAULT_FILTERS, period: "YTD" }, { userId: "RD1" })).data;
    const west = (await getExecutiveOverview({ ...DEFAULT_FILTERS, period: "YTD" }, { userId: "RD2" })).data;
    expect(kpi(east, "placements").value + kpi(west, "placements").value).toBe(kpi(company, "placements").value);
    expect(east.recruiting.recruiters.length + west.recruiting.recruiters.length).toBe(company.recruiting.recruiters.length);
  });

  it("every recruiting tile drills down", async () => {
    const { data } = await getExecutiveOverview(DEFAULT_FILTERS, EXEC);
    const keys = data.kpiSections.filter((s) => ["activity", "conversion", "speed", "productivity"].includes(s.id)).flatMap((s) => s.tiles.map((t) => t.key));
    for (const kpiKey of keys) {
      const b = (await getKpiBreakdown(DEFAULT_FILTERS, EXEC, { kpiKey })).data;
      expect(b.sections.length, kpiKey).toBeGreaterThan(0);
    }
  });
  it("contractors and billing lead each screen and add up across the hierarchy", async () => {
    const close = (a, b) => expect(Math.abs(a - b)).toBeLessThan(0.01);
    const { data } = await getExecutiveOverview(DEFAULT_FILTERS, EXEC);
    expect(data.kpiSections.map((s) => s.id).slice(0, 3)).toEqual(["staffing", "financial", "productivity"]);
    const { recruiters, leadTeams, accountManagers } = data.recruiting;
    for (const key of ["billRevenue", "billedHours", "activeContractors"]) {
      const total = kpi(data, key).value;
      close(sum(recruiters, key), total);
      close(sum(leadTeams, key), total);
      close(sum(accountManagers, key), total);
    }
    expect(data.billingMonthly).toHaveLength(12);
    expect(data.billingMonthly.at(-1).billRevenue).toBeGreaterThan(0);

    const drill = (await getKpiBreakdown(DEFAULT_FILTERS, EXEC, { kpiKey: "billRevenue" })).data;
    expect(drill.sections[0].title).toBe("By recruiter");

    const team = (await getDirectorView(DEFAULT_FILTERS, { userId: "AM1" })).data;
    expect(team.kpiSections[0].id).toBe("team-staffing");
    close(sum(team.leaderboard, "billRevenue"), kpi(team, "billRevenue").value);

    const mine = (await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" })).data;
    expect(mine.kpiSections[0].id).toBe("my-staffing");
    expect(kpi(mine, "billRevenue").value).toBeGreaterThan(0);
  });
});
