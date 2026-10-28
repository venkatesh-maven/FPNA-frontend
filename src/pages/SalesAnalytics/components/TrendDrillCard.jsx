import React, { useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import ChartCard from "./ChartCard";
import SimpleTable from "./table/SimpleTable";
import { TrendComboChart } from "./charts/Charts";
import { getTrendDrill } from "../services/salesAnalyticsApi";
import { useSalesQuery } from "../hooks/useSalesQuery";
import { useSalesFilters } from "../filters/SalesFiltersContext";
import { useSalesAccess } from "../access/SalesAccessContext";
import { formatYm } from "../calc/dates";

const col = (key, label, unit = "money") => ({ key, label, unit });
const TREND_COLUMNS = [col("label", "Month", "text"), col("revenue", "Revenue"), col("cmpRevenue", "Comparison revenue"), col("gp", "GP"), col("cmpGp", "Comparison GP"), col("gmPct", "GM", "pct")];

/**
 * Revenue & GP trend that drills in place: month → vertical → client →
 * assignment, with a breadcrumb back up. `repId` narrows to one rep.
 */
export default function TrendDrillCard({ trend, compareLabel, repId, onAnalyze }) {
  const [path, setPath] = useState([]);
  const { filters } = useSalesFilters();
  const { viewer } = useSalesAccess();
  const args = { path, ...(repId ? { repId } : {}) };
  const { data, loading } = useSalesQuery(getTrendDrill, filters, viewer, args, { enabled: path.length > 0 });

  const crumbs = [{ label: "12 months", depth: 0 }, ...path.map((p, i) => ({ label: p.label, depth: i + 1 }))];
  const drillInto = (row) => {
    if (!data?.drillable) return;
    setPath((p) => [...p, { key: row.key, label: row.label }]);
  };

  return (
    <ChartCard
      title="Revenue & GP trend"
      subtitle={path.length ? data?.title || "Loading…" : `Last 12 months · bars solid inside the selected period · dashed lines show ${compareLabel} · select a month to drill down`}
      table={path.length ? (data ? { columns: data.columns, rows: data.rows } : null) : { columns: TREND_COLUMNS, rows: trend }}
      exportName="revenue-gp-trend"
      onAnalyze={onAnalyze}
    >
      {path.length ? (
        <div className="space-y-2">
          <nav className="flex flex-wrap items-center gap-1 text-xs" aria-label="Drill path">
            {crumbs.map((c, i) => (
              <React.Fragment key={c.depth}>
                {i ? <FiChevronRight className="text-sky-400" size={12} /> : null}
                {i < crumbs.length - 1 ? (
                  <button type="button" onClick={() => setPath((p) => p.slice(0, c.depth))} className="text-sky-700 hover:underline">
                    {c.label}
                  </button>
                ) : (
                  <span className="font-semibold text-sky-900">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
          {loading && !data ? (
            <div className="h-64 rounded-lg bg-sky-50 animate-pulse" />
          ) : (
            <SimpleTable columns={data?.columns || []} rows={data?.rows || []} maxHeight="300px" onRowClick={data?.drillable ? drillInto : undefined} />
          )}
          {data?.drillable ? <p className="text-xs text-sky-600">Select a row to go one level deeper.</p> : null}
        </div>
      ) : (
        <TrendComboChart data={trend} compareLabel={compareLabel} onSelectMonth={(m) => m?.ym && setPath([{ key: m.ym, label: formatYm(m.ym) }])} />
      )}
    </ChartCard>
  );
}
