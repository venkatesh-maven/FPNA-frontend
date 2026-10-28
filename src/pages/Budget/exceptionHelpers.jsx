// exceptionHelpers.jsx — shared UI building blocks for the Budget Guideline
// & Exception Engine (backend: src/budget/guideline_engine.py +
// exceptions_controller.py under /api/v1/budget/exceptions). Used by
// WorkforcePlanning/RevenueBudgeting/OpexBudgeting/CapexBudgeting/
// BudgetOverview/BudgetReviewApproval so every module surfaces guideline
// exceptions the same way instead of each page inventing its own status
// pill/drawer — same "one shared toolkit" convention as budgetHelpers.jsx.
import React, { useState, useEffect, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiAlertTriangle, FiCheckCircle, FiXCircle, FiClock, FiInfo } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { fmt, fmtPct } from "./budgetHelpers";

const EXCEPTIONS_API = `${API_BASE_URL}/api/v1/budget/exceptions`;

/* ============================================================
   Justification reason lists (spec §7) — Workforce gets the exact
   named list; other modules reuse a general business-reason set
   since the spec only asks for "relevant business reasons" there.
============================================================ */
export const WORKFORCE_EXCEPTION_REASONS = [
  "Market Rate Adjustment", "Employee Retention", "Promotion", "Performance-Based Adjustment",
  "Critical Skill", "Internal Equity", "Role Change", "Business-Critical Employee",
  "Executive Guidance", "Other",
];
export const GENERAL_EXCEPTION_REASONS = [
  "Contract Commitment", "Business-Critical Vendor", "Business-Critical Project",
  "Regulatory Requirement", "Vendor Lock-in", "Executive Guidance", "Other",
];

/* ============================================================
   Status pill config — Normal renders nothing (§15).
============================================================ */
const SEVERITY_CONFIG = {
  warning:   { label: "Guideline Warning",          cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  exception: { label: "Guideline Exception",         cls: "bg-red-50 text-red-700 ring-red-200" },
  high:      { label: "High-Severity Exception",     cls: "bg-red-100 text-red-800 ring-red-300" },
};
const APPROVAL_CONFIG = {
  approved: { label: "Approved Exception", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected: { label: "Rejected Exception",  cls: "bg-slate-200 text-slate-600 ring-slate-300" },
};

export function ExceptionBadge({ exception, onClick, className = "" }) {
  if (!exception) return null;
  const cfg = (exception.approval_status && APPROVAL_CONFIG[exception.approval_status])
    || SEVERITY_CONFIG[exception.severity] || SEVERITY_CONFIG.exception;
  return (
    <button type="button" onClick={onClick} title="Guideline exception — click for details"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 whitespace-nowrap hover:opacity-80 transition-opacity ${cfg.cls} ${className}`}>
      <FiAlertTriangle size={9} className="shrink-0" /> {cfg.label}
    </button>
  );
}

/* ============================================================
   useExceptions — fetch hook wrapping GET /budget/exceptions/{year}
   and its /summary sibling. Used for module-level "show only
   exceptions" filters and for the roll-up summary strips (§16).
============================================================ */
export function useExceptions(budgetYear, module) {
  const { token } = useContext(AuthContext);
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!budgetYear || !token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, accept: "application/json" };
      const q = module ? `?module=${module}` : "";
      const [listRes, summaryRes] = await Promise.all([
        fetch(`${EXCEPTIONS_API}/${budgetYear}${q}`, { headers }),
        fetch(`${EXCEPTIONS_API}/${budgetYear}/summary`, { headers }),
      ]);
      if (listRes.ok) setList((await listRes.json()).items || []);
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      // Non-critical — module pages already surface their own load errors;
      // an exception-summary fetch failure just means the strip stays empty.
    } finally {
      setLoading(false);
    }
  }, [budgetYear, module, token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { list, summary: module && summary ? summary[module] : summary, loading, refetch };
}

/* ============================================================
   ExceptionSummaryStrip — spec §16's exact shape: Total / Within
   Guideline / Exceptions / Pending / Approved / Rejected.

   Every cell is a filter trigger: clicking one calls onFilterChange with
   its key ("all" | "within" | "exception" | "pending" | "approved" |
   "rejected") so the caller can narrow its table to just that slice, and
   the active cell gets a highlighted ring. `onShowExceptions` is kept as a
   legacy fallback for callers (Workforce/Opex/Capex) that only wired up
   the single "show exceptions" checkbox and haven't adopted the full
   per-cell filter yet — clicking "Exceptions" there still works as before.
============================================================ */
export function ExceptionSummaryStrip({ totalEvaluated, summary, activeFilter = "all", onFilterChange, onShowExceptions }) {
  if (!summary) return null;
  const withinGuideline = Math.max(0, (totalEvaluated || 0) - (summary.exceptions || 0));
  const cells = [
    { key: "all", label: "Total Evaluated", value: totalEvaluated ?? "—", cls: "text-slate-700" },
    { key: "within", label: "Within Guideline", value: withinGuideline, cls: "text-emerald-600" },
    { key: "exception", label: "Exceptions", value: summary.exceptions || 0, cls: "text-red-600" },
    { key: "pending", label: "Pending Review", value: summary.pending_review || 0, cls: "text-amber-600" },
    { key: "approved", label: "Approved", value: summary.approved || 0, cls: "text-emerald-600" },
    { key: "rejected", label: "Rejected", value: summary.rejected || 0, cls: "text-slate-500" },
  ];
  return (
    <div style={{ colorScheme: "light" }}
      className="flex items-stretch gap-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-x divide-slate-100">
      {cells.map((c) => {
        const onClick = onFilterChange
          ? () => onFilterChange(c.key)
          : (c.key === "exception" ? onShowExceptions : undefined);
        const clickable = Boolean(onClick);
        const active = onFilterChange && activeFilter === c.key;
        return (
          // Plain <div role="button">, not a native <button> — Chrome/Edge's
          // "auto dark mode for web content" specifically reskins native form
          // controls it judges "unstyled" (near-white, no strong authored
          // color) with a synthesized dark palette, sampled from whatever
          // accent color the element references (which is why this flipped
          // between navy and red as the hover/ring class changed, even
          // though nothing was actually hovered). Plain elements aren't
          // subject to that reskin, so this keeps the real Tailwind colors
          // on screen. Keyboard activation (Enter/Space) is wired manually
          // to keep it accessible without the native element.
          <div key={c.key} role={clickable ? "button" : undefined} aria-disabled={!clickable}
            tabIndex={clickable ? 0 : undefined} onClick={clickable ? onClick : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
            style={{ colorScheme: "light" }}
            className={`flex-1 min-w-[110px] px-3 py-1.5 text-left bg-white outline-none transition-colors ${clickable ? "hover:bg-red-50/60 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-300" : "cursor-default"} ${active ? "bg-red-50 ring-1 ring-inset ring-red-300" : ""}`}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{c.label}</div>
            <div className={`text-sm font-bold tabular-nums ${c.cls}`}>{c.value}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   ExceptionDrawer — slide-in detail panel (cloned from the
   FinancialReports PnLDrilldownDrawer.jsx pattern). Shows the
   guideline/system/user/variance breakdown, a justification form,
   and — once justified — Approve/Reject actions. The backend is
   authoritative on who may review (DEPT_REVIEWERS/APPROVERS); this
   just always offers the buttons and surfaces a 403 as a toast-style
   inline error if the signed-in user isn't one.
============================================================ */
export function ExceptionDrawer({
  open, onClose, exception, entityLabel, systemValue, userValue,
  guidelineLabel, guidelineValue, reasonOptions = GENERAL_EXCEPTION_REASONS, onChanged,
}) {
  const { token } = useContext(AuthContext);
  const [reason, setReason] = useState(reasonOptions[0]);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) {
      setReason(exception?.justification_reason || reasonOptions[0]);
      setNote(exception?.justification_note || "");
      setComment("");
      setErr(null);
    }
  }, [open, exception]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const headers = { Authorization: `Bearer ${token}`, accept: "application/json", "Content-Type": "application/json" };
  const persisted = Boolean(exception?.id);

  const submitJustification = async () => {
    if (!persisted) return;
    if (reason.trim().toLowerCase() === "other" && !note.trim()) {
      setErr("Please provide a detailed explanation when selecting 'Other'.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${EXCEPTIONS_API}/${exception.id}/justify`, {
        method: "PATCH", headers, body: JSON.stringify({ reason, note }),
      });
      if (!res.ok) throw new Error((await res.json())?.detail || "Failed to save justification.");
      await onChanged?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (decision) => {
    if (!persisted) return;
    if (decision === "rejected" && !comment.trim()) {
      setErr("A comment is required when rejecting an exception.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${EXCEPTIONS_API}/${exception.id}/review`, {
        method: "PATCH", headers, body: JSON.stringify({ decision, comment }),
      });
      if (!res.ok) throw new Error((await res.json())?.detail || "Failed to submit review.");
      await onChanged?.();
      onClose?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sevCfg = SEVERITY_CONFIG[exception?.severity] || SEVERITY_CONFIG.exception;
  const isTerminal = exception?.approval_status === "approved" || exception?.approval_status === "rejected";

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.22 }}
        className="fixed right-0 top-0 h-full w-[520px] max-w-[92vw] bg-white z-[9999] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-sky-900 text-white shrink-0">
          <div>
            <div className="text-xs uppercase tracking-wide text-sky-300 font-semibold">Guideline Exception</div>
            <div className="text-s font-bold truncate max-w-[360px]">{entityLabel}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"><FiX size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <span className={`self-start px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${sevCfg.cls}`}>{sevCfg.label}</span>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-400 uppercase">Guideline</div>
              <div className="text-s font-bold text-slate-900">{guidelineLabel}</div>
              <div className="text-x text-slate-500 tabular-nums">{guidelineValue}</div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-400 uppercase">Variance</div>
              <div className="text-s font-bold text-red-600 tabular-nums">
                {exception?.variance_amount != null ? fmt(exception.variance_amount) : "—"}
              </div>
              <div className="text-x text-slate-500 tabular-nums">
                {exception?.variance_pct != null ? fmtPct(exception.variance_pct, { sign: true }) : "—"}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-400 uppercase">AI / System Value</div>
              <div className="text-s font-bold text-slate-700 tabular-nums">{fmt(systemValue)}</div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-400 uppercase">User Adjusted Value</div>
              <div className="text-s font-bold text-sky-700 tabular-nums">{fmt(userValue)}</div>
            </div>
          </div>

          {!persisted && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-x">
              <FiInfo size={13} className="shrink-0 mt-0.5" />
              This value hasn't been saved since the Guideline Exception Engine was enabled. Save this
              adjustment again (even re-entering the same value) to open a reviewable exception record.
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-x">
              <FiXCircle size={13} className="shrink-0 mt-0.5" /> {err}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-x font-semibold text-slate-600">Business Justification {isTerminal ? "" : "*"}</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={!persisted || isTerminal}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400">
              {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!persisted || isTerminal}
              placeholder="Add context for the reviewer…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400" />
            {!isTerminal && (
              <button onClick={submitJustification} disabled={!persisted || saving}
                className="self-end px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-x font-semibold disabled:opacity-50">
                {saving ? "Saving…" : exception?.justification_reason ? "Update Justification" : "Save Justification"}
              </button>
            )}
          </div>

          {exception?.approval_status && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-x text-slate-600">
              <FiClock size={12} className="shrink-0" />
              Approval status: <strong className="text-slate-800 capitalize">{exception.approval_status}</strong>
              {exception.rejection_reason && <span> — {exception.rejection_reason}</span>}
            </div>
          )}

          {persisted && exception?.justification_reason && !isTerminal && (
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
              <label className="text-x font-semibold text-slate-600">Finance Review</label>
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Comment (required if rejecting)…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => submitReview("rejected")} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-x font-semibold disabled:opacity-50">
                  <FiXCircle size={13} /> Reject
                </button>
                <button onClick={() => submitReview("approved")} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-x font-semibold disabled:opacity-50">
                  <FiCheckCircle size={13} /> Approve
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
