import React from "react";

const ReportTable = ({ filteredData, handleDrillDown, formatValue }) => {
  if (!filteredData || !filteredData.tableData) return <p>No data available</p>;

  const columns = Object.keys(filteredData.tableData[0] || {});

  return (
    <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100 max-h-96">
      <table className="w-full text-x">
        <thead>
          <tr className="bg-sky-100 text-sky-900">
            {columns.map((col) => (
              <th key={col} className="px-2 py-1 text-left capitalize">
                {col.replace(/([A-Z])/g, " $1")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.tableData.map((row, index) => (
            <tr
              key={index}
              className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
              onClick={() => handleDrillDown(row)}>
              {columns.map((col) => (
                <td
                  key={col}
                  className={`px-2 py-1 ${
                    typeof row[col] === "number"
                      ? row[col] < 0
                        ? "text-red-600"
                        : "text-green-600"
                      : ""
                  }`}>
                  {formatValue(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;