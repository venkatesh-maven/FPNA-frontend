import React from "react";
import { FiX } from "react-icons/fi";

export default function AppChip({ label, onRemove, className = "" }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-sm text-white backdrop-blur",
        className,
      ].join(" ")}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/30 hover:bg-white/40"
          title="Remove"
          data-pdf-hide
        >
          <FiX size={10} className="text-white" />
        </button>
      ) : null}
    </span>
  );
}
