import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import KpiTile from "./KpiTile";
import SectionInsights from "./insights/SectionInsights";

const AccordionContext = createContext(null);

/**
 * Turns the SectionBlocks inside it into an accordion: `defaultOpen` (the
 * page's first section) starts open and opening another closes it. Without
 * this wrapper a SectionBlock is always open.
 */
export function SectionAccordion({ defaultOpen, children }) {
  const [openId, setOpenId] = useState(defaultOpen ?? null);
  const value = useMemo(
    () => ({
      openId,
      open: setOpenId,
      toggle: (id) => setOpenId((cur) => (cur === id ? null : id)),
    }),
    [openId]
  );
  return <AccordionContext.Provider value={value}>{children}</AccordionContext.Provider>;
}

/** The surrounding accordion ({ openId, open, toggle }), or null outside one. */
export const useSectionAccordion = () => useContext(AccordionContext);

// Closing a tall section above the one just opened can push its header off the top of the scroll area.
const revealIfHidden = (el) => {
  if (!el) return;
  let scroller = el.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
  if (el.getBoundingClientRect().top < viewTop) el.scrollIntoView({ block: "start", behavior: "smooth" });
};

/**
 * One topic of a dashboard (revenue & GP, contractors, pipeline…): its KPI
 * tiles, charts and tables on the left and the AI insights about that topic
 * only on the right. Tiles stretch to fill the row, so a short section
 * doesn't leave empty columns.
 *
 * Inside a SectionAccordion the header toggles the section. A closed body
 * keeps its width (height 0, not display:none) so charts stay sized, and it
 * still prints.
 */
export default function SectionBlock({ section, insights = [], onDrill, actions, subtitle, children, id, tileMin = 200 }) {
  const tiles = section?.tiles || [];
  const hasInsights = insights.length > 0;
  const accordion = useSectionAccordion();
  const key = section?.id ?? id;
  const collapsible = !!accordion && key != null;
  const open = !collapsible || accordion.openId === key;
  const domId = id || (section ? `section-${section.id}` : undefined);
  const bodyId = domId ? `${domId}-body` : undefined;

  const ref = useRef(null);
  const openedByViewer = useRef(false);
  useEffect(() => {
    if (open && openedByViewer.current) revealIfHidden(ref.current);
    openedByViewer.current = false;
  }, [open]);

  const toggle = () => {
    openedByViewer.current = !open;
    accordion.toggle(key);
  };

  return (
    <section ref={ref} id={domId} className="rounded-xl border border-sky-100 bg-white shadow-sm" aria-label={section?.title}>
      <header
        onClick={collapsible ? toggle : undefined}
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 ${open ? "border-sky-100" : "border-transparent print:border-sky-100"} ${collapsible ? "cursor-pointer hover:bg-sky-50/60" : ""}`}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-semibold text-sky-900">
            {collapsible ? (
              <button type="button" aria-expanded={open} aria-controls={bodyId} className="text-left">
                {section?.title}
              </button>
            ) : (
              section?.title
            )}
          </h3>
          {subtitle ? <p className="text-xs text-sky-600">{subtitle}</p> : null}
        </div>
        {actions || collapsible ? (
          <div className="flex items-center gap-1">
            {actions ? (
              <div className="flex items-center gap-1 print:hidden" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            ) : null}
            {collapsible ? <FiChevronDown size={16} className={`shrink-0 text-sky-600 transition-transform print:hidden ${open ? "rotate-180" : ""}`} aria-hidden="true" /> : null}
          </div>
        ) : null}
      </header>
      <div id={bodyId} className={open ? undefined : "invisible h-0 overflow-hidden print:visible print:h-auto print:overflow-visible"} inert={!open || undefined}>
        <div className={`grid gap-3 p-3 ${hasInsights ? "xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]" : ""}`}>
          <div className="min-w-0 space-y-3">
            {tiles.length ? (
              <div className="flex flex-wrap gap-2">
                {tiles.map((t) => (
                  <div key={t.key} className="flex min-w-0 [&>*]:flex-1" style={{ flex: `1 1 ${tileMin}px` }}>
                    <KpiTile tile={t} onDrill={onDrill} />
                  </div>
                ))}
              </div>
            ) : null}
            {children}
          </div>
          {hasInsights ? <SectionInsights insights={insights} /> : null}
        </div>
      </div>
    </section>
  );
}

/** Insights that belong to a section id. */
export const insightsFor = (insights, sectionId) => (insights || []).filter((i) => i.section === sectionId);
