import React, { useState } from "react";
import { BsStars } from "react-icons/bs";
import { FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiTarget } from "react-icons/fi";
import { GOAL_METRICS, goalTarget, parseGoal, planForGoal } from "../../calc/goalSeek";
import { gpForCommission } from "../../calc/whatIf";
import { formatDate, formatYm } from "../../calc/dates";
import { compactMoney, money, pct, rate, signedMoney } from "../../utils/format";

// What each plan asks of the recruiter, and how its amounts count in the forecast.
const PLAN_INFO = {
  balanced: { title: "Balanced mix", tag: "Partly upside", how: "Spread the effort: a little from each lever is an easier ask than one big change." },
  billRate: { title: "Raise bill rates", tag: "Changes existing work", how: "Negotiate the increase at upcoming extensions and renewals, starting with clients billed below your desk average." },
  starts: { title: "Place new contractors", tag: "Upside until committed", how: "Fill open requisitions at your most active client and keep candidates ready to start." },
  extension: { title: "Extend more contractors", tag: "Upside above the historical rate", how: "Open extension talks early with the managers of contractors ending this quarter." },
  pipeline: { title: "Fill more job orders", tag: "Upside above stage probability", how: "Move your largest open job orders forward: get candidates submitted, interviews booked and start dates confirmed." },
  hours: { title: "Bill more hours", tag: "Changes existing work", how: "Ask clients about overtime or fuller weeks where projects are behind." },
};

const fmtFor = (metric) => (metric === "commission" ? (v) => money(v) : metric === "attainment" ? (v) => pct(v, 1) : compactMoney);

const goalText = (goal, fmt) => {
  const label = GOAL_METRICS[goal.metric].label;
  if (goal.mode === "pct") return `${label} +${goal.value}%`;
  if (goal.mode === "add") return `${label} +${goal.metric === "attainment" ? `${goal.value} pts` : fmt(goal.value)}`;
  return `${label} ${fmt(goal.value)}`;
};

/** The assumption changes a plan makes, in words. */
const describe = (lv, ctx) =>
  [
    lv.billRatePct ? `Bill rates +${lv.billRatePct.toFixed(1)}% on all clients from ${formatYm(ctx.rateFromYm)}` : null,
    lv.extensionProbability > ctx.extFrom ? `Extension probability ${ctx.extFrom}% → ${lv.extensionProbability}% for the ${ctx.ending} assignments ending this quarter` : null,
    lv.pipelinePts ? `Fill probability +${lv.pipelinePts} pts on ${ctx.openDeals} open job order${ctx.openDeals === 1 ? "" : "s"}` : null,
    lv.starts ? `${lv.starts} new contractor${lv.starts === 1 ? "" : "s"} at ${ctx.start.clientName} from ${formatDate(ctx.start.startDate)}, ${rate(ctx.start.billRate)}, 6 months` : null,
    lv.hoursPct ? `Billable hours +${lv.hoursPct.toFixed(1)}%` : null,
  ].filter(Boolean);

/**
 * Goal-first planning: the recruiter says the result they want ("increase my
 * commission by 15%") and each plan works out the assumptions that get there.
 * Apply puts a plan's assumptions into the scenario.
 */
export default function GoalPlanner({ baseline, base, result, assumptions, costDetail, own, onApply }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [planned, setPlanned] = useState(null);
  const my = own ? "my " : "";
  const hasCommission = GOAL_METRICS.commission.value(base) != null;
  const examples = [
    hasCommission ? `Increase ${my}commission by 15%` : null,
    `Reach 110% of ${my}GP target`,
    "Add $20K GP",
    "Grow revenue by 5%",
  ].filter(Boolean);

  const plan = (input) => {
    const goal = parseGoal(input);
    if (goal.error) {
      setPlanned(null);
      setError(
        goal.error === "metric"
          ? "Say which result to grow: commission, GP, revenue, recruiting contribution or target attainment."
          : `How much? For example “${input.trim()} by 15%” or “… to $30K”.`
      );
      return;
    }
    const m = GOAL_METRICS[goal.metric];
    const baseValue = m.value(base);
    if (baseValue == null) {
      setPlanned(null);
      setError(`${m.label} isn't available for your role. Try a GP or revenue goal.`);
      return;
    }
    const target = goalTarget(goal, baseValue);
    setError(null);
    setPlanned({ input, goal, baseValue, target, from: JSON.stringify(assumptions), out: planForGoal(baseline, assumptions, goal.metric, target, { costDetail }), applied: null });
  };

  const now = JSON.stringify(assumptions);
  const stale = planned && now !== planned.from && now !== planned.applied?.key;
  const fmt = planned ? fmtFor(planned.goal.metric) : null;
  const current = planned ? GOAL_METRICS[planned.goal.metric].value(result) : null;
  const met = planned && current != null && current >= planned.target - 0.005;
  const gpNeeded = planned?.goal.metric === "commission" && baseline.commission ? gpForCommission(planned.target, baseline.target.gp, baseline.commission) : null;

  return (
    <div className="space-y-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          plan(text);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="relative flex min-w-[260px] flex-1 items-center">
          <FiTarget className="pointer-events-none absolute left-2.5 text-sky-500" size={15} aria-hidden="true" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What do you want to reach? e.g. “Increase ${my}commission by 15%”`}
            aria-label="Your goal"
            className="w-full rounded-lg border border-sky-200 bg-white py-2 pl-8 pr-3 text-sm text-sky-950 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
        </label>
        <button type="submit" disabled={!text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-40">
          <BsStars size={14} /> Plan it
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] print:hidden">
        <span className="text-slate-500">Try:</span>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setText(ex);
              plan(ex);
            }}
            className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-sky-800 hover:bg-sky-100"
          >
            {ex}
          </button>
        ))}
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <FiAlertTriangle size={13} className="shrink-0" /> {error}
        </p>
      ) : null}

      {planned ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <p>
              <b>Goal: {goalText(planned.goal, fmt)}</b>
              {planned.goal.readAs === "growth" ? <span className="text-sky-700"> (read as an increase of {planned.goal.value}%)</span> : null}
              {" · "}baseline {fmt(planned.baseValue)} → <b>{fmt(planned.target)}</b>
              {gpNeeded != null ? <span className="text-sky-700"> · takes quarter GP of {compactMoney(gpNeeded)} ({signedMoney(gpNeeded - base.quarter.gp, { compact: true })} on the baseline)</span> : null}
            </p>
            {met ? (
              <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                <FiCheckCircle size={13} /> Reached in this scenario: {fmt(current)}
              </span>
            ) : (
              <span className="text-sky-700">This scenario: {fmt(current)}</span>
            )}
          </div>

          {stale ? (
            <button type="button" onClick={() => plan(planned.input)} className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:underline">
              <FiRefreshCw size={12} /> Assumptions changed since this plan. Re-plan from the current scenario
            </button>
          ) : null}

          {planned.out.alreadyMet ? (
            <p className="text-xs text-green-800">The current scenario already reaches this goal, so nothing needs to change.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
              {planned.out.plans.map((p) => {
                const info = PLAN_INFO[p.id];
                const applied = planned.applied?.id === p.id && !stale;
                return (
                  <div key={p.id} className={`flex flex-col gap-1.5 rounded-lg border p-3 ${applied ? "border-green-300 bg-green-50/60" : p.reached ? "border-sky-100 bg-white" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-sky-950">{info.title}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{info.tag}</p>
                      </div>
                      <button
                        type="button"
                        disabled={applied}
                        onClick={() => {
                          onApply(p, planned.goal.metric);
                          setPlanned((s) => ({ ...s, applied: { id: p.id, key: JSON.stringify(p.assumptions) } }));
                        }}
                        className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold print:hidden ${applied ? "bg-green-600 text-white" : "bg-sky-900 text-white hover:bg-sky-800"}`}
                      >
                        {applied ? "Applied" : "Apply"}
                      </button>
                    </div>
                    <ul className="space-y-0.5 text-xs text-sky-900">
                      {describe(p.levers, planned.out.context).map((d) => (
                        <li key={d} className="flex gap-1.5">
                          <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                    <p className={`text-xs font-medium ${p.reached ? "text-green-800" : "text-amber-800"}`}>
                      {p.reached ? `Reaches ${fmt(p.value)}` : `Falls short on its own: ${fmt(p.value)} at its limit`}
                      <span className="font-normal text-slate-600">
                        {planned.goal.metric !== "gp" ? ` · GP ${compactMoney(p.result.gp)}` : ""} · GM {pct(p.result.gmPct)}
                      </span>
                    </p>
                    <p className="text-[11px] leading-snug text-slate-500">{info.how}</p>
                    {applied ? <p className="text-[11px] font-medium text-green-800">The fields this plan changed are highlighted in Assumptions below.</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
