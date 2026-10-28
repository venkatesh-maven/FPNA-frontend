import React from "react";
import { FiAlertCircle } from "react-icons/fi";

const DrillDownView = ({ drillDownData, setDrillDownData }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-sky-900">{drillDownData.title}</h3>
        <button
          onClick={() => setDrillDownData(null)}
          className="text-s text-sky-600 hover:text-sky-800">
          Back to Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-sky-50 rounded-lg p-4">
          <h4 className="text-s font-medium text-sky-800 mb-3">Details</h4>
          <table className="w-full text-s">
            <tbody>
              {drillDownData.data.map((item, index) => (
                <tr key={index} className="border-b border-sky-100">
                  <td className="py-2 font-medium text-sky-900 capitalize">
                    {item.field.replace(/([A-Z])/g, " $1")}
                  </td>
                  <td className={`py-2 text-right ${
                    typeof item.value === "string" && item.value.includes("-$")
                      ? "text-red-600"
                      : typeof item.value === "string" && item.value.includes("$")
                      ? "text-green-600"
                      : ""
                  }`}>
                    {item.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-sky-50 rounded-lg p-4">
          <h4 className="text-s font-medium text-sky-800 mb-3">Insights</h4>
          <ul className="space-y-3 text-s">
            {drillDownData.insights.map((insight, index) => (
              <li key={index} className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 text-sky-500">
                  <FiAlertCircle className="h-full w-full" />
                </div>
                <p className="ml-2 text-gray-700">{insight}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DrillDownView;