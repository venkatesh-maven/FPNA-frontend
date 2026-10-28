import React from "react";
import { reports } from "./reportData";

const ReportSidebar = ({ selectedReport, setSelectedReport, setDrillDownData }) => {
  return (
    <aside className="w-1/4 bg-white p-4 rounded-xl shadow-md">
      <h2 className="text-sky-800 text-md font-semibold mb-4">Reports</h2>
      <ul className="space-y-2">
        {reports.map((r) => (
          <li
            key={r.id}
            onClick={() => {
              setSelectedReport(r.id);
              setDrillDownData(null);
            }}
            className={`px-3 py-2 rounded-md text-s cursor-pointer transition ${
              selectedReport === r.id
                ? "bg-sky-100 text-sky-800 font-semibold"
                : "text-sky-700 hover:bg-sky-50"
            }`}>
            {r.title}
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default ReportSidebar;


