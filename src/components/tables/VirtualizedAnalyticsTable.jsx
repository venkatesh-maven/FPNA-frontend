import React, { memo, useMemo } from "react";
import { List } from "react-window";

const DEFAULT_HEIGHT = 520;
const DEFAULT_ROW_HEIGHT = 46;

const VirtualRow = memo(
  ({ ariaAttributes, index, style, rows, renderRow, minWidth }) => {
    const row = rows[index];

    return (
      <div
        {...ariaAttributes}
        style={style}
        className="vat-row-shell"
      >
        <table
          className="w-full border-collapse text-x"
          style={{ minWidth, tableLayout: "auto" }}
        >
          <tbody>{renderRow(row, index)}</tbody>
        </table>
      </div>
    );
  },
);

VirtualRow.displayName = "VirtualRow";

export default function VirtualizedAnalyticsTable({
  rows = [],
  renderHeader,
  renderRow,
  renderFooter,
  emptyState = null,
  loading = false,
  loadingRows = 8,
  minWidth = 1100,
  height = DEFAULT_HEIGHT,
  maxHeight = "60vh",
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscanCount = 8,
  className = "",
  tableClassName = "w-full border-collapse text-x",
}) {
  const normalizedMinWidth =
    typeof minWidth === "number" ? `${minWidth}px` : minWidth;

  const shellStyle = useMemo(
    () => ({
      maxHeight,
      scrollBehavior: "smooth",
    }),
    [maxHeight],
  );

  const listHeight =
    typeof height === "number"
      ? Math.min(height, Math.max(rowHeight, rows.length * rowHeight))
      : height;

  const skeletonRows = Array.from({ length: loadingRows });

  return (
    <div
      className={[
        "vat-scroll overflow-auto rounded-lg border border-sky-200 bg-white",
        className,
      ].join(" ")}
      style={shellStyle}
    >
      <style>
        {`
          .vat-scroll {
            scrollbar-width: thin;
            scrollbar-color: #0c4a6e #e0f2fe;
          }

          .vat-scroll::-webkit-scrollbar {
            display: block;
            width: 6px;
            height: 6px;
          }

          .vat-scroll::-webkit-scrollbar-track {
            background: #e0f2fe;
            border-radius: 999px;
          }

          .vat-scroll::-webkit-scrollbar-thumb {
            background: #0c4a6e;
            border-radius: 999px;
          }

          .vat-scroll::-webkit-scrollbar-thumb:hover {
            background: #075985;
          }

          .vat-row-shell {
            min-width: ${normalizedMinWidth};
          }

          .vat-row-shell tr {
            height: ${rowHeight}px;
          }

          .vat-row-shell tr:hover td {
            background-color: #f8fafc;
          }
        `}
      </style>

      <table
        className={tableClassName}
        style={{ minWidth: normalizedMinWidth, tableLayout: "auto" }}
      >
        {renderHeader?.()}
      </table>

      {loading ? (
        <table
          className={tableClassName}
          style={{ minWidth: normalizedMinWidth, tableLayout: "auto" }}
        >
          <tbody>
            {skeletonRows.map((_, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-3 py-3 sticky left-0 z-10 bg-white">
                  <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                </td>
                {Array.from({ length: 8 }).map((__, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3">
                    <div className="ml-auto h-3 w-20 rounded bg-slate-200 animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : rows.length === 0 ? (
        emptyState
      ) : (
        <List
          className="outline-none"
          defaultHeight={typeof listHeight === "number" ? listHeight : height}
          rowComponent={VirtualRow}
          rowCount={rows.length}
          rowHeight={rowHeight}
          rowProps={{ rows, renderRow, minWidth: normalizedMinWidth }}
          overscanCount={overscanCount}
          style={{ height: listHeight, minWidth: normalizedMinWidth }}
        />
      )}

      {renderFooter && (
        <table
          className={tableClassName}
          style={{ minWidth: normalizedMinWidth, tableLayout: "auto" }}
        >
          {renderFooter()}
        </table>
      )}
    </div>
  );
}
