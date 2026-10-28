// CapexForecastHelpers.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FiCheckCircle, FiXCircle, FiInfo, FiArrowUp, FiArrowDown,
  FiLock, FiCornerDownLeft, FiInbox, FiCpu, FiEdit, FiUpload,
  FiX, FiAlertCircle, FiSend, FiImage, FiMessageSquare,
  FiRefreshCw, FiBold, FiItalic, FiList, FiCheck, FiEye,
  FiTrendingUp,
} from "react-icons/fi";
import { getDecimalPrecision } from '../../utils/formatters';

// ─── Design tokens ────────────────────────────────────────────────────────────
const MONTH_ABBR_ALL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Fiscal-year-aware quarter->months map — see Revenueforecasthelpers.jsx for
// the identical implementation this mirrors. Defaults to fiscalYearStartMonth=1
// (Q1=Jan-Mar), matching the old hardcoded behavior.
export const getQuarterMonths = (fiscalYearStartMonth = 1) => {
  const start = ((fiscalYearStartMonth || 1) - 1 + 12) % 12;
  const rotated = [...MONTH_ABBR_ALL.slice(start), ...MONTH_ABBR_ALL.slice(0, start)];
  return { Q1: rotated.slice(0, 3), Q2: rotated.slice(3, 6), Q3: rotated.slice(6, 9), Q4: rotated.slice(9, 12) };
};

export const STAGES = ["draft", "submitted", "reviewed", "approved", "locked"];
export const STAGE_LABELS = {
  draft: "Draft", submitted: "Submitted", reviewed: "Reviewed",
  approved: "Approved", locked: "Locked",
};
export const STAGE_CONFIG = {
  draft:     { pill: "bg-slate-100 text-slate-600 ring-slate-200",      dot: "bg-slate-400"   },
  submitted: { pill: "bg-sky-50 text-sky-700 ring-sky-200",             dot: "bg-sky-500"     },
  reviewed:  { pill: "bg-indigo-50 text-indigo-700 ring-indigo-200",    dot: "bg-indigo-500"  },
  approved:  { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  locked:    { pill: "bg-slate-800 text-slate-100 ring-slate-700",      dot: "bg-slate-300"   },
};

export const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",       "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700", "bg-slate-200 text-slate-700",
  "bg-teal-100 text-teal-700",     "bg-cyan-100 text-cyan-700",
  "bg-amber-100 text-amber-700",   "bg-rose-100 text-rose-700",
  "bg-sky-600 text-white",         "bg-slate-700 text-white",
];

// ─── Formatters ───────────────────────────────────────────────────────────────
export const fmt = (n) => {
  if (n == null || n === "") return "—";

  if (typeof n === "number") {
    if (!Number.isFinite(n)) return "—";
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
  }

  if (typeof n === "string") {
    const t = n.trim();
    if (!t) return "—";
    const parsed = Number(t.replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      return `$${parsed.toLocaleString("en-US", { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
    }
    return t;
  }

  return String(n);
};
export const fmtK = (n) =>
  n == null ? "—" : Math.abs(Number(n)) >= 1_000_000
    ? `$${(Number(n) / 1_000_000).toFixed(getDecimalPrecision())}M`
    : `$${(Number(n) / 1000).toFixed(getDecimalPrecision())}k`;
export const fmtPct = (n) => n != null ? `${Number(n).toFixed(getDecimalPrecision())}%` : "—";

export const parseApiError = async (res) => {
  let msg = `HTTP ${res.status}`;
  try {
    const d = await res.json();
    if (typeof d === "string") msg = d;
    else if (d?.detail) msg = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
    else if (d?.message) msg = d.message;
    else if (d?.error)   msg = d.error;
  } catch { /* no body */ }
  return msg;
};
export const getInitials = (name = "") =>
  name.split(/[\s,\-\/]+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
export const avatarClass = (name = "") =>
  AVATAR_COLORS[Math.abs((name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
export const getMonthKey = (year, index) =>
  `${year}-${String(index + 1).padStart(2, "0")}`;

// ─── ROI Badge helpers ────────────────────────────────────────────────────────
export function RoiBadge({ roi }) {
  if (!roi) return null;
  const npvGood = (roi.npv ?? 0) >= 0;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${npvGood ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
        NPV {fmt(roi.npv)}
      </span>
      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
        {roi.payback_period_years}yr payback
      </span>
      {roi.annual_benefit > 0 && (
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
          Benefit {fmt(roi.annual_benefit)}/yr
        </span>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, add };
}
export function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} style={{ animation: "slideUp 0.3s ease forwards" }}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-s font-semibold shadow-2xl
            ${t.type==="success"?"bg-emerald-600 text-white":t.type==="error"?"bg-red-600 text-white":"bg-slate-800 text-white"}`}>
          {t.type==="success"?<FiCheckCircle size={15}/>:t.type==="error"?<FiXCircle size={15}/>:<FiInfo size={15}/>}
          <span className="max-w-xs leading-snug">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-9 h-9 border-[3px] border-slate-200 border-t-sky-600 rounded-full animate-spin"/>
      <span className="text-slate-400 text-x font-medium tracking-wide">{label}</span>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ label }) {
  return (
    <div className="py-16 text-center">
      <FiInbox className="mx-auto text-slate-300 mb-3" size={32}/>
      <p className="text-s text-slate-400">{label}</p>
    </div>
  );
}

// ─── CenterErrorModal ─────────────────────────────────────────────────────────
export function CenterErrorModal({ error, onClose }) {
  if (!error) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl p-8 w-[420px] text-center shadow-2xl border border-slate-200">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <FiXCircle className="text-red-500" size={24}/>
        </div>
        <h3 className="font-bold text-slate-900 text-base mb-2">Something went wrong</h3>
        <p className="text-red-600 text-s mb-6 leading-relaxed">{error}</p>
        <button onClick={onClose} className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-s font-semibold transition-colors">Close</button>
      </div>
    </div>
  );
}

// ─── WorkflowModal — uses action string (same as expense) ─────────────────────
export function WorkflowModal({ open, target, onClose, onConfirm, loading }) {
  const [comment, setComment] = useState("");
  const [err, setErr] = useState(false);
  const isReject = target === "draft";
  useEffect(() => { if (open) { setComment(""); setErr(false); } }, [open]);
  if (!open) return null;
  const cfgMap = {
    submitted: { emoji: "🚀", title: "Submit for Review",  sub: "Submit this CAPEX forecast to the finance team for review.",    btn: "bg-sky-600 hover:bg-sky-700"         },
    reviewed:  { emoji: "🔍", title: "Mark as Reviewed",   sub: "Confirm you have thoroughly reviewed all CAPEX data.",          btn: "bg-indigo-600 hover:bg-indigo-700"   },
    approved:  { emoji: "✅", title: "Approve Forecast",   sub: "Approve and advance to the locking stage.",                    btn: "bg-emerald-600 hover:bg-emerald-700" },
    locked:    { emoji: "🔒", title: "Lock Forecast",      sub: "Permanently lock — no further edits will be allowed.",         btn: "bg-slate-800 hover:bg-slate-900"     },
    draft:     { emoji: "↩️", title: "Send Back to Draft", sub: "Return for revision. A comment is required.",                  btn: "bg-red-600 hover:bg-red-700"         },
  };
  const cfg = cfgMap[target] || {};
  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-[460px] shadow-2xl border border-slate-200">
        <div className="text-4xl mb-4">{cfg.emoji}</div>
        <h3 className="text-slate-900 font-bold text-xl mb-1">{cfg.title}</h3>
        <p className="text-slate-500 text-s mb-5">{cfg.sub}</p>
        <textarea value={comment} onChange={(e) => { setComment(e.target.value); setErr(false); }}
          placeholder={isReject ? "Comment is required when rejecting…" : "Optional comment…"} rows={3}
          className={`w-full px-3 py-2.5 rounded-xl text-s text-slate-900 border outline-none resize-none transition-all
            ${err ? "border-red-400 bg-red-50" : "border-slate-300 bg-slate-50 focus:border-sky-500 focus:ring-2 ring-sky-100"}`}/>
        {err && <p className="text-red-500 text-x mt-1.5">⚠ Comment is required when sending back.</p>}
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold transition-colors">Cancel</button>
          <button disabled={loading} onClick={() => { if (isReject && !comment.trim()) { setErr(true); return; } onConfirm(target, comment.trim()); }}
            className={`px-5 py-2.5 rounded-xl text-white text-s font-semibold transition-colors disabled:opacity-50 ${cfg.btn}`}>
            {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</span> : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WorkflowProgress ─────────────────────────────────────────────────────────
export function WorkflowProgress({ stage, workflowMeta, onAction }) {
  const stageIdx   = STAGES.indexOf(stage);
  const canSubmit  = stage === "draft";
  const canReview  = stage === "submitted";
  const canApprove = stage === "reviewed";
  const canLock    = stage === "approved";
  const canReject  = stage !== "draft" && stage !== "locked";
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 mb-2 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STAGES.map((s, i) => {
            const done = i < stageIdx; const current = i === stageIdx;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-x font-bold transition-all
                    ${current?"bg-sky-600 text-white ring-2 ring-sky-100 shadow-sm":done?"bg-slate-700 text-white":"bg-slate-100 text-slate-400 border border-slate-200"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium tracking-wide ${current?"text-sky-600":done?"text-slate-500":"text-slate-300"}`}>{STAGE_LABELS[s]}</span>
                </div>
                {i < STAGES.length - 1 && <div className={`w-6 h-0.5 rounded-full ${i < stageIdx?"bg-slate-700":"bg-slate-200"}`}/>}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {workflowMeta?.reviewed_by && <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x text-slate-600">Reviewed: <strong>{workflowMeta.reviewed_by}</strong></span>}
          {workflowMeta?.approved_by && <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x text-slate-600">Approved: <strong>{workflowMeta.approved_by}</strong></span>}
          {workflowMeta?.locked_by   && <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-x text-slate-200">Locked: <strong>{workflowMeta.locked_by}</strong></span>}
          {canReject  && <button onClick={() => onAction("draft")}     className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-x font-semibold transition-all"><FiCornerDownLeft size={12}/> Reject</button>}
          {canSubmit  && <button onClick={() => onAction("submitted")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-x font-semibold transition-all shadow-sm"><FiArrowUp size={12}/> Submit</button>}
          {canReview  && <button onClick={() => onAction("reviewed")}  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-x font-semibold transition-all shadow-sm"><FiCheckCircle size={12}/> Mark Reviewed</button>}
          {canApprove && <button onClick={() => onAction("approved")}  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-x font-semibold transition-all shadow-sm"><FiCheckCircle size={12}/> Approve</button>}
          {canLock    && <button onClick={() => onAction("locked")}    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-x font-semibold transition-all shadow-sm"><FiLock size={12}/> Lock</button>}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
export function KpiCards({ forecastSummary, months, rows }) {
  const totalNpv     = (rows || []).reduce((s, r) => s + (parseFloat(r.roi?.npv) || 0), 0);
  const totalBenefit = (rows || []).reduce((s, r) => s + (parseFloat(r.roi?.annual_benefit) || 0), 0);
  const varAmt    = forecastSummary?.variance_amount ?? 0;
  const varPct    = forecastSummary?.variance_percent ?? 0;

  const cards = [
    { label: "AI Suggested Total", value: fmt(forecastSummary?.total_ai),   sub: months.length > 1 ? `${months[0]}–${months[months.length - 1]} AI CAPEX` : `${months[0] || ""} AI CAPEX`,   icon: <FiCpu size={16}/>,       accent: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-100"    },
    { label: "Adjusted Total",     value: fmt(forecastSummary?.total_user), sub: "User-adjusted CAPEX",                  icon: <FiEdit size={16}/>,      accent: "text-slate-700",   bg: "bg-slate-50",   border: "border-slate-200"  },
    {
      label: "Portfolio NPV",      value: fmt(totalNpv), sub: "Sum across all CAPEX items",
      icon: totalNpv >= 0 ? <FiArrowUp size={16}/> : <FiArrowDown size={16}/>,
      accent: totalNpv >= 0 ? "text-emerald-600" : "text-red-600",
      bg: totalNpv >= 0 ? "bg-emerald-50" : "bg-red-50", border: totalNpv >= 0 ? "border-emerald-100" : "border-red-100",
    },
    {
      label: "Variance",
      value: fmt(varAmt),
      sub: `${Number(varPct).toFixed(getDecimalPrecision())}% vs AI baseline`,
      icon: varAmt >= 0 ? <FiArrowUp size={16}/> : <FiArrowDown size={16}/>,
      accent: varAmt >= 0 ? "text-red-600" : "text-emerald-600",
      bg: varAmt >= 0 ? "bg-red-50" : "bg-emerald-50",
      border: varAmt >= 0 ? "border-red-100" : "border-emerald-100",
    },
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 mb-2">
      {cards.map((card) => (
        <div key={card.label} className="min-w-0 bg-white rounded-xl border border-sky-200 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs text-sky-600 font-semibold uppercase tracking-wider truncate">{card.label}</span>
            <span className="w-6 h-6 shrink-0 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 [&_svg]:size-3.5">{card.icon}</span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-bold text-sky-900 tabular-nums whitespace-nowrap">{card.value}</span>
            <span className="text-[11px] text-sky-600 truncate" title={card.sub}>{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SaveBar ──────────────────────────────────────────────────────────────────
export function SaveBar({ hasChanges, saving, onSave, label = "Save Adjustments", disabled }) {
  if (!hasChanges) return null;
  return (
    <div style={{ animation: "slideUp 0.25s ease" }}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-4">
      <div className="flex items-center gap-2 text-amber-600 text-s font-semibold"><FiAlertCircle size={15}/> Unsaved changes</div>
      <button onClick={onSave} disabled={saving || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-s font-semibold rounded-xl transition-all">
        {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : <>💾 {label}</>}
      </button>
    </div>
  );
}

// ─── CommentCell ──────────────────────────────────────────────────────────────
export function CommentCell({ value, onChange, placeholder = "Note…", disabled }) {
  const [focus, setFocus] = useState(false);
  return (
    <input type="text" value={value || ""} disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      placeholder={placeholder}
      className={`w-full min-w-[100px] px-2 py-1.5 rounded-lg border text-x transition-all outline-none
        ${disabled?"bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          :focus  ?"border-sky-500 bg-white ring-2 ring-sky-100 text-slate-900"
          :         "border-slate-200 bg-white hover:border-slate-300 text-slate-700"}`}/>
  );
}

// ─── InlineCommentIcon ───────────────────────────────────────────────────────
// Revenue-style icon comment editor with popup view/edit modes.
export function InlineCommentIcon({ commentKey, value, onChange, label, disabled, isOverall }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("view"); // view | edit
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const textareaRef = useRef(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 260 });
  const hasComment = !!(value && value.trim());

  const updatePopupPosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const width = 320;
    const margin = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const popupHeight = popupRef.current?.offsetHeight || (hasComment && mode === "view" ? 140 : 220);

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, viewportW - width - margin));

    const topAbove = rect.top - popupHeight - 6;
    const topBelow = rect.bottom + 6;
    let top = topAbove >= margin ? topAbove : topBelow;

    if (top + popupHeight > viewportH - margin) {
      top = Math.max(margin, viewportH - popupHeight - margin);
    }

    setPopupPos({ top, left, width });
  }, [hasComment, mode]);

  useEffect(() => {
    if (!open) return;
    setDraft(value || "");
    setMode(hasComment ? "view" : "edit");
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, [open, value, hasComment]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePopupPosition();
    const raf = requestAnimationFrame(updatePopupPosition);

    const reposition = () => updatePopupPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, mode, draft, updatePopupPosition]);

  const handleSubmit = () => {
    onChange?.(draft.trim());
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.("");
    setDraft("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="inline-flex items-center justify-center">
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        title={hasComment ? `Comment: ${value}` : label ? `Add comment for ${label}` : "Add comment"}
        className={`relative w-6 h-6 rounded-md flex items-center justify-center transition-all group
          ${hasComment
            ? "bg-sky-100 text-sky-600 hover:bg-sky-200 border border-sky-200"
            : "bg-transparent text-slate-300 hover:text-sky-500 hover:bg-sky-50 border border-transparent hover:border-sky-200"
          } ${disabled && !hasComment ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        disabled={disabled && !hasComment}
      >
        <FiMessageSquare size={11} className={hasComment ? "fill-sky-200" : ""}/>
        {hasComment && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white"/>}
      </button>

      {open && (
        <div
          ref={popupRef}
          className="comment-popup fixed z-[5000] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          style={{ width: popupPos.width, top: popupPos.top, left: popupPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <FiMessageSquare size={11} className="text-sky-600"/>
              <span className=" text-xs font-semibold text-slate-700 truncate max-w-[160px]">{label || "Comment"}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <FiX size={12}/>
            </button>
          </div>

          <div className="p-3">
            {mode === "view" && hasComment ? (
              <div>
                <p className="text-x text-slate-700 leading-relaxed bg-sky-50 rounded-lg px-3 py-2 border border-sky-100 mb-2">{value}</p>
                <div className="flex gap-1.5">
                  {!disabled && (
                    <button
                      onClick={() => setMode("edit")}
                      className="flex items-center gap-1 flex-1 justify-center px-2 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700  text-xs font-semibold transition-colors"
                    >
                      <FiEdit size={10}/> Edit
                    </button>
                  )}
                  {!disabled && (
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-500  text-xs font-semibold transition-colors"
                    >
                      <FiX size={10}/> Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={disabled}
                  placeholder="Add a note or observation…"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
                    if (e.key === "Escape") setOpen(false);
                  }}
                  className="w-full px-2.5 py-2 text-x text-slate-900 rounded-lg border border-slate-300 outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1 mb-2">Ctrl+Enter to save · Esc to close</p>
                <div className="flex gap-1.5">
                  {hasComment && mode === "edit" && (
                    <button
                      onClick={() => setMode("view")}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500  text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={disabled}
                    className="flex items-center gap-1 flex-1 justify-center px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white  text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <FiCheck size={11}/> Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ScenarioModal — CAPEX specific (item_multipliers) ───────────────────────
export function ScenarioModal({ open, onClose, onSave, editScenario, loading }) {
  const [form, setForm]     = useState({ scenario_name: "", multiplier: 1, description: "" });
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (open) {
      setForm(editScenario
        ? { scenario_name: editScenario.scenario_name || "", multiplier: editScenario.multiplier ?? 1, description: editScenario.description || "" }
        : { scenario_name: "", multiplier: 1, description: "" });
      setErrors({});
    }
  }, [open, editScenario]);
  if (!open) return null;
  const validate = () => {
    const e = {};
    if (!form.scenario_name.trim()) e.scenario_name = "Name is required";
    if (isNaN(form.multiplier) || form.multiplier <= 0) e.multiplier = "Must be a positive number";
    return e;
  };
  const handleSubmit = () => {
    const e = validate(); if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, multiplier: parseFloat(form.multiplier), parameter_types: ["capex"], customer_scope: "all", item_multipliers: [] });
  };
  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[480px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{editScenario ? "Edit Scenario" : "Create Scenario"}</h3>
            <p className="text-x text-slate-500 mt-0.5">{editScenario ? "Update scenario parameters" : "Add a new CAPEX forecast scenario"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"><FiX size={15}/></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Scenario Name *</label>
            <input value={form.scenario_name} onChange={(e) => { setForm(p => ({...p, scenario_name: e.target.value})); setErrors(p => ({...p, scenario_name: ""})); }}
              placeholder="e.g. accelerated_investment, delayed_spending…"
              className={`w-full px-3 py-2.5 rounded-xl border text-s text-slate-900 outline-none transition-all ${errors.scenario_name?"border-red-400 bg-red-50":"border-slate-300 bg-white focus:border-sky-500 focus:ring-2 ring-sky-100"}`}/>
            {errors.scenario_name && <p className="text-red-500 text-x mt-1">{errors.scenario_name}</p>}
          </div>
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-2">Multiplier *</label>
            <input type="range" min="0.5" max="2.0" step="0.01" value={form.multiplier}
              onChange={(e) => { setForm(p => ({...p, multiplier: parseFloat(e.target.value)})); setErrors(p => ({...p, multiplier: ""})); }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"/>
            <div className="flex justify-between items-center mt-2">
              <span className="text-x text-slate-400">0.5×</span>
              <span className="text-s font-semibold text-sky-600">{Number(form.multiplier).toFixed(getDecimalPrecision())}×</span>
              <span className="text-x text-slate-400">2.0×</span>
            </div>
            <p className="text-x text-slate-400 mt-1.5">1.0 = baseline · 1.2 = +20% CAPEX · 0.75 = −25%</p>
          </div>
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))}
              placeholder="Describe the investment assumptions behind this scenario…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all"/>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : editScenario ? "Update Scenario" : "Create Scenario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ExcelUploadPreviewModal ───────────────────────────────────────────────────
export function ExcelUploadPreviewModal({ open, onClose, title, onUpload, uploading, uploadError, accept = ".xlsx,.xls,.csv" }) {
  const fileRef = useRef(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [step,         setStep]         = useState("drop");
  const [rawFile,      setRawFile]      = useState(null);
  const [headers,      setHeaders]      = useState([]);
  const [rows,         setRows]         = useState([]);
  const [parseError,   setParseError]   = useState(null);
  const [uploadProg,   setUploadProg]   = useState(0);
  const [changedCells, setChangedCells] = useState(new Set());

  useEffect(() => {
    if (!open) { setStep("drop"); setRawFile(null); setHeaders([]); setRows([]); setParseError(null); setUploadProg(0); setChangedCells(new Set()); }
  }, [open]);

  const parseFile = async (file) => {
    setParseError(null);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array", cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!data || data.length < 2) { setParseError("File appears empty or has no data rows."); return; }
      const hdrs   = data[0].map((h) => String(h ?? ""));
      const body   = data.slice(1).filter((row) => row.some((c) => c !== "" && c != null));
      const mapped = body.map((row) => { const obj = {}; hdrs.forEach((h, i) => { obj[h] = row[i] ?? ""; }); return obj; });
      setHeaders(hdrs); setRows(mapped); setRawFile(file); setStep("preview");
    } catch (e) { setParseError(`Could not parse file: ${e.message}`); }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); };
  const handleFileInput = (e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; };
  const handleCellEdit = (rowIdx, col, val) => {
    setRows((prev) => { const next = [...prev]; next[rowIdx] = { ...next[rowIdx], [col]: val }; return next; });
    setChangedCells((prev) => new Set(prev).add(`${rowIdx}-${col}`));
  };
  const handleSubmitUpload = async () => {
    setStep("uploading"); setUploadProg(0);
    const interval = setInterval(() => setUploadProg((p) => Math.min(p + Math.random() * 15, 90)), 200);
    try {
      const wb   = XLSX.utils.book_new();
      const ws   = XLSX.utils.json_to_sheet(rows, { header: headers });
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const file = new File([blob], rawFile?.name || "upload.xlsx", { type: blob.type });
      await onUpload(file);
      clearInterval(interval); setUploadProg(100); setStep("done");
    } catch { clearInterval(interval); setStep("preview"); }
  };

  if (!open) return null;
  const isNumericCol = (col) => {
    const sample = rows.slice(0, 5).map((r) => r[col]).filter((v) => v !== "" && v != null);
    return sample.length > 0 && sample.every((v) => !isNaN(Number(v)));
  };

  return (
    <div className="fixed inset-0 z-[900] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        style={{ width: step === "preview" ? "min(96vw, 1100px)" : "500px", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {["Upload","Preview & Edit","Submit"].map((s, i) => {
                const stepNum = i + 1;
                const curStep = step === "drop" ? 1 : step === "preview" ? 2 : 3;
                const done    = stepNum < curStep; const active = stepNum === curStep;
                return (
                  <React.Fragment key={s}>
                    <div className="flex items-center gap-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${active?"bg-sky-600 text-white":done?"bg-emerald-500 text-white":"bg-slate-200 text-slate-500"}`}>
                        {done ? "✓" : stepNum}
                      </div>
                      <span className={`text-x font-medium hidden sm:inline ${active?"text-sky-700":done?"text-emerald-600":"text-slate-400"}`}>{s}</span>
                    </div>
                    {i < 2 && <div className={`w-6 h-0.5 rounded-full ${done?"bg-emerald-400":"bg-slate-200"}`}/>}
                  </React.Fragment>
                );
              })}
            </div>
            <span className="font-semibold text-slate-900 text-s">{title}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"><FiX size={14}/></button>
        </div>
        {/* Step 1: Drop */}
        {step === "drop" && (
          <div className="p-6">
            <div onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-12 px-6 text-center cursor-pointer transition-all ${dragOver?"border-sky-400 bg-sky-50":"border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/40"}`}>
              <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4"><FiUpload size={24} className="text-sky-600"/></div>
              <p className="font-semibold text-slate-800 text-s mb-1">{dragOver?"Drop it!":"Drop file or click to browse"}</p>
              <p className="text-x text-slate-400">{accept.replace(/\./g,"").toUpperCase().replace(/,/g," · ")}</p>
              <p className=" text-xs text-slate-400 mt-2 bg-slate-100 px-3 py-1 rounded-full">File will be previewed before uploading</p>
              <input ref={fileRef} type="file" accept={accept} onChange={handleFileInput} hidden/>
            </div>
            {parseError && <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200"><FiAlertCircle className="text-red-500 shrink-0 mt-0.5" size={14}/><p className="text-x text-red-600">{parseError}</p></div>}
          </div>
        )}
        {/* Step 2: Preview */}
        {step === "preview" && (
          <>
            <div className="px-6 py-3 bg-sky-50 border-b border-sky-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sky-700 text-x font-semibold"><FiEye size={13}/> {rawFile?.name}</div>
                <span className=" text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full tabular-nums">{rows.length} rows · {headers.length} cols</span>
                {changedCells.size > 0 && <span className=" text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">{changedCells.size} edit{changedCells.size!==1?"s":""}</span>}
              </div>
              <p className=" text-xs text-sky-600 font-medium">Click any cell to edit before submitting</p>
            </div>
            <div className="overflow-auto flex-1" style={{ maxHeight: "55vh" }}>
              <table className="w-full border-collapse text-x" style={{ minWidth: `${Math.max(headers.length * 140, 600)}px` }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-sky-800">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-white w-10 border-r border-sky-700">#</th>
                    {headers.map((h, i) => <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 whitespace-nowrap">{h||`Col ${i+1}`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className={`border-b border-slate-100 ${ri%2===0?"bg-white":"bg-slate-50/50"} hover:bg-sky-50/30 transition-colors`}>
                      <td className="px-3 py-1.5 text-slate-400 tabular-nums text-xs border-r border-slate-100 text-center">{ri+1}</td>
                      {headers.map((h, ci) => {
                        const cellKey = `${ri}-${h}`; const isChanged = changedCells.has(cellKey); const isNum = isNumericCol(h);
                        return (
                          <td key={ci} className={`px-1 py-1 border-r border-slate-100 ${isChanged?"bg-amber-50":""}`}>
                            <input type="text" value={String(row[h]??"")} onChange={(e) => handleCellEdit(ri, h, e.target.value)}
                              className={`w-full px-2 py-1 rounded border text-x outline-none transition-all min-w-[100px] ${isChanged?"border-amber-400 bg-amber-50 text-amber-900 focus:ring-1 ring-amber-200":"border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-sky-400 focus:bg-white focus:ring-1 ring-sky-100"} ${isNum?"text-right tabular-nums":"text-left"}`}/>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {uploadError && <div className="mx-6 mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 shrink-0"><FiAlertCircle className="text-red-500 shrink-0 mt-0.5" size={14}/><p className="text-x text-red-600">{uploadError}</p></div>}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <button onClick={() => { setStep("drop"); setRows([]); setHeaders([]); setRawFile(null); setChangedCells(new Set()); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-s font-semibold transition-colors">← Back</button>
              <div className="flex items-center gap-3">
                {changedCells.size > 0 && <p className=" text-xs text-amber-600 font-medium">{changedCells.size} cell{changedCells.size!==1?"s":""} edited</p>}
                <button onClick={handleSubmitUpload} disabled={uploading||rows.length===0} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all shadow-sm disabled:opacity-50"><FiUpload size={13}/> Submit Upload</button>
              </div>
            </div>
          </>
        )}
        {/* Step 3: Uploading */}
        {step === "uploading" && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center"><FiUpload size={28} className="text-sky-600 animate-pulse"/></div>
            <div className="text-center"><p className="font-semibold text-slate-900 text-base mb-1">Uploading…</p><p className="text-x text-slate-500">{rawFile?.name}</p></div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-sky-600 h-2 rounded-full transition-all duration-200" style={{ width: `${uploadProg}%` }}/></div>
            <p className=" text-xs text-slate-400 tabular-nums">{Math.round(uploadProg)}%</p>
          </div>
        )}
        {/* Step 4: Done */}
        {step === "done" && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center"><FiCheck size={28} className="text-emerald-600"/></div>
            <div className="text-center"><p className="font-semibold text-slate-900 text-base mb-1">Upload Complete</p><p className="text-x text-slate-500">Your file has been uploaded successfully.</p>{changedCells.size > 0 && <p className=" text-xs text-emerald-600 mt-1 font-medium">{changedCells.size} edit{changedCells.size!==1?"s":""} applied before upload</p>}</div>
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────
export function RichTextEditor({ value, onChange, placeholder = "Write a comment…", disabled }) {
  const editorRef = useRef(null); const fileRef = useRef(null); const [focused, setFocused] = useState(false);
  useEffect(() => { if (editorRef.current && value === "") editorRef.current.innerHTML = ""; }, [value]);
  const execCmd = (cmd) => { editorRef.current?.focus(); document.execCommand(cmd, false, null); notifyChange(); };
  const notifyChange = () => onChange?.(editorRef.current?.innerHTML || "");
  const handleImageInsert = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => { editorRef.current?.focus(); document.execCommand("insertImage", false, e.target.result); notifyChange(); };
    reader.readAsDataURL(file);
  };
  const handlePaste = (e) => { const items = e.clipboardData?.items; if (!items) return; for (const item of items) { if (item.type.startsWith("image/")) { e.preventDefault(); handleImageInsert(item.getAsFile()); return; } } };
  return (
    <div className={`rounded-xl border overflow-hidden bg-white transition-all ${disabled?"opacity-60 pointer-events-none":""} ${focused?"border-sky-700 ring-2 ring-sky-100":"border-sky-200"}`}>
      <div className="flex items-center gap-1 px-3 py-2 bg-sky-50 border-b border-sky-200">
        {[{icon:<FiBold size={13}/>,cmd:"bold"},{icon:<FiItalic size={13}/>,cmd:"italic"},{icon:<FiList size={13}/>,cmd:"insertUnorderedList"}].map(b=>(
          <button key={b.cmd} onMouseDown={(e)=>{e.preventDefault();execCmd(b.cmd);}} className="w-7 h-7 rounded-lg flex items-center justify-center text-sky-700 hover:bg-white hover:text-sky-900 transition-colors">{b.icon}</button>
        ))}
        <div className="w-px h-4 bg-sky-200 mx-1"/>
        <button onMouseDown={(e)=>{e.preventDefault();fileRef.current?.click();}} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sky-700 hover:bg-white hover:text-sky-900 transition-colors text-x font-medium"><FiImage size={13}/> Image</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={e=>{handleImageInsert(e.target.files?.[0]);e.target.value="";}} hidden/>
        <div className="ml-auto text-xs text-sky-600">Paste or drag images</div>
      </div>
      <div ref={editorRef} contentEditable={!disabled} suppressContentEditableWarning
        onInput={notifyChange} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        onPaste={handlePaste} onDrop={(e)=>{e.preventDefault();handleImageInsert(e.dataTransfer.files?.[0]);}} onDragOver={(e)=>e.preventDefault()}
        data-placeholder={placeholder}
        className="min-h-[110px] max-h-[240px] overflow-y-auto bg-white p-3 text-s text-sky-900 outline-none leading-relaxed [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1.5 [&_img]:max-h-48 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-bold [&_em]:italic empty:before:content-[attr(data-placeholder)] empty:before:text-sky-400 empty:before:pointer-events-none"
        style={{ wordBreak: "break-word" }}/>
    </div>
  );
}

// ─── OverallChat ──────────────────────────────────────────────────────────────
export function OverallChat({ year, quarter, token, API_BASE, addToast }) {
  const [comments, setComments]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [posting, setPosting]     = useState(false);
  const [editorVal, setEditorVal] = useState("");
  const [filter, setFilter]       = useState("all");
  const bottomRef = useRef(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter !== "all"
        ? `${API_BASE}/${year}/comments?quarter=${quarter}&comment_type=${filter}`
        : `${API_BASE}/${year}/comments?quarter=${quarter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) { addToast(`Failed to load comments: ${e.message}`, "error"); }
    finally { setLoading(false); }
  }, [year, quarter, token, filter, API_BASE]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => { if (!loading) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [comments, loading]);

  const handlePost = async () => {
    const text = editorVal?.replace(/<[^>]*>/g, "").trim();
    if (!text && !editorVal?.includes("<img")) { addToast("Comment cannot be empty", "error"); return; }
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/comments?quarter=${quarter}`, {
        method: "POST", headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment: editorVal }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setEditorVal(""); addToast("Comment posted ✓", "success"); fetchComments();
    } catch (e) { addToast(`Failed to post: ${e.message}`, "error"); }
    finally { setPosting(false); }
  };

  const FILTER_OPTS = [{ value:"all",label:"All" },{ value:"general",label:"General" },{ value:"transition",label:"Transition" },{ value:"rejection",label:"Rejection" }];
  const typeBadge = (type) => ({general:"bg-sky-50 text-sky-600 border-sky-200",transition:"bg-amber-50 text-amber-600 border-amber-200",rejection:"bg-red-50 text-red-600 border-red-200"}[type]||"bg-slate-50 text-slate-500 border-slate-200");

  return (
    <div className="mt-6 bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-sky-900 text-white flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center"><FiMessageSquare size={15}/></div>
          <div>
            <h2 className="font-semibold text-s leading-tight text-white">CAPEX Discussion</h2>
            <p className="text-white/90  text-xs">{year} · {quarter} · {comments.length} comment{comments.length!==1?"s":""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-sky-200">
            {FILTER_OPTS.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)} className={`px-2.5 py-1 rounded-md text-x font-medium transition-all ${filter===f.value?"bg-sky-900 text-white shadow-sm":"text-sky-700 hover:bg-sky-50 hover:text-sky-900"}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={fetchComments} className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-colors"><FiRefreshCw size={13}/></button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row" style={{ minHeight: 420, maxHeight: 600 }}>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-white border-r border-sky-200">
          {loading ? <Spinner label="Loading discussion…"/>
            : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 gap-2">
                <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center"><FiMessageSquare className="text-sky-500" size={22}/></div>
                <p className="text-sky-700 text-s font-medium">No comments yet</p>
                <p className="text-sky-500 text-x">Start the discussion →</p>
              </div>
            ) : (
              <>
                {comments.map((c, i) => {
                  const avCls  = avatarClass(c.user_name || c.user_id || "?");
                  const initls = getInitials(c.user_name || "U");
                  const isRich = c.comment?.includes("<") && c.comment?.includes(">");
                  return (
                    <div key={c.id||i} style={{ animation: "fadeIn 0.3s ease" }} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-x font-bold shrink-0 ${avCls}`}>{initls}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sky-900 text-s">{c.user_name||"User"}</span>
                          {c.department && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-medium border border-sky-200">{c.department}</span>}
                          {c.comment_type && c.comment_type!=="general" && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${typeBadge(c.comment_type)}`}>{c.comment_type}</span>}
                          {c.created_at && <span className="text-xs text-sky-500 tabular-nums ml-auto">{new Date(c.created_at).toLocaleString()}</span>}
                        </div>
                        <div className={`text-s text-sky-900 leading-relaxed bg-white rounded-xl px-3 py-2.5 border border-sky-200 ${isRich?"[&_img]:max-w-full [&_img]:rounded-lg [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-bold [&_em]:italic":""}`}
                          {...(isRich?{dangerouslySetInnerHTML:{__html:c.comment}}:{children:c.comment})}/>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </>
            )}
        </div>
        <div className="w-full lg:w-[360px] p-4 flex flex-col gap-3 bg-white shrink-0">
          <div>
            <h3 className="font-semibold text-sky-900 text-s mb-0.5">Add to Discussion</h3>
            <p className="text-x text-sky-600">Supports <strong>bold</strong>, <em>italic</em>, lists &amp; images</p>
          </div>
          <RichTextEditor value={editorVal} onChange={setEditorVal} placeholder="Share CAPEX observations, flag investment changes, or add context…" disabled={posting}/>
          <button onClick={handlePost} disabled={posting}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all disabled:opacity-50">
            {posting?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Posting…</>:<><FiSend size={13}/> Post Comment</>}
          </button>
          <p className="text-xs text-sky-600 text-center">{year} {quarter} · Visible to all team members</p>
        </div>
      </div>
    </div>
  );
}

