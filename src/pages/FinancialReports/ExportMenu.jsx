import React, { useEffect, useRef, useState } from "react";
import { FiDownload, FiFileText } from "react-icons/fi";
import { BsChatLeftText } from "react-icons/bs";
import ActionHoverLabel from "./ActionHoverLabel";

/**
 * Icon-only download button for a report toolbar that asks whether to include
 * the commentary shown under the report. `className` styles the button (it
 * needs `relative group` for the hover label); `onExport(includeCommentary)`
 * does the download.
 */
export default function ExportMenu({
  label,
  format = "csv",
  onExport,
  commentaryCount = 0,
  className = "",
  busy = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const closeOnEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (includeCommentary) => {
    setOpen(false);
    onExport(includeCommentary);
  };

  const where = format === "excel" ? "on a separate Commentary sheet" : "below the report data";
  const itemClass =
    "w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy || disabled}
        aria-label={`Download ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={className}
      >
        <FiDownload />
        {!open && <ActionHoverLabel>{busy ? "Downloading…" : label}</ActionHoverLabel>}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 z-50 bg-white border border-sky-200 rounded-xl shadow-xl p-1.5">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-500">Download {label}</p>
          <button type="button" role="menuitem" disabled={!commentaryCount} onClick={() => choose(true)} className={itemClass}>
            <BsChatLeftText className="mt-0.5 shrink-0 text-sky-700" />
            <span>
              <span className="block text-x font-semibold text-sky-900">With commentary</span>
              <span className="block text-xs text-sky-600">
                {commentaryCount
                  ? `Adds the ${commentaryCount} saved commentary ${commentaryCount === 1 ? "item" : "items"} ${where}`
                  : "No commentary saved for this view"}
              </span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose(false)} className={itemClass}>
            <FiFileText className="mt-0.5 shrink-0 text-sky-700" />
            <span>
              <span className="block text-x font-semibold text-sky-900">Without commentary</span>
              <span className="block text-xs text-sky-600">Report data only</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
