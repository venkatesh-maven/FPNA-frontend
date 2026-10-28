import React from "react";
import MaskedValue from "../MaskedValue";
import { byUnit } from "../../utils/format";
import { isNumericUnit } from "./tableUtils";

export function Cell({ row, column }) {
  if (row.__masked?.includes(column.key)) return <MaskedValue />;
  if (column.render) return column.render(row);
  const v = row[column.key];
  if (column.unit === "text" || column.unit === "date") return v ?? "—";
  return byUnit(v, column.unit || "money");
}

/** Plain read-only table: evidence in drawers and the table view of charts. */
export default function SimpleTable({ columns, rows, maxHeight, onRowClick, emptyLabel = "No rows for the current filters." }) {
  if (!rows?.length) return <p className="text-sm text-sky-600 py-6 text-center">{emptyLabel}</p>;
  return (
    <div className="overflow-auto rounded-lg border border-sky-100 report-table-scroll" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-sm">
        <thead className="bg-sky-900 text-white sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-semibold whitespace-nowrap ${isNumericUnit(c.unit) ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.key || r.id || i}
              className={`border-b border-sky-50 ${onRowClick ? "cursor-pointer hover:bg-sky-50" : "hover:bg-sky-50/50"}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${isNumericUnit(c.unit) ? "text-right tabular-nums" : "text-left"} text-sky-900`}>
                  <Cell row={r} column={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
