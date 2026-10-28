import React from "react";
import { FiDownload, FiX } from "react-icons/fi";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn } from "../../../FinancialReports/DrilldownDrawer";
import { downloadCsv } from "../../../FinancialReports/reportExport";
import { toCsvRows } from "../../calc/table";
import SimpleTable from "../table/SimpleTable";

/**
 * Drawer showing the rows behind a number: an insight's evidence, a KPI
 * breakdown, or a chart's drivers. `sections` = [{ title, columns, rows }].
 */
export default function EvidenceDrawer({ open, onClose, title, subtitle, sections, loading, error, children, onRowClick }) {
  return (
    <DrilldownDrawer open={open} onClose={onClose} className="w-[1100px] max-w-[92vw] lg:max-w-[72vw]">
      <div className="px-6 py-5 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle ? <p className="text-sky-200 text-sm mt-1">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0">
            <FiX size={22} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? <DrilldownBodySkeleton /> : null}
        {error ? <p className="text-sm text-red-700">{error.message || "Could not load this breakdown."}</p> : null}
        {!loading && !error ? (
          <DrilldownFadeIn className="space-y-5">
            {children}
            {(sections || []).map((s) => (
              <div key={s.title} className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-sky-900 text-sm">{s.title}</h3>
                  {s.rows?.length ? (
                    <button
                      type="button"
                      onClick={() => downloadCsv(toCsvRows(s.columns, s.rows), `${s.title}.csv`)}
                      className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900"
                    >
                      <FiDownload size={12} /> CSV
                    </button>
                  ) : null}
                </div>
                <SimpleTable columns={s.columns} rows={s.rows} maxHeight="480px" onRowClick={onRowClick ? (r) => onRowClick(r, s) : undefined} />
              </div>
            ))}
          </DrilldownFadeIn>
        ) : null}
      </div>
    </DrilldownDrawer>
  );
}
