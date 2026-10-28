// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { mockConfig } from "../mockServer/handle";
import { getSalesHealth, getSalesHealthOpportunity, getSalesHealthStage } from "../salesHealthApi";
import { getDataset } from "../../mock/dataset";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { MASKED_FIELDS_BY_CAPABILITY } from "../../access/capabilities";

const EXEC = { userId: "E2" };
const REP = { userId: "R03" };
const tileOf = (data, key) => data.kpiSections.flatMap((s) => s.tiles).find((t) => t.key === key);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

const hasBadNumber = (v) => {
  if (typeof v === "number") return Number.isNaN(v) || v === Infinity || v === -Infinity;
  if (Array.isArray(v)) return v.some(hasBadNumber);
  if (v && typeof v === "object") return Object.values(v).some(hasBadNumber);
  return false;
};

const UI_WORDS = /\b(click|tab|drawer|filter|button|scroll|hover|panel|select the)\b/i;

function expectInsightsWellFormed(data) {
  const sections = new Set(data.kpiSections.map((s) => s.id));
  for (const i of data.insights) {
    expect(sections.has(i.section), `${i.id} → ${i.section}`).toBe(true);
    expect(i.meaning.length, i.id).toBeGreaterThan(10);
    expect(i.actions.length, i.id).toBeGreaterThan(0);
    for (const text of [i.title, i.meaning, ...i.actions]) expect(text, i.id).not.toMatch(UI_WORDS);
    if (i.evidence) {
      expect(Array.isArray(i.evidence.columns)).toBe(true);
      expect(Array.isArray(i.evidence.rows)).toBe(true);
    }
    if (i.whatIf) expect(["pipeline", "staffing", "rates"]).toContain(i.whatIf.prefill.focus);
  }
  expect(new Set(data.insights.map((i) => i.id)).size).toBe(data.insights.length);
}

beforeAll(() => {
  mockConfig.latency = false;
});

describe("sales health view", { timeout: 120000 }, () => {
  it("is free of NaN / Infinity across periods and comparison bases, for every role", async () => {
    for (const compare of ["budget", "target", "board", "forecast", "py", "pp"]) {
      for (const period of ["MTD", "QTD", "YTD", "R12", "PQ", "FY"]) {
        const { data } = await getSalesHealth({ ...DEFAULT_FILTERS, period, compare }, EXEC);
        expect(hasBadNumber(data), `${period} vs ${compare}`).toBe(false);
        expectInsightsWellFormed(data);
      }
    }
    for (const viewer of [{ userId: "AM1" }, REP, { userId: "R07" }]) {
      for (const period of ["QTD", "YTD", "R12"]) {
        const { data } = await getSalesHealth({ ...DEFAULT_FILTERS, period, compare: "py" }, viewer);
        expect(hasBadNumber(data), `${viewer.userId} ${period}`).toBe(false);
        expectInsightsWellFormed(data);
      }
    }
  });

  it("covers the spec 11.4 insights for each role", async () => {
    const ids = async (viewer) => new Set((await getSalesHealth({ ...DEFAULT_FILTERS, period: "YTD" }, viewer)).data.insights.map((i) => i.id));
    const exec = await ids(EXEC);
    for (const id of ["health-exec-coverage", "health-exec-concentration", "health-exec-conversion", "health-exec-churn", "health-exec-gp-at-risk"]) expect(exec.has(id), id).toBe(true);
    const dir = await ids({ userId: "AM1" });
    for (const id of ["health-dir-conversion", "health-dir-largest-win", "health-dir-stuck", "health-dir-at-risk", "health-dir-coaching"]) expect(dir.has(id), id).toBe(true);
    const sp = await ids(REP);
    for (const id of ["health-sp-follow-up", "health-sp-expiring", "health-sp-commission"]) expect(sp.has(id), id).toBe(true);
  });

  it("every tile drill and the stage / opportunity drills resolve", async () => {
    const { data } = await getSalesHealth({ ...DEFAULT_FILTERS, period: "YTD" }, EXEC);
    for (const t of data.kpiSections.flatMap((s) => s.tiles)) {
      if (!t.drill) continue;
      const d = data.drills[t.drillKey];
      expect(d, t.key).toBeTruthy();
      for (const s of d.sections) if (s.table) expect(Array.isArray(data.tables[s.table]), `${t.key} → ${s.table}`).toBe(true);
    }
    const stage = (await getSalesHealthStage({ ...DEFAULT_FILTERS, period: "YTD" }, EXEC, { stage: "Interviewing" })).data;
    expect(stage.entries.length).toBe(stage.summary.entered);
    expect(sum(stage.byOwner.map((r) => r.entered))).toBe(stage.summary.entered);
    const funnelRow = data.tables.funnel.find((r) => r.stage === "Interviewing");
    expect(stage.summary.entered).toBe(funnelRow.entered);
    const opp = (await getSalesHealthOpportunity(DEFAULT_FILTERS, EXEC, { opportunityId: data.tables.pipeline[0].id })).data;
    expect(opp.opportunity.id).toBe(data.tables.pipeline[0].id);
    expect(opp.history.length).toBeGreaterThan(0);
  });
});

describe("sales health scope", { timeout: 120000 }, () => {
  it("a salesperson only sees their own opportunities and clients", async () => {
    const ds = getDataset();
    const mine = new Set(ds.clients.filter((c) => c.owners.some((o) => o.repId === "R03")).map((c) => c.id));
    // Naming another rep doesn't widen a salesperson's scope.
    const { data, meta } = await getSalesHealth({ ...DEFAULT_FILTERS, period: "YTD" }, REP, { repId: "R10" });
    expect(meta.scope.kind).toBe("own");
    expect(data.role).toBe("own");
    for (const key of ["pipeline", "winLoss", "slippage", "delayedStarts", "newClientTimeline"]) {
      for (const r of data.tables[key]) expect(r.repId, `${key} ${r.id}`).toBe("R03");
    }
    for (const key of ["churn", "atRisk", "movement", "expiring", "requisitions"]) {
      for (const r of data.tables[key]) expect(mine.has(r.clientId), `${key} ${r.clientId}`).toBe(true);
    }
    expect(data.tables.efficiencyByRep.map((r) => r.repId)).toEqual(["R03"]);
    expect(data.tables.conversionByRep.every((r) => r.repId === "R03")).toBe(true);

    const other = ds.opportunities.find((o) => o.repId === "R10");
    const denied = (await getSalesHealthOpportunity(DEFAULT_FILTERS, REP, { opportunityId: other.id })).data;
    expect(denied.opportunity).toBeNull();
    const stage = (await getSalesHealthStage(DEFAULT_FILTERS, REP, { stage: "Sourcing" })).data;
    expect(stage.entries.every((e) => e.repId === "R03")).toBe(true);
  });

  it("a director sees only their teams, and the access admin sees nothing", async () => {
    const ds = getDataset();
    const teamReps = new Set(ds.org.reps.filter((r) => ["T1A", "T1B"].includes(r.teamId)).map((r) => r.id));
    const { data } = await getSalesHealth(DEFAULT_FILTERS, { userId: "AM1" });
    expect(data.tables.pipeline.every((r) => teamReps.has(r.repId))).toBe(true);
    expect(data.tables.efficiencyByRep.every((r) => teamReps.has(r.repId))).toBe(true);
    await expect(getSalesHealth(DEFAULT_FILTERS, { userId: "A1" })).rejects.toThrow();
  });

  it("team totals never exceed company totals, and team pipelines add up to the company", async () => {
    const ds = getDataset();
    const filters = { ...DEFAULT_FILTERS, period: "YTD" };
    const company = (await getSalesHealth(filters, EXEC)).data;
    const keys = ["openPipeline", "openPipelineGp", "weightedPipeline", "weightedGpPipeline", "openingBillable", "contractorStarts", "contractorEnds", "expiringAssignments", "staleDeals"];
    for (const userId of ["AM1", "AM3", "AM4", "AM5"]) {
      const team = (await getSalesHealth(filters, { userId })).data;
      for (const k of keys) expect(tileOf(team, k).value, `${userId} ${k}`).toBeLessThanOrEqual(tileOf(company, k).value + 1e-6);
      expect(team.lineage.logoChurn.activeAtStart).toBeLessThanOrEqual(company.lineage.logoChurn.activeAtStart);
      expect(team.lineage.clientWinRate.closed).toBeLessThanOrEqual(company.lineage.clientWinRate.closed);
      expect(team.lineage.fillRate.eligible).toBeLessThanOrEqual(company.lineage.fillRate.eligible);
    }
    let teamPipeline = 0;
    let teamDecided = 0;
    for (const t of ds.org.teams) {
      const d = (await getSalesHealth({ ...filters, team: [t.id] }, EXEC)).data;
      teamPipeline += tileOf(d, "openPipeline").value;
      teamDecided += d.lineage.clientWinRate.closed + d.lineage.expansionWinRate.closed;
    }
    // Opportunities have a single owner, so team pipelines and decisions sum exactly to the company.
    expect(teamPipeline).toBeCloseTo(tileOf(company, "openPipeline").value, 2);
    expect(teamDecided).toBe(company.lineage.clientWinRate.closed + company.lineage.expansionWinRate.closed);
  });
});

describe("sales health definitions", { timeout: 120000 }, () => {
  it("rates keep explicit, consistent numerators and denominators", async () => {
    for (const period of ["QTD", "YTD", "R12"]) {
      for (const viewer of [EXEC, { userId: "AM3" }, REP]) {
        const { data } = await getSalesHealth({ ...DEFAULT_FILTERS, period }, viewer);
        const L = data.lineage;
        const pctOf = (n, d) => (d ? (n / d) * 100 : null);

        // Win rates: won + lost = closed; rate = won ÷ closed.
        for (const k of ["clientWinRate", "expansionWinRate"]) {
          expect(L[k].won + L[k].lost).toBe(L[k].closed);
          expect(L[k].rate).toBe(pctOf(L[k].won, L[k].closed));
        }
        const decided = data.tables.winLoss;
        expect(decided.filter((r) => r.dealType === "New client").length).toBe(L.clientWinRate.closed);
        expect(decided.filter((r) => r.status === "won").length).toBe(L.clientWinRate.won + L.expansionWinRate.won);

        // Requisition fill: filled + cancelled + open = eligible; no partial fills.
        expect(L.fillRate.filled + L.fillRate.cancelled + L.fillRate.open).toBe(L.fillRate.eligible);
        expect(L.fillRate.rate).toBe(pctOf(L.fillRate.filled, L.fillRate.eligible));
        expect(sum(data.tables.requisitions.map((r) => r.eligible))).toBe(L.fillRate.eligible);

        // Logo churn: lost ÷ active at start.
        expect(L.logoChurn.lost).toBeLessThanOrEqual(L.logoChurn.activeAtStart);
        expect(L.logoChurn.rate).toBe(pctOf(L.logoChurn.lost, L.logoChurn.activeAtStart));

        // Attrition: closing = opening + starts − ends; ends split into the four end types.
        const a = L.attrition;
        expect(a.closing).toBe(a.opening + a.starts - a.ends);
        expect(a.planned + a.conversion + a.early + a.clientDriven).toBe(a.ends);
        expect(a.rate).toBe(pctOf(a.ends, a.opening));
        expect(sum(data.tables.movement.map((r) => r.ends))).toBe(a.ends);

        // Stage conversion: eligible = advanced + lost; entered = eligible + still in stage.
        const s = L.stageConversion;
        expect(s.advanced + s.lost).toBe(s.eligible);
        expect(s.eligible + s.open).toBe(s.entered);
        for (const row of data.tables.funnel) expect(row.advanced + row.lost + row.open).toBe(row.entered);

        // Retention: gross ≤ net, retained never above the base.
        for (const k of ["revenueRetention", "gpRetention"]) {
          expect(L[k].kept).toBeLessThanOrEqual(L[k].base + 1e-6);
          if (L[k].gross != null) expect(L[k].gross).toBeLessThanOrEqual(L[k].net + 1e-9);
        }
        const bridge = data.retention.gpBridge;
        expect(bridge.start.amount + sum(bridge.steps.map((x) => x.amount))).toBe(bridge.end.amount);

        // Sales cost-to-GP shows its method and lineage.
        expect(L.salesCostToGp.rate).toBe(pctOf(L.salesCostToGp.salesExpense, L.salesCostToGp.gp));
      }
    }
  });

  it("keeps pipeline values separate from actual revenue and won deals separate from billing", async () => {
    const { data } = await getSalesHealth({ ...DEFAULT_FILTERS, period: "YTD" }, EXEC);
    expect(data.tables.pipeline.every((r) => r.status === "open")).toBe(true);
    expect(tileOf(data, "openPipeline").sub).toMatch(/not actual/);
    // Client wins, first fills, first starts and first billing are separate dates.
    for (const r of data.tables.newClientTimeline) {
      if (r.firstStartDate) expect(r.firstStartDate >= r.winDate).toBe(true);
      if (r.firstBillingDate && r.firstStartDate) expect(r.firstBillingDate >= r.firstStartDate).toBe(true);
    }
  });
});

describe("sales health masking", { timeout: 120000 }, () => {
  it("withholds cost detail from the restricted rep without leaking it into insights", async () => {
    const { data, meta } = await getSalesHealth({ ...DEFAULT_FILTERS, period: "YTD" }, { userId: "R07" });
    expect(meta.maskedFields).toContain("tAndE");
    expect(tileOf(data, "tAndE").masked).toBe(true);
    expect(tileOf(data, "acquisition").masked).toBe(true);
    expect(tileOf(data, "salesCostToGp").value).not.toBeNull();
    const row = data.tables.efficiencyByRep[0];
    expect(row.travel).toBeNull();
    expect(row.__masked).toContain("travel");
    const restricted = new Set(MASKED_FIELDS_BY_CAPABILITY.view_cost_detail);
    const leaks = [];
    const walk = (v, path) => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
        if (restricted.has(k) && x != null) leaks.push(`${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    };
    walk(data, "data");
    expect(leaks).toEqual([]);
    const efficiency = data.insights.find((i) => i.section === "health-efficiency" && i.evidence?.rows?.some((r) => r.label === "Travel"));
    expect(efficiency).toBeUndefined();
  });

  it("shows cost detail to an unrestricted rep", async () => {
    const { data } = await getSalesHealth({ ...DEFAULT_FILTERS, period: "YTD" }, REP);
    expect(tileOf(data, "tAndE").value).toBeGreaterThan(0);
  });
});
