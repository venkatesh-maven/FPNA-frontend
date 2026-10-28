import React, { useState, useRef, useEffect } from "react";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline Growth",
  MODERATE_GROWTH: "Moderate Sales Growth",
  HIGH_GROWTH: "High Sales Growth",
};

const RISK_LEVEL = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for sales-driven budgeting
const initialSalesData = [
  {
    department: "Marketing", category: "Demand Generation", linkedSalesPipeline: "Enterprise New Business", originalBudget: 250000,
    [SCENARIOS.BASELINE]:        { projectedSalesGrowth: 10, aiBudgetIncrease: 25000, userOverride: 25000, roiRisk: RISK_LEVEL.LOW, aiInsight: "Standard 1:1 budget scaling with sales growth." },
    [SCENARIOS.MODERATE_GROWTH]: { projectedSalesGrowth: 15, aiBudgetIncrease: 45000, userOverride: 45000, roiRisk: RISK_LEVEL.MED, aiInsight: "Requires a higher ratio (1:1.2) to capture additional market share." },
    [SCENARIOS.HIGH_GROWTH]:     { projectedSalesGrowth: 25, aiBudgetIncrease: 87500, userOverride: 87500, roiRisk: RISK_LEVEL.HIGH, aiInsight: "Aggressive 1:1.4 scaling needed to saturate market and support high growth." },
  },
  {
    department: "Sales", category: "Sales Team Headcount", linkedSalesPipeline: "Enterprise New Business", originalBudget: 600000,
    [SCENARIOS.BASELINE]:        { projectedSalesGrowth: 10, aiBudgetIncrease: 60000, userOverride: 60000, roiRisk: RISK_LEVEL.LOW, aiInsight: "Linear headcount increase to manage new lead volume." },
    [SCENARIOS.MODERATE_GROWTH]: { projectedSalesGrowth: 15, aiBudgetIncrease: 90000, userOverride: 90000, roiRisk: RISK_LEVEL.LOW, aiInsight: "Linear headcount increase." },
    [SCENARIOS.HIGH_GROWTH]:     { projectedSalesGrowth: 25, aiBudgetIncrease: 180000, userOverride: 180000, roiRisk: RISK_LEVEL.MED, aiInsight: "Requires adding a new sales pod, increasing management overhead." },
  },
  {
    department: "Operations", category: "Inventory & COGS", linkedSalesPipeline: "SMB Product Line", originalBudget: 400000,
    [SCENARIOS.BASELINE]:        { projectedSalesGrowth: 8, aiBudgetIncrease: 32000, userOverride: 32000, roiRisk: RISK_LEVEL.LOW, aiInsight: "COGS scales directly with sales volume." },
    [SCENARIOS.MODERATE_GROWTH]: { projectedSalesGrowth: 12, aiBudgetIncrease: 48000, userOverride: 48000, roiRisk: RISK_LEVEL.LOW, aiInsight: "Direct cost scaling." },
    [SCENARIOS.HIGH_GROWTH]:     { projectedSalesGrowth: 20, aiBudgetIncrease: 80000, userOverride: 80000, roiRisk: RISK_LEVEL.LOW, aiInsight: "Direct cost scaling." },
  },
];

const SalesGrowthBudgetAdjustments = () => {
  const [activeTab, setActiveTab] = useState("adjustments");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [salesData, setSalesData] = useState(JSON.parse(JSON.stringify(initialSalesData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes a direct, linear relationship between sales growth and budget expansion for variable-spend departments like Marketing and Sales.",
    [SCENARIOS.MODERATE_GROWTH]: "Applies a 1.2x multiplier to Marketing spend to capture additional market share in a moderately growing market.",
    [SCENARIOS.HIGH_GROWTH]: "Applies an aggressive 1.4x multiplier to Marketing and a 1.2x multiplier to Sales headcount to support and drive rapid expansion.",
  });

  const [salesVersions, setSalesVersions] = useState([]);
  const [salesTotals, setSalesTotals] = useState({});
  const filtersRef = useRef(null);
  
  const HISTORICAL_SALES = 8000000;

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { projectedSalesGrowth: 0, aiBudgetIncrease: 0, userOverride: 0, roiRisk: RISK_LEVEL.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { originalBudget: 0, userAdjustments: 0, weightedSalesGrowth: 0, byGrowthDriver: {}, byDept: {} };
    if (!data || data.length === 0) return totals;
    
    let totalBudgetWeight = 0;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const finalBudget = item.originalBudget + scenarioData.userOverride;

      totals.originalBudget += item.originalBudget;
      totals.userAdjustments += scenarioData.userOverride;
      totals.weightedSalesGrowth += scenarioData.projectedSalesGrowth * item.originalBudget;
      totalBudgetWeight += item.originalBudget;
      
      if (!totals.byGrowthDriver[item.linkedSalesPipeline]) totals.byGrowthDriver[item.linkedSalesPipeline] = 0;
      totals.byGrowthDriver[item.linkedSalesPipeline] += finalBudget;

      if (!totals.byDept[item.department]) totals.byDept[item.department] = 0;
      totals.byDept[item.department] += scenarioData.userOverride;
    });
    
    totals.weightedSalesGrowth = totalBudgetWeight > 0 ? totals.weightedSalesGrowth / totalBudgetWeight : 0;
    
    return totals;
  };

  useEffect(() => {
    setSalesTotals(calculateTotalsForScenario(salesData, activeScenario));
  }, [salesData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setSalesData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      const parsedValue = parseFloat(value) || 0;
      scenarioItem[field] = parsedValue;

      if (field === 'projectedSalesGrowth') {
        const aiIncrease = (newData[index].originalBudget * parsedValue / 100) * (activeScenario === SCENARIOS.HIGH_GROWTH ? 1.4 : 1);
        scenarioItem.aiBudgetIncrease = aiIncrease;
        scenarioItem.userOverride = aiIncrease;
      }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
      totalsByScenario[scen] = calculateTotalsForScenario(salesData, scen);
    });
    setSalesVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(salesData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Sales growth model saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = salesData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Department': item.department, 'Category': item.category,
        'Linked Sales Pipeline': item.linkedSalesPipeline, 'Projected Sales Growth (%)': scenarioData.projectedSalesGrowth,
        'User Override Adjustment': scenarioData.userOverride, 'Final Budget': item.originalBudget + scenarioData.userOverride,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Sales Growth Budget`);
    XLSX.writeFile(workbook, `Sales_Growth_Budget_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(salesData.map(d => [`${d.department}-${d.category}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Category']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.projectedSalesGrowth = row['Projected Sales Growth (%)'] ?? scenarioItem.projectedSalesGrowth;
          scenarioItem.userOverride = row['User Override Adjustment'] ?? scenarioItem.userOverride;
          dataMap.set(key, itemToUpdate);
        }
      });
      setSalesData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review AI suggestions.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setSalesData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getRiskColor = (level) => {
    if (level === RISK_LEVEL.HIGH) return "bg-red-100 text-red-800 border-red-300";
    if (level === RISK_LEVEL.MED) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-green-100 text-green-800 border-green-300";
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(salesTotals.byGrowthDriver || {}),
    datasets: [{ label: 'Budget by Growth Driver', data: Object.values(salesTotals.byGrowthDriver || {}), backgroundColor: 'rgba(16, 185, 129, 0.7)' }],
  };
  const pieChartData = {
    labels: Object.keys(salesTotals.byDept || {}),
    datasets: [{ data: Object.values(salesTotals.byDept || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444'], hoverOffset: 4 }],
  };
  const lineChartData = {
    labels: ['Previous Period', 'Forecasted Period'],
    datasets: [
        { label: 'Sales', yAxisID: 'y', data: [HISTORICAL_SALES, HISTORICAL_SALES * (1 + (salesTotals.weightedSalesGrowth || 0) / 100)], borderColor: 'rgba(16, 185, 129, 1)'},
        { label: 'Budget', yAxisID: 'y1', data: [salesTotals.originalBudget, salesTotals.originalBudget + salesTotals.userAdjustments], borderColor: 'rgba(59, 130, 246, 1)'},
    ]
  };
  const lineChartOptions = { ...chartOptions, scales: { y: { position: 'left', title: {display: true, text: 'Sales ($)'} }, y1: { position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'Budget ($)'} } } };
  
  const finalBudget = (salesTotals.originalBudget || 0) + (salesTotals.userAdjustments || 0);
  const finalSales = HISTORICAL_SALES * (1 + (salesTotals.weightedSalesGrowth || 0) / 100);

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Sales Growth-Linked Budget Adjustments</h1><p className="text-sky-100 text-x">Dynamically update budgets based on revenue performance.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'adjustments', label: 'Dynamic Adjustments'}, {id: 'import', label: 'Import Performance'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
          <button key={tab.id} className={`py-2 px-4 font-medium text-s ${activeTab === tab.id ? 'text-sky-50 border-b-2 border-sky-600 bg-sky-800 rounded-t-lg' : 'text-sky-900 hover:text-sky-500 hover:bg-sky-100 rounded-t-lg'}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
        <div className="ml-4">
            <label className="text-s font-medium text-sky-800 mr-2">Active Scenario:</label>
            <select value={activeScenario} onChange={(e) => { if(hasChanges && !window.confirm("Unsaved changes. Switch anyway?")) return; setActiveScenario(e.target.value); setHasChanges(false); }} className="p-1.5 border border-sky-300 bg-white text-sky-900 rounded-md text-x">
                {Object.values(SCENARIOS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
        <div className="relative ml-auto" ref={filtersRef}><button className="py-2 px-3 text-gray-500 hover:text-blue-500 flex items-center text-s"><BsFilter className="mr-1" /> Filters</button></div>
      </div>
      
      <div>
        {activeTab === 'adjustments' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Forecasted Sales Growth</p><p className="text-2xl font-bold text-green-600">{(salesTotals?.weightedSalesGrowth || 0).toFixed(1)}%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">AI-Driven Budget Adjustments</p><p className="text-2xl font-bold text-sky-900">${(salesTotals?.userAdjustments || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Spend as % of Sales</p><p className="text-2xl font-bold text-sky-900">{finalSales > 0 ? ((finalBudget / finalSales) * 100).toFixed(getDecimalPrecision()) : 0}%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Sales vs. Budget Growth Trend</h2><div className="h-[250px]"><Line data={lineChartData} options={lineChartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget by Growth Driver</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions} /></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Scaled by Dept</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' }}}} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Growth-Linked Budget Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department / Category</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Linked Sales Pipeline</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Sales Growth (%)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">AI Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Final Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {salesData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const finalBudget = item.originalBudget + scenarioData.userOverride;
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.department}</div><div className="text-x text-sky-600">{item.category}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">{item.linkedSalesPipeline}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.projectedSalesGrowth} onChange={(e) => handleInputChange(index, 'projectedSalesGrowth', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiBudgetIncrease.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${finalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center"><span className={`text-x font-bold px-2 py-1 rounded-full border ${getRiskColor(scenarioData.roiRisk)}`}>{scenarioData.roiRisk}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Growth Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Sales drivers, pipeline reliability...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Sales Performance Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with sales forecasts to drive budget adjustments.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Category', 'Projected Sales Growth (%)', and 'User Override Adjustment'.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Growth Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Sales Growth', 'Total Final Budget', 'Total Adjustment', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(salesData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Sales Growth') { value = `${(totals.weightedSalesGrowth || 0).toFixed(1)}%`; className = "text-s font-semibold text-green-600"; }
                        else if (metric === 'Total Final Budget') { value = `$${(totals.originalBudget + totals.userAdjustments).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total Adjustment') { value = `$${(totals.userAdjustments || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${(totals.userAdjustments || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`; }
                        else if (metric === 'Assumptions') { value = scenarioAssumptions[scenarioName] || 'N/A'; className = "text-x text-gray-600 whitespace-pre-wrap max-w-xs"; }
                        return <td key={`${metric}-${scenarioName}`} className={`px-5 py-4 ${className}`}>{value}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Model Version History</h2>
          {salesVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Final Budget</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {salesVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { originalBudget: 0, userAdjustments: 0 };
                        const finalBudget = total.originalBudget + total.userAdjustments;
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${finalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      })}
                      <td className="px-4 py-3"><button onClick={() => handleRestoreVersion(version)} className="text-s text-sky-700 hover:text-sky-900 hover:underline">Restore</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesGrowthBudgetAdjustments;