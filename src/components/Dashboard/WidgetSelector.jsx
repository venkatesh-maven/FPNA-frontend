import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import { toast } from "react-toastify";

const chartTypes = [
  "bar_chart",
  "line_chart",
  "pie_chart",
  "Doughnut_Chart",
  "bubble_chart",
  "area_chart",
  "radar_chart"
];
 
const WidgetSelector = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  loading,
  error 
}) => {
  const [widgetData, setWidgetData] = useState({
    widgetName: "",
    chartType: "bar_chart",
    chartEnableOrDisable: true
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setWidgetData({
      ...widgetData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(widgetData);
      toast.success("Widget added successfully!");
      onClose();
      setWidgetData({
        widgetName: "",
        chartType: "bar_chart",
        chartEnableOrDisable: true
      });
    } catch (err) {
      // toast.error( "Failed to add widget");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Add New Widget</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={20} />
          </button>
        </div>
        
        <form onSubmit={handleFormSubmit}>
          <div className="mb-4">
            <label className="block text-s font-medium text-gray-700 mb-1">
              Widget Name
            </label>
            <input
              type="text"
              name="widgetName"
              value={widgetData.widgetName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-s font-medium text-gray-700 mb-1">
              Chart Type
            </label>
            <select
              name="chartType"
              value={widgetData.chartType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
            >
              {chartTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              name="chartEnableOrDisable"
              checked={widgetData.chartEnableOrDisable}
              onChange={handleInputChange}
              className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-s text-gray-700">
              Enable Widget
            </label>
          </div>
          
          {/* {error && (
            <div className="mb-4 text-red-500 text-s">{error}</div>
          )} */}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-s font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-s font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Widget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WidgetSelector;