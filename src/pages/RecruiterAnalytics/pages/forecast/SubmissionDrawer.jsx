import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiCornerUpLeft, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn } from "../../../FinancialReports/DrilldownDrawer";
import { salesForecast } from "../../services/salesAnalyticsApi";
import { useSalesAccess } from "../../access/SalesAccessContext";
import { CONFIDENCE, CONFIDENCE_LABELS } from "../../calc/whatIf";
import { formatDate, formatYmShort } from "../../calc/dates";
import { compactMoney, money, pct, signedMoney } from "../../utils/format";
import { STATUS_LABEL, STATUS_STYLE } from "../whatif/ScenarioBar";
import { Grid, td, tdLeft } from "../whatif/inputs";

const btn = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

const Summary = ({ label, value, sub }) => (
  <div>
    <div className="text-xs text-sky-200">{label}</div>
    <div className="text-lg font-bold">{value}</div>
    {sub ? <div className="text-xs text-sky-200">{sub}</div> : null}
  </div>
);

/**
 * One recruiter's submitted forecast for an account manager: client × month rows,
 * the operational assumptions behind them, review history and account manager
 * adjustments, with return / confirm actions.
 */
export default function SubmissionDrawer({ row, permissions, onClose, onChanged }) {
  const { viewer } = useSalesAccess();
  const [sub, setSub] = useState(null);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState("");
  const [adj, setAdj] = useState({ revenue: "", gp: "", reason: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!row?.submissionId) return;
    setError(null);
    salesForecast.submission(viewer, row.submissionId).then(setSub).catch((e) => setError(e.message));
  }, [row?.submissionId, viewer]);
  useEffect(() => {
    setSub(null);
    setComment("");
    setAdj({ revenue: "", gp: "", reason: "" });
    load();
  }, [load]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
      onChanged?.();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Client × month grid from the snapshot rows.
  const grid = useMemo(() => {
    if (!sub) return null;
    const months = [...new Set(sub.snapshot.rows.map((r) => r.ym))].sort();
    const by = new Map();
    for (const r of sub.snapshot.rows) {
      if (!by.has(r.clientKey)) by.set(r.clientKey, { client: r.client, business: r.business, months: {}, revenue: 0, gp: 0, probable: 0, upside: 0 });
      const c = by.get(r.clientKey);
      c.months[r.ym] = (c.months[r.ym] || 0) + r.gp;
      c.revenue += r.revenue;
      c.gp += r.gp;
      c.probable += r.confidence.probable.gp;
      c.upside += r.confidence.upside.gp;
    }
    return { months, clients: [...by.values()].sort((a, b) => b.gp - a.gp) };
  }, [sub]);

  const s = sub?.snapshot;
  const status = sub?.status || row?.status;

  return (
    <DrilldownDrawer open={!!row} onClose={onClose} className="w-[1100px] max-w-[94vw] lg:max-w-[76vw]">
      <div className="bg-gradient-to-r from-sky-900 to-sky-700 px-6 py-5 text-white">
        <div className="flex justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{row?.name}</h2>
              {status ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span> : null}
            </div>
            <p className="mt-1 text-sm text-sky-200">
              {row?.team} · {sub ? `version ${sub.version} · ${sub.scenarioName} · submitted ${formatDate(sub.submittedAt.slice(0, 10))}${sub.sample ? " (sample)" : ""}` : row?.source}
            </p>
            {s ? (
              <div className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-4">
                <Summary label="Quarter revenue" value={compactMoney(s.quarter.revenue + sub.adjustmentTotal.revenue)} sub={`Prior quarter ${compactMoney(s.priorQuarter.revenue)}`} />
                <Summary label="Quarter GP" value={compactMoney(s.quarter.gp + sub.adjustmentTotal.gp)} sub={`Target ${compactMoney(s.target.gp)}`} />
                <Summary label="GP attainment" value={pct(s.target.gp ? ((s.quarter.gp + sub.adjustmentTotal.gp) / s.target.gp) * 100 : null, 0)} sub={`GM ${pct(s.quarter.gmPct)}`} />
                <Summary label="Account manager adjustments" value={sub.adjustmentTotal.gp ? signedMoney(sub.adjustmentTotal.gp, { compact: true }) : "None"} sub="GP; recruiter's original kept" />
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="self-start">
            <FiX size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-6">
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {row && !row.submissionId ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {row.name} hasn't submitted a forecast for this quarter. The team view uses the system baseline for them until they do.
          </p>
        ) : null}
        {row?.submissionId && !sub && !error ? <DrilldownBodySkeleton /> : null}

        {sub ? (
          <DrilldownFadeIn className="space-y-4">
            {permissions.review || permissions.confirm ? (
              <div className="space-y-2 rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-sky-900">Review</h3>
                {sub.note ? <p className="text-xs text-slate-700">Recruiter's note: “{sub.note}”</p> : null}
                <div className="flex flex-wrap items-start gap-2">
                  {permissions.confirm && status === "submitted" ? (
                    <button type="button" disabled={busy} onClick={() => act(() => salesForecast.confirm(viewer, { submissionId: sub.id }))} className={`${btn} border-green-700 bg-green-700 text-white hover:bg-green-800`}>
                      <FiCheck size={12} /> Confirm forecast
                    </button>
                  ) : null}
                  {permissions.review && ["submitted", "confirmed"].includes(status) ? (
                    <span className="flex flex-1 flex-wrap items-center gap-2">
                      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What should be revised?" className="min-w-[240px] flex-1 rounded border border-sky-200 px-2 py-1 text-xs" />
                      <button
                        type="button"
                        disabled={busy || !comment.trim()}
                        onClick={async () => (await act(() => salesForecast.returnToRep(viewer, { submissionId: sub.id, comment }))) && setComment("")}
                        className={`${btn} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`}
                      >
                        <FiCornerUpLeft size={12} /> Return for revision
                      </button>
                    </span>
                  ) : null}
                  {status === "returned" ? <span className="text-xs text-amber-800">Waiting for the recruiter to revise and resubmit.</span> : null}
                </div>
                {permissions.confirm && status !== "superseded" ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-sky-100 pt-2">
                    <span className="text-xs font-semibold text-sky-900">Account manager adjustment</span>
                    <input type="number" value={adj.revenue} onChange={(e) => setAdj((a) => ({ ...a, revenue: e.target.value }))} placeholder="Revenue ±" className="w-28 rounded border border-sky-200 px-2 py-1 text-right text-xs" aria-label="Revenue adjustment" />
                    <input type="number" value={adj.gp} onChange={(e) => setAdj((a) => ({ ...a, gp: e.target.value }))} placeholder="GP ±" className="w-24 rounded border border-sky-200 px-2 py-1 text-right text-xs" aria-label="GP adjustment" />
                    <input value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))} placeholder="Reason (required)" className="min-w-[200px] flex-1 rounded border border-sky-200 px-2 py-1 text-xs" aria-label="Adjustment reason" />
                    <button
                      type="button"
                      disabled={busy || adj.reason.trim().length < 5 || (!Number(adj.revenue) && !Number(adj.gp))}
                      onClick={async () => (await act(() => salesForecast.addAdjustment(viewer, { submissionId: sub.id, ...adj }))) && setAdj({ revenue: "", gp: "", reason: "" })}
                      className={`${btn} border-sky-900 bg-sky-900 text-white hover:bg-sky-800`}
                    >
                      <FiPlus size={12} /> Add
                    </button>
                  </div>
                ) : null}
                {sub.adjustments?.length ? (
                  <ul className="space-y-1">
                    {sub.adjustments.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-violet-200 bg-violet-50/60 px-2 py-1 text-xs text-violet-950">
                        <span>
                          <span className="font-semibold">Account manager adjustment:</span> revenue {signedMoney(a.revenue)}, GP {signedMoney(a.gp)} — {a.reason}
                          <span className="ml-1 text-violet-700">({a.by?.name}, {formatDate(a.at.slice(0, 10))})</span>
                        </span>
                        {permissions.confirm ? (
                          <button type="button" onClick={() => act(() => salesForecast.removeAdjustment(viewer, { submissionId: sub.id, adjustmentId: a.id }))} className="text-violet-400 hover:text-red-600" aria-label="Remove adjustment">
                            <FiTrash2 size={12} />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2 rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-sky-900">GP by client and month</h3>
              <Grid head={["Client", ...grid.months.map(formatYmShort), "Quarter revenue", "Quarter GP", "Probable", "Upside"]} maxHeight="360px">
                {grid.clients.map((c) => (
                  <tr key={c.client}>
                    <td className={tdLeft}>
                      {c.client}
                      {c.business === "new" ? <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-800">new</span> : null}
                    </td>
                    {grid.months.map((m) => (
                      <td key={m} className={td}>{money(c.months[m] || 0)}</td>
                    ))}
                    <td className={td}>{money(c.revenue)}</td>
                    <td className={td}>{money(c.gp)}</td>
                    <td className={td}>{money(c.probable)}</td>
                    <td className={td}>{money(c.upside)}</td>
                  </tr>
                ))}
              </Grid>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-sky-900">Operational assumptions</h3>
                {sub.assumptionNotes.length ? (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-700">
                    {sub.assumptionNotes.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600">No changes from the baseline: current assignments at their run-rate, extensions at the historical rate and pipeline at stage probability.</p>
                )}
              </div>
              <div className="space-y-2 rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-sky-900">Confidence</h3>
                <Grid head={["Confidence", "Revenue", "GP"]} maxHeight="none">
                  {CONFIDENCE.map((c) => (
                    <tr key={c}>
                      <td className={tdLeft}>{CONFIDENCE_LABELS[c]}</td>
                      <td className={td}>{money(s.confidence[c].revenue)}</td>
                      <td className={td}>{money(s.confidence[c].gp)}</td>
                    </tr>
                  ))}
                </Grid>
                {s.commission ? <p className="text-[11px] text-slate-500">Projected quarter commission at this forecast: {money(s.commission.quarterTotal)}.</p> : null}
              </div>
            </div>

            {sub.reviews?.length ? (
              <div className="space-y-1 rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-sky-900">Review history</h3>
                {sub.reviews.map((r, i) => (
                  <p key={i} className="text-xs text-slate-700">
                    {formatDate(r.at.slice(0, 10))} · {r.by?.name} {r.action === "returned" ? "returned it" : "confirmed it"}
                    {r.comment ? `: “${r.comment}”` : "."}
                  </p>
                ))}
              </div>
            ) : null}
          </DrilldownFadeIn>
        ) : null}
      </div>
    </DrilldownDrawer>
  );
}
