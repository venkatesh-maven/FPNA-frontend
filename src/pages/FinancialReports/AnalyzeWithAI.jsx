import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BsStars } from "react-icons/bs";
import { FiX, FiSend, FiCopy, FiCheck, FiPlus, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-toastify";
import { fevicon } from "../../assets/Assets";
import useAnalyzeWithAI from "../../hooks/useAnalyzeWithAI";
import { aiHelpTooltipProps } from "./aiHelpTooltipProps";

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

const DIRECTION_STYLES = {
  favorable: "bg-green-100 text-green-800",
  unfavorable: "bg-red-100 text-red-800",
  neutral: "bg-slate-100 text-slate-700",
};

const analysisAsText = (a) =>
  [
    a.headline,
    a.summary,
    ...a.drivers.map((d) => `- ${d.name}${d.impact ? ` (${d.impact})` : ""}: ${d.explanation}`),
  ]
    .filter(Boolean)
    .join("\n");

const formatCell = (value, type, currencySymbol) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (type === "money" && Number.isFinite(n)) {
    return `${n < 0 ? "-" : ""}${currencySymbol}${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (type === "pct" && Number.isFinite(n)) return `${n.toFixed(1)}%`;
  return String(value);
};

/**
 * ✦ "Analyze with AI" trigger for a chart, KPI or table value. Pass `tooltip`
 * ({ heading, context, body }) to use the rich AIHelpTooltip instead of the
 * plain browser title — the page must mount <AIHelpTooltip /> for it.
 */
export function AnalyzeButton({ onClick, className = "", title = "Explain this number with AI", tooltip }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={tooltip ? undefined : title}
      aria-label={title}
      {...(tooltip ? aiHelpTooltipProps(tooltip) : {})}
      className={`inline-flex items-center justify-center p-1 rounded-md text-sky-500 hover:text-sky-800 hover:bg-sky-100 align-middle ${className}`}
    >
      <BsStars size={12} />
    </button>
  );
}

/**
 * "Analyze with AI" drawer: root-cause analysis of the clicked value using
 * the context already on screen, follow-up questions to drill further, and
 * the supporting data the analysis was based on.
 *
 * `loadContext(target)` returns { context: string, supporting: [{ title,
 * columns: [{ key, label, type }], rows }] } — the page decides what data
 * backs each value.
 */
export default function AnalyzeWithAI({
  target,
  onClose,
  token,
  reportId,
  reportLabel,
  year,
  currency,
  currencySymbol = "$",
  filterLabels,
  loadContext,
  onAddToReport,
}) {
  const api = useAnalyzeWithAI({ token, reportId, reportLabel, year, currency });
  const [tab, setTab] = useState("analysis");
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [supporting, setSupporting] = useState([]);
  const [chat, setChat] = useState([]); // [{ role, content }] after the analysis
  const [asking, setAsking] = useState(false);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const contextRef = useRef("");
  const rawRef = useRef("");
  const runId = useRef(0);
  const bottomRef = useRef(null);

  const apiTarget = target && {
    title: target.title,
    component: target.component || "table",
    metric: target.metric || null,
    period: target.period || null,
    value: target.value != null ? String(target.value) : null,
  };

  const run = async () => {
    const id = ++runId.current;
    setStatus("loading");
    setError("");
    setAnalysis(null);
    setChat([]);
    setAdded(false);
    try {
      const { context, supporting: support } = await loadContext(target);
      if (id !== runId.current) return;
      setSupporting(support || []);
      contextRef.current = context;
      const result = await api.analyze({ target: apiTarget, filterLabels, context });
      if (id !== runId.current) return;
      rawRef.current = result.raw;
      setAnalysis(result);
      setStatus("ready");
    } catch (err) {
      if (id !== runId.current) return;
      setError(err.message || "Could not load the data for this analysis.");
      setStatus("error");
    }
  };

  useEffect(() => {
    runId.current++;
    setTab("analysis");
    setInput("");
    setSupporting([]);
    if (target) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    if (tab === "analysis") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, asking, tab]);

  const ask = async (question) => {
    const q = (question ?? input).trim();
    if (!q || asking || status !== "ready") return;
    const id = runId.current;
    setInput("");
    setChat((prev) => [...prev, { role: "user", content: q }]);
    setAsking(true);
    try {
      const answer = await api.ask({
        target: apiTarget,
        filterLabels,
        context: contextRef.current,
        history: [{ role: "assistant", content: rawRef.current }, ...chat],
        question: q,
      });
      if (id === runId.current) setChat((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (err) {
      if (id === runId.current) {
        setChat((prev) => prev.slice(0, -1));
        setInput(q);
        toast.error(err.message);
      }
    } finally {
      if (id === runId.current) setAsking(false);
    }
  };

  const handleCopy = async () => {
    await copyText(analysisAsText(analysis));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAdd = async () => {
    try {
      await onAddToReport({
        title: analysis.headline || target.title,
        text: [
          analysis.summary,
          ...analysis.drivers.map((d) => `${d.name}${d.impact ? ` (${d.impact})` : ""}: ${d.explanation}`),
        ].join(" "),
      });
      setAdded(true);
      toast.success("Analysis added to report commentary");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed top-0 right-0 z-50 h-full w-[460px] max-w-full bg-white shadow-2xl flex flex-col border-l border-sky-200"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="p-4 bg-sky-50 border-b border-sky-200">
              <div className="flex items-start justify-between">
                <div className="flex gap-3 items-center">
                  <img src={fevicon} width="40px" alt="logo" />
                  <div>
                    <h2 className="text-s font-semibold text-sky-900">Analyze with AI</h2>
                    <p className="text-x text-sky-600">{target.title}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-sky-100 text-sky-600">
                  <FiX size={18} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {[reportLabel, ...(filterLabels.length ? filterLabels : ["All data"])].map((label) => (
                  <span key={label} className="px-2 py-0.5 rounded-full text-[10px] bg-white border border-sky-200 text-sky-700">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-1">
                {[
                  ["analysis", "Analysis"],
                  ["data", `Supporting data${supporting.length ? ` (${supporting.length})` : ""}`],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`px-3 py-1 text-x rounded-lg ${
                      tab === id ? "bg-sky-900 text-white" : "bg-white text-sky-800 border border-sky-200 hover:bg-sky-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-sky-50 space-y-3">
              {tab === "analysis" && (
                <>
                  {status === "loading" && (
                    <div className="bg-white border border-sky-200 rounded-lg px-3 py-2 shadow-sm text-x text-sky-700 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                      </span>
                      Investigating the underlying data…
                    </div>
                  )}

                  {status === "error" && (
                    <div className="rounded-lg px-3 py-2 text-x bg-white border border-red-200 text-red-700 shadow-sm">
                      {error}
                    </div>
                  )}

                  {analysis && (
                    <div className="bg-white border border-sky-300 rounded-lg px-3 py-3 shadow-sm text-x text-sky-900 space-y-2">
                      {analysis.headline && <h3 className="font-semibold text-s">{analysis.headline}</h3>}
                      <p className="leading-relaxed">{analysis.summary}</p>
                      {analysis.drivers.length > 0 && (
                        <div className="pt-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500 mb-1">
                            Root causes &amp; drivers
                          </p>
                          <ul className="space-y-2">
                            {analysis.drivers.map((d, i) => (
                              <li key={i} className="border-l-4 border-sky-200 pl-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold">{d.name}</span>
                                  {d.impact && (
                                    <span
                                      className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                        DIRECTION_STYLES[d.direction] || DIRECTION_STYLES.neutral
                                      }`}
                                    >
                                      {d.impact}
                                    </span>
                                  )}
                                </div>
                                {d.explanation && <p className="mt-0.5 text-slate-700 leading-relaxed">{d.explanation}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="pt-2 border-t border-sky-100 flex items-center gap-3 text-sky-600">
                        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-sky-900">
                          {copied ? <FiCheck /> : <FiCopy />} {copied ? "Copied" : "Copy"}
                        </button>
                        {onAddToReport &&
                          (added ? (
                            <span className="flex items-center gap-1 text-emerald-700">
                              <FiCheck /> Added to report
                            </span>
                          ) : (
                            <button onClick={handleAdd} className="flex items-center gap-1 hover:text-sky-900">
                              <FiPlus /> Add to report
                            </button>
                          ))}
                        <button onClick={() => setTab("data")} className="ml-auto hover:text-sky-900">
                          View supporting data →
                        </button>
                      </div>
                    </div>
                  )}

                  {chat.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-lg rounded-br-none px-3 py-2 text-x bg-sky-600 text-white shadow-sm whitespace-pre-line">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="max-w-[92%] rounded-lg rounded-bl-none px-3 py-2 text-x bg-white border border-sky-200 text-sky-900 shadow-sm whitespace-pre-line leading-relaxed"
                      >
                        {m.content}
                      </div>
                    )
                  )}

                  {asking && (
                    <div className="inline-flex bg-white border border-sky-200 rounded-lg rounded-bl-none px-3 py-2 shadow-sm">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                      </span>
                    </div>
                  )}

                  {analysis && !asking && analysis.follow_up_questions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.follow_up_questions
                        .filter((q) => !chat.some((m) => m.role === "user" && m.content === q))
                        .map((q) => (
                          <button
                            key={q}
                            onClick={() => ask(q)}
                            className="px-2 py-1 text-[11px] text-left rounded-lg bg-white border border-sky-300 text-sky-800 hover:bg-sky-100"
                          >
                            {q}
                          </button>
                        ))}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}

              {tab === "data" && (
                <>
                  {!supporting.length && (
                    <p className="text-x text-sky-700">
                      {status === "loading" ? "Loading…" : "No supporting data for this value."}
                    </p>
                  )}
                  {supporting.map((table) => (
                    <div key={table.title} className="bg-white border border-sky-200 rounded-lg shadow-sm overflow-hidden">
                      <h4 className="px-3 py-2 text-x font-semibold text-sky-900 bg-sky-100">{table.title}</h4>
                      {table.note && <p className="px-3 pt-1 text-[11px] text-sky-600">{table.note}</p>}
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-sky-700 border-b border-sky-100">
                              {table.columns.map((c) => (
                                <th
                                  key={c.key}
                                  className={`px-2 py-1.5 font-semibold whitespace-nowrap ${c.type ? "text-right" : "text-left"}`}
                                >
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row, i) => (
                              <tr key={i} className="border-b border-sky-50 last:border-0">
                                {table.columns.map((c) => (
                                  <td
                                    key={c.key}
                                    className={`px-2 py-1.5 whitespace-nowrap ${c.type ? "text-right" : "text-left"} ${
                                      c.signed && Number(row[c.key]) < 0
                                        ? "text-red-700"
                                        : c.signed && Number(row[c.key]) > 0
                                          ? "text-green-700"
                                          : "text-sky-900"
                                    }`}
                                  >
                                    {formatCell(row[c.key], c.type, currencySymbol)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Follow-up input */}
            <div className="p-4 border-t border-sky-200 bg-white space-y-2">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ask()}
                  disabled={status !== "ready" || asking}
                  placeholder="Ask a follow-up, e.g. Which customers drove the decline?"
                  className="flex-1 px-3 py-2 text-x border border-sky-200 rounded-lg focus:outline-none focus:border-sky-400 disabled:bg-slate-50"
                />
                <button
                  onClick={() => ask()}
                  disabled={!input.trim() || status !== "ready" || asking}
                  className="flex items-center gap-1 px-3 py-2 text-x text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
                >
                  <FiSend />
                </button>
                <button
                  onClick={run}
                  disabled={status === "loading"}
                  title="Run the analysis again"
                  className="flex items-center px-3 py-2 text-x text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50"
                >
                  <FiRefreshCw className={status === "loading" ? "animate-spin" : ""} />
                </button>
              </div>
              <p className="text-x text-sky-400">
                FPnAInsights may produce inaccurate information. Always verify critical insights.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
