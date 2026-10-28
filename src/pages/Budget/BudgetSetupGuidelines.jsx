// BudgetSetupGuidelines.jsx — Annual Budget Setup (PRD §6) + Budget Guidelines (PRD §7)
// Real backend: Budget Methodology applies instantly (BudgetMethodologyContext);
// everything else here is staged locally and written to
// fpna_config.budget_setup_guidelines when "Save" is clicked
// (BudgetGuidelinesContext.saveGuidelines).
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  FiSave, FiPlus, FiX, FiChevronRight, FiFlag, FiLock,
} from "react-icons/fi";
import {
  PageHeader, useToast, ToastContainer, WorkflowModal, WorkflowProgress, STAGE_LABELS,
} from "./budgetHelpers";
import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { BudgetMethodologyContext, BUDGET_METHODOLOGIES } from "../../context/BudgetMethodologyContext";
import { BudgetGuidelinesContext } from "../../context/BudgetGuidelinesContext";
import { API_BASE_URL } from "../../config/config";

const API_BASE = `${API_BASE_URL}/api/v1/budget/setup`;

async function parseErr(res) {
  try {
    const data = await res.json();
    return data?.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

const ORG_HIERARCHY = ["Company", "Region", "Business Unit", "Department", "Customer", "Project", "Product"];
const APPROVAL_CHAIN = ["Department Owner", "Finance Business Partner", "Corporate Finance", "CFO", "Executive Leadership"];
const INITIATIVE_OPTIONS = ["Geographic Expansion", "Product Launch", "Acquisition", "Digital Transformation", "AI Investments"];

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-x font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all";

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-x font-semibold transition-all
        ${disabled ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" :
          checked ? "bg-sky-50 border-sky-300 text-sky-700" : "bg-white border-slate-200 text-slate-500"}`}>
      <span className={`w-8 h-4 rounded-full relative transition-colors ${checked ? "bg-sky-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

// Read-only styling for the Revenue/Expense/Capital Guidelines cards once
// their approval workflow moves past Draft.
const guidelineInputCls = (editable) => `${inputCls} ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`;
function GuidelinesLockBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
      <FiLock size={10} /> Read-only — past Draft stage
    </div>
  );
}

const BudgetSetupGuidelines = () => {
  const { token } = useContext(AuthContext);
  const { toasts, add } = useToast();

  // ── Setup ──
  const { budgetYear } = useContext(BudgetYearContext);
  // Shared across the whole Budgeting module (PRD §6) — selecting here
  // changes which workflow/screen Revenue/Workforce/Opex/CAPEX show, and
  // persists to the backend immediately (not gated behind Save below).
  const { methodology, setMethodology } = useContext(BudgetMethodologyContext);

  // Shared Budget Guidelines (PRD §7) plus the rest of Annual Budget Setup —
  // staged locally here and only written to the backend when Save is
  // clicked. These are also the Top-Down target inputs read by every other
  // Budgeting page once saved.
  const {
    guidelines, setGuideline,
    frequency, setFrequency,
    boardApprovalOptional: boardOptional, setBoardApprovalOptional: setBoardOptional,
    initiatives, setInitiatives,
    saving, saveGuidelines,
  } = useContext(BudgetGuidelinesContext);
  const {
    revGrowthTarget, priceIncrease, newCustomerTarget, retentionTarget, crossSellGoal,
    payrollGrowthLimit, hiringFreeze, travelReduction, softwareConsolidation, marketingInvestment,
    capexLimit, techInvestment, officeExpansion, assetReplacement,
  } = guidelines;

  // ── Strategic initiatives ──
  const toggleInitiative = (name) =>
    setInitiatives((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));

  // ── Approval workflow (Revenue/Expense/Capital Guidelines only) — same
  // Draft→Submitted→Reviewed→Approved→Locked machinery as Revenue Budgeting,
  // scoped here to just the three Guidelines cards below. Planning
  // Frequency, Budget Methodology, Org Structure, and Approval Chain stay
  // freely editable regardless of this stage.
  const [stage, setStage] = useState("draft");
  const [guidelinesEditable, setGuidelinesEditable] = useState(true);
  const [modal, setModal] = useState({ open: false, target: null });

  const authHeaders = useCallback((json) => ({
    Authorization: `Bearer ${token}`,
    accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  }), [token]);

  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/workflow`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setStage(data.stage || "draft");
      setGuidelinesEditable(data.editable !== false);
    } catch (e) {
      add(`Failed to load Guidelines approval status: ${e.message}`, "error");
    }
  }, [budgetYear, authHeaders, add]);

  useEffect(() => { if (token && budgetYear) fetchWorkflow(); }, [token, budgetYear, fetchWorkflow]);

  const handleWorkflowAction = (target) => setModal({ open: true, target });
  const confirmWorkflow = async (target, comment) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/workflow`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ target_stage: target, comment }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      setStage(target);
      add(`Guidelines approval stage moved to ${target}.`, "success");
      await fetchWorkflow();
    } catch (e) {
      add(`Failed to update approval stage: ${e.message}`, "error");
    } finally {
      setModal({ open: false, target: null });
    }
  };

  const handleSave = async () => {
    try {
      await saveGuidelines({ skipGuidelines: !guidelinesEditable });
      add(guidelinesEditable
        ? "Budget Setup & Guidelines saved."
        : "Saved — Revenue/Expense/Capital Guidelines are locked at this approval stage and were not changed.", "success");
    } catch (err) {
      add(err.message || "Failed to save Budget Setup & Guidelines.", "error");
    }
  };

  return (
    <div className="planning-compact space-y-4 min-h-screen bg-slate-50 pb-10">
      <ToastContainer toasts={toasts} />
      <WorkflowModal open={modal.open} target={modal.target} onClose={() => setModal({ open: false, target: null })} onConfirm={confirmWorkflow} />
      <PageHeader title="Budget Setup & Guidelines" subtitle="Annual planning framework and CFO planning assumptions"
        right={
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 h-9 px-4 text-s font-medium text-white bg-sky-900 rounded-lg hover:bg-sky-800 disabled:opacity-60 transition">
            <FiSave size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        } />

      {/* ── Annual Budget Setup ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Field label="Budget Year" hint="Set in Settings & Customization → FY Management.">
            <div className={`${inputCls} bg-slate-50 text-slate-700`}>FY{budgetYear}</div>
          </Field>
          <Field label="Planning Frequency" hint="Monthly is the system's lowest level of detail.">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
              <option>Monthly</option><option>Quarterly</option><option>Annual</option>
            </select>
          </Field>
          <Field label="Budget Methodology" hint="Hybrid is the recommended default.">
            <div className="flex gap-1.5">
              {BUDGET_METHODOLOGIES.map((m) => (
                <button key={m} type="button" onClick={() => setMethodology(m)}
                  className={`flex-1 px-2 py-2 rounded-lg text-x font-semibold border transition-all
                    ${methodology === m ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                  {m}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Org hierarchy */}
        <div className="mt-5">
          <label className="block text-x font-semibold text-slate-600 mb-2">Organization Structure</label>
          <div className="flex items-center flex-wrap gap-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
            {ORG_HIERARCHY.map((level, i) => (
              <React.Fragment key={level}>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-x font-semibold text-slate-700">{level}</span>
                {i < ORG_HIERARCHY.length - 1 && <FiChevronRight className="text-sky-500" size={16} strokeWidth={3} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Approval chain */}
        <div className="mt-5">
          <label className="block text-x font-semibold text-slate-600 mb-2">Approval Workflow</label>
          <div className="flex items-center flex-wrap gap-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
            {APPROVAL_CHAIN.map((role, i) => (
              <React.Fragment key={role}>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-x font-semibold text-sky-700">{role}</span>
                <FiChevronRight className="text-sky-500" size={16} strokeWidth={3} />
              </React.Fragment>
            ))}
            <Toggle checked={boardOptional} onChange={setBoardOptional} label="Board Approval (optional)" />
          </div>
        </div>
      </div>

      {/* ── Budget Guidelines — gated by the approval workflow below ── */}
      <WorkflowProgress stage={stage} onAction={handleWorkflowAction} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold text-slate-900 text-s">Revenue Guidelines</h3>
            {!guidelinesEditable && <GuidelinesLockBadge />}
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Revenue Growth Target (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={revGrowthTarget} onChange={(e) => setGuideline("revGrowthTarget", e.target.value)} /></Field>
            <Field label="Price Increase (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={priceIncrease} onChange={(e) => setGuideline("priceIncrease", e.target.value)} /></Field>
            <Field label="New Customer Target (#)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={newCustomerTarget} onChange={(e) => setGuideline("newCustomerTarget", e.target.value)} /></Field>
            <Field label="Customer Retention Target (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={retentionTarget} onChange={(e) => setGuideline("retentionTarget", e.target.value)} /></Field>
            <Field label="Cross-sell Goal (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={crossSellGoal} onChange={(e) => setGuideline("crossSellGoal", e.target.value)} /></Field>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold text-slate-900 text-s">Expense Guidelines</h3>
            {!guidelinesEditable && <GuidelinesLockBadge />}
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Payroll Growth Limit (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={payrollGrowthLimit} onChange={(e) => setGuideline("payrollGrowthLimit", e.target.value)} /></Field>
            <Field label="Hiring Freeze"><Toggle checked={hiringFreeze} disabled={!guidelinesEditable} onChange={(v) => setGuideline("hiringFreeze", v)} label={hiringFreeze ? "Enabled" : "Disabled"} /></Field>
            <Field label="Travel Reduction (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={travelReduction} onChange={(e) => setGuideline("travelReduction", e.target.value)} /></Field>
            <Field label="Software Consolidation"><Toggle checked={softwareConsolidation} disabled={!guidelinesEditable} onChange={(v) => setGuideline("softwareConsolidation", v)} label={softwareConsolidation ? "Enabled" : "Disabled"} /></Field>
            <Field label="Marketing Investment (%)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={marketingInvestment} onChange={(e) => setGuideline("marketingInvestment", e.target.value)} /></Field>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold text-slate-900 text-s">Capital Guidelines</h3>
            {!guidelinesEditable && <GuidelinesLockBadge />}
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Annual CAPEX Limit ($)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={capexLimit} onChange={(e) => setGuideline("capexLimit", e.target.value)} /></Field>
            <Field label="Technology Investment ($)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={techInvestment} onChange={(e) => setGuideline("techInvestment", e.target.value)} /></Field>
            <Field label="Office Expansion"><Toggle checked={officeExpansion} disabled={!guidelinesEditable} onChange={(v) => setGuideline("officeExpansion", v)} label={officeExpansion ? "Planned" : "Not planned"} /></Field>
            <Field label="Asset Replacement ($)"><input type="number" disabled={!guidelinesEditable} className={guidelineInputCls(guidelinesEditable)} value={assetReplacement} onChange={(e) => setGuideline("assetReplacement", e.target.value)} /></Field>
          </div>
        </div>
      </div>

      {/* Strategic initiatives */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <FiFlag className="text-sky-600" size={16} />
          <h3 className="font-semibold text-slate-900 text-s">Strategic Initiatives</h3>
        </div>
        <p className="text-x text-slate-500 mb-3">These become planning inputs for Revenue, Workforce, and CAPEX budgeting.</p>
        <div className="flex flex-wrap gap-2">
          {INITIATIVE_OPTIONS.map((name) => {
            const active = initiatives.includes(name);
            return (
              <button key={name} onClick={() => toggleInitiative(name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-x font-semibold border transition-all
                  ${active ? "bg-sky-600 border-sky-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {active ? <FiX size={11} /> : <FiPlus size={11} />} {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BudgetSetupGuidelines;
