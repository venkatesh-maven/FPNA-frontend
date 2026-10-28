import React, { useState } from "react";
import { FiBarChart2, FiDownload, FiList } from "react-icons/fi";
import { AnalyzeButton } from "../../FinancialReports/AnalyzeWithAI";
import ActionHoverLabel from "../../FinancialReports/ActionHoverLabel";
import { downloadCsv } from "../../FinancialReports/reportExport";
import { toCsvRows } from "../calc/table";
import SimpleTable from "./table/SimpleTable";

const iconBtn = "relative group inline-flex items-center justify-center p-1.5 rounded-md text-sky-600 hover:text-sky-900 hover:bg-sky-100";

/**
 * Card for a chart with an optional table view of the same data, CSV export
 * of that table, and an "Analyze drivers" action. `table` is { columns, rows }.
 */
export default function ChartCard({ title, subtitle, table, exportName, onAnalyze, actions, children, className = "" }) {
  const [view, setView] = useState("chart");
  return (
    <div className={`bg-white rounded-lg border border-sky-100 p-3 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sky-900 text-sm">{title}</h3>
          {subtitle ? <p className="text-xs text-sky-600 mt-0.5">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1 shrink-0 print:hidden">
          {actions}
          {onAnalyze ? <AnalyzeButton onClick={onAnalyze} title="Analyze drivers" /> : null}
          {table ? (
            <button type="button" className={iconBtn} aria-label={view === "chart" ? "Show as table" : "Show as chart"} onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}>
              {view === "chart" ? <FiList size={14} /> : <FiBarChart2 size={14} />}
              <ActionHoverLabel>{view === "chart" ? "Table" : "Chart"}</ActionHoverLabel>
            </button>
          ) : null}
          {table ? (
            <button type="button" className={iconBtn} aria-label={`Download ${title} as CSV`} onClick={() => downloadCsv(toCsvRows(table.columns, table.rows), `${exportName || title}.csv`)}>
              <FiDownload size={14} />
              <ActionHoverLabel>CSV</ActionHoverLabel>
            </button>
          ) : null}
        </div>
      </div>
      {view === "table" && table ? <SimpleTable columns={table.columns} rows={table.rows} maxHeight="360px" /> : children}
    </div>
  );
}
