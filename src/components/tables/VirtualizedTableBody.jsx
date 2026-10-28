import React, { memo } from "react";
import { List } from "react-window";

const BodyRow = memo(({ ariaAttributes, index, style, rows, renderRow }) => {
  const row = renderRow(rows[index], index);

  return React.cloneElement(row, {
    ...ariaAttributes,
    style: {
      ...row.props.style,
      ...style,
      display: "table",
      tableLayout: "fixed",
      width: "100%",
    },
  });
});

BodyRow.displayName = "BodyRow";

export default function VirtualizedTableBody({
  rows = [],
  renderRow,
  rowHeight = 46,
  height = 480,
  overscanCount = 8,
  emptyState = null,
  className = "",
}) {
  if (!rows.length) {
    return <tbody>{emptyState}</tbody>;
  }

  return (
    <List
      tagName="tbody"
      className={className}
      defaultHeight={height}
      rowComponent={BodyRow}
      rowCount={rows.length}
      rowHeight={rowHeight}
      rowProps={{ rows, renderRow }}
      overscanCount={overscanCount}
      style={{
        display: "block",
        height: Math.min(height, rows.length * rowHeight),
        position: "relative",
      }}
    />
  );
}
