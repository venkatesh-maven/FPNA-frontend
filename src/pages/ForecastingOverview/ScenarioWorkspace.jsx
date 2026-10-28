import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { getDecimalPrecision } from "../../utils/formatters";
import { DEPENDENT_LINES, buildStatementMonthly, closedMonthsFrom, hierarchyFromMonthly, quarterTotals } from "./scenarioStatement";

const API = `${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling`;

const parseN = (n) => {
  if (n == null) return 0;
  const num = Number(typeof n === "string" ? n.replace(/,/g, "") : n);
  return isFinite(num) ? num : 0;
};
const fmtK = (n) => {
  const num = parseN(n);
  return `${num < 0 ? "-" : ""}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
};
const fmtPct = (n) => `${parseN(n).toFixed(getDecimalPrecision())}%`;

// The workspace P&L, recalculated client-side on every driver edit from the
// same monthly statement the backend uses (scenarioStatement.js mirrors
// forecasting/scenario_pnl.py). Closed months stay at actuals. Also returns,
// per dependent line, the base, the formula suggestion and the value after
// the user's Keep Base / Override decision.
function buildHierarchy(baseRevDrivers, baseCostDrivers, scnRevDrivers, scnCostDrivers, rules, months, decisions, closedMonths) {
  const overrides = {};
  DEPENDENT_LINES.forEach((key) => {
    const d = decisions[key];
    if (d?.decision === "kept_base") overrides[key] = { decision: "kept_base" };
    else if (d?.decision === "overridden") overrides[key] = { decision: "overridden", scenario_value: parseN(d.overrideValue) };
  });
  const formula = buildStatementMonthly(baseRevDrivers, baseCostDrivers, scnRevDrivers, scnCostDrivers, rules, months, closedMonths);
  const statement = buildStatementMonthly(baseRevDrivers, baseCostDrivers, scnRevDrivers, scnCostDrivers, rules, months, closedMonths, overrides);
  const baseTotals = quarterTotals(statement.base, months);
  const suggestedTotals = quarterTotals(formula.scenario, months);
  const resolvedTotals = quarterTotals(statement.scenario, months);
  return {
    ...hierarchyFromMonthly(statement, months),
    dependentSuggestions: Object.fromEntries(DEPENDENT_LINES.map((key) => [
      key, { base: baseTotals[key], suggested: suggestedTotals[key], resolved: resolvedTotals[key] },
    ])),
  };
}

function averageByDriver(drivers, months, names) {
  const out = {};
  names.forEach((name) => {
    const vals = months.map((m) => {
      const d = drivers.find((x) => x.month === m && x.driver_name === name);
      return d ? Number(d.driver_value) : null;
    }).filter((v) => v != null);
    out[name] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  return out;
}

function expandToMonths(value, months) {
  return months.map((m) => ({ month: m, driver_value: Number(value) || 0 }));
}

const REV_DRIVER_META = [
  { key: "volume", label: "Volume", hint: "Units sold per month", isPercent: false, defaultVal: 1000 },
  { key: "selling_price", label: "Rate / Price", hint: "Average selling price per unit", isPercent: false, defaultVal: 100 },
  { key: "growth_rate", label: "Growth Rate", hint: "Period-over-period growth applied to price", isPercent: true, defaultVal: 0 },
  { key: "acquisition_rate", label: "Mix / Acquisition", hint: "Customer mix or acquisition multiplier", isPercent: false, defaultVal: 1 },
];

function VarianceChip({ variance, variancePct }) {
  if (!variance) return <span className="text-xs text-slate-400">—</span>;
  const positive = variance > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {positive ? "▲" : "▼"} {fmtK(Math.abs(variance))} ({Math.abs(variancePct).toFixed(1)}%)
    </span>
  );
}

function LineTypeBadge({ type }) {
  const cfg = {
    driver: { label: "Driver", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    dependent: { label: "Dependent", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    computed: { label: "Computed", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  }[type] || { label: type, cls: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
}

export default function ScenarioWorkspace({
  year, quarter, months, currency,
  scenarioId, isSystemScenario, systemScenarioName, scenarioDisplayName,
  editableOverride, // true while creating a brand-new scenario before it has an id
  onClose, addToast, markFinal, onRequestSetFinal, onSaved,
}) {
  const { token } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [rules, setRules] = useState([]);

  const [revValues, setRevValues] = useState({});
  const [payrollMode, setPayrollMode] = useState("flat");
  const [costValues, setCostValues] = useState({});
  const [decisions, setDecisions] = useState({
    cogs: { decision: "pending" },
    sales_commission: { decision: "pending" },
    shipping_delivery: { decision: "pending" },
  });
  const [expanded, setExpanded] = useState({ revenue: false, payroll: false });
  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Original per-month driver rows as fetched, plus which top-level fields
  // the user actually touched this session. On Save, a touched field is
  // written as the new quarter-level value repeated across all 3 months;
  // an untouched field is written back exactly as it was fetched (its
  // original per-month values, if any) — otherwise saving a scenario that
  // has real month-to-month variation (built via the old per-month Edit
  // grid) would silently flatten that seasonality to one repeated number,
  // since this workspace only edits at the quarter level.
  const [originalRevDrivers, setOriginalRevDrivers] = useState([]);
  const [originalCostDrivers, setOriginalCostDrivers] = useState([]);
  const [touchedRev, setTouchedRev] = useState({});
  const [touchedCost, setTouchedCost] = useState({});
  const [payrollTouched, setPayrollTouched] = useState(false);

  // Opening ANY scenario here — system or custom, final or draft — never
  // edits it in place: handleSave always POSTs a brand-new scenario and the
  // one you opened is left exactly as it was (see handleSave below). So
  // there is nothing to "lock" for editing purposes; inputs stay enabled
  // regardless of what's open. isCurrentlyFinal is kept only to label the
  // badge and to hide "Mark as final" on a scenario that already is.
  const editable = editableOverride != null ? editableOverride : true;
  const isCurrentlyFinal = !!pnl?.is_final;

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = isSystemScenario
        ? `${API}/${year}/scenarios/system/pnl?quarter=${quarter}&scenario_name=${encodeURIComponent(systemScenarioName)}&currency=${currency}`
        : `${API}/${year}/scenarios/${scenarioId}/pnl?quarter=${quarter}&currency=${currency}`;
      const [pnlRes, rulesRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }),
        fetch(`${API}/${year}/dependent-rules`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }),
      ]);
      if (!pnlRes.ok) throw new Error(`HTTP ${pnlRes.status}`);
      const pnlData = await pnlRes.json();
      const rulesData = rulesRes.ok ? await rulesRes.json() : { rules: [] };

      setPnl(pnlData);
      setRules(rulesData.rules || []);

      const scnRev = pnlData.revenue_drivers?.scenario_drivers || [];
      const scnCost = pnlData.cost_drivers?.scenario_drivers || [];

      setOriginalRevDrivers(scnRev);
      setOriginalCostDrivers(scnCost);
      setTouchedRev({});
      setTouchedCost({});
      setPayrollTouched(false);

      setRevValues(averageByDriver(scnRev, months, REV_DRIVER_META.map((d) => d.key)));

      const costAvg = averageByDriver(scnCost, months, ["headcount_cost", "headcount", "avg_salary", "non_people_costs", "capex", "interest"]);
      setCostValues(costAvg);
      setPayrollMode(costAvg.headcount > 0 && costAvg.avg_salary > 0 ? "detailed" : "flat");

      // Rehydrate any previously-saved Accept/Override/Keep Base decision —
      // without this, reopening a scenario always shows "Suggested" again
      // and silently drops back to the fresh formula value even though the
      // backend now honors the saved one (see dependent_decisions on the
      // /pnl response). The persisted dollar amount is read back from
      // pnlData.lines itself, since the backend already resolved it there.
      const savedDecisions = pnlData.dependent_decisions || {};
      const lineByKey = {};
      (pnlData.lines || []).forEach((l) => { lineByKey[l.key] = l; });
      setDecisions({
        cogs: { decision: savedDecisions.cogs || "pending", overrideValue: lineByKey.cogs?.scenario },
        sales_commission: { decision: savedDecisions.sales_commission || "pending", overrideValue: lineByKey.sales_commission?.scenario },
        shipping_delivery: { decision: savedDecisions.shipping_delivery || "pending", overrideValue: lineByKey.shipping_delivery?.scenario },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, quarter, currency, scenarioId, isSystemScenario, systemScenarioName, months, token]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const loadHistory = useCallback(async () => {
    if (!scenarioId || isSystemScenario) { setHistory([]); return; }
    try {
      const res = await fetch(`${API}/${year}/scenarios/${scenarioId}/assumptions?quarter=${quarter}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.assumptions || []);
    } catch {
      // non-critical — history panel just stays empty
    }
  }, [year, quarter, scenarioId, isSystemScenario, token]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const baseRevDrivers = pnl?.revenue_drivers?.base_drivers || [];
  const baseCostDrivers = pnl?.cost_drivers?.base_drivers || [];

  const scnRevDriversLive = useMemo(() => (
    REV_DRIVER_META.flatMap((d) => expandToMonths(revValues[d.key] ?? d.defaultVal, months).map((row) => ({ ...row, driver_name: d.key })))
  ), [revValues, months]);

  const scnCostDriversLive = useMemo(() => {
    const rows = [];
    if (payrollMode === "detailed") {
      rows.push(...expandToMonths(costValues.headcount ?? 0, months).map((r) => ({ ...r, driver_name: "headcount" })));
      rows.push(...expandToMonths(costValues.avg_salary ?? 0, months).map((r) => ({ ...r, driver_name: "avg_salary" })));
    } else {
      rows.push(...expandToMonths(costValues.headcount_cost ?? 0, months).map((r) => ({ ...r, driver_name: "headcount_cost" })));
    }
    rows.push(...expandToMonths(costValues.non_people_costs ?? 0, months).map((r) => ({ ...r, driver_name: "non_people_costs" })));
    rows.push(...expandToMonths(costValues.capex ?? 0, months).map((r) => ({ ...r, driver_name: "capex" })));
    rows.push(...expandToMonths(costValues.interest ?? 0, months).map((r) => ({ ...r, driver_name: "interest" })));
    // COGS isn't edited here (it's a dependent line), but the scenario's own
    // cogs driver is its COGS reference, so it carries through unchanged.
    rows.push(...originalCostDrivers.filter((r) => r.driver_name === "cogs"));
    return rows;
  }, [costValues, payrollMode, months, originalCostDrivers]);

  const closedMonths = useMemo(() => closedMonthsFrom(pnl?.month_sources, months), [pnl, months]);

  const hierarchy = useMemo(() => {
    if (!pnl) return null;
    return buildHierarchy(baseRevDrivers, baseCostDrivers, scnRevDriversLive, scnCostDriversLive, rules, months, decisions, closedMonths);
  }, [pnl, baseRevDrivers, baseCostDrivers, scnRevDriversLive, scnCostDriversLive, rules, months, decisions, closedMonths]);

  // What actually gets persisted on Save: touched fields use the new
  // quarter-level value (expanded across all 3 months); untouched fields
  // are written back exactly as originally fetched, preserving any
  // month-to-month variation the quarter-level UI here never displays.
  const buildSaveRevenueDrivers = useCallback(() => {
    const rows = [];
    REV_DRIVER_META.forEach((d) => {
      if (touchedRev[d.key]) {
        rows.push(...expandToMonths(revValues[d.key] ?? d.defaultVal, months).map((r) => ({ ...r, driver_name: d.key })));
      } else {
        rows.push(...originalRevDrivers.filter((r) => r.driver_name === d.key));
      }
    });
    return rows;
  }, [touchedRev, revValues, months, originalRevDrivers]);

  const buildSaveCostDrivers = useCallback(() => {
    const rows = [];
    if (payrollTouched) {
      if (payrollMode === "detailed") {
        rows.push(...expandToMonths(costValues.headcount ?? 0, months).map((r) => ({ ...r, driver_name: "headcount" })));
        rows.push(...expandToMonths(costValues.avg_salary ?? 0, months).map((r) => ({ ...r, driver_name: "avg_salary" })));
      } else {
        rows.push(...expandToMonths(costValues.headcount_cost ?? 0, months).map((r) => ({ ...r, driver_name: "headcount_cost" })));
      }
    } else {
      rows.push(...originalCostDrivers.filter((r) => ["headcount", "avg_salary", "headcount_cost"].includes(r.driver_name)));
    }
    ["non_people_costs", "capex", "interest"].forEach((key) => {
      if (touchedCost[key]) {
        rows.push(...expandToMonths(costValues[key] ?? 0, months).map((r) => ({ ...r, driver_name: key })));
      } else {
        rows.push(...originalCostDrivers.filter((r) => r.driver_name === key));
      }
    });
    rows.push(...originalCostDrivers.filter((r) => r.driver_name === "cogs"));
    return rows;
  }, [payrollTouched, payrollMode, costValues, touchedCost, months, originalCostDrivers]);

  const setDecision = (line, decision, overrideValue) => {
    setDecisions((p) => ({ ...p, [line]: { decision, overrideValue: overrideValue ?? p[line]?.overrideValue } }));
  };

  const buildAssumptions = useCallback(() => {
    if (!hierarchy) return [];
    const out = [];
    const byKey = {};
    hierarchy.lines.forEach((l) => { byKey[l.key] = l; });

    REV_DRIVER_META.forEach((d) => {
      out.push({
        line_key: "revenue", driver_key: d.key,
        base_value: null, scenario_value: revValues[d.key] ?? d.defaultVal,
        change_type: "driver", decision: "user_entered",
      });
    });

    if (payrollMode === "detailed") {
      out.push({ line_key: "payroll", driver_key: "headcount", scenario_value: costValues.headcount ?? 0, change_type: "driver", decision: "user_entered" });
      out.push({ line_key: "payroll", driver_key: "avg_salary", scenario_value: costValues.avg_salary ?? 0, change_type: "driver", decision: "user_entered" });
    } else {
      out.push({ line_key: "payroll", driver_key: "headcount_cost", scenario_value: costValues.headcount_cost ?? 0, change_type: "driver", decision: "user_entered" });
    }
    out.push({ line_key: "marketing", driver_key: "non_people_costs", scenario_value: costValues.non_people_costs ?? 0, change_type: "driver", decision: "user_entered" });
    out.push({ line_key: "depreciation_amortization", driver_key: "capex", scenario_value: costValues.capex ?? 0, change_type: "driver", decision: "user_entered" });
    out.push({ line_key: "interest_taxes", driver_key: "interest", scenario_value: costValues.interest ?? 0, change_type: "driver", decision: "user_entered" });

    ["cogs", "sales_commission", "shipping_delivery"].forEach((key) => {
      const line = byKey[key];
      const d = decisions[key] || { decision: "pending" };
      out.push({
        line_key: key, driver_key: null,
        base_value: line?.base ?? 0, scenario_value: line?.scenario ?? 0,
        change_type: "dependent_suggestion",
        decision: d.decision === "pending" ? "accepted" : d.decision,
      });
    });

    return out;
  }, [hierarchy, revValues, costValues, payrollMode, decisions]);

  const handleSave = async ({ scenario_name, description, visibility }) => {
    setSaving(true);
    try {
      // Always creates a NEW scenario — never PATCHes the one currently
      // open. Whatever was opened (a system scenario, a draft custom
      // scenario, or the current Final Forecast) is left completely
      // unchanged; the edits made here become a separate scenario with
      // this one recorded as its baseline.
      const payload = {
        scenario_name, description, visibility,
        baseline_scenario_name: scenarioDisplayName,
        revenue_drivers: buildSaveRevenueDrivers(),
        cost_drivers: buildSaveCostDrivers(),
      };

      const res = await fetch(`${API}/${year}/scenarios?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const targetId = data.scenario.id;

      const assumptionsRes = await fetch(`${API}/${year}/scenarios/${targetId}/assumptions?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assumptions: buildAssumptions() }),
      });
      if (!assumptionsRes.ok) {
        const err = await assumptionsRes.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${assumptionsRes.status}`);
      }

      addToast(`Saved as new scenario "${scenario_name}" — "${scenarioDisplayName}" was not changed.`, "success");
      setSaveModalOpen(false);
      onSaved && onSaved(targetId);
      onClose();
    } catch (e) {
      addToast(`Save failed: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[900] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl px-8 py-10 shadow-2xl text-slate-500 text-s">Loading scenario workspace…</div>
      </div>
    );
  }

  if (error || !pnl || !hierarchy) {
    return (
      <div className="fixed inset-0 z-[900] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl px-8 py-10 shadow-2xl text-red-600 text-s max-w-md text-center">
          Failed to load scenario workspace{error ? `: ${error}` : "."}
          <div className="mt-4"><button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-s font-semibold">Close</button></div>
        </div>
      </div>
    );
  }

  const byKey = {}; hierarchy.lines.forEach((l) => { byKey[l.key] = l; });
  const impact = hierarchy.impact_summary;

  return (
    <div className="fixed inset-0 z-[900] bg-slate-100 overflow-auto">
      <SaveScenarioModal
        open={saveModalOpen}
        saving={saving}
        defaultName={`${scenarioDisplayName} v2`}
        baselineName={scenarioDisplayName}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSave}
        keyChanges={buildAssumptions()}
      />

      {/* forecasting-page-header: this page's global theme (src/index.css
          .forecasting-pnl-theme rules) only force white text + recognize a
          dark header on elements matching this class (or the literal first
          child of the theme root) — without it, h1/h2/h3/button text here
          gets forced to the page's dark navy/teal palette meant for
          light-background content, becoming unreadable on this dark bar. */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 px-4 md:px-6 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-white min-w-0">
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center shrink-0">←</button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white truncate">{scenarioDisplayName}</h1>
                <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/20 text-xs font-semibold">{isSystemScenario ? "System Baseline" : "Custom"}</span>
                {isCurrentlyFinal && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">🔒 Final Forecast</span>}
              </div>
              <p className="text-xs text-sky-300 tabular-nums">
                {year} · {quarter} · {currency}
                {pnl?.baseline_scenario_name && <> · Baseline: <span className="text-sky-100">{pnl.baseline_scenario_name}</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isCurrentlyFinal && (
              <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hidden sm:inline">
                Editing here saves a new scenario — "{scenarioDisplayName}" stays unchanged
              </span>
            )}
            {/* Solid white here would collide with the header's forced-white
                text (see note above the <header> tag) and become invisible
                — use a solid accent color instead, like "Set as Final
                Forecast" below. Always enabled: Save never edits the open
                scenario in place, it always creates a new one, so there is
                no "read-only" state that blocks it. */}
            <button onClick={() => setSaveModalOpen(true)} className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-x font-semibold">
              Save as New Scenario
            </button>
            {!isCurrentlyFinal && (scenarioId || isSystemScenario) && (
              <span title={markFinal?.reason || undefined} className="inline-flex">
                <button
                  onClick={() => onRequestSetFinal && onRequestSetFinal({ id: scenarioId, scenario_name: scenarioDisplayName, is_system: isSystemScenario })}
                  disabled={!markFinal?.allowed}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-x font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                  Mark as final
                </button>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Sticky Scenario Impact Summary */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-4 flex-wrap text-x">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scenario Impact</span>
          {[
            ["Revenue", impact.revenue_impact],
            ["Gross Profit", impact.gross_profit_impact],
            ["EBITDA", impact.ebitda_impact],
            ["Net Income", impact.net_income_impact],
            ["Cash Impact", impact.cash_impact],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-slate-500">{label}:</span>
              <span className={`font-bold tabular-nums ${val >= 0 ? "text-emerald-700" : "text-red-700"}`}>{val >= 0 ? "+" : ""}{fmtK(val)}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto p-4 grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
        {/* A. Assumptions / Drivers panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-s font-bold text-slate-900 mb-3">Assumptions & Drivers</h2>

          <DriverGroup
            title="Revenue"
            editable={editable}
            expanded={expanded.revenue}
            onToggle={() => setExpanded((p) => ({ ...p, revenue: !p.revenue }))}
            base={byKey.revenue.base} scenario={byKey.revenue.scenario}
          >
            {REV_DRIVER_META.map((d) => (
              <DriverInput
                key={d.key}
                label={d.label} hint={d.hint} isPercent={d.isPercent}
                value={revValues[d.key] ?? d.defaultVal}
                editable={editable}
                onChange={(v) => {
                  setRevValues((p) => ({ ...p, [d.key]: v }));
                  setTouchedRev((p) => ({ ...p, [d.key]: true }));
                }}
              />
            ))}
          </DriverGroup>

          <DriverGroup
            title="Payroll"
            editable={editable}
            expanded={expanded.payroll}
            onToggle={() => setExpanded((p) => ({ ...p, payroll: !p.payroll }))}
            base={byKey.payroll.base} scenario={byKey.payroll.scenario}
          >
            <div className="flex gap-2 mb-2">
              {["flat", "detailed"].map((m) => (
                <button
                  key={m}
                  disabled={!editable}
                  onClick={() => { setPayrollMode(m); setPayrollTouched(true); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${payrollMode === m ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"}`}
                >
                  {m === "flat" ? "Flat Amount" : "Headcount × Salary"}
                </button>
              ))}
            </div>
            {payrollMode === "detailed" ? (
              <>
                <DriverInput label="Headcount" hint="Total headcount for the quarter" value={costValues.headcount ?? 0} editable={editable} onChange={(v) => { setCostValues((p) => ({ ...p, headcount: v })); setPayrollTouched(true); }} />
                <DriverInput label="Avg Salary" hint="Average fully-loaded cost per head" value={costValues.avg_salary ?? 0} editable={editable} onChange={(v) => { setCostValues((p) => ({ ...p, avg_salary: v })); setPayrollTouched(true); }} />
              </>
            ) : (
              <DriverInput label="Payroll Amount" hint="Flat quarterly payroll cost" value={costValues.headcount_cost ?? 0} editable={editable} onChange={(v) => { setCostValues((p) => ({ ...p, headcount_cost: v })); setPayrollTouched(true); }} />
            )}
          </DriverGroup>

          <SimpleDriverRow label="Marketing / Other OpEx" value={costValues.non_people_costs ?? 0} editable={editable} onChange={(v) => { setCostValues((p) => ({ ...p, non_people_costs: v })); setTouchedCost((p) => ({ ...p, non_people_costs: true })); }} line={byKey.marketing} />
          <SimpleDriverRow label="Depreciation & Amortization" value={costValues.capex ?? 0} editable={editable} onChange={(v) => { setCostValues((p) => ({ ...p, capex: v })); setTouchedCost((p) => ({ ...p, capex: true })); }} line={byKey.depreciation_amortization} />
          <SimpleDriverRow label="Interest & Taxes" value={costValues.interest ?? 0} editable={editable} onChange={(v) => { setCostValues((p) => ({ ...p, interest: v })); setTouchedCost((p) => ({ ...p, interest: true })); }} line={byKey.interest_taxes} />
        </div>

        {/* Right column: B. Financial Model / P&L (full width) + C. FPnAInsights suggestions below it */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-s font-bold text-slate-900">Profit & Loss</h2>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>GM: <b className="text-slate-800">{fmtPct(hierarchy.gross_margin_percent.scenario_pct)}</b></span>
                <span>EBITDA M: <b className="text-slate-800">{fmtPct(hierarchy.ebitda_margin_percent.scenario_pct)}</b></span>
              </div>
            </div>
            <div className="analytics-table-scroll overflow-x-auto">
              {/* table-fixed + % widths (not px) — plain table-auto let the
                  browser hand most of the panel's width to Line (its text
                  content reads as more "flexible" than the nowrap numeric
                  columns), leaving a big blank gap and pushing Variance out
                  past the visible width. Percentages instead of fixed px
                  keep all 4 columns scaling together with the panel at any
                  screen size, rather than forcing a scrollbar on narrow
                  screens or wasting space on wide ones.
                  The actual reason Variance stayed hidden even after that:
                  the shared `.analytics-table-scroll table` rule
                  (src/index.css) hardcodes `min-width: 1100px` for the
                  app's wide multi-column data grids — this compact 4-column
                  table inherited that same floor and was being forced to
                  1100px regardless of column %s. That rule isn't
                  `!important`, so an inline style here (which always wins
                  over a non-important stylesheet rule, whatever its
                  specificity) removes just the floor for this one table
                  without touching the shared class other tables rely on. */}
              <table className="w-full border-collapse text-s table-fixed" style={{ minWidth: 0 }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-[38%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Line</th>
                    <th className="w-[18%] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Base</th>
                    <th className="w-[18%] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Scenario</th>
                    <th className="w-[26%] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {hierarchy.lines.map((l) => (
                    <tr key={l.key} className={`border-b border-slate-100 ${l.type === "computed" ? "bg-zinc-50 font-bold" : ""}`}>
                      <td className="w-[38%] px-4 py-2.5 text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {l.label}
                          <LineTypeBadge type={l.type} />
                        </div>
                      </td>
                      <td className="w-[18%] px-3 py-2.5 text-right tabular-nums text-slate-500 whitespace-nowrap">{fmtK(l.base)}</td>
                      <td className="w-[18%] px-3 py-2.5 text-right tabular-nums text-slate-900 whitespace-nowrap">{fmtK(l.scenario)}</td>
                      <td className="w-[26%] px-3 py-2.5 text-right whitespace-nowrap"><VarianceChip variance={l.variance} variancePct={l.variance_pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* C. FPnAInsights suggestions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-s font-bold text-slate-900 mb-1">FPnAInsights Suggestions</h2>
            <p className="text-xs text-slate-500 mb-3">Dependent lines suggested from the Revenue change.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {["cogs", "sales_commission", "shipping_delivery"].map((key) => (
                <SuggestionCard
                  key={key}
                  label={{ cogs: "Cost of Goods Sold", sales_commission: "Sales Commission", shipping_delivery: "Shipping & Delivery" }[key]}
                  info={hierarchy.dependentSuggestions[key]}
                  decision={decisions[key]}
                  editable={editable}
                  onDecide={(decision, overrideValue) => setDecision(key, decision, overrideValue)}
                />
              ))}
            </div>
          </div>
        </div>

        {!isSystemScenario && scenarioId && (
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* hover:bg-slate-* would trip the page theme's button[class*="bg-slate-"]
                override even at rest (it matches on the substring, not the
                :hover state), forcing this button to a permanent navy
                background — the exact same navy the h2 below it is force-set
                to, making the title invisible. zinc isn't in that theme's
                intercept list. */}
            <button onClick={() => setHistoryOpen((p) => !p)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50">
              <h2 className="text-s font-bold text-slate-900 flex items-center gap-1.5">
                <span className={`transition-transform ${historyOpen ? "rotate-90" : ""}`}>▸</span> Assumptions &amp; Decision History
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">{history.length}</span>
              </h2>
            </button>
            {historyOpen && (
              history.length === 0 ? (
                <div className="px-4 pb-4 text-x text-slate-400">No saved assumptions yet — click Save Scenario to record why this scenario's numbers are what they are.</div>
              ) : (
                <div className="analytics-table-scroll overflow-x-auto">
                  <table className="w-full border-collapse text-x">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Line / Driver</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Previous</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">New</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Decision</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((a) => (
                        <tr key={a.id} className="border-b border-slate-100">
                          <td className="px-4 py-2 font-semibold text-slate-800">{a.line_key}{a.driver_key ? ` · ${a.driver_key}` : ""}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">{a.base_value != null ? fmtK(a.base_value) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-900">{a.scenario_value != null ? fmtK(a.scenario_value) : "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{a.change_type}</td>
                          <td className="px-3 py-2 text-slate-600">{a.decision}</td>
                          <td className="px-3 py-2 text-slate-500">{a.modified_by_name || "—"} · {a.modified_at ? new Date(a.modified_at).toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DriverGroup({ title, expanded, onToggle, base, scenario, children }) {
  // The page theme forces any button with a bg-slate-* class to a dark
  // navy background (matching this page's table-header convention) — the
  // inner spans deliberately carry no competing text-color class so they
  // inherit that forced white rather than being forced to dark-on-dark by
  // the theme's separate text-slate-* override.
  return (
    <div className="mb-3 border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100">
        <span className="text-x font-bold flex items-center gap-1.5">
          <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span> {title}
        </span>
        <span className="text-xs tabular-nums text-white/70">{fmtK(base)} → {fmtK(scenario)}</span>
      </button>
      {expanded && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

function DriverInput({ label, hint, value, isPercent, editable, onChange }) {
  const display = isPercent ? (Number(value) * 100).toFixed(2) : value;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-400 truncate">{hint}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" step="any" disabled={!editable}
          value={display}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const raw = e.target.value === "" ? 0 : Number(e.target.value);
            onChange(isPercent ? raw / 100 : raw);
          }}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums text-x outline-none focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {isPercent && <span className="text-xs text-slate-400">%</span>}
      </div>
    </div>
  );
}

function SimpleDriverRow({ label, value, editable, onChange, line }) {
  return (
    <div className="flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-3 py-2.5 mb-2">
      <div>
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        {line && <div className="text-xs tabular-nums text-slate-400">{fmtK(line.base)} → {fmtK(line.scenario)}</div>}
      </div>
      <input
        type="number" step="any" disabled={!editable}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums text-x outline-none focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}

// Colors here are deliberately "green"/"violet"/"zinc" rather than this
// codebase's usual "emerald"/"indigo"/"slate" — this page's global theme
// (src/index.css .forecasting-pnl-theme) force-overrides any button or
// badge using emerald/indigo/slate/sky/blue to the same navy+white,
// which would make Accept/Override/Keep Base visually indistinguishable
// from each other. green/violet/zinc aren't in that theme's override
// list, so they keep their own distinct colors as authored.
function SuggestionCard({ label, info, decision, editable, onDecide }) {
  const d = decision?.decision || "pending";
  // Seed from the rehydrated decision (a saved Override survives reopening
  // the scenario) rather than always starting from the fresh suggestion,
  // which would silently discard whatever number was actually saved.
  const [overrideInput, setOverrideInput] = useState(
    decision?.decision === "overridden" && decision?.overrideValue != null ? parseN(decision.overrideValue) : (info?.suggested ?? 0)
  );

  return (
    <div className="border border-slate-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-x font-bold text-slate-800">{label}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${
          d === "accepted" ? "bg-green-50 text-green-700 border-green-200"
          : d === "overridden" ? "bg-violet-50 text-violet-700 border-violet-200"
          : d === "kept_base" ? "bg-zinc-100 text-zinc-600 border-zinc-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
        }`}>
          {d === "pending" ? "Suggested" : d === "kept_base" ? "Kept Base" : d.charAt(0).toUpperCase() + d.slice(1)}
        </span>
      </div>
      <div className="text-xs text-slate-500 mb-2">
        Suggested change: <b className={info.suggested - info.base >= 0 ? "text-green-700" : "text-red-700"}>{fmtK(info.suggested - info.base)}</b>
      </div>
      {d === "overridden" && (
        <input
          type="number" step="any" disabled={!editable}
          value={overrideInput}
          onChange={(e) => { const v = e.target.value === "" ? 0 : Number(e.target.value); setOverrideInput(v); onDecide("overridden", v); }}
          className="w-full mb-2 rounded-lg border border-violet-300 px-2 py-1 text-right tabular-nums text-x outline-none focus:border-violet-500"
        />
      )}
      {editable && (
        <div className="flex gap-1.5">
          <button onClick={() => onDecide("accepted")} className={`flex-1 px-2 py-1 rounded-lg text-xs font-semibold ${d === "accepted" || d === "pending" ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>Accept</button>
          <button onClick={() => onDecide("overridden", overrideInput)} className={`flex-1 px-2 py-1 rounded-lg text-xs font-semibold ${d === "overridden" ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100"}`}>Override</button>
          <button onClick={() => onDecide("kept_base")} className={`flex-1 px-2 py-1 rounded-lg text-xs font-semibold ${d === "kept_base" ? "bg-zinc-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>Keep Base</button>
        </div>
      )}
    </div>
  );
}

function SaveScenarioModal({ open, saving, defaultName, baselineName, onClose, onSave, keyChanges }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("shared");

  useEffect(() => { if (open) { setName(defaultName || ""); setDescription(""); setVisibility("shared"); } }, [open, defaultName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Save as New Scenario</h3>
          <p className="text-xs text-slate-500 mt-0.5">Preserves the assumptions and driver changes below, not just the resulting numbers.</p>
          {baselineName && (
            <p className="text-xs text-sky-600 mt-1">
              Baseline: <span className="font-semibold">{baselineName}</span> — it will not be modified; this saves a separate new scenario.
            </p>
          )}
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Scenario Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g., "Revenue -10% / Maintain Workforce"'
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-s outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Description / Notes</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-s outline-none focus:border-sky-500 resize-y" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Visibility</label>
            <div className="flex gap-2">
              {["private", "shared", "organization"].map((v) => (
                <button key={v} onClick={() => setVisibility(v)}
                  className={`px-3 py-1.5 rounded-lg text-x font-semibold border ${visibility === v ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Key Changes ({keyChanges.length})</label>
            <div className="max-h-32 overflow-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {keyChanges.map((a, i) => (
                <div key={i} className="px-3 py-1.5 text-xs flex justify-between">
                  <span className="text-slate-600">{a.line_key}{a.driver_key ? ` · ${a.driver_key}` : ""}</span>
                  <span className="tabular-nums text-slate-800">{a.scenario_value != null ? fmtK(a.scenario_value) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-zinc-300 bg-zinc-50 text-s font-semibold text-zinc-600 hover:bg-zinc-100">Cancel</button>
          <button
            onClick={() => name.trim() && onSave({ scenario_name: name.trim(), description: description.trim(), visibility })}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save as New Scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}
