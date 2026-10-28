import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BsChatLeftText, BsChatLeftTextFill } from "react-icons/bs";
import { FiX, FiCopy, FiCheck, FiRefreshCw, FiSend, FiRotateCcw } from "react-icons/fi";
import { toast } from "react-toastify";
import { fevicon } from "../../assets/Assets";
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

const formatDraft = (v) =>
  v.recommendation ? `${v.explanation}\n\nRecommendation: ${v.recommendation}` : v.explanation;

/**
 * Commentary button shown next to each row's label in a report table (a P&L
 * line, a cash-flow line, a customer…). A chat icon rather than ✦, so it isn't
 * mistaken for the ✦ on values that explains a single number; filled once
 * commentary is saved for the row. Its hover help comes from the page's shared
 * <AIHelpTooltip />. `noun` names the commentary ("variance commentary",
 * "commentary").
 */
export function LineItemAIButton({ label, hasCommentary, onClick, noun = "variance commentary" }) {
  const Icon = hasCommentary ? BsChatLeftTextFill : BsChatLeftText;
  const title = hasCommentary ? "View or edit saved commentary" : `Write ${noun} (AI-assisted)`;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label ? `${title}: ${label}` : title}
      {...aiHelpTooltipProps({
        heading: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} with AI`,
        context: label,
        body: "AI drafts why this row moved and what to do about it. Add your own context to refine it, then save it to the report.",
        status: hasCommentary ? "Saved for the current view · click to view or edit" : undefined,
      })}
      className={`relative shrink-0 p-1 rounded-md hover:bg-sky-200 ${
        hasCommentary ? "text-sky-700" : "text-sky-400 hover:text-sky-700"
      }`}
    >
      <Icon size={13} />
      {hasCommentary && (
        <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
    </button>
  );
}

/**
 * "Refine with AI" drawer for one report row (`line` = { key, label }): AI
 * drafts an explanation + recommendation from the data on screen
 * (`buildContext(line.key)`), the user refines it with context / corrections /
 * management judgment as many times as needed, then accepts it as that row's
 * saved commentary (`lineCommentary` = hooks/useLineItemCommentary).
 */
export default function LineItemRefineWithAI({
  line,
  onClose,
  lineCommentary,
  reportLabel,
  filterLabels,
  buildContext,
  subtitle = "variance explanation & recommendation",
}) {
  const [versions, setVersions] = useState([]);
  const [baseInstructions, setBaseInstructions] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestId = useRef(0);
  const bottomRef = useRef(null);

  const saved = line ? lineCommentary.byLine[line.key] : null;
  const latest = versions[versions.length - 1];
  const appliedInstructions = [
    ...baseInstructions,
    ...versions.map((v) => v.instruction).filter(Boolean),
  ];
  const isDirty =
    !!latest &&
    (!saved ||
      latest.explanation !== saved.explanation ||
      (latest.recommendation || null) !== (saved.recommendation || null));

  const run = async (params, onDone) => {
    const id = ++requestId.current;
    setGenerating(true);
    setError("");
    try {
      const draft = await lineCommentary.explain({
        reportLabel,
        filterLabels,
        lineItem: line.key,
        lineItemLabel: line.label,
        context: buildContext(line.key),
        ...params,
      });
      if (id === requestId.current) onDone(draft);
    } catch (err) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setGenerating(false);
    }
  };

  const generateFresh = () =>
    run({}, (draft) => {
      setBaseInstructions([]);
      setVersions([{ id: Date.now(), instruction: null, ...draft }]);
    });

  // Start from the saved commentary if there is one, otherwise draft it.
  useEffect(() => {
    requestId.current++;
    setVersions([]);
    setBaseInstructions([]);
    setError("");
    setInput("");
    setGenerating(false);
    if (!line) return;
    const existing = lineCommentary.byLine[line.key];
    if (existing) {
      setBaseInstructions(existing.refinements || []);
      setVersions([
        {
          id: existing.id,
          instruction: null,
          fromSaved: true,
          explanation: existing.explanation,
          recommendation: existing.recommendation,
        },
      ]);
    } else {
      generateFresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.key]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [versions.length, generating]);

  const refine = () => {
    const instruction = input.trim();
    if (!instruction || !latest || generating) return;
    run(
      {
        current: { explanation: latest.explanation, recommendation: latest.recommendation },
        previousInstructions: appliedInstructions,
        instruction,
      },
      (draft) => {
        setVersions((prev) => [...prev, { id: Date.now(), instruction, ...draft }]);
        setInput("");
      }
    );
  };

  const revertTo = (index) => setVersions((prev) => prev.slice(0, index + 1));

  const accept = async () => {
    if (!latest) return;
    setSaving(true);
    try {
      await lineCommentary.save({
        lineItem: line.key,
        lineItemLabel: line.label,
        explanation: latest.explanation,
        recommendation: latest.recommendation,
        refinements: appliedInstructions,
      });
      toast.success(`Commentary saved for ${line.label}`);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (isDirty && !window.confirm("Discard this unsaved commentary?")) return;
    onClose();
  };

  const handleCopy = async () => {
    await copyText(formatDraft(latest));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence>
      {line && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            className="fixed top-0 right-0 z-50 h-full w-[420px] bg-white shadow-2xl flex flex-col border-l border-sky-200"
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
                  <h2 className="text-s font-semibold text-sky-900">Refine with AI</h2>
                  <p className="text-x text-sky-600">
                    {line.label} — {subtitle}
                  </p>
                </div>
              </div>
              <button onClick={close} className="p-1 rounded-lg hover:bg-sky-100 text-sky-600">
                <FiX size={18} />
              </button>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-4 bg-sky-50 space-y-3">
              <div className="max-w-[90%] rounded-lg px-3 py-2 text-x bg-white border border-sky-200 text-sky-900 rounded-bl-none shadow-sm">
                {saved
                  ? "This is the saved commentary for this line. "
                  : `Here's a draft for ${line.label} in the current ${reportLabel}${
                      filterLabels.length ? ` (${filterLabels.join(", ")})` : ""
                    }. `}
                Tell me what to add or correct — context, management judgment, tone — and I'll
                rewrite it. Accept it when you're happy.
              </div>

              {versions.map((v, i) => {
                const isLatest = i === versions.length - 1;
                return (
                  <React.Fragment key={v.id}>
                    {v.instruction && (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-lg rounded-br-none px-3 py-2 text-x bg-sky-600 text-white shadow-sm whitespace-pre-line">
                          {v.instruction}
                        </div>
                      </div>
                    )}
                    <div
                      className={`rounded-lg rounded-bl-none px-3 py-2 text-x text-sky-900 shadow-sm border ${
                        isLatest ? "bg-white border-sky-400" : "bg-white/60 border-sky-200 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-500">
                          {v.fromSaved ? "Saved" : i === 0 ? "AI draft" : `Refined v${i + 1}`}
                          {isLatest && " · current"}
                        </span>
                        {!isLatest && !generating && (
                          <button
                            onClick={() => revertTo(i)}
                            className="flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-900"
                          >
                            <FiRotateCcw size={11} /> Revert to this
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-line leading-relaxed">{v.explanation}</p>
                      {v.recommendation && (
                        <p className="mt-2 leading-relaxed">
                          <span className="font-semibold">Recommendation: </span>
                          {v.recommendation}
                        </p>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}

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
                <div className="max-w-[90%] rounded-lg px-3 py-2 text-x bg-white border border-red-200 text-red-700 rounded-bl-none shadow-sm">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-sky-200 bg-white space-y-2">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) refine();
                  }}
                  rows={3}
                  disabled={!latest || generating}
                  placeholder="e.g. The March dip was a one-off contract delay that closes in Q2 — mention it and soften the recommendation."
                  className="flex-1 px-2 py-1.5 text-x border border-sky-200 rounded-lg resize-none focus:outline-none focus:border-sky-400 disabled:bg-slate-50"
                />
                <button
                  onClick={refine}
                  disabled={!input.trim() || !latest || generating}
                  title="Refine (Ctrl+Enter)"
                  className="self-end flex items-center gap-1 px-3 py-2 text-x text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
                >
                  <FiSend /> Refine
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={accept}
                  disabled={!latest || !isDirty || generating || saving}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-x text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  <FiCheck /> {saved ? "Accept & update" : "Accept & save"}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!latest}
                  className="flex items-center gap-1 px-3 py-2 text-x text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50"
                >
                  {copied ? <FiCheck /> : <FiCopy />} {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={generateFresh}
                  disabled={generating}
                  title="Discard refinements and draft again from the data"
                  className="flex items-center gap-1 px-3 py-2 text-x text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50"
                >
                  <FiRefreshCw className={generating ? "animate-spin" : ""} /> New draft
                </button>
              </div>
              <p className="text-x text-sky-400">
                FPnAInsights may produce inaccurate information. Always verify critical commentary.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
