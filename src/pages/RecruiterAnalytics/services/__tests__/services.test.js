// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { mockConfig } from "../mockServer/handle";
import {
  getClientDetail,
  getDirectorView,
  getExecutiveOverview,
  getKpiBreakdown,
  getRepSummary,
  getSalespersonView,
  getTrendDrill,
} from "../salesAnalyticsApi";
import { getDataset } from "../../mock/dataset";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { decodeFilters, encodeFilters } from "../../filters/urlCodec";

const EXEC = { userId: "E2" };
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const kpi = (data, key) => data.kpiSections.flatMap((s) => s.tiles).find((t) => t.key === key);

const hasBadNumber = (v) => {
  if (typeof v === "number") return Number.isNaN(v) || v === Infinity || v === -Infinity;
  if (Array.isArray(v)) return v.some(hasBadNumber);
  if (v && typeof v === "object") return Object.values(v).some(hasBadNumber);
  return false;
};

beforeAll(() => {
  mockConfig.latency = false;
});

describe("scope and crediting", { timeout: 60000 }, () => {
  it("rep totals add up to team totals, and teams to the company (shared clients counted once)", async () => {
    const ds = getDataset();
    const filters = { ...DEFAULT_FILTERS, period: "YTD" };
    const company = (await getExecutiveOverview(filters, EXEC)).data;
    const companyRevenue = kpi(company, "revenue").value;

    let teamSum = 0;
    for (const team of ds.org.teams) {
      const t = (await getDirectorView({ ...filters, team: [team.id] }, EXEC)).data;
      const teamRevenue = kpi(t, "revenue").value;
      expect(sum(t.leaderboard.map((r) => r.revenue))).toBeCloseTo(teamRevenue, 2);
      teamSum += teamRevenue;
    }
    expect(teamSum).toBeCloseTo(companyRevenue, 2);
  });

  it("a director sees only their own teams", async () => {
    const d = (await getDirectorView(DEFAULT_FILTERS, { userId: "AM3" })).data;
    expect(d.leaderboard.every((r) => ["T3A", "T3B"].includes(r.teamId))).toBe(true);
  });

  it("a salesperson cannot open the executive or director views, or another rep", async () => {
    await expect(getExecutiveOverview(DEFAULT_FILTERS, { userId: "R03" })).rejects.toThrow();
    await expect(getDirectorView(DEFAULT_FILTERS, { userId: "R03" })).rejects.toThrow();
    const own = (await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" }, { repId: "R10" })).data;
    expect(own.rep.id).toBe("R03");
  });

  it("the access admin sees no business data", async () => {
    await expect(getExecutiveOverview(DEFAULT_FILTERS, { userId: "A1" })).rejects.toThrow();
    await expect(getSalespersonView(DEFAULT_FILTERS, { userId: "A1" })).rejects.toThrow();
  });
});

describe("field masking", { timeout: 60000 }, () => {
  it("withholds cost detail from the restricted rep, on tiles and rows", async () => {
    const { data, meta } = await getSalespersonView(DEFAULT_FILTERS, { userId: "R07" });
    expect(meta.maskedFields).toContain("avgPayRate");
    expect(kpi(data, "avgPayRate").masked).toBe(true);
    expect(kpi(data, "tAndE").value).toBeNull();
    const row = data.clients.find((c) => c.billedHours > 0);
    expect(row.avgPayRate).toBeNull();
    expect(row.wages).toBeNull();
    expect(row.__masked).toContain("avgPayRate");
    expect(row.avgBillRate).not.toBeNull();
    expect(data.insights.some((i) => i.id === "sp-tande")).toBe(false);
  });

  it("shows the same fields to an unrestricted rep", async () => {
    const { data } = await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" });
    expect(kpi(data, "avgPayRate").value).toBeGreaterThan(0);
  });
});

const MANDATORY_DIRECTOR_INSIGHTS = [
  "dir-top-gp", "dir-ytd-over-budget", "dir-top-new-client", "dir-rate-moves",
  "dir-contractor-movement", "dir-cost-growth", "dir-weak-contribution", "dir-underperformers",
];

/** Every insight is shown inside one of the page's KPI sections. */
function expectInsightsInSections(data) {
  const sections = new Set(data.kpiSections.map((s) => s.id));
  for (const i of data.insights) expect(sections.has(i.section), `${i.id} → ${i.section}`).toBe(true);
}

describe("views", { timeout: 60000 }, () => {
  it("executive view is complete and free of NaN / Infinity", async () => {
    for (const compare of ["budget", "target", "board", "forecast", "py", "pp"]) {
      for (const period of ["MTD", "QTD", "YTD", "R12", "PQ"]) {
        const { data } = await getExecutiveOverview({ ...DEFAULT_FILTERS, period, compare }, EXEC);
        expect(hasBadNumber(data)).toBe(false);
        const b = data.bridge;
        expect(b.start.amount + sum(b.steps.map((s) => s.amount))).toBe(b.end.amount);
        // The four insight areas the spec requires are always covered.
        const cats = new Set(data.insights.map((i) => i.category));
        for (const c of ["performance", "cost", "effectiveness", "forecast"]) expect(cats.has(c)).toBe(true);
        expectInsightsInSections(data);
      }
    }
  });

  it("director view always carries the eight mandatory insights", async () => {
    for (const userId of ["E2", "AM1", "AM4"]) {
      const { data } = await getDirectorView({ ...DEFAULT_FILTERS, period: "YTD" }, { userId });
      const ids = new Set(data.insights.map((i) => i.id));
      for (const id of MANDATORY_DIRECTOR_INSIGHTS) expect(ids.has(id)).toBe(true);
      expectInsightsInSections(data);
      expect(hasBadNumber(data)).toBe(false);
    }
  });

  it("salesperson, drills and drawers resolve", async () => {
    const sp = (await getSalespersonView({ ...DEFAULT_FILTERS, period: "YTD" }, { userId: "AM1" }, { repId: "R02" })).data;
    expect(sp.rep.id).toBe("R02");
    expectInsightsInSections(sp);
    expect(sp.clients.length).toBeGreaterThan(0);
    expect(hasBadNumber(sp)).toBe(false);
    const client = sp.clients[0];
    const detail = (await getClientDetail({ ...DEFAULT_FILTERS, period: "YTD" }, { userId: "AM1" }, { repId: "R02", clientId: client.clientId })).data;
    expect(detail.client.id).toBe(client.clientId);
    expect(detail.totals.revenue).toBeCloseTo(client.revenue, 2);

    const months = (await getTrendDrill(DEFAULT_FILTERS, EXEC, { path: [] })).data;
    const verticals = (await getTrendDrill(DEFAULT_FILTERS, EXEC, { path: [{ key: months.rows[months.rows.length - 2].key }] })).data;
    expect(verticals.level).toBe("vertical");
    expect(sum(verticals.rows.map((r) => r.revenue))).toBeCloseTo(months.rows[months.rows.length - 2].revenue, 2);

    for (const kpiKey of ["revenue", "activeContractors", "newClients", "weightedPipeline", "salesContribution", "quarterForecast"]) {
      const b = (await getKpiBreakdown(DEFAULT_FILTERS, EXEC, { kpiKey })).data;
      expect(b.sections.length).toBeGreaterThan(0);
    }
    const rep = (await getRepSummary(DEFAULT_FILTERS, { userId: "AM1" }, { repId: "R02" })).data;
    expect(rep.rep.repId).toBe("R02");
  });

  it("insight text never gives UI instructions", async () => {
    const ui = /\b(click|tab|drawer|filter|button|scroll|hover|panel|select the)\b/i;
    const all = [
      ...(await getExecutiveOverview(DEFAULT_FILTERS, EXEC)).data.insights,
      ...(await getDirectorView(DEFAULT_FILTERS, EXEC)).data.insights,
      ...(await getSalespersonView(DEFAULT_FILTERS, { userId: "R03" })).data.insights,
    ];
    for (const i of all) {
      expect(i.meaning.length).toBeGreaterThan(10);
      expect(i.actions.length).toBeGreaterThan(0);
      for (const text of [i.title, i.meaning, ...i.actions]) expect(text).not.toMatch(ui);
    }
  });

  it("filters narrow the data", async () => {
    const all = kpi((await getExecutiveOverview({ ...DEFAULT_FILTERS, period: "YTD" }, EXEC)).data, "revenue").value;
    const it = (await getExecutiveOverview({ ...DEFAULT_FILTERS, period: "YTD", vertical: ["IT"] }, EXEC));
    expect(kpi(it.data, "revenue").value).toBeLessThan(all);
    expect(it.meta.notes.join(" ")).toMatch(/allocated/);
    const pipelineOnly = await getExecutiveOverview({ ...DEFAULT_FILTERS, stage: ["Interviewing"] }, EXEC);
    expect(pipelineOnly.meta.ignoredFilters).toEqual([]);
  });
});

describe("URL codec", () => {
  it("round-trips and drops defaults", () => {
    const f = { ...DEFAULT_FILTERS, period: "YTD", vertical: ["IT", "HC"], compare: "py" };
    const params = encodeFilters(f);
    expect(params.toString()).toBe("p=YTD&cmp=py&vt=IT%2CHC");
    expect(decodeFilters(params)).toEqual(f);
    expect(encodeFilters(DEFAULT_FILTERS).toString()).toBe("");
  });
});
