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
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Aggressive Reduction",
  WORST_CASE: "Conservative Reduction",
};

const RISK_LEVEL = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for cost-cutting scenarios
const initialCostData = [
  {
    department: "Marketing", category: "Ad Spend", originalBudget: 200000,
    [SCENARIOS.BASELINE]:      { reductionTarget: 10, aiAdjusted: 180000, userOverride: 180000, impact: "Lead volume may decrease by 8-12%", risk: RISK_LEVEL.MED, aiInsight: "Reduces spend on lower-performing channels with minimal impact on MQLs." },
    [SCENARIOS.BEST_CASE]:     { reductionTarget: 20, aiAdjusted: 160000, userOverride: 160000, impact: "Lead volume may decrease by 20-25%", risk: RISK_LEVEL.HIGH, aiInsight: "Aggressive cut. Focuses only on top 2 channels. High risk to pipeline." },
    [SCENARIOS.WORST_CASE]:    { reductionTarget: 5,  aiAdjusted: 190000, userOverride: 190000, impact: "Lead volume may decrease by 3-5%", risk: RISK_LEVEL.LOW, aiInsight: "Minor efficiency gain by trimming lowest ROI keywords." },
  },
  {
    department: "IT", category: "SaaS Licenses", originalBudget: 80000,
    [SCENARIOS.BASELINE]:      { reductionTarget: 15, aiAdjusted: 68000, userOverride: 68000, impact: "No direct impact if unused licenses are cut.", risk: RISK_LEVEL.LOW, aiInsight: "AI identified 18 inactive user seats across 3 platforms." },
    [SCENARIOS.BEST_CASE]:     { reductionTarget: 25, aiAdjusted: 60000, userOverride: 60000, impact: "Tool consolidation may slow some workflows.", risk: RISK_LEVEL.MED, aiInsight: "Eliminates redundant tool B, migrating users to tool A." },
    [SCENARIOS.WORST_CASE]:    { reductionTarget: 5,  aiAdjusted: 76000, userOverride: 76000, impact: "No impact.", risk: RISK_LEVEL.LOW, aiInsight: "Cuts only confirmed inactive licenses." },
  },
  {
    department: "Operations", category: "Travel & Entertainment", originalBudget: 120000,
    [SCENARIOS.BASELINE]:      { reductionTarget: 20, aiAdjusted: 96000, userOverride: 96000, impact: "Reduced client face-time.", risk: RISK_LEVEL.MED, aiInsight: "Shifting to virtual meetings for non-critical client check-ins." },
    [SCENARIOS.BEST_CASE]:     { reductionTarget: 40, aiAdjusted: 72000, userOverride: 72000, impact: "Potential strain on client relationships.", risk: RISK_LEVEL.HIGH, aiInsight: "Limits travel to only the top 10 strategic accounts." },
    [SCENARIOS.WORST_CASE]:    { reductionTarget: 10, aiAdjusted: 108000, userOverride: 108000, impact: "Minimal impact on client relations.", risk: RISK_LEVEL.LOW, aiInsight: "Reduces internal travel, preserves client-facing budget." },
  },
];

const CostCuttingScenarioTesting = () => {
  const [activeTab, setActiveTab] = useState("test");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [costData, setCostData] = useState(JSON.parse(JSON.stringify(initialCostData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "A balanced approach to cost-cutting, targeting non-essential spend while protecting core operations. Focus on efficiency gains.",
    [SCENARIOS.BEST_CASE]: "An aggressive, 'deep cut' scenario to maximize short-term cash preservation, accepting higher operational and revenue risks.",
    [SCENARIOS.WORST_CASE]: "A conservative approach, making only the most obvious, low-risk reductions. The primary goal is to avoid any disruption to business performance.",
  });

  const [costVersions, setCostVersions] = useState([]);
  const [costTotals, setCostTotals] = useState({ original: 0, userAdjusted: 0, byDepartment: {}, highRiskCount: 0 });
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { reductionTarget: 0, aiAdjusted: item.originalBudget, userOverride: item.originalBudget, impact: "N/A", risk: RISK_LEVEL.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { original: 0, userAdjusted: 0, byDepartment: {}, highRiskCount: 0 };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.original += item.originalBudget;
      totals.userAdjusted += scenarioData.userOverride;
      
      if (scenarioData.risk === RISK_LEVEL.HIGH) {
        totals.highRiskCount++;
      }
      
      if (!totals.byDepartment[item.department]) totals.byDepartment[item.department] = { original: 0, user: 0 };
      totals.byDepartment[item.department].original += item.originalBudget;
      totals.byDepartment[item.department].user += scenarioData.userOverride;
    });
    return totals;
  };

  useEffect(() => {
    setCostTotals(calculateTotalsForScenario(costData, activeScenario));
  }, [costData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setCostData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      const parsedValue = parseFloat(value) || 0;
      scenarioItem[field] = parsedValue;

      if (field === 'reductionTarget') {
          const newAiAdjusted = newData[index].originalBudget * (1 - (parsedValue / 100));
          scenarioItem.aiAdjusted = newAiAdjusted;
          scenarioItem.userOverride = newAiAdjusted;
      }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
      totalsByScenario[scen] = calculateTotalsForScenario(costData, scen);
    });
    setCostVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(costData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Cost-cutting scenario saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = costData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Department': item.department, 'Category': item.category,
        'Original Budget': item.originalBudget, 'Reduction Target (%)': scenarioData.reductionTarget,
        'Adjusted Budget': scenarioData.userOverride, 'Forecasted Impact': scenarioData.impact, 'Risk Level': scenarioData.risk,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Cost Cutting Plan`);
    XLSX.writeFile(workbook, `Cost_Cutting_Plan_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(costData.map(d => [`${d.department}-${d.category}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Category']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.reductionTarget = row['Reduction Target (%)'] ?? scenarioItem.reductionTarget;
          scenarioItem.userOverride = row['Adjusted Budget'] ?? scenarioItem.userOverride;
          dataMap.set(key, itemToUpdate);
        }
      });
      setCostData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Reduction plan for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setCostData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getRiskColor = (level) => {
    if (level === RISK_LEVEL.HIGH) return "bg-red-100 text-red-800 border-red-300";
    if (level === RISK_LEVEL.MED) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-green-100 text-green-800 border-green-300";
  };
  
  const riskToNumber = (level) => {
      if (level === RISK_LEVEL.HIGH) return 3;
      if (level === RISK_LEVEL.MED) return 2;
      return 1;
  }
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(costTotals.byDepartment || {}),
    datasets: [
        { label: 'Original Budget', data: Object.values(costTotals.byDepartment || {}).map(d => d.original), backgroundColor: 'rgba(156, 163, 175, 0.7)' },
        { label: 'Adjusted Budget', data: Object.values(costTotals.byDepartment || {}).map(d => d.user), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
    ]
  };
  
  const lineChartData = {
    labels: costData.map(d => d.category),
    datasets: [
        { label: 'Cost Savings ($)', yAxisID: 'y', data: costData.map(item => item.originalBudget - getScenarioDataItem(item, activeScenario).userOverride), borderColor: 'rgba(16, 185, 129, 1)', tension: 0.1 },
        { label: 'Risk Level', yAxisID: 'y1', data: costData.map(item => riskToNumber(getScenarioDataItem(item, activeScenario).risk)), borderColor: 'rgba(239, 68, 68, 1)', tension: 0.1 },
    ]
  };
  const lineChartOptions = { ...chartOptions, scales: { y: { position: 'left', title: {display: true, text: 'Savings ($)'} }, y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'Risk Level'}, ticks: { stepSize: 1, callback: (value) => { if(value === 1) return 'Low'; if(value === 2) return 'Med'; if(value === 3) return 'High'; return ''; }} } } };
  
  const totalReduction = (costTotals.original || 0) - (costTotals.userAdjusted || 0);
  
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
          Cost-Cutting Scenario Testing
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Cost-Cutting Scenario Testing</h1><p className="text-sky-100 text-x">What if we reduce marketing spend by 15%?</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'test', label: 'Test Scenarios'}, {id: 'import', label: 'Import Plans'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'test' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Cost Reduction</p><p className="text-2xl font-bold text-green-600">${totalReduction.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">AI Estimated Operations Impact</p><p className="text-2xl font-bold text-red-600">Medium</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Efficiency Score Improvement</p><p className="text-2xl font-bold text-green-600">+12.5%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Original vs. Adjusted Budgets</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Cost Savings vs. Risk</h2><div className="h-[250px]"><Line data={lineChartData} options={lineChartOptions}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Scenario Simulation Editor ({activeScenario})</h2>
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
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Original Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Reduction (%)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">AI Adjusted</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Override</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">Forecasted Impact</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {costData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.department}</div><div className="text-x text-sky-600">{item.category}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.originalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.reductionTarget} onChange={(e) => handleInputChange(index, 'reductionTarget', e.target.value)} className="w-20 p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiAdjusted.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-4 py-3 text-s text-left text-red-600">{scenarioData.impact}</td>
                            <td className="px-2 py-1 text-center"><span className={`text-x font-bold px-2 py-1 rounded-full border ${getRiskColor(scenarioData.risk)}`}>{scenarioData.risk}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(costTotals.original || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td colSpan={2}></td>
                            <td className="px-4 py-3 text-lg text-center text-sky-900">${(costTotals.userAdjusted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Reduction Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Rationale, constraints, performance tradeoffs...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Reduction Plans</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your cost-cutting targets. Match by 'Department' and 'Category'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Category', 'Reduction Target (%)', and 'User Override' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Cost-Cutting Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Cost Reduction', 'Final Budget', 'High-Risk Items', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(costData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        const reduction = totals.original - totals.userAdjusted;
                        if (metric === 'Total Cost Reduction') { value = `$${reduction.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-green-600"; }
                        else if (metric === 'Final Budget') { value = `$${totals.userAdjusted.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'High-Risk Items') { value = `${totals.highRiskCount} items`; className = "text-s font-semibold text-red-600"; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Scenario Version History</h2>
          {costVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Reduction</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {costVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { original: 0, userAdjusted: 0 };
                        const reduction = total.original - total.userAdjusted;
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-green-600">${reduction.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default CostCuttingScenarioTesting;