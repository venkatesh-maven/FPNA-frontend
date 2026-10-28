// Client-wise performance for the recruiters in view: bill revenue, bill and
// pay rates, payroll, burden and GP for every client, so each layer of the
// hierarchy can report revenue and GP by client.

import { gmPct, perHour } from "../../calc/economics";
import { averageActive, expenseRows, sumFacts, sumPlans } from "./aggregate";

/** Client-level performance and rate/cost rows for the recruiters in view. */
export function clientRows(ctx) {
  const cur = sumFacts(ctx, ctx.currentWindow, (f) => f.clientId);
  const budget = sumPlans(ctx, ctx.planWindow, "budget", (p) => p.clientId);
  const active = averageActive(ctx, ctx.currentWindow, (f) => f.clientId);
  const acquisition = new Map();
  for (const e of expenseRows(ctx, ctx.currentWindow, (x) => x.category === "acquisition" && x.clientId)) {
    acquisition.set(e.clientId, (acquisition.get(e.clientId) || 0) + e.amount);
  }
  const rows = [];
  for (const [clientId, t] of cur) {
    const c = ctx.index.clientById.get(clientId);
    const owners = c.owners.filter((o) => ctx.repSet.has(o.repId));
    const b = budget.get(clientId);
    const commissionEst = Math.max(0, t.gp) * 0.08;
    rows.push({
      clientId,
      client: c.name,
      owner: owners.map((o) => `${ctx.index.repById.get(o.repId).name}${o.share < 1 ? ` (${Math.round(o.share * 100)}%)` : ""}`).join(", "),
      vertical: ctx.index.verticalById.get(c.verticalId)?.name,
      revenue: t.revenue,
      gp: t.gp,
      gmPct: gmPct(t.gp, t.revenue),
      gpBudget: b?.gp ?? null,
      gpBudgetVar: b ? t.gp - b.gp : null,
      contractors: active.get(clientId) || 0,
      billedHours: t.billedHours,
      avgBillRate: perHour(t.timeRevenue, t.billedHours),
      avgPayRate: perHour(t.wages, t.paidHours),
      payroll: t.wages,
      burden: t.burden,
      otherDirect: t.odc,
      directCost: t.directCost,
      contribution: t.gp - commissionEst - (acquisition.get(clientId) || 0),
    });
  }
  return rows.sort((a, b) => b.gp - a.gp);
}
