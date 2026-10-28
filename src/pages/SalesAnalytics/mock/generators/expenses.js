import { addMonths, dayOf, daysInMonth, fiscalQuarterStart, monthRange, toYm } from "../../calc/dates";

const round2 = (v) => Math.round(v * 100) / 100;

export const SALES_EXPENSE_CATEGORIES = [
  { id: "commission", label: "Commissions" },
  { id: "travel", label: "Travel" },
  { id: "entertainment", label: "Client entertainment" },
  { id: "acquisition", label: "Client acquisition" },
  { id: "salary", label: "Salary & benefits allocation" },
];

/**
 * Sales expenses per rep × month — all below-GP (none are direct costs):
 * commission at 8% of credited GP plus a 4% quarterly accelerator on GP above
 * the quarter's GP target; travel and entertainment around each rep's
 * allowance (a few reps run over); acquisition costs on won new-logo deals;
 * salary & benefits allocated to sales. Commission months more than one month
 * old are approved; the latest closed month and the current month are earned
 * (accrued, not yet approved).
 */
export function generateExpenses(rng, { org, clients, facts, plans, opportunities, startYm, asOf }) {
  const asOfYm = toYm(asOf);
  const asOfFraction = dayOf(asOf) / daysInMonth(asOfYm);
  const months = monthRange(startYm, asOfYm);
  const approvedThrough = addMonths(asOfYm, -2);

  const owners = new Map(clients.map((c) => [c.id, c.owners]));
  const gpByRepMonth = new Map();
  for (const f of facts) {
    for (const o of owners.get(f.clientId)) {
      const k = `${o.repId}|${f.ym}`;
      gpByRepMonth.set(k, (gpByRepMonth.get(k) || 0) + f.gp * o.share);
    }
  }
  const targetGpByRepMonth = new Map();
  for (const p of plans) {
    const list = p.clientId ? owners.get(p.clientId) : [{ repId: p.repId, share: 1 }];
    for (const o of list) {
      const k = `${o.repId}|${p.ym}`;
      targetGpByRepMonth.set(k, (targetGpByRepMonth.get(k) || 0) + p.target.gp * o.share);
    }
  }

  const winsByRepMonth = new Map();
  const acquisitionWins = [];
  for (const o of opportunities) {
    if (o.status !== "won") continue;
    const k = `${o.repId}|${toYm(o.wonDate)}`;
    winsByRepMonth.set(k, (winsByRepMonth.get(k) || 0) + 1);
    if (o.type === "new_logo") acquisitionWins.push(o);
  }

  const rows = [];
  const push = (r) => rows.push({ id: `X-${String(rows.length + 1).padStart(5, "0")}`, ...r, amount: round2(r.amount) });
  const travelGrowthReps = new Set(rng.shuffle(org.reps).slice(0, 5).map((r) => r.id));

  for (const rep of org.reps) {
    for (const m of months) {
      const frac = m === asOfYm ? asOfFraction : 1;
      const status = m <= approvedThrough ? "approved" : "earned";
      const gp = gpByRepMonth.get(`${rep.id}|${m}`) || 0;

      push({ ym: m, repId: rep.id, category: "commission", amount: Math.max(0, gp * rep.commissionPlan.baseRate), status, memo: "Base commission on credited GP" });

      // Accelerator once a quarter closes.
      const qStart = fiscalQuarterStart(m);
      const qEnd = addMonths(qStart, 2);
      if (m === qEnd && m < asOfYm) {
        let qGp = 0;
        let qTarget = 0;
        for (const qm of monthRange(qStart, qEnd)) {
          qGp += gpByRepMonth.get(`${rep.id}|${qm}`) || 0;
          qTarget += targetGpByRepMonth.get(`${rep.id}|${qm}`) || 0;
        }
        const over = qGp - qTarget;
        if (over > 0) {
          push({
            ym: m, repId: rep.id, category: "commission", status,
            amount: over * (rep.commissionPlan.accelRate - rep.commissionPlan.baseRate),
            memo: "Quarterly accelerator on GP above target",
          });
        }
      }

      const yearBump = m >= "2026-01" && travelGrowthReps.has(rep.id) ? 1.2 : 1;
      push({
        ym: m, repId: rep.id, category: "travel", status: "posted",
        amount: rep.travelAllowance * rng.float(0.55, 1.15) * (rep.overspender ? 1.45 : 1) * yearBump * frac,
        memo: "Client visits and mileage",
      });
      const wins = winsByRepMonth.get(`${rep.id}|${m}`) || 0;
      push({
        ym: m, repId: rep.id, category: "entertainment", status: "posted",
        amount: rep.entertainmentAllowance * rng.float(0.3, 1.05) * (rep.overspender ? 1.3 : 1) * frac + wins * 650,
        memo: wins ? "Client meals incl. deal celebrations" : "Client meals and events",
      });
      push({
        ym: m, repId: rep.id, category: "salary", status: "posted",
        amount: (rep.baseSalary / 12) * rep.salesAllocationPct * 1.22 * frac,
        memo: "Base salary and benefits allocated to sales",
      });
    }
  }

  for (const o of acquisitionWins) {
    push({
      ym: toYm(o.wonDate), repId: o.repId, category: "acquisition", status: "posted",
      amount: rng.float(1500, 6000), clientId: o.clientId, opportunityId: o.id,
      memo: `Pursuit costs for ${o.prospectName}`,
    });
  }
  return rows;
}
