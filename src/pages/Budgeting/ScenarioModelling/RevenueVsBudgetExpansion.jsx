import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter, BsGraphUp } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Aggressive Growth",
  WORST_CASE: "Conservative Growth",
};

// Mock data for the model
const initialModelData = [
  {
    department: "Marketing", historicalBudget: 250000,
    [SCENARIOS.BASELINE]:    { revenueGrowthFactor: 10, aiBudgetAdjustment: 25000, userOverride: 25000, aiInsight: "1:10 ratio. 10% revenue growth requires a 10% budget increase to fuel demand gen." },
    [SCENARIOS.BEST_CASE]:   { revenueGrowthFactor: 20, aiBudgetAdjustment: 50000, userOverride: 50000, aiInsight: "Aggressive 20% growth target requires doubling down on marketing spend." },
    [SCENARIOS.WORST_CASE]:  { revenueGrowthFactor: 5,  aiBudgetAdjustment: 10000, userOverride: 10000, aiInsight: "Conservative growth allows for more efficient marketing spend." },
  },
  {
    department: "R&D", historicalBudget: 400000,
    [SCENARIOS.BASELINE]:    { revenueGrowthFactor: 10, aiBudgetAdjustment: 20000, userOverride: 20000, aiInsight: "Scaling requires a 5% budget increase for new feature development." },
    [SCENARIOS.BEST_CASE]:   { revenueGrowthFactor: 20, aiBudgetAdjustment: 60000, userOverride: 60000, aiInsight: "Accelerated roadmap to support high growth requires a 15% budget lift." },
    [SCENARIOS.WORST_CASE]:  { revenueGrowthFactor: 5,  aiBudgetAdjustment: 0, userOverride: 0, aiInsight: "Focus on core product; new R&D initiatives are paused." },
  },
  {
    department: "Operations", historicalBudget: 150000,
    [SCENARIOS.BASELINE]:    { revenueGrowthFactor: 10, aiBudgetAdjustment: 7500, userOverride: 7500, aiInsight: "Support and infrastructure costs scale at 50% of revenue growth." },
    [SCENARIOS.BEST_CASE]:   { revenueGrowthFactor: 20, aiBudgetAdjustment: 15000, userOverride: 15000, aiInsight: "Higher transaction volume requires more support staff and server capacity." },
    [SCENARIOS.WORST_CASE]:  { revenueGrowthFactor: 5,  aiBudgetAdjustment: 3750, userOverride: 3750, aiInsight: "Slower growth leads to more modest scaling costs." },
  },
  {
    department: "G&A", historicalBudget: 120000,
    [SCENARIOS.BASELINE]:    { revenueGrowthFactor: 10, aiBudgetAdjustment: 6000, userOverride: 6000, aiInsight: "Administrative overhead increases slightly with company size." },
    [SCENARIOS.BEST_CASE]:   { revenueGrowthFactor: 20, aiBudgetAdjustment: 12000, userOverride: 12000, aiInsight: "Requires additional legal and finance support for a larger organization." },
    [SCENARIOS.WORST_CASE]:  { revenueGrowthFactor: 5,  aiBudgetAdjustment: 0, userOverride: 0, aiInsight: "No increase needed for conservative growth." },
  },
];

const RevenueVsBudgetExpansion = () => {
  const [activeTab, setActiveTab] = useState("model");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [modelData, setModelData] = useState(JSON.parse(JSON.stringify(initialModelData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes linear scaling. Marketing and Ops budgets grow at a defined percentage of revenue growth, while R&D and G&A are less correlated.",
    [SCENARIOS.BEST_CASE]: "Aggressive investment model. R&D and Marketing budgets are scaled up disproportionately to capture market share and build new products.",
    [SCENARIOS.WORST_CASE]: "Conservative, margin-focused model. Budget expansion is strictly controlled and kept below the rate of revenue growth to improve profitability.",
  });

  const [modelVersions, setModelVersions] = useState([]);
  const [modelTotals, setModelTotals] = useState({});
  const filtersRef = useRef(null);
  
  const HISTORICAL_REVENUE = 5000000; // A base revenue figure for calculations

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { revenueGrowthFactor: 0, aiBudgetAdjustment: 0, userOverride: 0, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { historicalBudget: 0, userFinalBudget: 0, byDepartment: {}, totalRevenueGrowthFactor: 0 };
    if (!data || data.length === 0) return totals;
    let totalWeight = 0;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const finalBudget = item.historicalBudget + scenarioData.userOverride;
      
      totals.historicalBudget += item.historicalBudget;
      totals.userFinalBudget += finalBudget;
      totals.totalRevenueGrowthFactor += scenarioData.revenueGrowthFactor * item.historicalBudget;
      totalWeight += item.historicalBudget;

      totals.byDepartment[item.department] = { historical: item.historicalBudget, final: finalBudget };
    });
    
    totals.totalRevenueGrowthFactor = totalWeight > 0 ? totals.totalRevenueGrowthFactor / totalWeight : 0;
    
    return totals;
  };

  useEffect(() => {
    setModelTotals(calculateTotalsForScenario(modelData, activeScenario));
  }, [modelData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setModelData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData[index][activeScenario][field] = parseFloat(value) || 0;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(modelData, scen);
    });
    setModelVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(modelData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Model version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = modelData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      const finalBudget = item.historicalBudget + scenarioData.userOverride;
      return {
        'Department': item.department,
        'Historical Budget': item.historicalBudget,
        'Revenue Growth Factor (%)': scenarioData.revenueGrowthFactor,
        'AI Suggested Budget Adjustment': scenarioData.aiBudgetAdjustment,
        'User Override': scenarioData.userOverride,
        'Final Budget': finalBudget,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Revenue vs Budget Model`);
    XLSX.writeFile(workbook, `RevenueVsBudget_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(modelData.map(d => [d.department, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const dept = row['Department'];
        if (dataMap.has(dept)) {
          const itemToUpdate = dataMap.get(dept);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userOverride = row['User Override'] ?? scenarioItem.userOverride;
          scenarioItem.revenueGrowthFactor = row['Revenue Growth Factor (%)'] ?? scenarioItem.revenueGrowthFactor;
          dataMap.set(dept, itemToUpdate);
        }
      });
      setModelData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review AI suggestions.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setModelData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const lineChartData = {
    labels: ['Last Year', 'This Year (Forecast)'],
    datasets: [
      { label: 'Revenue', data: [HISTORICAL_REVENUE, HISTORICAL_REVENUE * (1 + (modelTotals.totalRevenueGrowthFactor || 0) / 100)], borderColor: 'rgba(16, 185, 129, 1)', tension: 0.1, yAxisID: 'y' },
      { label: 'Budget', data: [modelTotals.historicalBudget, modelTotals.userFinalBudget], borderColor: 'rgba(59, 130, 246, 1)', tension: 0.1, yAxisID: 'y1' },
    ]
  };
  const lineChartOptions = { ...chartOptions, scales: { y: { position: 'left', title: {display: true, text: 'Revenue ($)'} }, y1: { position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'Budget ($)'} } } };
  
  const barChartData = {
    labels: Object.keys(modelTotals.byDepartment || {}),
    datasets: [
        { label: 'Historical Budget', data: Object.values(modelTotals.byDepartment || {}).map(d => d.historical), backgroundColor: 'rgba(156, 163, 175, 0.7)' },
        { label: 'Final Budget', data: Object.values(modelTotals.byDepartment || {}).map(d => d.final), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
    ]
  };

  const finalRevenue = HISTORICAL_REVENUE * (1 + (modelTotals.totalRevenueGrowthFactor || 0) / 100);
  const budgetExpansionRate = modelTotals.historicalBudget > 0 ? ((modelTotals.userFinalBudget - modelTotals.historicalBudget) / modelTotals.historicalBudget * 100) : 0;
  
  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Breadcrumb Navigation */}
            <nav className="flex mb-4" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                <li className="inline-flex items-center">
                  <Link
                    to="/"
                    className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
                    <svg
                      className="w-3 h-3 me-2.5"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 20 20">
                      <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z" />
                    </svg>
                    Home
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                    <Link
                      to="/scenario-modelling-budgeting"
                      className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                      Scenario Modelling
                    </Link>
                  </div>
                </li>
                <li aria-current="page">
                  <div className="flex items-center">
                    <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                    <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                      Revenue vs. Budget Expansion
                    </span>
                  </div>
                </li>
              </ol>
            </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Revenue Growth vs. Budget Expansion</h1><p className="text-sky-100 text-x">How does increasing revenue impact budget needs?</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'model', label: 'Model Revenue-Driven Budgets'}, {id: 'import', label: 'Import Models'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'model' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Revenue Growth %</p><p className="text-2xl font-bold text-green-600">{(modelTotals.totalRevenueGrowthFactor || 0).toFixed(1)}%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Budget Expansion Rate %</p><p className={`text-2xl font-bold ${budgetExpansionRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>{budgetExpansionRate.toFixed(1)}%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Budget-to-Revenue Ratio</p><p className="text-2xl font-bold text-sky-900">{finalRevenue > 0 ? ((modelTotals.userFinalBudget / finalRevenue) * 100).toFixed(1) : 0}%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Revenue vs. Budget Growth</h2><div className="h-[250px]"><Line data={lineChartData} options={lineChartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Allocation by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">What-If Modeling Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Model</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Historical Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Revenue Growth (%)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Final Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {modelData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const finalBudget = item.historicalBudget + scenarioData.userOverride;
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>{item.department}</td>
                            <td className="px-2 py-1 text-center text-s">${item.historicalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.revenueGrowthFactor} onChange={(e) => handleInputChange(index, 'revenueGrowthFactor', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiBudgetAdjustment.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${finalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(modelTotals.historicalBudget || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td colSpan={2}></td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${((modelTotals.userFinalBudget || 0) - (modelTotals.historicalBudget || 0)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-lg text-center text-sky-900">${(modelTotals.userFinalBudget || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Revenue & Margin Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Margin expectations, scaling logic...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Revenue/Budget Models</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your model data. Match by 'Department'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Revenue Growth Factor (%)', and 'User Override' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Model Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Final Budget', 'Historical Budget', 'Budget Expansion', 'Revenue Growth', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(modelData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Final Budget') { value = `$${(totals.userFinalBudget || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Historical Budget') { value = `$${(totals.historicalBudget || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Budget Expansion') { const expansion = totals.userFinalBudget - totals.historicalBudget; value = `$${expansion.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${expansion >= 0 ? 'text-red-600' : 'text-green-600'}`; }
                        else if (metric === 'Revenue Growth') { value = `${(totals.totalRevenueGrowthFactor || 0).toFixed(1)}%`; className = "text-s font-semibold text-green-600"; }
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
          {modelVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
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
                  {modelVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userFinalBudget || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default RevenueVsBudgetExpansion;