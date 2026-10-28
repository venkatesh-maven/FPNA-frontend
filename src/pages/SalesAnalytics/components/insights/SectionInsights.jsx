import React, { useState } from "react";
import { BsStars } from "react-icons/bs";
import { FiArrowRight, FiBookmark, FiPlayCircle, FiSearch, FiTrash2 } from "react-icons/fi";
import { useInsightActions } from "./InsightActions";
import { INSIGHT_CATEGORIES } from "../../insights/phrasing";
import { formatDate } from "../../calc/dates";

const DOT = { positive: "bg-green-500", negative: "bg-red-500", neutral: "bg-sky-400" };
const linkBtn = "inline-flex items-center gap-1 text-sky-700 hover:text-sky-950 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed";
const SHOW_FIRST = 3;

function InsightItem({ item, actions }) {
  const saved = (actions?.commentary.items || []).filter((c) => c.insightId === item.id);
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[item.severity] || DOT.neutral}`} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold leading-snug text-sky-950">{item.title}</p>
          <p className="text-xs leading-snug text-slate-700">{item.meaning}</p>
          {item.actions?.length ? (
            <ul className="space-y-0.5">
              {item.actions.map((a) => (
                <li key={a} className="flex gap-1.5 text-xs leading-snug text-sky-800">
                  <FiArrowRight size={11} className="mt-[3px] shrink-0 text-sky-500" aria-hidden="true" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] font-medium print:hidden">
              <button type="button" className={linkBtn} onClick={() => actions.analyze(item)} disabled={!item.evidence}>
                <FiSearch size={11} /> Analyze drivers
              </button>
              <button type="button" className={linkBtn} onClick={() => actions.refine(item)}>
                <BsStars size={11} /> Refine with AI
              </button>
              {actions.whatIf && item.whatIf ? (
                <button type="button" className={linkBtn} onClick={() => actions.whatIf(item)}>
                  <FiPlayCircle size={11} /> {item.whatIf.label || "Run What-If"}
                </button>
              ) : null}
              <button type="button" className={linkBtn} onClick={() => actions.save(item)}>
                <FiBookmark size={11} /> {saved.length ? "Save again" : "Save commentary"}
              </button>
              <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">{INSIGHT_CATEGORIES[item.category]?.label}</span>
            </div>
          ) : null}
          {saved.map((c) => (
            <div key={c.id} className="mt-1 flex items-start justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-900">
                  {c.source === "ai" ? "AI commentary" : "Saved commentary"} · {c.title}
                </p>
                <p className="whitespace-pre-line text-[11px] leading-snug text-amber-900/90">{c.text}</p>
                <p className="text-[10px] text-amber-700">
                  {c.savedBy} · {formatDate(c.savedAt?.slice(0, 10))}
                </p>
              </div>
              <button type="button" onClick={() => actions.commentary.remove(c.id)} className="shrink-0 text-amber-500 hover:text-red-600" aria-label={`Remove commentary ${c.title}`}>
                <FiTrash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}

/** The insights for one KPI section, compact, with the section's own actions. */
export default function SectionInsights({ insights, title = "AI insights" }) {
  const actions = useInsightActions();
  const [all, setAll] = useState(false);
  if (!insights?.length) return null;
  const shown = all ? insights : insights.slice(0, SHOW_FIRST);
  return (
    <aside className="min-w-0 self-start rounded-lg border border-sky-100 bg-sky-50/60" aria-label={title}>
      <div className="flex items-center gap-1.5 border-b border-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">
        <BsStars className="text-sky-600" size={12} /> {title}
        <span className="font-normal text-sky-500">· {insights.length}</span>
      </div>
      <ul className="divide-y divide-sky-100">
        {shown.map((item) => (
          <InsightItem key={item.id} item={item} actions={actions} />
        ))}
      </ul>
      {insights.length > SHOW_FIRST ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-sky-100 px-3 py-1.5 text-left text-[11px] font-medium text-sky-700 hover:bg-sky-100/60">
          {all ? "Show fewer" : `Show ${insights.length - SHOW_FIRST} more`}
        </button>
      ) : null}
    </aside>
  );
}
