import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BsStars, BsChatLeftText } from "react-icons/bs";
import { FiChevronDown, FiHelpCircle } from "react-icons/fi";
import AskAI from "./AskAI";
import ReportAIInsights from "./ReportAIInsights";

const TRIGGER_STYLES = {
  // Matches toolbars whose buttons are bg-sky-100 (P&L, Cash Flow)…
  soft: { idle: "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200", open: "bg-sky-200 text-sky-900 border-sky-300" },
  // …or bg-white with a sky-300 border (most other reports).
  outline: { idle: "bg-white text-sky-800 border-sky-300 hover:bg-sky-100", open: "bg-sky-100 text-sky-900 border-sky-400" },
};

/**
 * The single "Report AI" toolbar entry for a report page. Each option says
 * what it does, so users aren't left guessing between look-alike AI buttons.
 *
 * `insights` = the props for the report's AI Insights drawer
 * ({ commentary, reportLabel, filterLabels, viewKey, buildContext, disabled },
 * see ReportAIInsights); without it the menu only offers Ask AI.
 * `showTableHelp` adds a legend for the AI icons inside the table — only for
 * reports that have them (P&L).
 * `ask` = Ask AI's own config for a report with no fixed endpoint (see AskAI).
 */
const AIActionsMenu = ({ reportId, insights, ask, showTableHelp = false, variant = "soft" }) => {
  const insightsDisabled = !!insights?.disabled;
  const trigger = TRIGGER_STYLES[variant] || TRIGGER_STYLES.soft;
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null); // "insights" | "ask" | null
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const closeOnEscape = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const openPanel = (name) => {
    setMenuOpen(false);
    setPanel(name);
  };
  const panelChange = (name) => (next) => setPanel(next ? name : null);

  const itemIconClass = "mt-0.5 shrink-0 text-sky-700";
  const items = [
    insights && {
      id: "insights",
      icon: <BsStars size={16} className={itemIconClass} />,
      title: "Report insights",
      description: insightsDisabled
        ? "Load report data to generate insights"
        : "Key trends, risks and variances in the data on screen",
      disabled: insightsDisabled,
    },
    {
      id: "ask",
      icon: <FiHelpCircle size={16} className={itemIconClass} />,
      title: "Ask about this report",
      description: "Pick from common questions about this report",
    },
  ].filter(Boolean);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`flex items-center gap-2 px-3 py-2 text-x font-medium rounded-lg border transition ${
            menuOpen ? trigger.open : trigger.idle
          }`}
        >
          <BsStars size={14} /> Report AI
          <FiChevronDown size={14} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-72 z-50 bg-sky-50 border border-sky-200 rounded-xl shadow-xl p-2"
            >
              {items.map(({ id, icon, title, description, disabled }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => openPanel(id)}
                  className="w-full flex items-start gap-3 p-2 rounded-lg text-left hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  {icon}
                  <span>
                    <span className="block text-x font-semibold text-sky-900">{title}</span>
                    <span className="block text-xs text-sky-600">{description}</span>
                  </span>
                </button>
              ))}

              {showTableHelp && (
                <div className="mt-2 pt-2 px-2 pb-1 border-t border-sky-200">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500 mb-1">
                    In the table
                  </p>
                  <ul className="space-y-1 text-xs text-sky-700">
                    <li className="flex items-center gap-2">
                      <BsStars size={12} className="shrink-0 text-sky-500" />
                      Click this icon next to a value to have AI explain it
                    </li>
                    <li className="flex items-center gap-2">
                      <BsChatLeftText size={12} className="shrink-0 text-sky-500" />
                      Click this icon next to a row to write AI commentary
                    </li>
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {insights && (
        <ReportAIInsights
          {...insights}
          hideTrigger
          open={panel === "insights"}
          onOpenChange={panelChange("insights")}
        />
      )}
      <AskAI reportId={reportId} config={ask} hideTrigger open={panel === "ask"} onOpenChange={panelChange("ask")} />
    </>
  );
};

export default AIActionsMenu;
