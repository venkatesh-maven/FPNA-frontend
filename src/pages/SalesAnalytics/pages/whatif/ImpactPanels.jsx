import React, { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WaterfallChart } from "../../components/charts/Charts";
import { CONFIDENCE, CONFIDENCE_LABELS, gpForCommission } from "../../calc/whatIf";
import { formatYmShort } from "../../calc/dates";
import { compactMoney, count, hours, money, pct, signedMoney } from "../../utils/format";
import { Grid, NumInput, td, tdLeft } from "./inputs";

const delta = (v) => (
  <span className={v > 0.5 ? "text-green-700" : v < -0.5 ? "text-red-700" : "text-slate-500"}>{Math.abs(v) < 0.5 ? "—" : signedMoney(v)}</span>
);
const restricted = (what) => <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{what} is restricted for your role.</p>;

/* ---------------- commission ---------------- */

export function CommissionPanel({ baseline, result, base }) {
  const [goal, setGoal] = useState(null);
  const c = result.commission;
  const b = base.commission;
  if (!c) return restricted("Commission detail");
  const target = baseline.target.gp;
  const plan = baseline.commission;
  const gpUpTo = Math.min(result.quarter.gp, target);
  const gpAbove = Math.max(0, result.quarter.gp - target);
  const hypothetical = c.quarterTotal - b.quarterTotal;

  // GP per contractor over the rest of the quarter, from confirmed existing work.
  const perContractor = baseline.assignments.length ? base.confidence.confirmed.gp / baseline.assignments.length : 0;
  const neededGp = goal ? gpForCommission(goal, target, plan) : null;
  const gap = neededGp != null ? neededGp - result.quarter.gp : null;

  return (
    <div className="space-y-3">
      <Grid head={["Commission", "Baseline", "This scenario", "Change"]} maxHeight="none">
        <tr>
          <td className={tdLeft}>
            Earned to date <span className="block text-[10px] text-slate-500">Accrued this quarter · {money(c.approvedToDate)} approved / payable — unchanged by any scenario</span>
          </td>
          <td className={td}>{money(b.earnedToDate)}</td>
          <td className={td}>{money(c.earnedToDate)}</td>
          <td className={td}>{delta(0)}</td>
        </tr>
        <tr>
          <td className={tdLeft}>
            Projected, rest of quarter <span className="block text-[10px] text-slate-500">Plan applied to the forecast GP; not earned until it bills</span>
          </td>
          <td className={td}>{money(b.projectedRemaining)}</td>
          <td className={td}>{money(c.projectedRemaining)}</td>
          <td className={td}>{delta(c.projectedRemaining - b.projectedRemaining)}</td>
        </tr>
        <tr className="bg-sky-50 font-semibold">
          <td className={tdLeft}>Quarter commission</td>
          <td className={td}>{money(b.quarterTotal)}</td>
          <td className={td}>{money(c.quarterTotal)}</td>
          <td className={td}>{delta(hypothetical)}</td>
        </tr>
      </Grid>

      <div className="rounded-lg border border-sky-100 p-3">
        <p className="text-xs font-semibold text-sky-900">How the plan pays on this scenario's quarter GP</p>
        <div className="mt-2 flex h-6 overflow-hidden rounded bg-slate-100 text-[10px] font-medium text-white">
          <div className="flex items-center justify-center bg-sky-600" style={{ width: `${Math.min(100, (gpUpTo / Math.max(result.quarter.gp, target)) * 100)}%` }}>
            {Math.round(plan.baseRate * 100)}%
          </div>
          {gpAbove > 0 ? (
            <div className="flex items-center justify-center bg-emerald-600" style={{ width: `${(gpAbove / result.quarter.gp) * 100}%` }}>
              {Math.round(plan.accelRate * 100)}%
            </div>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-slate-600">
          <span>GP up to the {money(target)} quarter target: {money(gpUpTo)} × {Math.round(plan.baseRate * 100)}% = {money(gpUpTo * plan.baseRate)}</span>
          <span>{gpAbove > 0 ? `Above target: ${money(gpAbove)} × ${Math.round(plan.accelRate * 100)}% = ${money(gpAbove * plan.accelRate)}` : `${money(target - result.quarter.gp)} more GP reaches the ${Math.round(plan.accelRate * 100)}% accelerator`}</span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950">
        <p className="font-semibold">What would it take?</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span>Quarter commission I want:</span>
          <NumInput value={goal} placeholder={Math.round(c.quarterTotal * 1.2)} onChange={setGoal} min={0} prefix="$" width="w-24" label="Commission goal" />
        </div>
        {goal ? (
          <p className="mt-1.5">
            Needs {money(neededGp)} of quarter GP —{" "}
            {gap > 0 ? (
              <>
                {money(gap)} more than this scenario
                {perContractor > 0 ? <>, roughly {count(Math.ceil(gap / perContractor))} more contractors billing from now to quarter end at your current GP per contractor</> : null}.
              </>
            ) : (
              <>this scenario already gets there.</>
            )}
          </p>
        ) : (
          <p className="mt-1.5 text-amber-800">Enter an amount to see the GP and the extra contractors it needs.</p>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        Earned and approved commission are actuals. Projected commission applies the plan ({Math.round(plan.baseRate * 100)}% of credited GP, {Math.round(plan.accelRate * 100)}% above the quarterly GP target) to the forecast; the change from this
        scenario is hypothetical until the GP is billed and the commission approved.
      </p>
    </div>
  );
}

/* ---------------- by month ---------------- */

export function MonthlyPanel({ result, base }) {
  const data = result.months.map((m, i) => ({
    label: formatYmShort(m.ym),
    baseline: base.months[i].total.gp,
    scenario: m.total.gp,
  }));
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={56} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="baseline" name="Baseline GP" fill="#94a3b8" />
          <Bar dataKey="scenario" name="Scenario GP" fill="#0369a1" />
        </BarChart>
      </ResponsiveContainer>
      <Grid head={["Month", "Actual revenue", "Scenario revenue", "Δ revenue", "Actual GP", "Scenario GP", "Δ GP", "GM"]} maxHeight="none">
        {result.months.map((m, i) => (
          <tr key={m.ym}>
            <td className={tdLeft}>{formatYmShort(m.ym)}</td>
            <td className={td}>{money(m.actual.revenue)}</td>
            <td className={td}>{money(m.total.revenue)}</td>
            <td className={td}>{delta(m.total.revenue - base.months[i].total.revenue)}</td>
            <td className={td}>{money(m.actual.gp)}</td>
            <td className={td}>{money(m.total.gp)}</td>
            <td className={td}>{delta(m.total.gp - base.months[i].total.gp)}</td>
            <td className={td}>{pct(m.total.gmPct)}</td>
          </tr>
        ))}
        <tr className="bg-sky-50 font-semibold">
          <td className={tdLeft}>Quarter</td>
          <td className={td}>{money(result.actual.revenue)}</td>
          <td className={td}>{money(result.quarter.revenue)}</td>
          <td className={td}>{delta(result.quarter.revenue - base.quarter.revenue)}</td>
          <td className={td}>{money(result.actual.gp)}</td>
          <td className={td}>{money(result.quarter.gp)}</td>
          <td className={td}>{delta(result.quarter.gp - base.quarter.gp)}</td>
          <td className={td}>{pct(result.quarter.gmPct)}</td>
        </tr>
      </Grid>
      <p className="text-[11px] text-slate-500">Scenario figures include actual to date; only the rest of the quarter is modeled.</p>
    </div>
  );
}

/* ---------------- by client ---------------- */

export function ClientPanel({ result, base }) {
  const baseBy = new Map(base.clients.map((c) => [c.key, c]));
  const rows = result.clients
    .map((c) => {
      const b = baseBy.get(c.key);
      return { ...c, baseRevenue: b?.total.revenue || 0, baseGp: b?.total.gp || 0, dGp: c.total.gp - (b?.total.gp || 0) };
    })
    .filter((c) => Math.abs(c.total.revenue) > 0.5 || Math.abs(c.baseRevenue) > 0.5)
    .sort((x, y) => Math.abs(y.dGp) - Math.abs(x.dGp) || y.total.gp - x.total.gp);
  return (
    <Grid head={["Client", "Baseline revenue", "Scenario revenue", "Baseline GP", "Scenario GP", "Δ GP", "GM", "Probable + upside GP"]}>
      {rows.map((c) => (
        <tr key={c.key} className="hover:bg-sky-50/50">
          <td className={tdLeft}>
            {c.client}
            {c.isNew ? <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-800">new</span> : null}
          </td>
          <td className={td}>{money(c.baseRevenue)}</td>
          <td className={td}>{money(c.total.revenue)}</td>
          <td className={td}>{money(c.baseGp)}</td>
          <td className={td}>{money(c.total.gp)}</td>
          <td className={td}>{delta(c.dGp)}</td>
          <td className={td}>{pct(c.total.gmPct)}</td>
          <td className={td}>{money(c.byConf.probable.gp + c.byConf.upside.gp)}</td>
        </tr>
      ))}
    </Grid>
  );
}

/* ---------------- GP bridge and direct-cost bridge ---------------- */

export function BridgePanel({ bridge, result, base, costDetail }) {
  const steps = bridge.steps.map((s) => ({ key: s.key, label: s.label, amount: s.amount }));
  const lines = [
    ["Revenue", "revenue"],
    ...(costDetail ? [["Contractor wages", "wages"], ["Employer burden", "burden"], ["Other direct costs", "odc"]] : []),
    ["Total direct cost", "directCost"],
    ["Gross profit", "gp"],
  ];
  return (
    <div className="space-y-3">
      <WaterfallChart start={{ label: "Baseline GP", amount: bridge.start.gp }} steps={steps} end={{ label: "Scenario GP", amount: bridge.end.gp }} height={260} />
      <Grid head={["Driver", "Revenue effect", "GP effect"]} maxHeight="none">
        {bridge.steps.map((s) => (
          <tr key={s.key}>
            <td className={tdLeft}>{s.label}</td>
            <td className={td}>{delta(s.revenue)}</td>
            <td className={td}>{delta(s.amount)}</td>
          </tr>
        ))}
      </Grid>
      <Grid head={["Quarter", "Baseline", "Scenario", "Change"]} maxHeight="none">
        {lines.map(([label, k]) => (
          <tr key={k} className={k === "gp" ? "bg-sky-50 font-semibold" : ""}>
            <td className={tdLeft}>{label}</td>
            <td className={td}>{money(base.quarter[k])}</td>
            <td className={td}>{money(result.quarter[k])}</td>
            <td className={td}>{delta(result.quarter[k] - base.quarter[k])}</td>
          </tr>
        ))}
        <tr>
          <td className={tdLeft}>Gross margin</td>
          <td className={td}>{pct(base.quarter.gmPct)}</td>
          <td className={td}>{pct(result.quarter.gmPct)}</td>
          <td className={td}>{`${(result.quarter.gmPct - base.quarter.gmPct).toFixed(1)} pp`}</td>
        </tr>
      </Grid>
      {!costDetail ? <p className="text-[11px] text-slate-500">Wages, burden and other direct costs are restricted for your role; direct cost is modeled with client cost ratios.</p> : null}
    </div>
  );
}

/* ---------------- confidence and contractor activity ---------------- */

const CONF_COLORS = { actual: "#0c4a6e", confirmed: "#0369a1", probable: "#38bdf8", upside: "#f59e0b" };

export function ConfidencePanel({ result, base }) {
  const total = Math.max(1, result.quarter.gp);
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-semibold text-sky-900">Quarter GP by confidence</p>
        <div className="flex h-7 overflow-hidden rounded text-[10px] font-medium text-white">
          {CONFIDENCE.map((c) =>
            result.confidence[c].gp > 0 ? (
              <div key={c} className="flex items-center justify-center" style={{ width: `${(result.confidence[c].gp / total) * 100}%`, background: CONF_COLORS[c] }} title={`${CONFIDENCE_LABELS[c]}: ${money(result.confidence[c].gp)}`}>
                {result.confidence[c].gp / total > 0.08 ? CONFIDENCE_LABELS[c] : ""}
              </div>
            ) : null
          )}
        </div>
      </div>
      <Grid head={["Confidence", "Baseline revenue", "Scenario revenue", "Baseline GP", "Scenario GP"]} maxHeight="none">
        {CONFIDENCE.map((c) => (
          <tr key={c}>
            <td className={tdLeft}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: CONF_COLORS[c] }} />
              {CONFIDENCE_LABELS[c]}
            </td>
            <td className={td}>{money(base.confidence[c].revenue)}</td>
            <td className={td}>{money(result.confidence[c].revenue)}</td>
            <td className={td}>{money(base.confidence[c].gp)}</td>
            <td className={td}>{money(result.confidence[c].gp)}</td>
          </tr>
        ))}
      </Grid>
      <p className="text-[11px] text-slate-500">
        Confirmed: existing assignments to their planned end and committed starts. Probable: extensions at the historical rate and pipeline at stage probability. Upside: uncommitted
        starts and anything assumed above those rates.
      </p>
      <Grid head={["Contractor activity this quarter", "Baseline", "Scenario"]} maxHeight="none">
        <tr>
          <td className={tdLeft}>Expected on billing at quarter end</td>
          <td className={td}>{count(base.activity.activeAtEnd, 1)}</td>
          <td className={td}>{count(result.activity.activeAtEnd, 1)}</td>
        </tr>
        <tr>
          <td className={tdLeft}>Starts (actual + expected)</td>
          <td className={td}>{count(base.activity.starts, 1)}</td>
          <td className={td}>{count(result.activity.starts, 1)}</td>
        </tr>
        <tr>
          <td className={tdLeft}>Ends (actual + expected)</td>
          <td className={td}>{count(base.activity.ends, 1)}</td>
          <td className={td}>{count(result.activity.ends, 1)}</td>
        </tr>
        <tr>
          <td className={tdLeft}>Billable hours (credited)</td>
          <td className={td}>{hours(base.activity.hours)}</td>
          <td className={td}>{hours(result.activity.hours)}</td>
        </tr>
      </Grid>
    </div>
  );
}

/* ---------------- compare ---------------- */

export function ComparePanel({ baseline, result, base, submitted }) {
  const rows = [
    { label: `${baseline.quarter.priorLabel} actual`, revenue: baseline.priorQuarter.revenue, gp: baseline.priorQuarter.gp },
    { label: "Quarter Sales Target", revenue: baseline.target.revenue, gp: baseline.target.gp },
    { label: "Finance Forecast (read-only)", revenue: baseline.financeForecast.revenue, gp: baseline.financeForecast.gp },
    { label: "Baseline (no changes)", revenue: base.quarter.revenue, gp: base.quarter.gp },
    ...(submitted ? [{ label: `Last submitted (v${submitted.version}, ${submitted.status})`, revenue: submitted.snapshot.quarter.revenue + (submitted.adjustmentTotal?.revenue || 0), gp: submitted.snapshot.quarter.gp + (submitted.adjustmentTotal?.gp || 0) }] : []),
    { label: "This scenario", revenue: result.quarter.revenue, gp: result.quarter.gp, strong: true },
  ];
  return (
    <div className="space-y-2">
      <Grid head={["Quarter", "Revenue", "GP", "GM", "GP vs this scenario", "GP attainment"]} maxHeight="none">
        {rows.map((r) => (
          <tr key={r.label} className={r.strong ? "bg-sky-50 font-semibold" : ""}>
            <td className={tdLeft}>{r.label}</td>
            <td className={td}>{money(r.revenue)}</td>
            <td className={td}>{money(r.gp)}</td>
            <td className={td}>{pct(r.revenue ? (r.gp / r.revenue) * 100 : null)}</td>
            <td className={td}>{r.strong ? "—" : delta(result.quarter.gp - r.gp)}</td>
            <td className={td}>{pct(baseline.target.gp ? (r.gp / baseline.target.gp) * 100 : null, 0)}</td>
          </tr>
        ))}
      </Grid>
      <p className="text-[11px] text-slate-500">
        Remaining to the GP target in this scenario: {money(Math.max(0, result.attainment.gpGap))}
        {result.attainment.gpGap <= 0 ? " — target met" : ""}. The Finance Forecast is shown for reference only; it is owned by the Forecasting module.
      </p>
    </div>
  );
}
