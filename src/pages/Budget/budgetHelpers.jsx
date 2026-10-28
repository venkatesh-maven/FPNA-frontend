// budgetHelpers.jsx
// Shared UI building blocks for the AI-Powered Budget module. Used by both
// backend-connected pages (RevenueBudgeting.jsx, WorkforcePlanning.jsx) and
// the remaining mock-data-only pages.
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiCheckCircle, FiXCircle, FiInfo, FiArrowUp, FiArrowDown,
  FiLock, FiCornerDownLeft, FiInbox, FiX, FiAlertCircle,
  FiChevronDown, FiChevronUp, FiTarget, FiTrendingUp,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";

/* ============================================================
   Design tokens
============================================================ */
export const MONTHS_12 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ============================================================
   Planning Frequency (Monthly / Quarterly / Annual) bucketing —
   shared by RevenueBudgeting/WorkforcePlanning/OpexBudgeting/
   CapexBudgeting so every module reads the one CFO-set frequency
   (BudgetGuidelinesContext) the same way. The label format here
   ("Q{n} FY{year}" / "FY{year}") must match
   FPNA-Backend/src/budget/fiscal_utils.py's period_bucket_label()/
   fiscal_quarter_periods() byte-for-byte — it's the one place a
   frontend/backend mismatch would silently break a Quarterly/Annual
   save (the backend resolves a bucket label back into real months by
   pattern-matching this exact string).
============================================================ */

// Ordered 'YYYY-MM' strings for fiscal year `fyLabel` — mirrors
// fiscal_utils.fiscal_year_periods().
export function fiscalYearPeriods(fyLabel, startMonth = 1) {
  const periods = [];
  let y = fyLabel, m = startMonth || 1;
  for (let i = 0; i < 12; i++) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return periods;
}

// 'FY{fyLabel}' for annual, 'Q{n} FY{fyLabel}' for quarterly — mirrors
// fiscal_utils.period_bucket_label().
export function periodBucketLabel(fyLabel, quarter = null) {
  return quarter == null ? `FY${fyLabel}` : `Q${quarter} FY${fyLabel}`;
}

// { 'Q1 FY{fyLabel}': ['YYYY-MM', 'YYYY-MM', 'YYYY-MM'], ... } — mirrors
// fiscal_utils.fiscal_quarter_periods().
export function fiscalQuarterPeriods(fyLabel, startMonth = 1) {
  const months = fiscalYearPeriods(fyLabel, startMonth);
  const quarters = {};
  months.forEach((p, i) => {
    const label = periodBucketLabel(fyLabel, Math.floor(i / 3) + 1);
    (quarters[label] || (quarters[label] = [])).push(p);
  });
  return quarters;
}

// The ordered column labels to render for a given Planning Frequency —
// Monthly passes `periods` through unchanged (whatever grain the backend
// already returned); Quarterly/Annual replace it with bucket labels.
export function displayPeriods(frequency, fiscalYearStartMonth, budgetYear, periods) {
  if (frequency === "Annual") return [periodBucketLabel(budgetYear)];
  if (frequency === "Quarterly") return Object.keys(fiscalQuarterPeriods(budgetYear, fiscalYearStartMonth));
  return periods;
}

// Reverse of displayPeriods for a single label: which real 'YYYY-MM' months
// does this bucket cover — mirrors fiscal_utils.resolve_bucket_periods().
export function bucketMonths(frequency, fiscalYearStartMonth, budgetYear, label) {
  if (frequency === "Annual") return fiscalYearPeriods(budgetYear, fiscalYearStartMonth);
  if (frequency === "Quarterly") return fiscalQuarterPeriods(budgetYear, fiscalYearStartMonth)[label] || [];
  return [label];
}

// Generalizes OpexBudgeting.jsx's per-period multi-driver redistribution
// (splitting one typed total across several line items) one level up:
// splits `totalValue` across `aiWeights` (one weight per sub-unit —
// e.g. one AI monthly value per month in a quarter) proportional to each
// weight's share of the total, preserving whatever seasonality/shape the AI
// baseline has. Falls back to an even split when every weight is 0 (an
// all-zero AI baseline has no shape to preserve).
export function proportionalSplit(totalValue, aiWeights) {
  const n = aiWeights.length;
  if (n === 0) return [];
  const total = aiWeights.reduce((s, v) => s + (Number(v) || 0), 0);
  const v = Number(totalValue) || 0;
  if (total > 0) return aiWeights.map((w) => v * ((Number(w) || 0) / total));
  return aiWeights.map(() => v / n);
}

// The backend's apply_smart_currency (shared by every backend-connected
// Budget page) always returns money fields as comma-formatted strings (e.g.
// "25,209.67"), even for the "actualvalue" option, so every money field
// needs parsing back to a real number once at the API boundary before any
// client-side math runs.
export function toBackendNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  const parsed = Number(t.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
export const parseMoney = (v) => (typeof v === "string" ? toBackendNumber(v) : v);

// Same actualvalue/thousands/millions convention as the Forecasting module's
// "Actual" currency-scale dropdown.
export const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands", label: "Thousands" },
  { value: "millions", label: "Millions" },
];

// Same 5-stage shape and labels as the Forecasting workflow (STAGE_LABELS in
// RevenueForecastHelpers.jsx) so both modules read identically.
export const STAGES = ["draft", "submitted", "reviewed", "approved", "locked"];
export const STAGE_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  locked: "Locked",
};
export const STAGE_CONFIG = {
  draft:     { pill: "bg-slate-100 text-slate-600 ring-slate-200",      dot: "bg-slate-400" },
  submitted: { pill: "bg-sky-50 text-sky-700 ring-sky-200",             dot: "bg-sky-500" },
  reviewed:  { pill: "bg-indigo-50 text-indigo-700 ring-indigo-200",    dot: "bg-indigo-500" },
  approved:  { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  locked:    { pill: "bg-slate-800 text-slate-100 ring-slate-700",      dot: "bg-slate-300" },
};

export const OVERRIDE_REASONS = [
  "Customer Expansion", "Customer Reduction", "Pricing Negotiation",
  "Contract Renewal", "Contract Loss", "Project Delay",
  "Executive Guidance", "Market Conditions", "Sales Input",
  "Operational Constraint", "Other",
];

export const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700", "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700", "bg-slate-200 text-slate-700",
  "bg-teal-100 text-teal-700", "bg-cyan-100 text-cyan-700",
  "bg-sky-600 text-white", "bg-slate-700 text-white",
];

/* ============================================================
   Formatting
============================================================ */
export const fmt = (n) => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : n;
  if (!Number.isFinite(num)) return "—";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
export const fmtPct = (n, opts = {}) => {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return `${opts.sign && v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
};
export const getInitials = (name = "") =>
  name.split(/[\s,]+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
export const avatarClass = (name = "") =>
  AVATAR_COLORS[(name || "?").charCodeAt(0) % AVATAR_COLORS.length];

/* ============================================================
   Toast
============================================================ */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);
  return { toasts, add };
}
export function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-s font-semibold shadow-2xl
            ${t.type === "success" ? "bg-emerald-600 text-white"
              : t.type === "error" ? "bg-red-600 text-white"
              : "bg-slate-800 text-white"}`}>
          {t.type === "success" ? <FiCheckCircle size={15} /> : t.type === "error" ? <FiXCircle size={15} /> : <FiInfo size={15} />}
          <span className="max-w-xs leading-snug">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Spinner / Empty state
============================================================ */
export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-9 h-9 border-[3px] border-slate-200 border-t-sky-600 rounded-full animate-spin" />
      <span className="text-slate-400 text-x font-medium tracking-wide">{label}</span>
    </div>
  );
}
export function EmptyState({ label }) {
  return (
    <div className="py-16 text-center">
      <FiInbox className="mx-auto text-slate-300 mb-3" size={32} />
      <p className="text-s text-slate-400">{label}</p>
    </div>
  );
}

/* ============================================================
   Mock-data banner — every Budget page shows this so it's always
   obvious this phase is static/mock (per explicit user requirement)
============================================================ */
export function MockDataBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-x font-semibold">
      <FiAlertCircle size={13} /> Mock data for design review — nothing here is saved or connected to a live API yet.
    </div>
  );
}

/* ============================================================
   UnsavedChangesModal — mirrors RevenueForecasting.jsx's local
   component of the same name (kept as a copy rather than a
   cross-module import so this file has no dependency on the
   Forecasting page).
============================================================ */
export function UnsavedChangesModal({ open, saving, onSave, onDiscard, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[400px] shadow-2xl border border-slate-200 overflow-visible animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-amber-400" />
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <FiAlertCircle className="text-amber-500" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Unsaved Changes</h3>
              <p className="text-slate-500 text-s mt-1 leading-relaxed">
                You have unsaved changes. Would you like to save before continuing?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors">
              Stay
            </button>
            <button onClick={onDiscard}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-s font-semibold transition-colors">
              Discard
            </button>
            <button onClick={onSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : "💾 Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ApplyAllMonthsModal — shown when a user edits an AIAdjustedCell (Revenue
   Budgeting's customer revenue, Workforce Planning's employee salary) and
   blurs it with the value actually changed. Offers to propagate that same
   value to all 12 months for the row instead of leaving it scoped to the
   one month edited.
============================================================ */
export function ApplyAllMonthsModal({ open, label, value, applying, onYes, onNo }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[420px] shadow-2xl border border-slate-200 overflow-visible animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-sky-500" />
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
              <FiTrendingUp className="text-sky-600" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Apply to all 12 months?</h3>
              <p className="text-slate-500 text-s mt-1 leading-relaxed">
                Would you like to apply this Adjusted value ({fmt(value)}) to all 12 months
                for <span className="font-semibold text-sky-800">{label}</span>?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onNo} disabled={applying}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors disabled:opacity-50">
              No, just this month
            </button>
            <button onClick={onYes} disabled={applying}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {applying ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</> : "Yes, apply to all 12 months"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PageHeader — reused gradient header, matches BudgetingHub.jsx
============================================================ */
export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="forecasting-page-header bg-gradient-to-r from-[#004a80] to-[#cfe6f7] px-4 py-2.5 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sky-100 text-s">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

/* ============================================================
   KPI cards — generic grid
============================================================ */
export function KpiRow({ cards }) {
  // Up to 6 cards fill one row; larger sets (Revenue has 10, Review 9) use
  // fixed columns so they split into even rows instead of e.g. 7 + 3.
  const cols = cards.length > 6
    ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-[repeat(auto-fit,minmax(170px,1fr))]";
  return (
    <div className={`grid ${cols} gap-2`}>
      {cards.map((c) => (
        <div key={c.label} className="min-w-0 bg-white rounded-xl border border-sky-200 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs text-sky-600 font-semibold uppercase tracking-wider leading-tight">{c.label}</span>
            <span className="w-6 h-6 shrink-0 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 [&_svg]:size-3.5">
              {c.icon}
            </span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-bold text-sky-900 tabular-nums whitespace-nowrap">{c.value}</span>
            {c.sub && <span className="text-[11px] text-sky-600 truncate" title={typeof c.sub === "string" ? c.sub : undefined}>{c.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   WorkflowModal / WorkflowProgress — local-only stage transitions
============================================================ */
export function WorkflowModal({ open, target, onClose, onConfirm }) {
  const [comment, setComment] = useState("");
  const [err, setErr] = useState(false);
  const isReject = target === "draft";
  useEffect(() => { if (open) { setComment(""); setErr(false); } }, [open]);
  if (!open) return null;

  const cfgMap = {
    submitted: { emoji: "🚀", title: "Submit for Department Review", sub: "Send this budget to Finance for review.", btn: "bg-sky-600 hover:bg-sky-700" },
    reviewed:  { emoji: "🔍", title: "Mark as Finance Reviewed",     sub: "Confirm Finance has reviewed all assumptions.", btn: "bg-indigo-600 hover:bg-indigo-700" },
    approved:  { emoji: "✅", title: "Executive Approval",           sub: "Approve and advance toward locking.", btn: "bg-emerald-600 hover:bg-emerald-700" },
    locked:    { emoji: "🔒", title: "Lock Budget",                  sub: "Permanently lock — no further edits allowed.", btn: "bg-slate-800 hover:bg-slate-900" },
    draft:     { emoji: "↩️", title: "Send Back to Draft",           sub: "Return for revision. A comment is required.", btn: "bg-red-600 hover:bg-red-700" },
  };
  const cfg = cfgMap[target] || {};

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-[460px] shadow-2xl border border-slate-200">
        <div className="text-4xl mb-4">{cfg.emoji}</div>
        <h3 className="text-slate-900 font-bold text-xl mb-1">{cfg.title}</h3>
        <p className="text-slate-500 text-s mb-5">{cfg.sub}</p>
        <textarea value={comment}
          onChange={(e) => { setComment(e.target.value); setErr(false); }}
          placeholder={isReject ? "Comment is required when rejecting…" : "Optional comment…"}
          rows={3}
          className={`w-full px-3 py-2.5 rounded-xl text-s text-slate-900 border outline-none resize-none transition-all
            ${err ? "border-red-400 bg-red-50" : "border-slate-300 bg-slate-50 focus:border-sky-500 focus:ring-2 ring-sky-100"}`}
        />
        {err && <p className="text-red-500 text-x mt-1.5">⚠ Comment is required when sending back.</p>}
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold transition-colors">Cancel</button>
          <button onClick={() => { if (isReject && !comment.trim()) { setErr(true); return; } onConfirm(target, comment.trim()); }}
            className={`px-5 py-2.5 rounded-xl text-white text-s font-semibold transition-colors ${cfg.btn}`}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowProgress({ stage, workflowMeta, onAction }) {
  const stageIdx = STAGES.indexOf(stage);
  const canSubmit = stage === "draft";
  const canReview = stage === "submitted";
  const canApprove = stage === "reviewed";
  const canLock = stage === "approved";
  const canReject = stage !== "draft" && stage !== "locked";

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STAGES.map((s, i) => {
            const done = i < stageIdx; const current = i === stageIdx;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-x font-bold transition-all
                    ${current ? "bg-sky-600 text-white ring-2 ring-sky-100 shadow-sm" : done ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium tracking-wide ${current ? "text-sky-600" : done ? "text-slate-500" : "text-slate-300"}`}>
                    {STAGE_LABELS[s]}
                  </span>
                </div>
                {i < STAGES.length - 1 && <div className={`w-6 h-0.5 rounded-full ${i < stageIdx ? "bg-slate-700" : "bg-slate-200"}`} />}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {workflowMeta?.reviewed_by && <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x text-slate-600">Reviewed: <strong>{workflowMeta.reviewed_by}</strong></span>}
          {workflowMeta?.approved_by && <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x text-slate-600">Approved: <strong>{workflowMeta.approved_by}</strong></span>}
          {workflowMeta?.locked_by && <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-x text-slate-200">Locked: <strong>{workflowMeta.locked_by}</strong></span>}
          {canReject && <button onClick={() => onAction("draft")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-x font-semibold transition-all"><FiCornerDownLeft size={12} /> Reject</button>}
          {canSubmit && <button onClick={() => onAction("submitted")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-x font-semibold transition-all shadow-sm"><FiArrowUp size={12} /> Submit</button>}
          {canReview && <button onClick={() => onAction("reviewed")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-x font-semibold transition-all shadow-sm"><FiCheckCircle size={12} /> Mark Reviewed</button>}
          {canApprove && <button onClick={() => onAction("approved")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-x font-semibold transition-all shadow-sm"><FiCheckCircle size={12} /> Approve</button>}
          {canLock && <button onClick={() => onAction("locked")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-x font-semibold transition-all shadow-sm"><FiLock size={12} /> Lock</button>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ConfidencePill — Explainable AI confidence indicator (PRD §19)
============================================================ */
// Word-level confidence maps to a representative percentage, matching the
// PRD's own example format ("Confidence 95%").
export const CONFIDENCE_PCT = { High: 95, Medium: 72, Low: 48 };

export function ConfidencePill({ level = "Medium", showPct = false }) {
  const cfg = {
    High:   "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Medium: "bg-amber-50 text-amber-700 ring-amber-200",
    Low:    "bg-red-50 text-red-700 ring-red-200",
  }[level] || "bg-slate-50 text-slate-600 ring-slate-200";
  const label = showPct ? `${CONFIDENCE_PCT[level] ?? "—"}% confidence` : `${level} confidence`;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${cfg}`}>{label}</span>;
}

/* ============================================================
   ExplainPopover — "Why this recommendation?" (PRD §19, §48)
   Shows the AI Recommendation Panel format: suggested value,
   numeric confidence %, and the reasoning bullets behind it.
============================================================ */
export function ExplainPopover({ reasons = [], confidence = "Medium", label, value, valueLabel = "AI Suggested Revenue", variant = "icon" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const preview = reasons[0] ? (reasons[0].length > 70 ? reasons[0].slice(0, 70).trim() + "…" : reasons[0]) : "No insight available";

  return (
    <div className={variant === "cell" ? "flex" : "relative inline-flex"}>
      {variant === "cell" ? (
        <button onClick={() => setOpen(true)} title="Click to expand full AI insight"
          className="flex items-center gap-1.5 w-full text-left hover:text-sky-700 transition-colors">
          <BsStars size={11} className="shrink-0 text-sky-400" />
          <span className="font-semibold text-slate-900 text-xs leading-tight line-clamp-2">{preview}</span>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} title="Why this recommendation?"
          className="w-6 h-6 rounded-md flex items-center justify-center text-sky-500 hover:text-sky-700 hover:bg-sky-50 border border-transparent hover:border-sky-200 transition-all">
          <BsStars size={12} />
        </button>
      )}
      {open && createPortal(
        // Centered like the app's other modals (OverrideReasonModal, etc.)
        // instead of anchored next to the trigger button — a small
        // button-anchored popover was too easy to clip against the
        // viewport edge and too cramped to read a multi-sentence
        // explanation comfortably.
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={() => setOpen(false)}>
          <div onMouseDown={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-sky-800 text-white shrink-0">
              <span className="text-s font-semibold truncate">{label || "AI Recommendation"}</span>
              <div className="flex items-center gap-2 shrink-0">
                <ConfidencePill level={confidence} showPct />
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                  <FiX size={14} />
                </button>
              </div>
            </div>
            {value != null && (
              <div className="flex items-center justify-between px-5 py-3 bg-sky-50 border-b border-slate-100 shrink-0">
                <span className="text-x text-slate-500 font-semibold uppercase tracking-wide">{valueLabel}</span>
                <span className="text-lg font-bold text-sky-900 tabular-nums">{value}</span>
              </div>
            )}
            <ul className="p-5 flex flex-col gap-3 overflow-y-auto">
              {reasons.length === 0
                ? <li className="text-s text-slate-400">No explanation available.</li>
                : reasons.map((r, i) => (
                  <li key={i} className="text-s text-slate-700 leading-relaxed flex gap-2.5">
                    <span className="text-sky-500 mt-1 shrink-0">•</span><span>{r}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============================================================
   RollupChain — visual hierarchy chip chain (PRD §27 revenue
   rollup, §6 org structure). Purely presentational.
============================================================ */
export function RollupChain({ levels = [] }) {
  return (
    <div className="flex items-center flex-wrap gap-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
      {levels.map((lvl, i) => (
        <React.Fragment key={lvl}>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-x font-semibold text-slate-700">{lvl}</span>
          {i < levels.length - 1 && <FiChevronDown className="text-slate-300 -rotate-90" size={12} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ============================================================
   OverrideReasonModal — captures why a user changed an AI value
   (PRD §21). Local-only: appends to an in-memory audit trail.
============================================================ */
export function OverrideReasonModal({ open, onClose, onSave, context, current = null, readOnly = false, saving = false, stage = null }) {
  const [reason, setReason] = useState(OVERRIDE_REASONS[0]);
  const [note, setNote] = useState("");
  // Pre-fill from the saved reason (if any) every time the modal opens, so
  // reopening it to edit shows what's already on record instead of always
  // resetting back to the first dropdown option.
  useEffect(() => {
    if (open) { setReason(current?.reason || OVERRIDE_REASONS[0]); setNote(current?.note || ""); }
  }, [open, current]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[440px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-s">{readOnly ? "Override reason" : "Why the change?"}</h3>
            {context && <p className="text-x text-slate-500 mt-0.5">{context}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><FiX size={13} /></button>
        </div>
        {readOnly ? (
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold w-fit">
              <FiLock size={10} /> {stage === "draft"
                ? "Read-only — your department can't edit this budget"
                : "Read-only — budget is past Draft stage"}
            </div>
            <div>
              <label className="block text-x font-semibold text-slate-600 mb-1.5">Override reason</label>
              <p className="text-s text-slate-900 font-medium">{current?.reason || "—"}</p>
            </div>
            {current?.note && (
              <div>
                <label className="block text-x font-semibold text-slate-600 mb-1.5">Note</label>
                <p className="text-s text-slate-600 leading-relaxed whitespace-pre-wrap">{current.note}</p>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold">Close</button>
            </div>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-3">
            <div>
              <label className="block text-x font-semibold text-slate-600 mb-1.5">Override reason *</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100">
                {OVERRIDE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-x font-semibold text-slate-600 mb-1.5">Note (optional)</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Add context for reviewers…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold disabled:opacity-50">Skip</button>
              <button onClick={() => onSave({ reason, note })} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold disabled:opacity-60">
                {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : (current ? "Update Reason" : "Save Reason")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   AIAdjustedCell — paired AI-suggested / user-adjusted number
   display, matching the Forecasting module's grid convention.
============================================================ */
export function AIAdjustedCell({ ai, adjusted, editable, onChange, onFocus, onBlur, width = "w-16" }) {
  const changed = adjusted != null && ai != null && Number(adjusted) !== Number(ai);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400 tabular-nums w-14 text-right shrink-0" title="AI Suggested">{fmt(ai)}</span>
      {editable ? (
        <input type="number" value={adjusted ?? ""} onChange={(e) => onChange?.(e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
          className={`${width} px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
            ${changed ? "border-sky-300 bg-sky-50 text-sky-800 font-semibold" : "border-slate-200 bg-white text-slate-800"}
            focus:border-sky-500 focus:ring-2 ring-sky-100`} />
      ) : (
        <span className={`text-xs tabular-nums font-semibold ${width} text-right ${changed ? "text-sky-700" : "text-slate-700"}`}>{fmt(adjusted)}</span>
      )}
    </div>
  );
}

/* ============================================================
   PaginationBar — client-side paging for large analytics tables.
   Rendering thousands of rows (492 customers × 12 monthly periods,
   or 4,500+ pipeline opportunities) in one unvirtualized <tbody>
   is what made switching tabs/navigating away feel like a freeze —
   the browser had to mount/unmount tens of thousands of DOM nodes
   synchronously. Slicing to a page keeps the DOM small; totals/KPIs
   are computed from the full filtered dataset independently of what
   page is currently rendered, so they stay accurate either way.
============================================================ */
export function PaginationBar({ page, pageCount, total, pageSize, onPrev, onNext, itemLabel = "rows" }) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 rounded-b-xl">
      <span className="text-xs text-slate-500">
        Showing <strong className="text-slate-700">{start.toLocaleString()}–{end.toLocaleString()}</strong> of{" "}
        <strong className="text-slate-700">{total.toLocaleString()}</strong> {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={page <= 1}
          className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Prev
        </button>
        <span className="text-xs text-slate-500 tabular-nums">Page {page} of {pageCount}</span>
        <button onClick={onNext} disabled={page >= pageCount}
          className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Next
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   StatusPill — generic small status/approval badge
============================================================ */
export function StatusPill({ status }) {
  const cfg = {
    Draft:    "bg-slate-100 text-slate-600",
    Pending:  "bg-amber-50 text-amber-700",
    Approved: "bg-emerald-50 text-emerald-700",
    Rejected: "bg-red-50 text-red-700",
    Active:   "bg-sky-50 text-sky-700",
    Final:    "bg-slate-800 text-white",
  }[status] || "bg-slate-100 text-slate-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg}`}>{status}</span>;
}

/* ============================================================
   CollapsibleSection — used to group grids by category
============================================================ */
export function CollapsibleSection({ title, subtitle, right, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen((p) => !p)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2 text-left">
          {open ? <FiChevronUp className="text-slate-400" size={14} /> : <FiChevronDown className="text-slate-400" size={14} />}
          <div>
            <div className="font-semibold text-slate-800 text-s">{title}</div>
            {subtitle && <div className="text-x text-slate-400">{subtitle}</div>}
          </div>
        </div>
        {right}
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

/* ============================================================
   Budget Methodology (PRD §6) — Top-Down / Hybrid building blocks.
   Bottom-Up is whatever each page already renders; these three are the
   *additional* pieces Top-Down/Hybrid modes layer on top, reading targets
   from BudgetGuidelinesContext. Static-data-first pass: allocation edits
   here are local-only, not persisted to a backend yet.
============================================================ */

// Shared so every page computes "target" the exact same way.
export const computeTopDownTarget = (baseline, growthPct) =>
  (Number(baseline) || 0) * (1 + (Number(growthPct) || 0) / 100);

export function TopDownTargetCard({ title, baseline, baselineLabel = "Prior Year Actual", growthPct, growthLabel = "Growth Target", target, icon }) {
  const resolvedTarget = target ?? computeTopDownTarget(baseline, growthPct);
  return (
    <div className="bg-white rounded-xl border border-sky-200 shadow-sm px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        {icon || <FiTarget className="text-sky-600" size={16} />}
        <h3 className="font-semibold text-slate-900 text-s">{title} — Top-Down Target</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{baselineLabel}</div>
          <div className="text-base font-bold text-slate-700 tabular-nums mt-0.5">{fmt(baseline)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{growthLabel}</div>
          <div className="text-base font-bold text-sky-600 tabular-nums mt-0.5">{fmtPct(growthPct, { sign: true })}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Target Budget</div>
          <div className="text-base font-bold text-emerald-600 tabular-nums mt-0.5">{fmt(resolvedTarget)}</div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">Set on Budget Setup &amp; Guidelines — allocated below.</p>
    </div>
  );
}

// Hybrid mode: shows the Top-Down target as a guardrail against whatever the
// page's own live Bottom-Up total already is.
export function ReconciliationBanner({ target, actual, label = "Bottom-Up Total" }) {
  const variance = actual - target;
  const variancePct = target ? (variance / target) * 100 : 0;
  const status = Math.abs(variancePct) < 2
    ? { text: "On Track", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
    : variance > 0
      ? { text: "Over Target", cls: "bg-red-50 text-red-700 ring-red-200" }
      : { text: "Under Target", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 bg-white rounded-xl border border-sky-200 shadow-sm px-4 py-2">
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Top-Down Target</div>
          <div className="text-base font-bold text-sky-700 tabular-nums">{fmt(target)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{label}</div>
          <div className="text-base font-bold text-slate-700 tabular-nums">{fmt(actual)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Variance</div>
          <div className={`text-base font-bold tabular-nums ${variance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {variance >= 0 ? "+" : ""}{fmt(variance)} ({fmtPct(variancePct, { sign: true })})
          </div>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-x font-semibold ring-1 shrink-0 ${status.cls}`}>{status.text}</span>
    </div>
  );
}

// Generic proportional-allocation grid — `rows`: [{ key, name, priorShare }].
// `priorShare` values are relative weights (don't need to sum to 1; this
// normalizes). `onAdjust(key, value)` fires when a user edits a cell —
// local-only in this pass, not persisted.
export function TopDownAllocationTable({ dimensionLabel, target, rows, adjustedByKey = {}, onAdjust }) {
  const totalShare = rows.reduce((s, r) => s + (Number(r.priorShare) || 0), 0) || 1;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-sky-800">
            <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700/50">{dimensionLabel}</th>
            <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700/50">Prior Year Share</th>
            <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700/50">Target Allocation</th>
            <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide">Adjusted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const sharePct = (Number(r.priorShare) || 0) / totalShare;
            const allocation = target * sharePct;
            const adjusted = adjustedByKey[r.key] ?? allocation;
            const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
            return (
              <tr key={r.key} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                <td className="px-3 py-1 font-semibold text-slate-900 text-xs leading-tight truncate border-r border-slate-100">{r.name}</td>
                <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmtPct(sharePct * 100)}</td>
                <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(allocation)}</td>
                <td className="px-1.5 py-1">
                  <input type="number" value={adjusted === "" ? "" : Math.round(adjusted)} onChange={(e) => onAdjust?.(r.key, e.target.value)}
                    className="w-28 ml-auto block px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-sky-900 text-white font-semibold">
            <td colSpan={2} className="px-3 py-1.5 text-xs border-r border-sky-700">TARGET TOTAL</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(target)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-xs">
              {fmt(rows.reduce((s, r) => {
                const sharePct = (Number(r.priorShare) || 0) / totalShare;
                const allocation = target * sharePct;
                const adjusted = adjustedByKey[r.key] ?? allocation;
                return s + (Number(adjusted) || 0);
              }, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
