import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { FiInfo } from "react-icons/fi";
import { getWhatIfBaseline, salesForecast, scenarios as scenarioApi } from "../../services/salesAnalyticsApi";
import { clearSalesQueryCache, useSalesQuery } from "../../hooks/useSalesQuery";
import { useSalesAccess } from "../../access/SalesAccessContext";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { DEFAULT_FILTERS } from "../../filters/filterSchema";
import { countChanges, emptyAssumptions, scenarioBridge, simulate } from "../../calc/whatIf";
import { formatDate } from "../../calc/dates";
import { compactMoney, count, money, pct, signedMoney } from "../../utils/format";
import SectionBlock from "../../components/SectionBlock";
import PageToolbar from "../../components/PageToolbar";
import ContextFooter from "../../components/ContextFooter";
import { EmptyState, Spinner } from "../../../Budget/budgetHelpers";
import ScenarioBar, { STATUS_LABEL, STATUS_STYLE } from "./ScenarioBar";
import { PanelTabs, Grid, td, tdLeft } from "./inputs";
import { CostsPanel, ExistingPanel, ExpensesPanel, PipelinePanel, RatesPanel, StartsPanel } from "./AssumptionPanels";
import { BridgePanel, ClientPanel, CommissionPanel, ComparePanel, ConfidencePanel, MonthlyPanel } from "./ImpactPanels";
import GoalPlanner from "./GoalPlanner";

const clone = (v) => JSON.parse(JSON.stringify(v));
const ZERO_GLOBALS = ["hoursPct", "billRatePct", "payRatePct", "payrollTaxPp", "wcPp", "benefitsPerHour", "odcPerContractorMonth"];
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== "" && v !== undefined));

// Where an insight's What-If lever opens: [assumption tab, impact tab].
const FOCUS = {
  commission: ["pipeline", "commission"],
  staffing: ["existing", "confidence"],
  rates: ["rates", "bridge"],
  pipeline: ["pipeline", "confidence"],
  quarter: ["existing", "compare"],
};
const LEVER_TAB = { volume: "existing", hours: "rates", billRate: "rates", payRate: "rates", mix: "rates", burden: "costs", directLabor: "costs", odc: "costs", margin: "rates", fees: "starts" };
// Where an applied goal plan's changes are easiest to see.
const PLAN_TAB = { balanced: "rates", billRate: "rates", hours: "rates", extension: "existing", pipeline: "pipeline", starts: "starts" };

function ResultCard({ label, value, base, sub, fmt = compactMoney, invert = false }) {
  const d = value != null && base != null ? value - base : null;
  const good = d != null && (invert ? d < 0 : d > 0);
  return (
    <div className="flex min-w-0 flex-[1_1_170px] flex-col gap-0.5 rounded-lg border border-sky-100 bg-white px-3 py-2">
      <span className="truncate text-xs font-medium text-sky-700">{label}</span>
      <span className="text-lg font-bold leading-tight text-sky-900 tabular-nums">{value == null ? "Restricted" : fmt(value)}</span>
      {d != null ? (
        <span className="text-[11px] text-slate-600">
          Baseline {fmt(base)}
          {Math.abs(d) > 0.005 ? <span className={`ml-1 font-semibold ${good ? "text-green-700" : "text-red-700"}`}>{fmt === compactMoney ? signedMoney(d, { compact: true }) : `${d > 0 ? "+" : ""}${fmt(d)}`}</span> : null}
        </span>
      ) : null}
      {sub ? <span className="text-[11px] leading-snug text-slate-500">{sub}</span> : null}
    </div>
  );
}

export default function WhatIfPage() {
  const { viewer, access, can } = useSalesAccess();
  const { options } = useSalesFilters();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const own = access?.scope?.kind === "own";
  const repArg = own ? undefined : params.get("sp") || location.state?.repId || undefined;
  const { data: baseline, meta, error } = useSalesQuery(getWhatIfBaseline, DEFAULT_FILTERS, viewer, repArg ? { repId: repArg } : {});
  const prefill = location.state?.prefill || {};
  const focus = FOCUS[prefill.focus] || [LEVER_TAB[prefill.lever] || "existing", null];

  const [assumptions, setAssumptions] = useState(emptyAssumptions);
  const [current, setCurrent] = useState(null);
  const [name, setName] = useState("");
  const [list, setList] = useState([]);
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState(null);
  const [leftTab, setLeftTab] = useState(focus[0]);
  const [rightTab, setRightTab] = useState(focus[1]);

  const repId = baseline?.rep?.id;
  const canSave = can("create_scenario");
  const canSubmit = can("edit_own_forecast") && own && repId === viewer.userId;
  const costDetail = baseline?.defaults?.burdenRate != null;

  // A different recruiter starts from their baseline.
  useEffect(() => {
    setAssumptions(emptyAssumptions());
    setCurrent(null);
    setName("");
    setNotice(null);
  }, [repId]);

  const reloadScenarios = useCallback(() => {
    if (!repId || !canSave) return;
    scenarioApi.list(viewer, repId).then(setList).catch(() => setList([]));
  }, [repId, canSave, viewer]);
  const reloadStatus = useCallback(() => {
    if (!repId) return;
    salesForecast.status(viewer, repId).then(setStatus).catch(() => setStatus(null));
  }, [repId, viewer]);
  useEffect(() => {
    reloadScenarios();
    return scenarioApi.subscribe(reloadScenarios);
  }, [reloadScenarios]);
  useEffect(() => {
    reloadStatus();
    return salesForecast.subscribe(reloadStatus);
  }, [reloadStatus]);

  const result = useMemo(() => (baseline?.rep ? simulate(baseline, assumptions) : null), [baseline, assumptions]);
  const base = useMemo(() => (baseline?.rep ? simulate(baseline) : null), [baseline]);
  const bridge = useMemo(() => (baseline?.rep && rightTab === "bridge" ? scenarioBridge(baseline, assumptions) : null), [baseline, assumptions, rightTab]);
  const changes = countChanges(assumptions);
  const dirty = current ? JSON.stringify(assumptions) !== JSON.stringify(current.assumptions) : changes > 0;

  const set = useMemo(
    () => ({
      global: (k, v) => setAssumptions((a) => ({ ...a, global: { ...a.global, [k]: v == null && ZERO_GLOBALS.includes(k) ? 0 : v } })),
      assignment: (id, k, v) => setAssumptions((a) => mapSet(a, "assignments", id, k, v)),
      client: (id, k, v) => setAssumptions((a) => mapSet(a, "clients", id, k, v)),
      opp: (id, k, v) => setAssumptions((a) => mapSet(a, "opportunities", id, k, v)),
      addStart: (s) => setAssumptions((a) => ({ ...a, newStarts: [...a.newStarts, s] })),
      updateStart: (i, patch) => setAssumptions((a) => ({ ...a, newStarts: a.newStarts.map((s, j) => (j === i ? { ...s, ...patch } : s)) })),
      removeStart: (i) => setAssumptions((a) => ({ ...a, newStarts: a.newStarts.filter((_, j) => j !== i) })),
      expense: (k, v) => setAssumptions((a) => ({ ...a, expenses: clean({ ...a.expenses, [k]: v }) })),
    }),
    []
  );

  if (error) return <div className="rounded-xl border border-sky-100 bg-white"><EmptyState label={error.message} /></div>;
  if (!baseline || !result) return <Spinner label="Building your quarter baseline…" />;
  if (!baseline.rep) return <div className="rounded-xl border border-sky-100 bg-white"><EmptyState label="No recruiter in your scope." /></div>;

  const say = (text, isError = false) => setNotice({ text, error: isError });
  const run = async (fn, ok) => {
    try {
      const out = await fn();
      if (ok) say(typeof ok === "function" ? ok(out) : ok);
      return out;
    } catch (e) {
      say(e.message || "That didn't work.", true);
      return null;
    }
  };

  const onLoad = (id) => {
    const s = list.find((x) => x.id === id);
    setCurrent(s || null);
    setAssumptions(s ? clone(s.assumptions) : emptyAssumptions());
    setName(s?.name || "");
    setNotice(null);
  };
  const save = async (asNew) => {
    const saved = await run(
      () => scenarioApi.save(viewer, { id: asNew ? undefined : current?.id, repId, name: asNew && current && name === current.name ? `${name} (copy)` : name, assumptions }),
      (s) => `Saved “${s.name}”.`
    );
    if (saved) {
      setCurrent(clone(saved));
      setName(saved.name);
    }
  };

  const picker = !own ? (
    <label className="flex items-center gap-2 text-sm text-sky-800">
      Recruiter
      <select
        value={repId}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("sp", e.target.value);
          setParams(next, { state: location.state });
        }}
        className="rounded-md border border-sky-200 bg-white px-2 py-1.5 text-sm"
      >
        {(options?.reps || []).map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </label>
  ) : null;

  const leftTabs = [
    { id: "existing", label: "Existing contractors", badge: Object.keys(assumptions.assignments).length + (assumptions.global.extensionProbability != null ? 1 : 0) || null },
    { id: "rates", label: "Rates, hours & clients", badge: Object.keys(assumptions.clients).length + ["billRatePct", "payRatePct", "hoursPct"].filter((k) => assumptions.global[k]).length || null },
    { id: "starts", label: "New starts", badge: assumptions.newStarts.length || null },
    { id: "pipeline", label: "Pipeline", badge: Object.keys(assumptions.opportunities).length || null },
    { id: "costs", label: "Direct costs", badge: ["payrollTaxPp", "wcPp", "benefitsPerHour", "odcPerContractorMonth"].filter((k) => assumptions.global[k]).length || null },
    { id: "expenses", label: "My expenses", badge: Object.keys(assumptions.expenses || {}).length || null },
  ];
  const rightTabs = [
    { id: "commission", label: "Commission" },
    { id: "month", label: "By month" },
    { id: "client", label: "By client" },
    { id: "bridge", label: "GP bridge" },
    { id: "confidence", label: "Confidence & contractors" },
    { id: "compare", label: "Compare" },
  ];
  const right = rightTab || (result.commission ? "commission" : "month");
  const panelProps = { baseline, a: assumptions, set, costDetail };

  return (
    <div className="space-y-3">
      <PageToolbar
        title={`What-If & ${canSubmit ? "My" : "Recruiting"} Forecast · ${baseline.rep.name}`}
        subtitle={`${baseline.quarter.label} · starts from actual to date plus each assignment's current run-rate, extensions at the historical rate and pipeline at stage probability`}
      >
        {picker}
      </PageToolbar>

      {location.state?.fromInsight ? (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2 text-xs text-sky-900">
          <FiInfo size={13} /> Opened from the insight “{location.state.fromInsight}”.
        </div>
      ) : null}
      {!canSubmit && can("create_scenario") ? (
        <p className="text-xs text-slate-600">You can model {baseline.rep.name}'s desk here; only {baseline.rep.name} can submit their own recruiting forecast. Review submissions on the Team Forecast tab.</p>
      ) : null}

      <ScenarioBar
        scenarios={list}
        current={current}
        name={name}
        setName={setName}
        dirty={dirty}
        changes={changes}
        canSave={canSave}
        canSubmit={canSubmit}
        status={status}
        notice={notice}
        onLoad={onLoad}
        onSave={() => save(false)}
        onSaveAs={() => save(true)}
        onDelete={async () => {
          if (!current || !window.confirm(`Delete the scenario “${current.name}”?`)) return;
          await run(() => scenarioApi.remove(viewer, current.id), "Scenario deleted.");
          onLoad(null);
        }}
        onReset={() => setAssumptions(emptyAssumptions())}
        onSetForecast={() => run(() => scenarioApi.setMyForecast(viewer, current.id), `“${current.name}” is now your recruiting forecast.`)}
        onSubmit={async (note) => {
          const out = await run(() => salesForecast.submit(viewer, { note }), (s) => `Version ${s.version} submitted to your account manager.`);
          if (out) clearSalesQueryCache();
          return !!out;
        }}
      />

      <div className="flex flex-wrap gap-2">
        <ResultCard label="Quarter revenue" value={result.quarter.revenue} base={base.quarter.revenue} />
        <ResultCard label="Quarter GP" value={result.quarter.gp} base={base.quarter.gp} sub={`GM ${pct(result.quarter.gmPct)} (baseline ${pct(base.quarter.gmPct)})`} />
        <ResultCard
          label="GP target attainment"
          value={result.attainment.gp}
          base={base.attainment.gp}
          fmt={(v) => pct(v, 1)}
          sub={result.attainment.gpGap > 0 ? `${money(result.attainment.gpGap)} still to reach target` : "Quarter GP target met"}
        />
        <ResultCard label="Recruiting contribution" value={result.contribution} base={base.contribution} sub={`GP less ${canSubmit ? "your" : "the recruiter's"} recruiting expense (not EBITDA)`} />
        <ResultCard
          label={canSubmit ? "My quarter commission" : "Quarter commission"}
          value={result.commission?.quarterTotal ?? null}
          base={base.commission?.quarterTotal ?? null}
          sub={result.commission ? `${money(result.commission.earnedToDate)} earned so far · rest is projected` : null}
        />
        <ResultCard
          label="Contractors at quarter end"
          value={result.activity.activeAtEnd}
          base={base.activity.activeAtEnd}
          fmt={(v) => count(v, 1)}
          sub={`${count(result.activity.starts, 1)} starts · ${count(result.activity.ends, 1)} ends in the quarter`}
        />
      </div>

      <SectionBlock section={{ id: "goal", title: "Plan for a goal" }} subtitle="Say the result you want; each plan works out the assumptions that reach it, and Apply fills them in">
        <GoalPlanner
          key={baseline.rep.id}
          baseline={baseline}
          base={base}
          result={result}
          assumptions={assumptions}
          costDetail={costDetail}
          own={canSubmit}
          onApply={(plan, metric) => {
            setAssumptions(plan.assumptions);
            setLeftTab(PLAN_TAB[plan.id]);
            if (metric === "commission") setRightTab("commission");
          }}
        />
      </SectionBlock>

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <SectionBlock section={{ id: "assumptions", title: "Assumptions" }} subtitle="Empty fields use the baseline; changed fields are highlighted">
          <PanelTabs tabs={leftTabs} active={leftTab} onChange={setLeftTab} label="Assumption groups" />
          {leftTab === "existing" ? <ExistingPanel {...panelProps} /> : null}
          {leftTab === "rates" ? <RatesPanel {...panelProps} highlight={prefill.clientIds || []} /> : null}
          {leftTab === "starts" ? <StartsPanel {...panelProps} /> : null}
          {leftTab === "pipeline" ? <PipelinePanel {...panelProps} /> : null}
          {leftTab === "costs" ? <CostsPanel {...panelProps} /> : null}
          {leftTab === "expenses" ? <ExpensesPanel {...panelProps} /> : null}
        </SectionBlock>
        <SectionBlock section={{ id: "impact", title: "Impact on the quarter" }} subtitle={`${baseline.quarter.label} · baseline vs this scenario`}>
          <PanelTabs tabs={rightTabs} active={right} onChange={setRightTab} label="Impact views" />
          {right === "commission" ? <CommissionPanel baseline={baseline} result={result} base={base} /> : null}
          {right === "month" ? <MonthlyPanel result={result} base={base} /> : null}
          {right === "client" ? <ClientPanel result={result} base={base} /> : null}
          {right === "bridge" && bridge ? <BridgePanel bridge={bridge} result={result} base={base} costDetail={costDetail} /> : null}
          {right === "confidence" ? <ConfidencePanel result={result} base={base} /> : null}
          {right === "compare" ? <ComparePanel baseline={baseline} result={result} base={base} submitted={status?.latest} /> : null}
        </SectionBlock>
      </div>

      {status?.history?.length ? (
        <SectionBlock section={{ id: "submissions", title: canSubmit ? "My forecast submissions" : `${baseline.rep.name}'s forecast submissions` }} subtitle="Every submitted version is kept; the account manager reviews the latest">
          <Grid head={["Version", "Scenario", "Submitted", "Status", "Quarter revenue", "Quarter GP", "Account manager adjustments (GP)", "Account manager comment"]} maxHeight="none">
            {status.history.map((s) => {
              const review = s.reviews?.[s.reviews.length - 1];
              return (
                <tr key={s.id}>
                  <td className={tdLeft}>v{s.version}{s.sample ? <span className="ml-1 text-[10px] text-slate-400">sample</span> : null}</td>
                  <td className={td}>{s.scenarioName}</td>
                  <td className={td}>{formatDate(s.submittedAt.slice(0, 10))}</td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                  </td>
                  <td className={td}>{money(s.snapshot.quarter.revenue)}</td>
                  <td className={td}>{money(s.snapshot.quarter.gp)}</td>
                  <td className={td}>{s.adjustmentTotal?.gp ? signedMoney(s.adjustmentTotal.gp) : "—"}</td>
                  <td className={`${td} max-w-[280px] truncate text-left`} title={review?.comment || ""}>{review?.comment || "—"}</td>
                </tr>
              );
            })}
          </Grid>
        </SectionBlock>
      ) : null}

      <ContextFooter meta={meta} />
    </div>
  );
}

/** Set or clear one field of a keyed assumption map, dropping empty entries. */
function mapSet(a, mapKey, id, k, v) {
  const entry = clean({ ...(a[mapKey][id] || {}), [k]: v });
  const next = { ...a[mapKey] };
  if (Object.keys(entry).length) next[id] = entry;
  else delete next[id];
  return { ...a, [mapKey]: next };
}
