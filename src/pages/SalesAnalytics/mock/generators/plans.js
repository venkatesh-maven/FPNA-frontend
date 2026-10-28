import { addMonths, monthRange, toYm } from "../../calc/dates";

const round2 = (v) => Math.round(v * 100) / 100;
const DRIVER_KEYS = ["N", "H", "R", "W", "burden", "odc", "fees"];
export const NEW_BUSINESS_SHARE = 0.04;
export const TARGET_UPLIFT = 1.06;
export const BOARD_UPLIFT = 1.02;

/** Client × month actual drivers, used as the base for next year's plan. */
function actualDrivers(facts) {
  const byKey = new Map();
  for (const f of facts) {
    const k = `${f.clientId}|${f.ym}`;
    let a = byKey.get(k);
    if (!a) {
      a = { N: 0, H: 0, R: 0, W: 0, burden: 0, odc: 0, fees: 0, gp: 0, revenue: 0 };
      byKey.set(k, a);
    }
    if (f.kind === "time") {
      a.N += f.af;
      a.H += f.billedHours;
      a.R += f.revenue;
      a.W += f.wages;
      a.burden += f.burden;
      a.odc += f.odc;
    } else {
      a.fees += f.revenue;
    }
    a.gp += f.gp;
    a.revenue += f.revenue;
  }
  return byKey;
}

const scale = (d, k) => Object.fromEntries(DRIVER_KEYS.map((key) => [key, d[key] * k]));
const totals = (d) => {
  const revenue = d.R + d.fees;
  return { ...d, revenue: round2(revenue), gp: round2(d.R - d.W - d.burden - d.odc + d.fees) };
};

/**
 * Plans per client × month for Jan 2024 – Dec of the as-of year. Budget is
 * last year's actual drivers grown 3–10% with ~3% rate increases (2024 uses
 * 2024 actuals ±4% as a stand-in for the missing 2023 base); Sales Target is
 * budget × 1.06; Board Plan budget × 1.02; Finance Forecast is actual for
 * closed months and budget ± noise after. A per-rep "new business" row holds
 * unassigned new-logo budget.
 */
export function generatePlans(rng, { org, clients, facts, startYm, asOf }) {
  const asOfYm = toYm(asOf);
  const lastYm = `${asOfYm.slice(0, 4)}-12`;
  const months = monthRange(startYm, lastYm);
  const actual = actualDrivers(facts);
  const rows = [];
  const repBudget = new Map(); // `${repId}|${ym}` → summed credited budget drivers

  for (const c of clients) {
    const growthByYear = new Map();
    for (const m of months) {
      const y = m.slice(0, 4);
      if (!growthByYear.has(y)) growthByYear.set(y, rng.float(1.03, 1.1));
      const g = growthByYear.get(y);
      const isFirstYear = y === startYm.slice(0, 4);
      const base = isFirstYear ? actual.get(`${c.id}|${m}`) : actual.get(`${c.id}|${addMonths(m, -12)}`);
      const noise = isFirstYear ? rng.float(0.96, 1.04) : 1;
      if (!base || base.revenue <= 0) continue;

      const rate = 1.03;
      const N = base.N * g * noise;
      const hoursPer = base.N ? base.H / base.N : 0;
      const H = N * hoursPer;
      const B = base.H ? (base.R / base.H) * rate : 0;
      const P = base.H ? (base.W / base.H) * rate : 0;
      const u = base.W ? base.burden / base.W : 0;
      const budget = totals({
        N, H, R: H * B, W: H * P, burden: H * P * u, odc: base.odc * g * noise, fees: base.fees * 1.05 * noise,
      });
      const target = totals(scale(budget, TARGET_UPLIFT));
      const actualNow = actual.get(`${c.id}|${m}`);
      const forecast =
        m < asOfYm
          ? { revenue: round2(actualNow?.revenue || 0), gp: round2(actualNow?.gp || 0) }
          : { revenue: round2(budget.revenue * rng.float(0.94, 1.02)), gp: round2(budget.gp * rng.float(0.93, 1.02)) };

      rows.push({
        ym: m,
        clientId: c.id,
        repId: null,
        verticalId: c.verticalId,
        branchId: c.branchId,
        budget,
        target,
        board: { revenue: round2(budget.revenue * BOARD_UPLIFT), gp: round2(budget.gp * BOARD_UPLIFT) },
        forecast,
      });

      for (const o of c.owners) {
        const k = `${o.repId}|${m}`;
        const acc = repBudget.get(k) || Object.fromEntries(DRIVER_KEYS.map((key) => [key, 0]));
        for (const key of DRIVER_KEYS) acc[key] += budget[key] * o.share;
        repBudget.set(k, acc);
      }
    }
  }

  // Unassigned new-logo budget per rep, in the rep's own vertical and branch.
  for (const rep of org.reps) {
    for (const m of months) {
      const acc = repBudget.get(`${rep.id}|${m}`);
      if (!acc) continue;
      const budget = totals(scale(acc, NEW_BUSINESS_SHARE));
      rows.push({
        ym: m,
        clientId: null,
        repId: rep.id,
        verticalId: rep.primaryVerticalId,
        branchId: rep.branchId,
        budget,
        target: totals(scale(budget, TARGET_UPLIFT)),
        board: { revenue: round2(budget.revenue * BOARD_UPLIFT), gp: round2(budget.gp * BOARD_UPLIFT) },
        // Realised new business shows up in client actuals, so closed months forecast nothing here.
        forecast: m < asOfYm ? { revenue: 0, gp: 0 } : { revenue: round2(budget.revenue * 0.9), gp: round2(budget.gp * 0.9) },
      });
    }
  }
  return rows;
}
