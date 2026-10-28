import React from "react";
import { FiAlertCircle } from "react-icons/fi";
import AppCard from "../../components/ui/AppCard";

const ReportTable = ({
  data,
  loading,
  error,
  onDrillDown,
  formatValue = (key, value) => value,
}) => {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-sky-500" />
      </div>
    );
  }

  if (error) {
    return (
      <AppCard className="rounded-lg border-red-200 bg-red-50" hover={false}>
        <div className="flex items-center text-red-700">
          <FiAlertCircle className="mr-2" />
          <p>{error}</p>
        </div>
      </AppCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <AppCard className="py-8 text-center text-gray-500" hover={false}>
        <FiAlertCircle className="mx-auto mb-2 h-12 w-12 text-gray-400" />
        <p>No data available</p>
        <p className="mt-1 text-s">Try selecting different filter options</p>
      </AppCard>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="report-table-scroll max-h-96 overflow-auto rounded-xl border border-sky-200 bg-white">
      <table className="w-full text-x">
        <thead className="sticky top-0 z-20 bg-sky-900 text-white">
          <tr>
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 text-left capitalize">
                {col.replace(/_/g, " ").replace(/([A-Z])/g, " $1")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={index}
              className="cursor-pointer border-b border-sky-200 hover:bg-sky-50"
              onClick={() => onDrillDown && onDrillDown(row)}
            >
              {columns.map((col) => {
                const value = row[col];
                let cellClass = "whitespace-nowrap px-3 py-2";

                if (typeof value === "number") {
                  if (value < 0) {
                    cellClass += " text-red-600";
                  } else if (col.includes("profit") || col.includes("revenue")) {
                    cellClass += " text-green-600";
                  } else {
                    cellClass += " text-sky-700";
                  }
                } else {
                  cellClass += " text-sky-900";
                }

                return (
                  <td key={col} className={cellClass}>
                    {formatValue(col, value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;
