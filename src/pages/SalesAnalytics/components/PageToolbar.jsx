import React from "react";
import { FiPrinter } from "react-icons/fi";
import ExportMenu from "../../FinancialReports/ExportMenu";
import ActionHoverLabel from "../../FinancialReports/ActionHoverLabel";
import { useSalesAccess } from "../access/SalesAccessContext";

const toolBtn =
  "relative group flex items-center px-3 py-2.5 text-sm bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200";

/** Page title row with download (with or without saved commentary) and print. */
export default function PageToolbar({ title, subtitle, onExport, commentaryCount = 0, exportLabel, children }) {
  const { can } = useSalesAccess();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-sky-900">{title}</h2>
        {subtitle ? <p className="text-sm text-sky-700">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2 print:hidden">
        {children}
        {onExport && can("export_data") ? (
          <ExportMenu label={exportLabel || title} format="csv" onExport={onExport} commentaryCount={commentaryCount} className={toolBtn} />
        ) : null}
        <button type="button" onClick={() => window.print()} aria-label="Print" className={toolBtn}>
          <FiPrinter />
          <ActionHoverLabel>Print</ActionHoverLabel>
        </button>
      </div>
    </div>
  );
}
