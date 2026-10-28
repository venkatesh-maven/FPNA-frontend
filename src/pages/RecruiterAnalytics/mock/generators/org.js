import { FIRST_NAMES, LAST_NAMES } from "../seedLists";

export const BUSINESS_UNITS = [
  { id: "BU-COM", name: "Commercial Staffing" },
  { id: "BU-PRO", name: "Professional Staffing" },
];

export const REGIONS = [
  { id: "NE", name: "Northeast" },
  { id: "SE", name: "Southeast" },
  { id: "MW", name: "Midwest" },
  { id: "WE", name: "West" },
];

// SUTA rate / wage base are representative experience rates, not statutory facts.
export const BRANCHES = [
  { id: "BOS", name: "Boston", regionId: "NE", state: "MA", sutaRate: 0.0242, sutaWageBase: 15000 },
  { id: "NYC", name: "New York", regionId: "NE", state: "NY", sutaRate: 0.041, sutaWageBase: 12800 },
  { id: "PHL", name: "Philadelphia", regionId: "NE", state: "PA", sutaRate: 0.0382, sutaWageBase: 10000 },
  { id: "ATL", name: "Atlanta", regionId: "SE", state: "GA", sutaRate: 0.027, sutaWageBase: 9500 },
  { id: "CLT", name: "Charlotte", regionId: "SE", state: "NC", sutaRate: 0.01, sutaWageBase: 31400 },
  { id: "CHI", name: "Chicago", regionId: "MW", state: "IL", sutaRate: 0.0395, sutaWageBase: 13590 },
  { id: "CMH", name: "Columbus", regionId: "MW", state: "OH", sutaRate: 0.027, sutaWageBase: 9000 },
  { id: "DEN", name: "Denver", regionId: "WE", state: "CO", sutaRate: 0.017, sutaWageBase: 23800 },
  { id: "PHX", name: "Phoenix", regionId: "WE", state: "AZ", sutaRate: 0.02, sutaWageBase: 8000 },
  { id: "SEA", name: "Seattle", regionId: "WE", state: "WA", sutaRate: 0.0123, sutaWageBase: 68500 },
];

export const VERTICALS = [
  { id: "IT", name: "IT", buId: "BU-PRO", pay: [45, 85], markup: [1.45, 1.65], weeklyHours: [40, 40], wcRate: 0.004, salary: [95000, 150000] },
  { id: "HC", name: "Healthcare", buId: "BU-PRO", pay: [34, 58], markup: [1.4, 1.55], weeklyHours: [36, 40], wcRate: 0.015, salary: [70000, 110000] },
  { id: "FA", name: "Finance & Accounting", buId: "BU-PRO", pay: [28, 52], markup: [1.45, 1.6], weeklyHours: [38, 40], wcRate: 0.003, salary: [65000, 115000] },
  { id: "ENG", name: "Engineering", buId: "BU-PRO", pay: [40, 75], markup: [1.45, 1.6], weeklyHours: [40, 40], wcRate: 0.012, salary: [85000, 135000] },
  { id: "LI", name: "Light Industrial", buId: "BU-COM", pay: [16, 23], markup: [1.38, 1.52], weeklyHours: [40, 46], wcRate: 0.055, salary: [40000, 55000] },
  { id: "ADM", name: "Administrative", buId: "BU-COM", pay: [18, 27], markup: [1.4, 1.55], weeklyHours: [37.5, 40], wcRate: 0.003, salary: [42000, 62000] },
];

export const SERVICE_LINES = [
  { id: "AUG", name: "Staff Augmentation" },
  { id: "SOW", name: "Project / SOW" },
  { id: "PAY", name: "Payroll Services" },
  { id: "PERM", name: "Permanent Placement" },
];

const TEAM_DEFS = [
  { id: "T1", name: "Northeast Professional", directorId: "D1", branchIds: ["BOS", "NYC"], verticals: ["IT", "FA", "ENG"], size: 6 },
  { id: "T2", name: "Northeast Commercial", directorId: "D1", branchIds: ["PHL", "NYC"], verticals: ["LI", "ADM", "HC"], size: 6 },
  { id: "T3", name: "Southeast", directorId: "D2", branchIds: ["ATL", "CLT"], verticals: ["HC", "LI", "IT", "ADM"], size: 5 },
  { id: "T4", name: "Midwest", directorId: "D3", branchIds: ["CHI", "CMH"], verticals: ["LI", "ENG", "FA", "IT"], size: 6 },
  { id: "T5", name: "West", directorId: "D4", branchIds: ["DEN", "PHX", "SEA"], verticals: ["IT", "HC", "ADM", "ENG"], size: 5 },
];

// Desk org shared with the Sales Analytics sample (same seed and streams).
// toRecruitingOrg (recruiting.js) keeps only the CEO, finance and the access
// admin from this list and replaces D1–D4, E1 and the desk titles below with
// the Recruiting Director / Account Manager / Recruiter Lead / Recruiter layers,
// so these titles never reach the screen.
const FIXED_PEOPLE = [
  { id: "E1", name: "Morgan Hale", role: "executive", title: "Chief Revenue Officer" },
  { id: "E2", name: "Dana Whitfield", role: "executive", title: "Chief Executive Officer" },
  { id: "D1", name: "Elena Novak", role: "director", title: "Sales Director, Northeast" },
  { id: "D2", name: "Marcus Osei", role: "director", title: "Sales Director, Southeast" },
  { id: "D3", name: "Grace Lindqvist", role: "director", title: "Sales Director, Midwest" },
  { id: "D4", name: "Rafael Duarte", role: "director", title: "Sales Director, West" },
  { id: "F1", name: "Priya Raman", role: "finance", title: "FP&A Lead" },
  { id: "A1", name: "Sam Ortega", role: "access_admin", title: "Access Administrator" },
];

export function generateOrg(rng) {
  const usedNames = new Set(FIXED_PEOPLE.map((p) => p.name));
  const uniqueName = () => {
    for (;;) {
      const n = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };

  const teams = TEAM_DEFS.map(({ size, ...t }) => ({ ...t, size }));
  const reps = [];
  let n = 1;
  for (const team of teams) {
    for (let i = 0; i < team.size; i++) {
      const id = `R${String(n).padStart(2, "0")}`;
      reps.push({
        id,
        name: uniqueName(),
        title: i === 0 ? "Senior Account Executive" : "Account Executive",
        role: "salesperson",
        teamId: team.id,
        branchId: team.branchIds[i % team.branchIds.length],
        primaryVerticalId: team.verticals[i % team.verticals.length],
        hireDate: `${rng.int(2016, 2023)}-${String(rng.int(1, 12)).padStart(2, "0")}-01`,
        baseSalary: Math.round(rng.float(68000, 112000) / 1000) * 1000,
        salesAllocationPct: Math.round(rng.float(0.7, 1) * 100) / 100,
        travelAllowance: Math.round(rng.float(700, 1500) / 50) * 50,
        entertainmentAllowance: Math.round(rng.float(300, 700) / 50) * 50,
        commissionPlan: { baseRate: 0.08, accelRate: 0.12 },
        overspender: false,
        restricted: false,
      });
      n++;
    }
  }
  // A few recruiters run consistently over their travel allowance; one
  // recruiter's access excludes cost detail (used to show field-level masking).
  for (const r of rng.shuffle(reps).slice(0, 4)) r.overspender = true;
  const restricted = reps.find((r) => r.id === "R07");
  if (restricted) restricted.restricted = true;

  const people = [
    ...FIXED_PEOPLE.map((p) => ({ ...p })),
    ...reps.map((r) => ({ id: r.id, name: r.name, role: "salesperson", title: r.title, teamId: r.teamId })),
  ];

  return {
    businessUnits: BUSINESS_UNITS,
    regions: REGIONS,
    branches: BRANCHES,
    verticals: VERTICALS,
    serviceLines: SERVICE_LINES,
    teams,
    reps,
    people,
  };
}
