import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CSVLink } from "react-csv";
import { FiFilter, FiDownload, FiPrinter } from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import AIChatbot from "./AIChatbot";

const timePeriods = [
  { id: "all", name: "All Periods" },
  { id: "current", name: "Current Month" },
  { id: "last", name: "Last Month" },
  { id: "qtd", name: "Quarter to Date" },
  { id: "ytd", name: "Year to Date" },
  { id: "custom", name: "Custom Range" },
];

const entities = [
  { id: "all", name: "All Entities" },
  { id: "ny", name: "New York Branch" },
  { id: "sf", name: "San Francisco Branch" },
  { id: "tx", name: "Texas Branch" },
];

const hierarchies = [
  { id: "group", name: "Group Level" },
  { id: "department", name: "Department Level" },
  { id: "product", name: "Product Level" },
];

const ReportFilters = ({
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  currentReport,
  filteredData,
  selectedReport,
  showAIDropdown,
  setShowAIDropdown,
  aiInputs,
  setAiInputs,
  aiHistory,
  handleSendAIQuery,
}) => {
  const filtersRef = React.useRef(null);

  return (
    <div className="mb-4 flex flex-wrap gap-2 justify-end items-center">
      <div className="flex gap-2">
        <div className="relative" ref={filtersRef}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg px-3 py-2 text-x">
            <FiFilter className="mr-2" /> Filter
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-sky-200 p-4 right-0">
                <div className="space-y-3">
                  <div>
                    <label className="block text-x font-medium text-sky-700 mb-1">
                      Time Period 
                    </label>
                    <select
                      value={filters.period}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          period: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-sky-300 rounded text-x">
                      {timePeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-x font-medium text-sky-700 mb-1">
                      Entity
                    </label>
                    <select
                      value={filters.entity}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          entity: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-sky-300 rounded text-x">
                      {entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-x font-medium text-sky-700 mb-1">
                      Hierarchy
                    </label>
                    <select
                      value={filters.hierarchy}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          hierarchy: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-sky-300 rounded text-x">
                      {hierarchies.map((hierarchy) => (
                        <option key={hierarchy.id} value={hierarchy.id}>
                          {hierarchy.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {filters.period === "custom" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-x font-medium text-sky-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={filters.customRange.start}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              customRange: {
                                ...filters.customRange,
                                start: e.target.value,
                              },
                            })
                          }
                          className="w-full p-2 border border-sky-300 rounded text-x"
                        />
                      </div>
                      <div>
                        <label className="block text-x font-medium text-sky-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={filters.customRange.end}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              customRange: {
                                ...filters.customRange,
                                end: e.target.value,
                              },
                            })
                          }
                          className="w-full p-2 border border-sky-300 rounded text-x"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex gap-2">
        <CSVLink
          data={filteredData.tableData || []}
          filename={`${currentReport?.title.replace(/\s+/g, "-")}.csv`}
          className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
          <FiDownload className="mr-1" /> CSV
        </CSVLink>
        <button
          onClick={() => window.print()}
          className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
          <FiPrinter className="mr-1" /> Print
        </button>
        
        <AIChatbot
          selectedReport={selectedReport}
          showAIDropdown={showAIDropdown}
          setShowAIDropdown={setShowAIDropdown}
          currentReport={currentReport}
          aiInputs={aiInputs}
          setAiInputs={setAiInputs}
          aiHistory={aiHistory}
          handleSendAIQuery={handleSendAIQuery}
        />
      </div>
    </div>
  );
};

export default ReportFilters;