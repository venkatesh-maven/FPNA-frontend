import React from "react";

/**
 * Name label for an icon-only toolbar button, shown under the button on hover
 * or keyboard focus. The button needs `relative group`; give it an aria-label
 * too, since this label is decorative.
 */
export default function ActionHoverLabel({ children }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 whitespace-nowrap rounded-md bg-sky-900 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}
