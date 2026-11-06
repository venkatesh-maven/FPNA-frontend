import { describe, expect, it } from "vitest";
import { buildLiveDataset } from "../liveDataset";

// A two-client, two-month company in the server's column format.
const payload = () => ({
  meta: { asOf: "2025-03-31", startYm: "2025-02", fiscalStartMonth: 1, version: 1, hasForecast: true, defaultDurationMonths: 12 },
  months: ["2025-02", "2025-03", "2025-04"],
  teams: [{ id: "M1", name: "Mia's team", directorId: "D1" }],
  directors: [{ id: "D1", name: "Dee", title: "VP Sales" }],
  reps: { id: ["R1", "R2"], name: ["Ann", "Ben"], title: ["Rep", "Rep"], teamId: ["M1", null], region: ["NA", "EMEA"], vertical: ["Finance", "Retail"], hireDate: [null, null], baseSalary: [90000, null] },
  clients: {
    id: ["Acme", "Bolt"],
    vertical: ["Finance", "Retail"],
    region: ["NA", "EMEA"],
    segment: ["SMB", "Enterprise"],
    acquiredDate: ["2024-03-10", null],
    owners: [[[0, 0.333333], [1, 0.666666]], [[1, 1]]],
  },
  revenue: { c: [0, 1, 0], m: [0, 1, 1], v: [100, 1000, 400] },
  cogsRate: [0.25, 0.4, 0],
  budget: { c: [0], m: [1], v: [500] },
  budgetCogsRate: [0, 0.5, 0],
  forecast: { c: [1], m: [2], v: [300] },
  companyRevenue: [100, 1400, 0],
  budgetRevenue: [0, 500, 0],
  pools: { salary: [0, 140, 0], travel: [0, 14, 0], budgetSalary: [0, 0, 0], budgetTravel: [0, 0, 0] },
  deals: {
    id: ["O1", "O2"], client: [0, null], name: ["Acme CRM", "Prospect"], rep: [0, 1], vertical: ["Finance", "Retail"],
    region: ["NA", "EMEA"], segment: ["SMB", "SMB"], type: ["expansion", "new_logo"], stage: ["Won", "Proposal"],
    status: ["won", "open"], probability: [1, 0.5], amount: [300, 800], created: ["2025-01-05", "2025-03-01"],
    closed: ["2025-03-10", null], source: ["Paid Search", null], duration: [6, null],
  },
  margin: 0.6,
});

describe("live dataset", () => {
  const ds = buildLiveDataset(payload());

  it("keeps every client's owner shares at exactly one", () => {
    const acme = ds.index.clientById.get("Acme");
    expect(acme.owners.reduce((s, o) => s + o.share, 0)).toBeCloseTo(1, 12);
    expect(acme.owners.map((o) => o.repId)).toEqual(["R1", "R2"]);
  });

  it("turns ledger revenue into monthly actuals with GP at the month's COGS rate", () => {
    const march = ds.facts.filter((f) => f.ym === "2025-03");
    expect(march.reduce((s, f) => s + f.revenue, 0)).toBe(1400);
    const acme = march.find((f) => f.clientId === "Acme");
    expect(acme.gp).toBeCloseTo(240);
    expect(acme.kind).toBe("invoice");
    expect(acme.billedHours).toBe(0);
  });

  it("carries budget as the target and forecast for later months, and no Board Plan", () => {
    const march = ds.plans.find((p) => p.clientId === "Acme" && p.ym === "2025-03");
    expect(march.budget).toEqual({ revenue: 500, gp: 250 });
    expect(march.target).toBe(march.budget);
    expect(march.board).toBeNull();
    const april = ds.plans.find((p) => p.clientId === "Bolt" && p.ym === "2025-04");
    expect(april.budget).toBeNull();
    expect(april.forecast.revenue).toBe(300);
    expect(april.forecast.gp).toBeCloseTo(300 * (1 - (0.25 * 100 + 0.4 * 1400) / 1500)); // the trailing COGS rate
  });

  it("shares the Sales department's payroll and travel by revenue", () => {
    const ann = ds.expenses.filter((e) => e.repId === "R1" && e.ym === "2025-03");
    expect(ann.find((e) => e.category === "salary").amount).toBeCloseTo((140 * 400 * (0.333333 / 0.999999)) / 1400);
    expect(ann.every((e) => e.status === "posted")).toBe(true);
  });

  it("maps deals without inventing what the CRM doesn't hold", () => {
    const open = ds.index.opportunityById.get("O2");
    expect(open.clientId).toBeNull();
    expect(open.expectedStart).toBe("2025-04-01");
    expect(open.durationMonths).toBe(12);
    expect(open.headcount).toBe(0);
    expect(open.pushes).toEqual([]);
    expect(open.closeDate).toBeNull();
    const won = ds.index.opportunityById.get("O1");
    expect(won.wonDate).toBe("2025-03-10");
    expect(won.durationMonths).toBe(6);
    expect(won.stageHistory.map((h) => h.stage)).toEqual(["Prospect", "Won"]);
  });

  it("builds people for every role, with a company view first", () => {
    expect(ds.org.people[0]).toMatchObject({ id: "E1", role: "executive" });
    expect(ds.org.people.find((p) => p.id === "D1").role).toBe("director");
    expect(ds.index.repById.get("R2").teamId).toBe("NO-TEAM");
    expect(ds.org.teams.map((t) => t.id)).toEqual(["M1", "NO-TEAM"]);
    expect(ds.contractors).toEqual([]);
    expect(ds.meta.live).toBe(true);
  });
});
