import React, { useState, useEffect } from "react";
import Chart from "react-apexcharts";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

// Sample metric configurations
const defaultMetrics = [
  {
    id: "revenuePerEmployee",
    title: "Revenue per Employee",
    type: "bar",
    enabled: true,
    series: [{ name: "Revenue/Employee", data: [50, 60, 70, 90, 100, 120] }],
    options: {
      chart: { type: "bar", toolbar: { show: false }, foreColor: "#0c4a6e" },
      colors: ["#0369a1"],
      xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] },
      plotOptions: { bar: { borderRadius: 4, columnWidth: "60%" } }
    }
  },
  {
    id: "marketingROI",
    title: "Marketing ROI",
    type: "line",
    enabled: true,
    series: [{ name: "ROI (%)", data: [30, 40, 45, 50, 49, 60] }],
    options: {
      chart: { type: "line", toolbar: { show: false }, foreColor: "#0c4a6e" },
      colors: ["#0284c7"],
      stroke: { width: 3, curve: "smooth" },
      markers: { size: 5 },
      xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] }
    }
  },
  {
    id: "costPerLead",
    title: "Cost per Lead",
    type: "area",
    enabled: true,
    series: [{ name: "Cost ($)", data: [20, 22, 24, 28, 30, 35] }],
    options: {
      chart: { type: "area", toolbar: { show: false }, foreColor: "#0c4a6e" },
      colors: ["#0ea5e9"],
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 }
      },
      xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] }
    }
  },
  {
    id: "profitability",
    title: "Profitability by Segment",
    type: "bar",
    enabled: true,
    series: [
      { name: "Product", data: [10, 15, 20, 25, 30] },
      { name: "Region", data: [5, 10, 15, 20, 25] },
      { name: "Business Unit", data: [8, 12, 18, 22, 28] }
    ],
    options: {
      chart: { type: "bar", stacked: true, toolbar: { show: false }, foreColor: "#0c4a6e" },
      colors: ["#0369a1", "#0284c7", "#0ea5e9"],
      plotOptions: { bar: { borderRadius: 4, columnWidth: "70%" } },
      xaxis: { categories: ["Q1", "Q2", "Q3", "Q4", "Q5"] }
    }
  }
];

// Available metric types for customization
const availableMetricTypes = [
  { id: "revenuePerEmployee", name: "Revenue per Employee", description: "Total revenue divided by number of employees" },
  { id: "marketingROI", name: "Marketing ROI", description: "Return on investment for marketing campaigns" },
  { id: "costPerLead", name: "Cost per Lead", description: "Total marketing spend divided by leads generated" },
  { id: "profitability", name: "Profitability by Segment", description: "Profit margins across different business segments" },
  { id: "customerLTV", name: "Customer Lifetime Value", description: "Average revenue per customer over their lifetime" },
  { id: "employeeProductivity", name: "Employee Productivity", description: "Output per employee by department" }
];

const KeyFinancialKPIs = () => {
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [newMetricType, setNewMetricType] = useState("");
  const [timeRange, setTimeRange] = useState("6M");
  const [viewMode, setViewMode] = useState("charts"); // 'charts' or 'table'

  // Load saved metrics from localStorage
  useEffect(() => {
    const savedMetrics = localStorage.getItem("financialKPIs");
    if (savedMetrics) {
      setMetrics(JSON.parse(savedMetrics));
    }
  }, []);

  // Save metrics to localStorage when they change
  useEffect(() => {
    localStorage.setItem("financialKPIs", JSON.stringify(metrics));
  }, [metrics]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(metrics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setMetrics(items);
  };

  const toggleMetric = (id) => {
    setMetrics(metrics.map(metric => 
      metric.id === id ? { ...metric, enabled: !metric.enabled } : metric
    ));
  };

  const removeMetric = (id) => {
    setMetrics(metrics.filter(metric => metric.id !== id));
  };

  const openEditModal = (metric) => {
    setEditingMetric(metric);
    setShowConfigModal(true);
  };

  const handleAddMetric = () => {
    if (!newMetricType) return;
    
    const template = availableMetricTypes.find(m => m.id === newMetricType);
    if (!template) return;

    const newMetric = {
      id: `${template.id}-${Date.now()}`,
      title: template.name,
      type: "bar",
      enabled: true,
      series: [{ name: template.name, data: Array(6).fill(0).map(() => Math.floor(Math.random() * 100)) }],
      options: {
        chart: { type: "bar", toolbar: { show: false }, foreColor: "#0c4a6e" },
        colors: ["#0369a1"],
        xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] }
      }
    };

    setMetrics([...metrics, newMetric]);
    setNewMetricType("");
    setShowConfigModal(false);
  };

  const updateMetricConfig = (updatedMetric) => {
    setMetrics(metrics.map(metric => 
      metric.id === updatedMetric.id ? updatedMetric : metric
    ));
    setShowConfigModal(false);
  };

  // Filter enabled metrics for display
  const enabledMetrics = metrics.filter(metric => metric.enabled);

  // Sample table data
  const kpiTableData = enabledMetrics.map(metric => ({
    metric: metric.title,
    value: metric.series[0].data[metric.series[0].data.length - 1],
    change: `${Math.floor(Math.random() * 20) - 5}%`,
    trend: Math.random() > 0.5 ? "up" : "down"
  }));

  return (
    <div className="space-y-6 p-4 min-h-screen bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Key Financial KPIs</h1>
            <p className="text-sky-100 mt-2">Performance metrics and financial indicators</p>
          </div>
          <div className="flex space-x-3">
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-white/20 text-white border border-white/30 rounded-md px-3 py-1 text-s focus:outline-none focus:ring-2 focus:ring-white"
            >
              <option value="3M">Last 3 Months</option>
              <option value="6M">Last 6 Months</option>
              <option value="12M">Last 12 Months</option>
              <option value="YTD">Year to Date</option>
            </select>
            <button 
              onClick={() => setViewMode(viewMode === "charts" ? "table" : "charts")}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-1 rounded-md text-s border border-white/30 transition-colors"
            >
              {viewMode === "charts" ? "Table View" : "Chart View"}
            </button>
            <button 
              onClick={() => setShowConfigModal(true)}
              className="bg-white text-sky-800 hover:bg-sky-100 px-4 py-1 rounded-md text-s font-medium shadow transition-colors"
            >
              Configure Metrics
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {enabledMetrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-sky-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-sky-800 font-medium">{metric.title}</h3>
              <button 
                onClick={() => openEditModal(metric)}
                className="text-sky-500 hover:text-sky-700 text-s"
              >
                Edit
              </button>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-sky-900">
                {metric.series[0].data[metric.series[0].data.length - 1]}
                {metric.title.includes("ROI") ? "%" : metric.title.includes("Cost") ? "$" : "k"}
              </span>
              <span className={`flex items-center text-s font-medium ${
                metric.series[0].data.slice(-1)[0] > metric.series[0].data.slice(-2)[0] 
                  ? "text-green-600" : "text-red-600"
              }`}>
                {Math.abs(metric.series[0].data.slice(-1)[0] - metric.series[0].data.slice(-2)[0])}%
                {metric.series[0].data.slice(-1)[0] > metric.series[0].data.slice(-2)[0] ? (
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts or Table View */}
      {viewMode === "charts" ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="metrics">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {enabledMetrics.map((metric, index) => (
                  <Draggable key={metric.id} draggableId={metric.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="bg-white rounded-xl shadow-sm p-6 border border-sky-100 relative"
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="absolute top-2 right-2 text-sky-400 hover:text-sky-600 cursor-move"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-semibold text-sky-900">{metric.title}</h3>
                          <button 
                            onClick={() => removeMetric(metric.id)}
                            className="text-red-500 hover:text-red-700 text-s"
                          >
                            Remove
                          </button>
                        </div>
                        <Chart
                          options={metric.options}
                          series={metric.series}
                          type={metric.type}
                          height={300}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden border border-sky-100">
          <div className="p-6 border-b border-sky-100 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-sky-900">Detailed KPI Breakdown</h3>
            <div className="text-s text-sky-600">
              Showing data for {timeRange === "3M" ? "last 3 months" : 
                             timeRange === "6M" ? "last 6 months" : 
                             timeRange === "12M" ? "last 12 months" : "year to date"}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-100">
              <thead className="bg-sky-50">
                <tr>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-700 uppercase tracking-wider">Metric</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-700 uppercase tracking-wider">Current Value</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-700 uppercase tracking-wider">Period Change</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-700 uppercase tracking-wider">Trend</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sky-100">
                {kpiTableData.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50"}>
                    <td className="px-6 py-4 whitespace-nowrap text-s font-medium text-sky-900">{item.metric}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-800">
                      {item.value}
                      {item.metric.includes("ROI") ? "%" : item.metric.includes("Cost") ? "$" : "k"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-x font-medium ${
                        item.trend === "up" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {item.change}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-800">
                      {item.trend === "up" ? (
                        <span className="inline-flex items-center">
                          <svg className="h-4 w-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Positive
                        </span>
                      ) : (
                        <span className="inline-flex items-center">
                          <svg className="h-4 w-4 text-red-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                          </svg>
                          Negative
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-800">
                      <button 
                        onClick={() => openEditModal(metrics.find(m => m.title === item.metric))}
                        className="text-sky-600 hover:text-sky-800 mr-3"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => removeMetric(metrics.find(m => m.title === item.metric).id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center border-b border-sky-100 pb-4 mb-4">
                <h2 className="text-xl font-semibold text-sky-900">
                  {editingMetric ? `Edit ${editingMetric.title}` : "Configure Metrics"}
                </h2>
                <button 
                  onClick={() => {
                    setShowConfigModal(false);
                    setEditingMetric(null);
                  }}
                  className="text-sky-500 hover:text-sky-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {editingMetric ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-s font-medium text-sky-700 mb-1">Metric Title</label>
                    <input
                      type="text"
                      value={editingMetric.title}
                      onChange={(e) => setEditingMetric({...editingMetric, title: e.target.value})}
                      className="w-full p-2 border border-sky-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-s font-medium text-sky-700 mb-1">Chart Type</label>
                    <select
                      value={editingMetric.type}
                      onChange={(e) => setEditingMetric({...editingMetric, type: e.target.value})}
                      className="w-full p-2 border border-sky-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
                    >
                      <option value="bar">Bar Chart</option>
                      <option value="line">Line Chart</option>
                      <option value="area">Area Chart</option>
                      <option value="pie">Pie Chart</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="px-4 py-2 border border-sky-300 rounded-md text-sky-700 hover:bg-sky-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateMetricConfig(editingMetric)}
                      className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-sky-900 mb-3">Add New Metric</h3>
                    <div className="flex space-x-3">
                      <select
                        value={newMetricType}
                        onChange={(e) => setNewMetricType(e.target.value)}
                        className="flex-1 p-2 border border-sky-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
                      >
                        <option value="">Select a metric to add</option>
                        {availableMetricTypes
                          .filter(type => !metrics.some(m => m.id.startsWith(type.id)))
                          .map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                      </select>
                      <button
                        onClick={handleAddMetric}
                        disabled={!newMetricType}
                        className={`px-4 py-2 rounded-md ${newMetricType ? 
                          "bg-sky-600 text-white hover:bg-sky-700" : 
                          "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-sky-900 mb-3">Current Metrics</h3>
                    <div className="space-y-2">
                      {metrics.map(metric => (
                        <div key={metric.id} className="flex items-center justify-between p-3 bg-sky-50 rounded-md">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={metric.enabled}
                              onChange={() => toggleMetric(metric.id)}
                              className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-sky-300 rounded"
                            />
                            <span className="ml-3 text-s font-medium text-sky-900">{metric.title}</span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditModal(metric)}
                              className="text-s text-sky-600 hover:text-sky-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeMetric(metric.id)}
                              className="text-s text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyFinancialKPIs;