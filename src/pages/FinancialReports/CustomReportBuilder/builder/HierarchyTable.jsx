import React, { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { computeTotals, formatMetricValue, formatPercent } from "../financialCustomReportAggregate";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(period) {
  const m = Number(String(period).split("-")[1]);
  return MONTH_NAMES[m - 1] || period;
}

function varianceClass(value) {
  if (value == null || !Number.isFinite(value)) return "text-slate-400";
  return value >= 0 ? "text-emerald-600" : "text-rose-600";
}

// Right-pinned Insights / Recommendation columns, same widths as the P&L
// report's: the Insights offset equals the full Recommendation cell width
// (190px content + 24px padding = 214px).
const STICKY_RECOMMENDATION = "sticky right-0 w-[214px] min-w-[214px] max-w-[214px]";
const STICKY_INSIGHTS =
  "sticky right-[214px] w-[244px] min-w-[244px] max-w-[244px] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.25)]";

// Renders a buildHierarchy() tree as an expandable/collapsible table —
// depth-indented labels, a subtotal row per non-leaf node, and either
// one column per selected metric/driver or (when only the primary metric is
// selected and Display By = Month) one column per month. Compare With
// columns (Actual | Compare | Variance | Variance %) append when a
// comparison is active. Top-level nodes are paginated the same way the
// previous flat table paginated its rows, so a wide report still bounds DOM
// size regardless of how many top-level groups it produces.
//
// `aiColumns` ({ renderLabelAction, renderInsight, renderRecommendation },
// each called with a node) adds a button after each row label and the
// pinned Insights / Recommendation columns.
export default function HierarchyTable({
  hierarchy,
  groupByLabels,
  metricColumns,
  isMonthPivot,
  periods,
  compareWith,
  compareLabel,
  grandTotal,
  sortConfig,
  onSort,
  showPercentOfTotal,
  percentOfTotalBase,
  conditionalFormatting,
  aiColumns,
  pageSize = 100,
}) {
  const [expanded, setExpanded] = useState(() => new Set(hierarchy.map((n) => n.key)));
  const [currentPage, setCurrentPage] = useState(1);

  const toggle = (path) => {
    const key = path.join("␟");
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(hierarchy.length / pageSize));
  const pagedRoots = useMemo(
    () => hierarchy.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [hierarchy, currentPage, pageSize]
  );

  const hasCompare = compareWith && compareWith !== "none";
  const primaryMetric = metricColumns[0]?.field;
  const showPct = showPercentOfTotal && !isMonthPivot && percentOfTotalBase;

  const cfClass = (value) => {
    if (!conditionalFormatting?.enabled || value == null || !Number.isFinite(Number(value))) return "";
    const hit =
      conditionalFormatting.direction === "above"
        ? Number(value) > conditionalFormatting.threshold
        : Number(value) < conditionalFormatting.threshold;
    return hit ? "bg-amber-100 font-semibold" : "";
  };

  const monthValuesFor = (node) => {
    if (!node.rows) return {};
    const out = {};
    periods.forEach((p) => {
      const rowsInMonth = node.rows.filter((r) => r.Month === p);
      out[p] = rowsInMonth.length ? computeTotals(rowsInMonth, [primaryMetric], "sum")[primaryMetric] : 0;
    });
    return out;
  };

  const renderRows = (nodes, acc) => {
    nodes.forEach((node) => {
      const key = node.path.join("␟");
      const isOpen = expanded.has(key);
      const monthVals = isMonthPivot ? monthValuesFor(node) : null;

      acc.push(
        <tr key={key} className={node.isLeaf ? "border-b border-sky-50 hover:bg-sky-50 text-sky-900" : "bg-sky-50/70 font-semibold border-b border-sky-100 text-sky-900"}>
          <td className="px-3 py-2.5 whitespace-nowrap text-left" style={{ paddingLeft: `${12 + node.level * 20}px` }}>
            <span className="flex items-center gap-1.5">
              {!node.isLeaf ? (
                <button onClick={() => toggle(node.path)} className="text-sky-600 hover:text-sky-900">
                  {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
              ) : (
                <span className="inline-block w-[14px]" />
              )}
              {node.label}
              {aiColumns?.renderLabelAction?.(node)}
            </span>
          </td>

          {isMonthPivot
            ? periods.map((p) => (
                <td key={p} className="px-3 py-2.5 whitespace-nowrap text-right">
                  {formatMetricValue(monthVals[p], metricColumns[0]?.format)}
                </td>
              ))
            : metricColumns.map((m, idx) => (
                <td key={m.field} className={`px-3 py-2.5 whitespace-nowrap text-right ${idx === 0 ? cfClass(node.metrics[m.field]) : ""}`}>
                  {formatMetricValue(node.metrics[m.field], m.format)}
                </td>
              ))}

          {showPct ? (
            <td className="px-3 py-2.5 whitespace-nowrap text-right text-slate-600">
              {formatPercent((Number(node.metrics[primaryMetric]) / percentOfTotalBase) * 100)}
            </td>
          ) : null}

          {hasCompare ? (
            <>
              <td className="px-3 py-2.5 whitespace-nowrap text-right text-slate-500">
                {formatMetricValue(node.compare?.[primaryMetric], metricColumns[0]?.format)}
              </td>
              <td className={`px-3 py-2.5 whitespace-nowrap text-right font-medium ${varianceClass(node.variance?.[primaryMetric])}`}>
                {formatMetricValue(node.variance?.[primaryMetric], metricColumns[0]?.format)}
              </td>
              <td className={`px-3 py-2.5 whitespace-nowrap text-right font-medium ${varianceClass(node.variancePercent?.[primaryMetric])}`}>
                {node.variancePercent?.[primaryMetric] == null ? "—" : formatPercent(node.variancePercent[primaryMetric])}
              </td>
            </>
          ) : null}

          {aiColumns ? (
            <>
              {/* Opaque backgrounds: the metric columns scroll underneath. */}
              <td className={`px-3 py-2 font-normal text-sky-700 ${STICKY_INSIGHTS} z-10 ${node.isLeaf ? "bg-white" : "bg-sky-50"}`}>
                {aiColumns.renderInsight(node)}
              </td>
              <td className={`px-3 py-2 font-normal text-sky-700 ${STICKY_RECOMMENDATION} z-10 ${node.isLeaf ? "bg-white" : "bg-sky-50"}`}>
                {aiColumns.renderRecommendation(node)}
              </td>
            </>
          ) : null}
        </tr>
      );

      if (!node.isLeaf && isOpen) {
        renderRows(node.children, acc);
      }
    });
    return acc;
  };

  const bodyRows = renderRows(pagedRoots, []);

  const sortIcon = (field) =>
    sortConfig?.key === field ? (
      sortConfig.direction === "asc" ? <FiArrowUp className="inline ml-1" size={12} /> : <FiArrowDown className="inline ml-1" size={12} />
    ) : null;

  return (
    <div>
      <div className="report-table-scroll overflow-auto max-h-[600px] border border-sky-100 rounded-lg">
        <table className="min-w-max w-full text-x">
          <thead className="sticky top-0 bg-sky-900 text-white z-20">
            <tr>
              <th className="px-3 py-3 font-semibold whitespace-nowrap text-left">
                {groupByLabels.join(" / ")}
              </th>
              {isMonthPivot
                ? periods.map((p) => (
                    <th key={p} className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                      {monthLabel(p)}
                    </th>
                  ))
                : metricColumns.map((m) => (
                    <th
                      key={m.field}
                      className="px-3 py-3 font-semibold whitespace-nowrap text-right cursor-pointer hover:bg-sky-800"
                      onClick={() => onSort?.(m.field)}
                    >
                      {m.label}
                      {sortIcon(m.field)}
                    </th>
                  ))}
              {showPct ? <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">% of Total</th> : null}
              {hasCompare ? (
                <>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">{compareLabel}</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Variance</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Variance %</th>
                </>
              ) : null}
              {aiColumns ? (
                <>
                  <th className={`px-3 py-3 font-semibold whitespace-nowrap text-left ${STICKY_INSIGHTS} z-30 bg-sky-900`}>Insights</th>
                  <th className={`px-3 py-3 font-semibold whitespace-nowrap text-left ${STICKY_RECOMMENDATION} z-30 bg-sky-900`}>
                    Recommendation
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {bodyRows}
            {grandTotal ? (
              <tr className="sticky bottom-0 z-20 bg-sky-50 font-semibold border-t-2 border-sky-200 text-sky-900">
                <td className="px-3 py-2.5 whitespace-nowrap text-left">
                  <strong>📊 Grand Total</strong>
                </td>
                {isMonthPivot
                  ? periods.map((p) => (
                      <td key={p} className="px-3 py-2.5 whitespace-nowrap text-right">
                        <strong>{formatMetricValue(grandTotal.monthValues?.[p], metricColumns[0]?.format)}</strong>
                      </td>
                    ))
                  : metricColumns.map((m) => (
                      <td key={m.field} className="px-3 py-2.5 whitespace-nowrap text-right">
                        <strong>{formatMetricValue(grandTotal.metrics[m.field], m.format)}</strong>
                      </td>
                    ))}
                {showPct ? (
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    <strong>100.0%</strong>
                  </td>
                ) : null}
                {hasCompare ? (
                  <>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <strong>{formatMetricValue(grandTotal.compare?.[primaryMetric], metricColumns[0]?.format)}</strong>
                    </td>
                    <td className={`px-3 py-2.5 whitespace-nowrap text-right ${varianceClass(grandTotal.variance?.[primaryMetric])}`}>
                      <strong>{formatMetricValue(grandTotal.variance?.[primaryMetric], metricColumns[0]?.format)}</strong>
                    </td>
                    <td className={`px-3 py-2.5 whitespace-nowrap text-right ${varianceClass(grandTotal.variancePercent?.[primaryMetric])}`}>
                      <strong>{grandTotal.variancePercent?.[primaryMetric] == null ? "—" : formatPercent(grandTotal.variancePercent[primaryMetric])}</strong>
                    </td>
                  </>
                ) : null}
                {aiColumns ? (
                  <>
                    <td className={`${STICKY_INSIGHTS} bg-sky-50`} />
                    <td className={`${STICKY_RECOMMENDATION} bg-sky-50`} />
                  </>
                ) : null}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {hierarchy.length > pageSize ? (
        <div className="flex items-center justify-between px-3 py-3 border-t border-sky-100">
          <p className="text-x text-slate-600">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-medium">{Math.min(currentPage * pageSize, hierarchy.length)}</span> of{" "}
            <span className="font-medium">{hierarchy.length}</span> top-level groups
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-sky-200 rounded text-x font-medium text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-sky-200 rounded text-x font-medium text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
