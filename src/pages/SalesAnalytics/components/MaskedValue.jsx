import React from "react";
import { FiLock } from "react-icons/fi";

/** Shown in place of a value the viewer's role may not see. */
export default function MaskedValue({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 text-slate-400 ${className}`} title="Restricted for your role">
      <FiLock size={11} aria-hidden="true" />
      <span>Restricted</span>
    </span>
  );
}
