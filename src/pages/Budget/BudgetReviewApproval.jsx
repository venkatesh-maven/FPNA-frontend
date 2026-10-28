// BudgetReviewApproval.jsx — PRD §50 Review Dashboard, §61 Approval Workflow,
// §63 Audit Trail. Backed by /api/v1/budget/review/{year} — consolidated KPIs
// and Base Case are real rollups of the 4 live modules; Best/Worst are a
// fixed, clearly-labeled sensitivity band on top of the real Base Case (no
// budget-module "scenario" concept exists to store independent ones). The
// Audit Trail is a real, consolidated workflow *stage-transition* feed
// (union of all 5 modules' own audit tables) — not itemized field diffs,
// since no history of individual cell/item edits is captured anywhere yet.
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  FiTrendingUp, FiUsers, FiDollarSign, FiPercent, FiCheckCircle, FiFlag, FiAlertTriangle,
} from "react-icons/fi";
import {
  PageHeader, KpiRow, WorkflowModal, WorkflowProgress,
  StatusPill, EmptyState, useToast, ToastContainer, fmtPct,
} from "./budgetHelpers";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { useNavigate } from "react-router-dom";

const MODULE_PATHS = {
  revenue: "/budget-revenue", workforce: "/budget-workforce",
  opex: "/budget-opex", capex: "/budget-capex",
};
const MODULE_LABELS = { revenue: "Revenue", workforce: "Workforce", opex: "Opex", capex: "CAPEX" };

const API_BASE = `${API_BASE_URL}/api/v1/budget/review`;

async function parseErr(res) {
  try {
    const data = await res.json();
    return data?.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

const SCENARIO_META = {
  base: { label: "Base Case", accent: "border-sky-300 bg-sky-50/40" },
  best: { label: "Best Case", accent: "border-emerald-300 bg-emerald-50/40" },
  worst: { label: "Worst Case", accent: "border-red-300 bg-red-50/40" },
};

const BudgetReviewApproval = () => {
  const { toasts, add } = useToast();
  const { token } = useContext(AuthContext);
  const { budgetYear } = useContext(BudgetYearContext);

  const [modal, setModal] = useState({ open: false, target: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState("draft");
  const [kpis, setKpis] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [exceptionSummary, setExceptionSummary] = useState(null);
  const navigate = useNavigate();
  const [settingScenario, setSettingScenario] = useState(false);
  // Same actualvalue/thousands/millions "View" filter Budget Overview and
  // Forecasting & Scenario Planning have — the backend already accepts
  // currency_filter on this endpoint, this was just hardcoded to
  // "actualvalue" on the frontend.
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  const authHeaders = useCallback((json) => ({
    Authorization: `Bearer ${token}`,
    accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  }), [token]);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setStage(data.stage || "draft");
      setKpis(data.kpis || null);
      setScenarios(data.scenarios || null);
      setAuditTrail(data.audit_trail || []);
      setExceptionSummary(data.exception_summary || null);
    } catch (e) {
      setError(e.message || "Failed to load Budget Review & Approval.");
    } finally {
      setLoading(false);
    }
  }, [budgetYear, authHeaders, currencyFilter]);

  // fmt() (budgetHelpers) hardcodes 0 decimal places — right for actual-value
  // whole dollars, but rounds a millions-scaled figure like 176.59 down to
  // "$177" with no unit context. 2-decimal fallback once currency_filter
  // scales a value down, same convention Forecasting/Revenue Report use.
  // Kept local to this page — fmt() itself stays untouched.
  const fmtScaled = useCallback((n) => {
    if (n == null || n === "") return "—";
    const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : n;
    if (!Number.isFinite(num)) return "—";
    const dp = currencyFilter === "actualvalue" ? 0 : 2;
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
  }, [currencyFilter]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  const handleWorkflowAction = (target) => setModal({ open: true, target });
  const confirmWorkflow = async (target, comment) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/workflow`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ target_stage: target, comment }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      setStage(target);
      add(`Consolidated budget moved to ${target}.`, "success");
    } catch (e) {
      add(e.message || "Failed to update workflow stage.", "error");
    } finally {
      setModal({ open: false, target: null });
    }
  };

  const setActiveScenario = async (key) => {
    setSettingScenario(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/active-scenario`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ scenario: key }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add(`${SCENARIO_META[key].label} set as the active planning scenario.`, "success");
      await fetchReview();
    } catch (e) {
      add(e.message || "Failed to set active scenario.", "error");
    } finally {
      setSettingScenario(false);
    }
  };

  const staticHeader = <PageHeader title="Budget Review & Approval" subtitle="Consolidated KPIs, scenario comparison, and audit trail" />;

  if (loading) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <TableSkeleton columns={4} rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <EmptyState label={`Couldn't load Budget Review & Approval — ${error}`} />
      </div>
    );
  }

  const reviewKpis = [
    { label: "Payroll Growth", value: fmtPct(kpis.payroll_growth_pct, { sign: true }), sub: "vs prior fiscal year actual payroll", icon: <FiUsers size={16} /> },
    { label: "Headcount Growth", value: fmtPct(kpis.headcount_growth_pct, { sign: true }), sub: "New positions vs existing headcount", icon: <FiUsers size={16} /> },
    { label: "Revenue per Employee", value: fmtScaled(kpis.revenue_per_employee), sub: "Budgeted revenue ÷ headcount", icon: <FiDollarSign size={16} /> },
    { label: "Expense Growth", value: fmtPct(kpis.expense_growth_pct, { sign: true }), sub: "Opex + Payroll vs prior fiscal year", icon: <FiTrendingUp size={16} /> },
    { label: "Operating Margin", value: fmtPct(kpis.operating_margin_pct), sub: "Budgeted, Revenue − Opex − Payroll", icon: <FiPercent size={16} /> },
    { label: "Payroll as % Revenue", value: fmtPct(kpis.payroll_pct_of_revenue), sub: "Share of budgeted revenue", icon: <FiPercent size={16} /> },
    { label: "AI vs User Variance", value: fmtScaled(kpis.ai_vs_user_variance), sub: "Total budget vs AI baseline, all modules", icon: <FiFlag size={16} /> },
    { label: "Modules Fully Reviewed", value: `${kpis.modules_fully_reviewed}/${kpis.modules_total}`, sub: "Revenue, Workforce, Opex, CAPEX", icon: <FiCheckCircle size={16} /> },
    { label: "Guideline Exceptions", value: kpis.guideline_exceptions ?? 0, sub: `${kpis.guideline_exceptions_pending ?? 0} pending Finance review`, icon: <FiAlertTriangle size={16} /> },
  ];

  return (
    <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
      <ToastContainer toasts={toasts} />
      <WorkflowModal open={modal.open} target={modal.target} onClose={() => setModal({ open: false, target: null })} onConfirm={confirmWorkflow} />

      {staticHeader}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Budget Year</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Set in Settings & Customization → FY Management.">
            FY{budgetYear}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">View</span>
          <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700 outline-none focus:border-sky-500">
            <option value="actualvalue">Actual Value</option>
            <option value="thousands">Thousands</option>
            <option value="millions">Millions</option>
          </select>
        </div>
      </div>

      <KpiRow cards={reviewKpis} />

      {/* ── Exception Summary — spec §16: per-module counts with drill-down. ── */}
      {exceptionSummary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <div className="text-s font-semibold text-sky-900 mb-2">Guideline Exception Summary</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["revenue", "workforce", "opex", "capex"].map((key) => {
              const m = exceptionSummary[key] || { exceptions: 0, pending_review: 0, approved: 0, rejected: 0 };
              return (
                <button key={key} onClick={() => navigate(MODULE_PATHS[key])}
                  className="text-left px-3 py-1.5 rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition-colors">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{MODULE_LABELS[key]}</div>
                  <div className={`text-base font-bold tabular-nums ${m.exceptions > 0 ? "text-red-600" : "text-slate-400"}`}>{m.exceptions}</div>
                  <div className="text-xs text-slate-400">
                    {m.pending_review} pending &middot; {m.approved} approved &middot; {m.rejected} rejected
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="text-s font-semibold text-sky-900 mb-2">Approval Workflow — Consolidated FY{budgetYear} Budget</div>
        <WorkflowProgress stage={stage} onAction={handleWorkflowAction} />
      </div>

      {/* ── Scenario comparison ── */}
      <div>
        <div className="text-s font-semibold text-sky-900 mb-2">Scenario Comparison (Best / Base / Worst)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {["best", "base", "worst"].map((key) => {
            const s = scenarios[key];
            const meta = SCENARIO_META[key];
            const isActive = scenarios.active === key;
            return (
              <div key={key} className={`rounded-xl border-2 shadow-sm px-4 py-3 ${meta.accent}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-s">{meta.label}</span>
                  {isActive ? <StatusPill status="Final" /> : <StatusPill status="Draft" />}
                </div>
                {s.is_sensitivity_band && (
                  <p className="text-xs text-slate-400 mb-2 leading-snug">± sensitivity band around Base Case — not an independently budgeted scenario.</p>
                )}
                <div className="flex flex-col gap-1 text-x mt-1.5">
                  <Row label="Revenue" value={fmtScaled(s.revenue)} />
                  <Row label="Opex" value={fmtScaled(s.opex)} />
                  <Row label="Payroll" value={fmtScaled(s.payroll)} />
                  <Row label="CAPEX" value={fmtScaled(s.capex)} />
                  <Row label="Net Income" value={fmtScaled(s.net_income)} bold />
                </div>
                <button onClick={() => setActiveScenario(key)} disabled={isActive || settingScenario}
                  className="mt-2 w-full py-1.5 rounded-lg text-x font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  {isActive ? "Active Scenario" : "Set as Active"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Audit trail ── */}
      <div>
        <div className="text-s font-semibold text-sky-900 mb-2">Audit Trail — Workflow Stage Transitions</div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-sky-800">
                {["Module", "User", "From Stage", "To Stage", "Date / Time", "Reason"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-white uppercase border-r border-sky-700 last:border-r-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditTrail.length === 0 ? (
                <tr><td colSpan={6}><EmptyState label="No workflow stage transitions yet." /></td></tr>
              ) : auditTrail.map((a, i) => (
                <tr key={i} className="border-b border-slate-200 hover:bg-sky-50/50">
                  <td className="px-3 py-1.5 font-semibold text-slate-900 text-xs whitespace-nowrap border-r border-slate-100">{a.module}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">{a.user || "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500 whitespace-nowrap capitalize border-r border-slate-100">{a.from_stage || "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-sky-700 font-semibold whitespace-nowrap capitalize border-r border-slate-100">{a.to_stage}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-400 tabular-nums whitespace-nowrap border-r border-slate-100">{a.created_at ? new Date(a.created_at).toLocaleString() : "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-600">{a.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

export default BudgetReviewApproval;
