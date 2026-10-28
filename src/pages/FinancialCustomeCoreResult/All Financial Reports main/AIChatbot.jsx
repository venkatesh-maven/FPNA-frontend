import React from "react";
import { motion } from "framer-motion";
import { FiSend } from "react-icons/fi";
import { BsStars } from "react-icons/bs";

const AIChatbot = ({
  selectedReport,
  showAIDropdown,
  setShowAIDropdown,
  currentReport,
  aiInputs,
  setAiInputs,
  aiHistory,
  handleSendAIQuery,
}) => {
  return (
    <div className="relative">
      <button
        onClick={() => setShowAIDropdown(selectedReport)}
        className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x">
        <BsStars className="mr-1" /> Ask AI
      </button>

      {showAIDropdown === selectedReport && currentReport && (
        <motion.div
          className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}>
          <h1 className="text-s font-semibold text-sky-900 mb-2">
            Ask about {currentReport.title}
          </h1>
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="text"
              value={aiInputs[selectedReport] || ""}
              onChange={(e) =>
                setAiInputs((prev) => ({
                  ...prev,
                  [selectedReport]: e.target.value,
                }))
              }
              placeholder="Ask AI about this report..."
              className="w-full p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSendAIQuery();
              }}
              className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
              disabled={!aiInputs[selectedReport]?.trim()}>
              <FiSend className="w-5 h-5" />
            </button>
          </div>
          {aiHistory[selectedReport]?.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
              {aiHistory[selectedReport].map((entry, index) => (
                <div key={index}>
                  <strong>Q:</strong> {entry.query}
                  <br />
                  <strong>A:</strong> {entry.response}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AIChatbot;