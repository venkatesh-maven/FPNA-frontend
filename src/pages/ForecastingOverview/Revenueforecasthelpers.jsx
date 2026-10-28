// RevenueForecastHelpers.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FiCheckCircle, FiXCircle, FiInfo, FiArrowUp, FiArrowDown,
  FiLock, FiCornerDownLeft, FiInbox, FiCpu, FiEdit, FiUpload,
  FiX, FiAlertCircle, FiSend, FiImage, FiMessageSquare,
  FiRefreshCw, FiBold, FiItalic, FiList, FiCheck, FiEdit2,
} from "react-icons/fi";
import { getDecimalPrecision } from '../../utils/formatters';

// ─── Design tokens ────────────────────────────────────────────────────────────
const MONTH_ABBR_ALL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Fiscal-year-aware quarter->months map. `fiscalYearStartMonth` (1=Jan..12=Dec,
// from Settings & Customization -> FY Management) rotates which 3-month block
// is Q1 — defaults to 1 so Q1=Jan-Mar, matching the old hardcoded behavior.
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
  draft:     { pill: "bg-slate-100 text-slate-600 ring-slate-200",       dot: "bg-slate-400"   },
  submitted: { pill: "bg-sky-50 text-sky-700 ring-sky-200",              dot: "bg-sky-500"     },
  reviewed:  { pill: "bg-indigo-50 text-indigo-700 ring-indigo-200",     dot: "bg-indigo-500"  },
  approved:  { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",  dot: "bg-emerald-500" },
  locked:    { pill: "bg-slate-800 text-slate-100 ring-slate-700",       dot: "bg-slate-300"   },
};
export const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",       "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700", "bg-slate-200 text-slate-700",
  "bg-teal-100 text-teal-700",     "bg-cyan-100 text-cyan-700",
  "bg-sky-600 text-white",         "bg-slate-700 text-white",
];

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
  n != null ? `$${(Number(n) / 1000).toFixed(getDecimalPrecision())}k` : "—";
export const parseApiError = async (res) => {
  let msg = `HTTP ${res.status}`;
  try {
    const d = await res.json();
    if (typeof d === "string") msg = d;
    else if (d?.detail) msg = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
    else if (d?.message) msg = d.message;
    else if (d?.error) msg = d.error;
  } catch { /* no body */ }
  return msg;
};
export const getInitials = (name = "") =>
  name.split(/[\s,]+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
export const avatarClass = (name = "") =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
export const getMonthKey = (year, index, quarter = "Q1", fiscalYearStartMonth = 1) => {
  const quarterStartPos = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 }[quarter] ?? 0;
  const offset = (fiscalYearStartMonth || 1) - 1 + quarterStartPos + index;
  const month = (offset % 12) + 1;
  const yearAdd = Math.floor(offset / 12);
  return `${year + yearAdd}-${String(month).padStart(2, "0")}`;
};

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
            ${t.type === "success" ? "bg-emerald-600 text-white"
              : t.type === "error" ? "bg-red-600 text-white"
              : "bg-slate-800 text-white"}`}>
          {t.type === "success" ? <FiCheckCircle size={15}/>
            : t.type === "error" ? <FiXCircle size={15}/>
            : <FiInfo size={15}/>}
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
        <button onClick={onClose}
          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-s font-semibold transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

// ─── WorkflowModal ────────────────────────────────────────────────────────────
export function WorkflowModal({ open, target, onClose, onConfirm, loading }) {
  const [comment, setComment] = useState("");
  const [err, setErr] = useState(false);
  const isReject = target === "draft";
  useEffect(() => { if (open) { setComment(""); setErr(false); } }, [open]);
  if (!open) return null;

  const cfgMap = {
    submitted: { emoji: "🚀", title: "Submit for Review",  sub: "Submit this forecast to the finance team for review.",    btn: "bg-sky-600 hover:bg-sky-700"   },
    reviewed:  { emoji: "🔍", title: "Mark as Reviewed",   sub: "Confirm you have thoroughly reviewed all forecast data.", btn: "bg-indigo-600 hover:bg-indigo-700" },
    approved:  { emoji: "✅", title: "Approve Forecast",   sub: "Approve and advance to the locking stage.",              btn: "bg-emerald-600 hover:bg-emerald-700" },
    locked:    { emoji: "🔒", title: "Lock Forecast",      sub: "Permanently lock — no further edits will be allowed.",   btn: "bg-slate-800 hover:bg-slate-900"  },
    draft:     { emoji: "↩️", title: "Send Back to Draft", sub: "Return for revision. A comment is required.",           btn: "bg-red-600 hover:bg-red-700"      },
  };
  const cfg = cfgMap[target] || {};

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold transition-colors">
            Cancel
          </button>
          <button disabled={loading}
            onClick={() => {
              if (isReject && !comment.trim()) { setErr(true); return; }
              onConfirm(target, comment.trim());
            }}
            className={`px-5 py-2.5 rounded-xl text-white text-s font-semibold transition-colors disabled:opacity-50 ${cfg.btn}`}>
            {loading
              ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</span>
              : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ImportModal ──────────────────────────────────────────────────────────────
export function ImportModal({ open, onClose, title, description, onUpload, uploading, error, accept = ".xlsx,.xls,.csv" }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  useEffect(() => { if (!open) setDragOver(false); }, [open]);
  if (!open) return null;

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  };

  return (
    <div className="fixed inset-0 z-[900] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[500px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FiUpload size={15} className="text-sky-600"/>
            <span className="font-semibold text-slate-900 text-s">{title}</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            <FiX size={14}/>
          </button>
        </div>
        <div className="p-6">
          {description && <p className="text-x text-slate-500 mb-5 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-200">{description}</p>}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-all
              ${dragOver ? "border-sky-400 bg-sky-50" : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/40"}`}>
            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
              <FiUpload size={22} className="text-sky-600"/>
            </div>
            <p className="font-semibold text-slate-800 text-s">{dragOver ? "Drop it!" : "Drop file or click to browse"}</p>
            <p className="text-x text-slate-400 mt-1">{accept.replace(/\./g, "").toUpperCase().replace(/,/g, " · ")}</p>
            <input ref={fileRef} type="file" accept={accept}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} hidden/>
          </div>
          {uploading && (
            <div className="mt-4 flex items-center gap-2 text-sky-600 text-s font-medium">
              <span className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"/> Uploading…
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <FiAlertCircle className="text-red-500 shrink-0 mt-0.5" size={14}/>
              <p className="text-x text-red-600">{error}</p>
            </div>
          )}
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
                    ${current ? "bg-sky-600 text-white ring-2 ring-sky-100 shadow-sm"
                      : done   ? "bg-slate-700 text-white"
                      :          "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium tracking-wide
                    ${current ? "text-sky-600" : done ? "text-slate-500" : "text-slate-300"}`}>
                    {STAGE_LABELS[s]}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`w-6 h-0.5 rounded-full ${i < stageIdx ? "bg-slate-700" : "bg-slate-200"}`}/>
                )}
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
export function KpiCards({ forecastSummary, months, variance, varPct, summaryVarianceAmount, summaryVariancePercent }) {
  const varAmt    = summaryVarianceAmount ?? variance;
  const varPctNum = summaryVariancePercent ?? Number(varPct);

  const cards = [
    {
      label: "AI Suggested Total", value: fmt(forecastSummary?.total_ai),
      sub: months.length > 1 ? `${months[0]}–${months[months.length - 1]} AI forecast` : `${months[0] || ""} AI forecast`,
      icon: <FiCpu size={16}/>, accent: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100",
    },
    {
      label: "Adjusted Total", value: fmt(forecastSummary?.total_user),
      sub: "User-adjusted forecast",
      icon: <FiEdit size={16}/>, accent: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
    },
    {
      label: "Variance ($)", value: fmt(varAmt),
      sub: `${varPctNum?.toFixed?.(1) ?? "0.0"}% vs AI baseline`,
      icon: varAmt >= 0 ? <FiArrowUp size={16}/> : <FiArrowDown size={16}/>,
      accent: varAmt >= 0 ? "text-emerald-600" : "text-red-600",
      bg: varAmt >= 0 ? "bg-emerald-50" : "bg-red-50",
      border: varAmt >= 0 ? "border-emerald-100" : "border-red-100",
    },
    {
      label: "Variance (%)",
      value: varPctNum != null ? `${varPctNum >= 0 ? "+" : ""}${varPctNum?.toFixed?.(1)}%` : "—",
      sub: "Relative to AI baseline",
      icon: varPctNum >= 0 ? <FiArrowUp size={16}/> : <FiArrowDown size={16}/>,
      accent: varPctNum >= 0 ? "text-emerald-600" : "text-red-600",
      bg: varPctNum >= 0 ? "bg-emerald-50" : "bg-red-50",
      border: varPctNum >= 0 ? "border-emerald-100" : "border-red-100",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 mb-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="min-w-0 bg-white rounded-xl border border-sky-200 px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs text-sky-600 font-semibold uppercase tracking-wider truncate">{card.label}</span>
            <span className="w-6 h-6 shrink-0 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 [&_svg]:size-3.5">
              {card.icon}
            </span>
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
      <div className="flex items-center gap-2 text-amber-600 text-s font-semibold">
        <FiAlertCircle size={15}/> Unsaved changes
      </div>
      <button onClick={onSave} disabled={saving || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-s font-semibold rounded-xl transition-all">
        {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : <>💾 {label}</>}
      </button>
    </div>
  );
}

// ─── CommentCell (kept for backward compat, not used in table anymore) ────────
export function CommentCell({ value, onChange, placeholder = "Note…", disabled }) {
  const [focus, setFocus] = useState(false);
  return (
    <input type="text" value={value || ""} disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      placeholder={placeholder}
      className={`w-full min-w-[100px] px-2 py-1.5 rounded-lg border text-x transition-all outline-none
        ${disabled ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          : focus   ? "border-sky-500 bg-white ring-2 ring-sky-100 text-slate-900"
          :            "border-slate-200 bg-white hover:border-slate-300 text-slate-700"}
        ${value && !disabled ? "border-slate-300" : ""}`}
    />
  );
}

// ─── NEW: InlineCommentIcon ───────────────────────────────────────────────────
// Replaces the inline text input in the table.
// - If no comment: shows a ghost message icon; click/hover opens a write popup.
// - If comment exists: shows a filled/colored icon; hover shows the comment text; click opens edit popup.
export function InlineCommentIcon({ commentKey, value, onChange, label, disabled, isOverall }) {
  const [open, setOpen]   = useState(false); // popup open
  const [draft, setDraft] = useState("");
  const [mode, setMode]   = useState("view"); // "view" | "edit"
  const wrapRef           = useRef(null);
  const triggerRef        = useRef(null);
  const popupRef          = useRef(null);
  const textareaRef       = useRef(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 260 });
  const hasComment        = !!(value && value.trim());

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

  // Sync draft when popup opens
  useEffect(() => {
    if (open) {
      setDraft(value || "");
      // If no comment, go directly to edit mode
      setMode(hasComment ? "view" : "edit");
      // Focus textarea after a tick
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

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
    <div ref={wrapRef} className="relative inline-flex items-center justify-center">
      {/* Trigger icon */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        title={hasComment ? `Comment: ${value}` : label ? `Add comment for ${label}` : "Add comment"}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-all group
          ${hasComment
            ? "bg-sky-100 text-sky-600 hover:bg-sky-200 border border-sky-200"
            : "bg-transparent text-slate-300 hover:text-sky-500 hover:bg-sky-50 border border-transparent hover:border-sky-200"
          } ${disabled && !hasComment ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        disabled={disabled && !hasComment}
      >
        <FiMessageSquare size={11} className={hasComment ? "fill-sky-200" : ""}/>
        {/* Green dot indicator when comment exists */}
        {hasComment && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white"/>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div
          ref={popupRef}
          className="comment-popup fixed z-[5000] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          style={{ width: popupPos.width, top: popupPos.top, left: popupPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <FiMessageSquare size={11} className="text-sky-600"/>
              <span className=" text-xs font-semibold text-slate-700 truncate max-w-[160px]">{label || "Comment"}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <FiX size={12}/>
            </button>
          </div>

          {/* Body */}
          <div className="p-3">
            {/* View mode: show comment text with edit button */}
            {mode === "view" && hasComment ? (
              <div>
                <p className="text-x text-slate-700 leading-relaxed bg-sky-50 rounded-lg px-3 py-2 border border-sky-100 mb-2">
                  {value}
                </p>
                <div className="flex gap-1.5">
                  {!disabled && (
                    <button onClick={() => setMode("edit")}
                      className="flex items-center gap-1 flex-1 justify-center px-2 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700  text-xs font-semibold transition-colors">
                      <FiEdit2 size={10}/> Edit
                    </button>
                  )}
                  {!disabled && (
                    <button onClick={handleClear}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-500  text-xs font-semibold transition-colors">
                      <FiX size={10}/> Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Edit / write mode */
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
                  className="w-full px-2.5 py-2 text-x text-slate-900 rounded-lg border border-slate-300 outline-none resize-none
                    focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all placeholder:text-slate-400
                    disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1 mb-2">Ctrl+Enter to save · Esc to close</p>
                <div className="flex gap-1.5">
                  {hasComment && mode === "edit" && (
                    <button onClick={() => setMode("view")}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500  text-xs font-semibold transition-colors">
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={disabled}
                    className="flex items-center gap-1 flex-1 justify-center px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white  text-xs font-semibold transition-all disabled:opacity-50">
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

// ─── ScenarioModal ────────────────────────────────────────────────────────────
export function ScenarioModal({ open, onClose, onSave, editScenario, loading }) {
  const [form, setForm]     = useState({ scenario_name: "", multiplier: 1, description: "" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      if (editScenario) {
        setForm({ scenario_name: editScenario.scenario_name || "", multiplier: editScenario.multiplier ?? 1, description: editScenario.description || "" });
      } else {
        setForm({ scenario_name: "", multiplier: 1, description: "" });
      }
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
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, multiplier: parseFloat(form.multiplier) });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[480px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{editScenario ? "Edit Scenario" : "Create Scenario"}</h3>
            <p className="text-x text-slate-500 mt-0.5">{editScenario ? "Update scenario parameters" : "Add a new forecast scenario"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            <FiX size={15}/>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Scenario Name *</label>
            <input value={form.scenario_name}
              onChange={(e) => { setForm(p => ({...p, scenario_name: e.target.value})); setErrors(p => ({...p, scenario_name: ""})); }}
              placeholder="e.g. conservative_growth, q3_optimistic…"
              className={`w-full px-3 py-2.5 rounded-xl border text-s text-slate-900 outline-none transition-all
                ${errors.scenario_name ? "border-red-400 bg-red-50" : "border-slate-300 bg-white focus:border-sky-500 focus:ring-2 ring-sky-100"}`}/>
            {errors.scenario_name && <p className="text-red-500 text-x mt-1">{errors.scenario_name}</p>}
          </div>
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Multiplier *</label>
            <input type="number" step="0.01" min="0.01" value={form.multiplier}
              onChange={(e) => { setForm(p => ({...p, multiplier: e.target.value})); setErrors(p => ({...p, multiplier: ""})); }}
              className={`w-full px-3 py-2.5 rounded-xl border text-s text-slate-900 outline-none transition-all
                ${errors.multiplier ? "border-red-400 bg-red-50" : "border-slate-300 bg-white focus:border-sky-500 focus:ring-2 ring-sky-100"}`}/>
            {errors.multiplier && <p className="text-red-500 text-x mt-1">{errors.multiplier}</p>}
            <p className="text-x text-slate-400 mt-1.5">1.0 = baseline · 1.1 = +10% uplift · 0.8 = −20% reduction</p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map(v => (
                <button key={v} type="button" onClick={() => setForm(p => ({...p, multiplier: v}))}
                  className={`px-2.5 py-1 rounded-lg text-x font-semibold transition-all border
                    ${parseFloat(form.multiplier) === v ? "bg-sky-600 text-white border-sky-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                  {v}×
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))}
              placeholder="Describe the assumptions behind this scenario…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all"/>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
                : editScenario ? "Update Scenario" : "Create Scenario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────
export function RichTextEditor({ value, onChange, placeholder = "Write a comment…", disabled }) {
  const editorRef = useRef(null);
  const fileRef   = useRef(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && value === "") editorRef.current.innerHTML = "";
  }, [value]);

  const execCmd = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    notifyChange();
  };

  const notifyChange = () => onChange?.(editorRef.current?.innerHTML || "");

  const handleImageInsert = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      editorRef.current?.focus();
      document.execCommand("insertImage", false, e.target.result);
      notifyChange();
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) { e.preventDefault(); handleImageInsert(item.getAsFile()); return; }
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all
      ${disabled ? "opacity-60 pointer-events-none" : ""}
      ${focused ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-300"}`}>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
        {[
          { icon: <FiBold size={13}/>,   cmd: "bold",               title: "Bold"   },
          { icon: <FiItalic size={13}/>, cmd: "italic",             title: "Italic" },
          { icon: <FiList size={13}/>,   cmd: "insertUnorderedList", title: "List"   },
        ].map(b => (
          <button key={b.cmd} title={b.title}
            onMouseDown={(e) => { e.preventDefault(); execCmd(b.cmd); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors">
            {b.icon}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-200 mx-1"/>
        <button title="Insert Image"
          onMouseDown={(e) => { e.preventDefault(); fileRef.current?.click(); }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors text-x font-medium">
          <FiImage size={13}/> Image
        </button>
        <input ref={fileRef} type="file" accept="image/*"
          onChange={e => { handleImageInsert(e.target.files?.[0]); e.target.value = ""; }} hidden/>
        <div className="ml-auto text-xs text-slate-400">Paste or drag images</div>
      </div>
      <div ref={editorRef} contentEditable={!disabled} suppressContentEditableWarning
        onInput={notifyChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={handlePaste}
        onDrop={(e) => { e.preventDefault(); handleImageInsert(e.dataTransfer.files?.[0]); }}
        onDragOver={(e) => e.preventDefault()}
        data-placeholder={placeholder}
        className="min-h-[110px] max-h-[240px] overflow-y-auto p-3 text-s text-slate-900 outline-none leading-relaxed
          [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1.5 [&_img]:max-h-48
          [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-bold [&_em]:italic
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
        style={{ wordBreak: "break-word" }}
      />
    </div>
  );
}

// ─── OverallChat ──────────────────────────────────────────────────────────────
// FIX: Uses IntersectionObserver to lazily fetch comments only when this
// section scrolls into the viewport — prevents the page from jumping to
// the bottom on initial load because the comment API was firing immediately.
export function OverallChat({ year, quarter, token, API_BASE, addToast }) {
  const [comments,   setComments]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [posting,    setPosting]    = useState(false);
  const [editorVal,  setEditorVal]  = useState("");
  const [filter,     setFilter]     = useState("all");
  const [visible,    setVisible]    = useState(false); // lazy: only fetch when in view
  const [hasFetched, setHasFetched] = useState(false);
  const bottomRef    = useRef(null);
  const sectionRef   = useRef(null);

  // ── Intersection observer: trigger fetch only when section enters viewport ──
  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

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
      setHasFetched(true);
    } catch (e) { addToast(`Failed to load comments: ${e.message}`, "error"); }
    finally { setLoading(false); }
  }, [year, quarter, token, filter, API_BASE]);

  // Only fetch once section is visible
  useEffect(() => {
    if (visible) fetchComments();
  }, [visible, fetchComments]);

  // Auto-scroll to latest comment (only after user has seen section)
  useEffect(() => {
    if (!loading && hasFetched && comments.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }, [comments, loading, hasFetched]);

  const handlePost = async () => {
    const text = editorVal?.replace(/<[^>]*>/g, "").trim();
    if (!text && !editorVal?.includes("<img")) { addToast("Comment cannot be empty", "error"); return; }
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/comments?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment: editorVal }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setEditorVal("");
      addToast("Comment posted ✓", "success");
      fetchComments();
    } catch (e) { addToast(`Failed to post: ${e.message}`, "error"); }
    finally { setPosting(false); }
  };

  const FILTER_OPTS = [
    { value: "all",        label: "All"        },
    { value: "general",    label: "General"    },
    { value: "transition", label: "Transition" },
    { value: "rejection",  label: "Rejection"  },
  ];

  const typeBadge = (type) => ({
    general:    "bg-sky-50 text-sky-600 border-sky-200",
    transition: "bg-amber-50 text-amber-600 border-amber-200",
    rejection:  "bg-red-50 text-red-600 border-red-200",
  }[type] || "bg-slate-50 text-slate-500 border-slate-200");

  return (
    <div ref={sectionRef} className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-sky-800 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
            <FiMessageSquare size={15}/>
          </div>
          <div>
            <p className="font-semibold text-s leading-tight">Forecast Discussion</p>
            <p className="text-white  text-xs">{year} · {quarter} · {comments.length} comment{comments.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5">
            {FILTER_OPTS.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1 rounded-md text-x font-medium transition-all
                  ${filter === f.value ? "bg-sky-900 text-white shadow-sm" : "text-slate-300 hover:text-white"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={fetchComments}
            className="w-7 h-7 rounded-lg bg-white hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Refresh comments">
            <FiRefreshCw size={13}/>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row" style={{ minHeight: 420, maxHeight: 600 }}>
        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/50 border-r border-slate-200">
          {!visible || (loading && !hasFetched) ? (
            <div className="flex-1 min-h-[220px] grid place-items-center text-slate-500 text-s">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="flex-1 min-h-[220px] grid place-items-center text-slate-400 text-s">
              No comments yet for this period.
            </div>
          ) : (
            <>
              {comments.map((c, i) => {
                const avCls    = avatarClass(c.user_name || c.user_id || "?");
                const initials = getInitials(c.user_name || "U");
                const isRich   = c.comment?.includes("<") && c.comment?.includes(">");
                return (
                  <div key={c.id || i} style={{ animation: "fadeIn 0.3s ease" }} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-x font-bold shrink-0 ${avCls}`}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-900 text-s">{c.user_name || "User"}</span>
                        {c.department && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">{c.department}</span>}
                        {c.comment_type && c.comment_type !== "general" && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${typeBadge(c.comment_type)}`}>{c.comment_type}</span>
                        )}
                        {c.created_at && <span className="text-xs text-slate-400 tabular-nums ml-auto">{new Date(c.created_at).toLocaleString()}</span>}
                      </div>
                      <div className={`text-s text-slate-800 leading-relaxed bg-white rounded-xl px-3 py-2.5 border border-slate-200
                        ${isRich ? "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1 [&_img]:max-h-48 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-bold [&_em]:italic" : ""}`}
                        {...(isRich ? { dangerouslySetInnerHTML: { __html: c.comment } } : { children: c.comment })}
                      />
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </>
          )}
        </div>

        {/* Compose */}
        <div className="w-full lg:w-[360px] p-4 flex flex-col gap-3 bg-white shrink-0">
          <div>
            <h3 className="font-semibold text-slate-800 text-s mb-0.5">Add to Discussion</h3>
            <p className="text-x text-slate-400">Supports <strong>bold</strong>, <em>italic</em>, lists &amp; images</p>
          </div>
          <RichTextEditor value={editorVal} onChange={setEditorVal}
            placeholder="Share observations, flag changes, or add context…" disabled={posting}/>
          <button onClick={handlePost} disabled={posting}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold transition-all disabled:opacity-50">
            {posting
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Posting…</>
              : <><FiSend size={13}/> Post Comment</>}
          </button>
          <p className="text-xs text-slate-400 text-center">{year} {quarter} · Visible to all team members</p>
        </div>
      </div>
    </div>
  );
}

