import React from "react";
import { FiChevronRight } from "react-icons/fi";
import MaskedValue from "./MaskedValue";
import { byUnit, compactMoney, pp, signedPct } from "../utils/format";

const tone = (favorable) => (favorable == null ? "text-sky-700" : favorable ? "text-green-600" : "text-red-600");

/** "+$120K (+3.2%) vs Budget", or "+1.4 pp vs Budget" for percentages. */
function ComparisonLine({ c, unit }) {
  let delta;
  if (c.pp != null) delta = pp(c.pp);
  else if (unit === "money") delta = `${c.abs >= 0 ? "+" : "-"}${compactMoney(Math.abs(c.abs))}${c.pct != null ? ` (${signedPct(c.pct)})` : ""}`;
  else delta = `${c.abs >= 0 ? "+" : "-"}${byUnit(Math.abs(c.abs), unit, { compact: true })}${c.pct != null ? ` (${signedPct(c.pct)})` : ""}`;
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-sky-600 truncate">vs {c.label}</span>
      <span className={`font-semibold whitespace-nowrap ${tone(c.favorable)}`}>{delta}</span>
    </div>
  );
}

function Sparkline({ values }) {
  const v = (values || []).filter((x) => typeof x === "number" && Number.isFinite(x));
  if (v.length < 2) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 100},${28 - ((x - min) / span) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-6 mt-1" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#0369a1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function KpiTile({ tile, onDrill }) {
  const clickable = tile.drill && onDrill && !tile.masked;
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={clickable ? () => onDrill(tile) : undefined}
      className={`group text-left bg-white rounded-lg border border-sky-100 px-3 py-2 flex flex-col gap-0.5 min-w-0 ${
        clickable ? "hover:border-sky-300 hover:bg-sky-50/40 transition cursor-pointer" : ""
      }`}
      title={clickable ? `Break down ${tile.label}` : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-sky-700 truncate">{tile.label}</span>
        {clickable ? <FiChevronRight className="text-sky-300 group-hover:text-sky-600 shrink-0" size={14} aria-hidden="true" /> : null}
      </div>
      <div className="text-lg font-bold leading-tight text-sky-900 tabular-nums">
        {tile.masked ? <MaskedValue className="text-sm font-normal" /> : byUnit(tile.value, tile.unit, { compact: tile.unit === "money" })}
      </div>
      {!tile.masked && tile.comparisons?.length ? (
        <div className="space-y-0.5">
          {tile.comparisons.slice(0, 3).map((c) => (
            <ComparisonLine key={c.basis} c={c} unit={tile.unit} />
          ))}
        </div>
      ) : null}
      {!tile.masked && tile.sub ? <p className="text-xs text-sky-600 leading-snug">{tile.sub}</p> : null}
      {!tile.masked && tile.series ? <Sparkline values={tile.series} /> : null}
    </Tag>
  );
}

