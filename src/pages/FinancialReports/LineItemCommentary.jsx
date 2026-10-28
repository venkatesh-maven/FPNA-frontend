import React from "react";
import { BsStars } from "react-icons/bs";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";

/**
 * Saved row commentary for the report view on screen, in the same order as
 * `lines` ([{ key, label }], the table rows). Part of the page, so it prints /
 * saves to PDF with the report (buttons are hidden by the global print CSS).
 */
export default function LineItemCommentary({
  lineCommentary,
  lines,
  onRefine,
  title = "Line-item Variance Commentary",
}) {
  const entries = lines
    .map((line) => ({ line, item: lineCommentary.byLine[line.key] }))
    .filter((e) => e.item);

  if (!entries.length) return null;

  const handleRemove = async (line, item) => {
    if (!window.confirm(`Remove the commentary for ${line.label}?`)) return;
    try {
      await lineCommentary.remove(item.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section
      className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
      style={{ breakInside: "avoid" }}
    >
      <h3 className="text-s font-semibold text-sky-900 mb-3">{title}</h3>

      <ol className="space-y-3">
        {entries.map(({ line, item }) => (
          <li key={item.id} className="border-l-4 border-sky-300 pl-3" style={{ breakInside: "avoid" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-x font-semibold text-sky-900">{line.label}</h4>
                <span
                  className="flex items-center gap-0.5 text-[11px] text-sky-600"
                  title={
                    item.refinements?.length
                      ? `Refined with: ${item.refinements.join(" | ")}`
                      : undefined
                  }
                >
                  <BsStars />
                  {item.source === "ai_refined"
                    ? `Refined with AI (${item.refinements.length})`
                    : "AI-generated"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onRefine(line)}
                  className="text-sky-600 hover:text-sky-900"
                  aria-label="Refine commentary"
                >
                  <FiEdit2 size={14} />
                </button>
                <button
                  onClick={() => handleRemove(line, item)}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Remove commentary"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-x text-slate-700 leading-relaxed">{item.explanation}</p>
            {item.recommendation && (
              <p className="mt-1 text-x text-slate-700 leading-relaxed">
                <span className="font-semibold text-sky-900">Recommendation: </span>
                {item.recommendation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
