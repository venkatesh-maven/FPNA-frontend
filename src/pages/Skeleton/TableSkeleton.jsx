// TableSkeleton.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BsStars } from "react-icons/bs";

// Progress lines shown while a report loads, so the wait reads as work being
// done. They advance in order and stop on the last one; pages can pass their
// own via `messages`.
const DEFAULT_MESSAGES = [
  "Fetching ledger entries…",
  "Totalling monthly figures…",
  "Comparing against budget…",
  "Calculating margins and variances…",
  "Building your report…",
  "Almost there…",
];
const STEP_MS = 1800;
// Show an elapsed-seconds counter once loading takes longer than this.
const SHOW_ELAPSED_AFTER_S = 5;

function LoadingStatus({ messages }) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const ms = Date.now() - started;
      setStep(Math.min(Math.floor(ms / STEP_MS), messages.length - 1));
      setElapsed(Math.floor(ms / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 border-b border-sky-100 bg-white text-x text-sky-800"
    >
      <motion.span
        animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="text-sky-500"
      >
        <BsStars size={14} />
      </motion.span>
      {/* In normal flow and never faded fully out, so a message is always on screen. */}
      <motion.span
        key={step}
        initial={{ opacity: 0.5, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="min-w-0 truncate font-medium leading-5"
      >
        {messages[step]}
      </motion.span>
      {elapsed >= SHOW_ELAPSED_AFTER_S && (
        <span className="shrink-0 text-sky-500 leading-5">· {elapsed}s</span>
      )}
    </div>
  );
}

export default function TableSkeleton({
  columns = 5,
  rows = 5,
  showHeader = true,
  showStatus = true,
  messages = DEFAULT_MESSAGES,
}) {
  return (
    <div className="relative overflow-hidden border border-sky-200 rounded-xl bg-white shadow-sm">
      {showStatus && messages?.length > 0 && <LoadingStatus messages={messages} />}

      {/* HEADER */}
      {showHeader && (
        <div className="sticky top-0 z-10 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-sky-200">
          <div className="flex">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 px-4 py-3 border-r border-sky-200 last:border-r-0"
              >
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: colIndex * 0.1,
                  }}
                  className="h-4 w-3/4 rounded-md bg-gradient-to-r from-sky-300 to-blue-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROWS */}
      <div className="divide-y divide-sky-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center hover:bg-sky-50/40 transition-colors"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 px-4 py-3 border-r border-sky-100 last:border-r-0"
              >
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    width: ["40%", "80%", "40%"],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: rowIndex * 0.1 + colIndex * 0.05,
                  }}
                  className="h-3 rounded-full bg-gradient-to-r from-sky-400 to-blue-400"
                />
              </div>
            ))}
          </div>
        ))}
      </div> 

      {/* SHIMMER OVERLAY */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-200/30 to-transparent pointer-events-none"
      />
    </div>
  );
}
