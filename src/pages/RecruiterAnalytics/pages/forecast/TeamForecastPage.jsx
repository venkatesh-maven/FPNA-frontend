import React, { useEffect, useState } from "react";
import { FiCheckCircle, FiSend, FiAlertTriangle } from "react-icons/fi";
import { getTeamForecast, salesForecast } from "../../services/salesAnalyticsApi";
import { clearSalesQueryCache, useSalesQuery } from "../../hooks/useSalesQuery";
import { useSalesAccess } from "../../access/SalesAccessContext";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { CONFIDENCE, CONFIDENCE_LABELS } from "../../calc/whatIf";
import { formatDate } from "../../calc/dates";
import { compactMoney, money, pct, signedPct } from "../../utils/format";
import SectionBlock, { SectionAccordion } from "../../components/SectionBlock";
import PageToolbar from "../../components/PageToolbar";
import ContextFooter from "../../components/ContextFooter";
import DataTable from "../../components/table/DataTable";
import { EmptyState, Spinner } from "../../../Budget/budgetHelpers";
import { exportPage } from "../../utils/exportRows";
import { STATUS_LABEL, STATUS_STYLE } from "../whatif/ScenarioBar";
import SubmissionDrawer from "./SubmissionDrawer";

const col = (key, label, unit = "money") => ({ key, label, unit });
const statusCol = {
  key: "status",
  label: "Status",
  unit: "text",
  render: (r) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>,
};

const GROUPS = [
  { id: "rep", label: "Recruiter", always: true, columns: [col("name", "Recruiter", "text"), col("team", "Team", "text"), statusCol, col("source", "Source", "text")] },
  {
    id: "quarter",
    label: "Quarter",
    columns: [
      col("priorQuarterRevenue", "Prior-quarter revenue"),
      col("priorQuarterGp", "Prior-quarter GP"),
      col("actualRevenue", "Actual to date"),
      col("remainingRevenue", "Remaining forecast"),
      col("forecastRevenue", "Full-quarter revenue"),
      col("forecastGp", "Full-quarter GP"),
      col("qoqGrowth", "QoQ", "pct"),
      col("vsTargetGp", "GP vs target"),
      col("gpAttainment", "GP attainment", "pct"),
    ],
  },
  { id: "confidence", label: "Confidence", columns: [col("confirmedGp", "Actual + confirmed GP"), col("probableGp", "Probable GP"), col("upsideGp", "Upside GP")] },
  { id: "adjustments", label: "Adjustments", columns: [col("adjustmentGp", "Account manager adjustment (GP)"), col("adjustmentCount", "Adjustments", "count")] },
];
const PRESETS = [
  { id: "gap", label: "Largest GP gap to target", key: "vsTargetGp", dir: "asc" },
  { id: "pending", label: "Waiting for review", key: "forecastGp", dir: "desc", filter: (r) => r.status === "submitted" },
  { id: "missing", label: "Not submitted", key: "forecastGp", dir: "desc", filter: (r) => r.status === "missing" },
  { id: "upside", label: "Most upside in forecast", key: "upsideGp", dir: "desc" },
];

const CONF_COLORS = { actual: "#0c4a6e", confirmed: "#0369a1", probable: "#38bdf8", upside: "#f59e0b" };
const btn = "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function tile(key, label, value, sub, unit = "money") {
  return { key, label, value, unit, sub, comparisons: [], drill: false };
}

export default function TeamForecastPage() {
  const { viewer } = useSalesAccess();
  const [rev, setRev] = useState(0);
  const { data, meta, error, loading } = useSalesQuery(getTeamForecast, DEFAULT_FILTERS, viewer, { rev });
  const [row, setRow] = useState(null);
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      salesForecast.subscribe(() => {
        clearSalesQueryCache();
        setRev((r) => r + 1);
      }),
    []
  );

  if (error) return <div className="rounded-xl border border-sky-100 bg-white"><EmptyState label={error.message} /></div>;
  if (!data) return <Spinner label="Consolidating forecasts…" />;

  const t = data.totals;
  const b = data.buckets;
  const p = data.permissions;
  const c = data.confirmation;
  const excluded = b.unconfirmed.count + b.missing.count;
  const qoq = t.priorQuarterRevenue ? ((t.forecastRevenue - t.priorQuarterRevenue) / t.priorQuarterRevenue) * 100 : null;
  const lastTransfer = c ? data.transfers.find((x) => x.confirmationId === c.id) : null;

  const run = async (fn, ok) => {
    setBusy(true);
    setMessage(null);
    try {
      const out = await fn();
      setMessage(ok(out));
    } catch (e) {
      setMessage({ error: true, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const summary = {
    id: "consolidated",
    title: `Consolidated ${data.quarter.label} recruiting forecast`,
    tiles: [
      tile("pq", "Prior-quarter actual", t.priorQuarterRevenue, `GP ${compactMoney(t.priorQuarterGp)}`),
      tile("atd", "Actual to date", t.actualRevenue, `GP ${compactMoney(t.actualGp)}`),
      tile("remaining", "Remaining forecast", t.remainingRevenue, `GP ${compactMoney(t.remainingGp)}`),
      tile("full", "Full-quarter forecast", t.forecastRevenue, `GP ${compactMoney(t.forecastGp)} · QoQ ${signedPct(qoq)}`),
      tile("gap", "GP vs quarter target", t.vsTargetGp, `Target GP ${compactMoney(t.targetGp)} · attainment ${pct(t.targetGp ? (t.forecastGp / t.targetGp) * 100 : null, 0)}`),
      tile("confirmed", "Confirmed by account manager", b.confirmed.gp, `${b.confirmed.count} recruiters · GP`),
      tile("unconfirmed", "Submitted, not confirmed", b.unconfirmed.gp, `${b.unconfirmed.count} recruiters · GP`),
      tile("missing", "Not submitted (system baseline)", b.missing.gp, `${b.missing.count} recruiters · GP`),
    ],
  };

  const onExport = () =>
    exportPage({
      filename: `team-recruiting-forecast-${data.quarter.label}.csv`,
      meta,
      blocks: [{ title: "Recruiting forecast by recruiter", columns: GROUPS.flatMap((g) => g.columns).map((x) => (x.render ? { ...x, render: undefined } : x)), data: data.reps }],
    });

  return (
    <SectionAccordion defaultOpen={summary.id}>
      <div className={`space-y-3 ${loading ? "opacity-70 transition-opacity" : ""}`}>
        <PageToolbar title="Team Recruiting Forecast" subtitle={`${data.quarter.label} · ${data.scope.label} · ${data.reps.length} recruiters`} onExport={onExport} />

        <SectionBlock section={summary} tileMin={150} subtitle="Latest submission per recruiter, plus account manager adjustments; no client or assignment is counted twice">
          <div>
            <p className="mb-1 text-xs font-semibold text-sky-900">Full-quarter GP by confidence</p>
            <div className="flex h-6 overflow-hidden rounded text-[10px] font-medium text-white">
              {CONFIDENCE.map((k) => {
                const share = data.confidence[k].gp / Math.max(1, t.forecastGp - t.adjustmentGp);
                return share > 0 ? (
                  <div key={k} className="flex items-center justify-center" style={{ width: `${share * 100}%`, background: CONF_COLORS[k] }} title={`${CONFIDENCE_LABELS[k]}: ${money(data.confidence[k].gp)}`}>
                    {share > 0.08 ? `${CONFIDENCE_LABELS[k]} ${pct(share * 100, 0)}` : ""}
                  </div>
                ) : null;
              })}
            </div>
            {t.adjustmentGp ? <p className="mt-1 text-[11px] text-violet-800">Includes account manager adjustments of {money(t.adjustmentGp)} GP, shown separately from recruiters' submissions.</p> : null}
          </div>
        </SectionBlock>

        <SectionBlock section={{ id: "reps", title: "Recruiter forecasts" }} subtitle="Select a recruiter for their client rows, assumptions and review actions">
          <DataTable groups={GROUPS} rows={data.reps} rowKey="repId" presets={PRESETS} defaultSort={{ key: "forecastGp", dir: "desc" }} onRowClick={setRow} totals={{ ...t, name: "Total" }} pageSize={30} />
        </SectionBlock>

        <SectionBlock section={{ id: "handoff", title: "Team confirmation and hand-off to Forecasting" }} subtitle="Once sent, Finance review, commentary, adjustments and approval happen only in the Forecasting module">
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-sky-100 p-3">
              <h4 className="text-xs font-semibold text-sky-900">Team confirmation</h4>
              {c ? (
                <div className={`rounded-md border px-3 py-2 text-xs ${c.stale ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"}`}>
                  <p className="font-semibold">
                    Version {c.version} confirmed by {c.confirmedBy.name} on {formatDate(c.confirmedAt.slice(0, 10))}: revenue {money(c.totals.revenue)}, GP {money(c.totals.gp)}
                  </p>
                  <p>
                    {c.submissions.length} recruiters included{c.excludedRepIds.length ? `, ${c.excludedRepIds.length} excluded` : ""}.
                    {c.stale ? " A forecast in it has since been returned or resubmitted — confirm the team forecast again before sending." : ""}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">Not confirmed yet for {data.scope.label}.</p>
              )}
              {p.confirm ? (
                <div className="space-y-1.5">
                  {excluded ? (
                    <label className="flex items-start gap-2 text-xs text-slate-700">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-sky-700" />
                      Confirm without the {excluded} recruiters who aren't confirmed yet ({b.unconfirmed.count} awaiting review or revision, {b.missing.count} not submitted). Only confirmed forecasts are included.
                    </label>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="min-w-[200px] flex-1 rounded border border-sky-200 px-2 py-1 text-xs" />
                    <button
                      type="button"
                      disabled={busy || !b.confirmed.count || (excluded > 0 && !ack)}
                      onClick={() => run(() => salesForecast.confirmTeam(viewer, { note, acknowledgeExcluded: ack }), (x) => ({ text: `Team forecast version ${x.version} confirmed.` }))}
                      className={`${btn} border-green-700 bg-green-700 text-white hover:bg-green-800`}
                    >
                      <FiCheckCircle size={13} /> Confirm team forecast
                    </button>
                  </div>
                  {!b.confirmed.count ? <p className="text-[11px] text-slate-500">Confirm individual recruiters' forecasts first.</p> : null}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Your role can review forecasts but not confirm the team forecast.</p>
              )}
              {data.otherConfirmations.length ? (
                <div className="border-t border-sky-100 pt-2 text-xs text-slate-700">
                  <p className="font-semibold text-sky-900">Team confirmations in your view</p>
                  {data.otherConfirmations.map((o) => (
                    <p key={o.id}>
                      {o.teamNames.join(", ")}: version {o.version} by {o.confirmedBy.name}, GP {money(o.totals.gp)}
                      {o.stale ? " (needs re-confirming)" : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-lg border border-sky-100 p-3">
              <h4 className="text-xs font-semibold text-sky-900">Send to Forecasting</h4>
              <p className="text-[11px] text-slate-600">
                Sends the confirmed monthly client rows with their drivers (contractors, hours, rates, direct costs, revenue, GP, confidence) and account manager adjustments as an immutable,
                versioned snapshot. Sending the same version again doesn't post twice.
              </p>
              {p.push ? (
                <button
                  type="button"
                  disabled={busy || !c}
                  onClick={() =>
                    run(
                      () => salesForecast.sendToForecasting(viewer, { confirmationId: c.id }),
                      (x) =>
                        x.status === "failed"
                          ? { error: true, text: "Forecasting rejected the transfer; the confirmed forecast is unchanged. See the errors below." }
                          : { text: x.duplicate ? `Version ${x.version} was already received (${x.id}); nothing was posted twice.` : `Sent: Forecasting received version ${x.version} (${x.id}).` }
                    )
                  }
                  className={`${btn} border-sky-900 bg-sky-900 text-white hover:bg-sky-800`}
                >
                  <FiSend size={13} /> Send to Forecasting
                </button>
              ) : (
                <p className="text-[11px] text-slate-500">Your role can't send forecasts to Forecasting.</p>
              )}
              {lastTransfer?.status === "failed" ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <p className="flex items-center gap-1 font-semibold">
                    <FiAlertTriangle size={12} /> Transfer {lastTransfer.id} failed validation
                  </p>
                  <ul className="list-disc pl-5">
                    {lastTransfer.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.transfers.length ? (
                <div className="overflow-auto rounded-lg border border-sky-100">
                  <table className="w-full text-xs">
                    <thead className="bg-sky-50 text-sky-900">
                      <tr>
                        {["Transfer", "Teams", "Version", "Sent", "Status", "Records", "Revenue sent", "GP sent"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-2 py-1 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {data.transfers.map((x) => (
                        <tr key={x.id}>
                          <td className="px-2 py-1 font-mono text-[11px]">{x.id}</td>
                          <td className="px-2 py-1">{x.teamNames.join(", ")}</td>
                          <td className="px-2 py-1">v{x.version}</td>
                          <td className="px-2 py-1">{formatDate(x.sentAt.slice(0, 10))} · {x.sentBy.name}</td>
                          <td className={`px-2 py-1 font-semibold ${x.status === "received" ? "text-green-700" : "text-red-700"}`}>{x.status === "received" ? "Received by Forecasting" : "Failed validation"}</td>
                          <td className="px-2 py-1 text-right">{x.recordCount}</td>
                          <td className="px-2 py-1 text-right">{money(x.reconciliation.sentRevenue)}</td>
                          <td className="px-2 py-1 text-right">{money(x.reconciliation.sentGp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Nothing sent this quarter yet.</p>
              )}
            </div>
          </div>
          {message ? <p className={`mt-2 text-xs ${message.error ? "text-red-700" : "text-green-800"}`}>{message.text}</p> : null}
        </SectionBlock>

        <ContextFooter meta={meta} />
        <SubmissionDrawer row={row} permissions={p} onClose={() => setRow(null)} onChanged={() => setRev((r) => r + 1)} />
      </div>
    </SectionAccordion>
  );
}
