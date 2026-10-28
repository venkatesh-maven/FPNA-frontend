import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// Decelerates into place (no spring bounce) on the way in; accelerates away on the way out.
const EASE_OUT = [0.22, 1, 0.36, 1];
const EASE_IN = [0.4, 0, 1, 1];

/**
 * Shared shell for the report drilldown drawers. The backdrop fades in while
 * the panel glides a short way in from the right and fades up, and both
 * animate out on close instead of vanishing. Keep the drawer mounted and
 * toggle `open` — returning null when closed would skip the close animation.
 */
export default function DrilldownDrawer({ open, onClose, className = "w-[1200px] max-w-[72vw]", children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drilldown-backdrop"
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
          exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }}
        />
      )}
      {open && (
        <motion.div
          key="drilldown-panel"
          role="dialog"
          aria-modal="true"
          className={`fixed right-0 top-0 h-full bg-sky-50 z-50 shadow-2xl flex flex-col ${className}`}
          initial={{ opacity: 0, x: 72 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } }}
          exit={{ opacity: 0, x: 72, transition: { duration: 0.25, ease: EASE_IN } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Stand-in for the header's summary figures while loading, so the header keeps its height. */
export function DrilldownSummarySkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-4 gap-6 mt-6" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2 py-1">
          <div className="h-4 w-28 rounded bg-white/20 animate-pulse" />
          <div className="h-6 w-36 rounded bg-white/25 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Stand-in for the drawer body while loading. */
export function DrilldownBodySkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="h-40 rounded-2xl bg-white shadow-sm animate-pulse" />
      <div className="h-72 rounded-2xl bg-white shadow-sm animate-pulse" />
    </div>
  );
}

/** Fades loaded content (or a newly picked tab) in rather than popping it in. */
export function DrilldownFadeIn({ className, children }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
