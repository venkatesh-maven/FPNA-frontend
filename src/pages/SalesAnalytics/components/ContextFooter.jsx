import React from "react";
import { formatDate } from "../calc/dates";
import { FILTER_FIELDS } from "../filters/filterSchema";

const filterLabel = (key) => FILTER_FIELDS.find((f) => f.key === key)?.label || key;

/** Period, unit, currency, freshness, source, comparison basis — and anything not applied. */
export default function ContextFooter({ meta }) {
  if (!meta) return null;
  const parts = [
    `${meta.period.label}${meta.period.isPartial ? " (partial)" : ""}`,
    `${meta.unit}`,
    `vs ${meta.compareBasis}${meta.compareKind === "actual" ? " (same elapsed days)" : ""}`,
    `Data as of ${formatDate(meta.asOf)}`,
    `Scope: ${meta.scope.label}`,
  ];
  return (
    <footer className="mt-4 rounded-lg border border-sky-100 bg-white/70 px-3 py-2 text-xs text-sky-700 space-y-1">
      <p>{parts.join(" · ")}</p>
      {meta.sources?.length ? <p>Sources: {meta.sources.join("; ")}</p> : null}
      {meta.ignoredFilters?.length ? (
        <p className="text-amber-700">Not applied on this view: {meta.ignoredFilters.map(filterLabel).join(", ")}</p>
      ) : null}
      {meta.notes?.map((n) => (
        <p key={n}>{n}</p>
      ))}
      {meta.maskedFields?.length ? <p>Some cost or commission fields are restricted for your role and show as “Restricted”.</p> : null}
    </footer>
  );
}
