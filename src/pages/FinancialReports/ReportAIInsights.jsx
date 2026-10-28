import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BsStars } from "react-icons/bs";
import { FiX, FiCopy, FiCheck, FiPlus, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-toastify";
import { fevicon } from "../../assets/Assets";
import { CATEGORY_STYLES } from "./insightCategories";

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
};

/**
 * "AI Insights" drawer for a financial report: generates insights from the
 * data currently on screen (with the applied filters), lets the user copy them
 * or add selected ones to the report as commentary (`commentary` is
 * hooks/useReportCommentary). Styled to match the report Ask AI drawer
 * (./AskAI.jsx).
 *
 * Renders its own toolbar button by default. Pass `open` / `onOpenChange` /
 * `hideTrigger` to open it from elsewhere (the "Report AI" menu) — it stays
 * mounted either way, so generated insights survive closing it.
 */
export default function ReportAIInsights({
  commentary,
  reportLabel,
  filterLabels,
  viewKey,
  buildContext,
  disabled,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp ?? internalOpen;
  const setIsOpen = (next) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [insights, setInsights] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [addedIds, setAddedIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const listTopRef = useRef(null);

  // Insights are specific to what's on screen — drop them when the view changes.
  useEffect(() => {
    setInsights([]);
    setSelected(new Set());
    setAddedIds(new Set());
    setError("");
  }, [viewKey]);

  const generate = async () => {
    const context = buildContext();
    if (!context) {
      setError("There is no report data on screen to analyze.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const result = await commentary.generateInsights({ reportLabel, filterLabels, context });
      setInsights(result);
      setSelected(new Set());
      setAddedIds(new Set());
      listTopRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Generate on open (however it was opened) if there's nothing to show yet.
  useEffect(() => {
    if (isOpen && !insights.length && !generating && !disabled) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the drawer opening
  }, [isOpen]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleCopy = async (insight) => {
    await copyText(`${insight.title}\n${insight.text}`);
    setCopiedId(insight.id);
    setTimeout(() => setCopiedId((id) => (id === insight.id ? null : id)), 1500);
  };

  const addToReport = async (toAdd) => {
    if (!toAdd.length) return;
    setAdding(true);
    try {
      await commentary.addItems(
        toAdd.map((i) => ({ title: i.title, text: i.text, category: i.category, source: "ai" }))
      );
      setAddedIds((prev) => new Set([...prev, ...toAdd.map((i) => i.id)]));
      setSelected(new Set());
      toast.success(
        toAdd.length === 1 ? "Insight added to report commentary" : `${toAdd.length} insights added to report commentary`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const selectedInsights = insights.filter((i) => selected.has(i.id) && !addedIds.has(i.id));

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          title={disabled ? "Load report data to generate insights" : "Generate AI insights for this report"}
          className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BsStars className="mr-1" /> AI Insights
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Drawer */}
            <motion.div
              className="fixed top-0 right-0 z-50 h-full w-[380px] bg-white shadow-2xl flex flex-col border-l border-sky-200"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="p-4 bg-sky-50 border-b border-sky-200 flex items-start justify-between">
                <div className="flex gap-3 items-center">
                  <img src={fevicon} width="40px" alt="logo" />
                  <div>
                    <h2 className="text-s font-semibold text-sky-900">FPnAInSightAI</h2>
                    <p className="text-x text-sky-600">
                      AI Insights — what you should know from this report
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-sky-100 text-sky-600"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Insights */}
              <div className="flex-1 overflow-y-auto p-4 bg-sky-50 space-y-3">
                <div ref={listTopRef} className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-3 py-2 text-x bg-white border border-sky-200 text-sky-900 rounded-bl-none shadow-sm">
                    Here are the key insights from the current {reportLabel}
                    {filterLabels.length ? ` (${filterLabels.join(", ")})` : ""}. Copy them, or add the
                    ones you want to the report as commentary.
                  </div>
                </div>

                {generating && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-sky-200 rounded-lg rounded-bl-none px-3 py-2 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}

                {!generating && error && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg px-3 py-2 text-x bg-white border border-red-200 text-red-700 rounded-bl-none shadow-sm">
                      {error}
                    </div>
                  </div>
                )}

                {!generating &&
                  insights.map((insight) => {
                    const cat = CATEGORY_STYLES[insight.category] || CATEGORY_STYLES.trend;
                    const added = addedIds.has(insight.id);
                    const isSelected = selected.has(insight.id) || added;
                    return (
                      <div
                        key={insight.id}
                        className={`rounded-lg rounded-bl-none px-3 py-2 text-x text-sky-900 shadow-sm border ${
                          isSelected ? "bg-sky-100 border-sky-400" : "bg-white border-sky-200"
                        }`}
                      >
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-sky-600"
                            checked={isSelected}
                            disabled={added}
                            onChange={() => toggle(insight.id)}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold">{insight.title}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cat.className}`}>
                                {cat.label}
                              </span>
                            </span>
                            <span className="block mt-1 whitespace-pre-line leading-relaxed">{insight.text}</span>
                          </span>
                        </label>
                        <div className="mt-2 pt-2 border-t border-sky-100 flex items-center gap-3 text-sky-600">
                          <button
                            onClick={() => handleCopy(insight)}
                            className="flex items-center gap-1 hover:text-sky-900"
                          >
                            {copiedId === insight.id ? <FiCheck /> : <FiCopy />}
                            {copiedId === insight.id ? "Copied" : "Copy"}
                          </button>
                          {added ? (
                            <span className="flex items-center gap-1 text-emerald-700">
                              <FiCheck /> Added to report
                            </span>
                          ) : (
                            <button
                              onClick={() => addToReport([insight])}
                              disabled={adding}
                              className="flex items-center gap-1 hover:text-sky-900 disabled:opacity-50"
                            >
                              <FiPlus /> Add to report
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Actions Panel */}
              <div className="p-4 border-t border-sky-200 bg-white">
                <p className="text-x font-semibold text-sky-900 mb-2 flex items-center gap-1">
                  <BsStars className="text-sky-600" />
                  {reportLabel}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => addToReport(selectedInsights)}
                    disabled={!selectedInsights.length || adding}
                    className="flex items-center justify-center gap-1 px-3 py-2 text-x text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <FiPlus /> Add selected to report
                    {selectedInsights.length ? ` (${selectedInsights.length})` : ""}
                  </button>
                  <button
                    onClick={generate}
                    disabled={generating || disabled}
                    className="flex items-center justify-center gap-1 px-3 py-2 text-x text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50 transition-colors"
                  >
                    <FiRefreshCw className={generating ? "animate-spin" : ""} />
                    {insights.length ? "Regenerate insights" : "Generate insights"}
                  </button>
                </div>
                <p className="text-x text-sky-400 mt-3">
                  FPnAInsights may produce inaccurate information. Always verify critical insights.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
