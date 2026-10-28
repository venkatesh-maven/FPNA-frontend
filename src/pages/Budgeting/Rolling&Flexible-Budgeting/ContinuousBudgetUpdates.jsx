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
import { BsFilter, BsGraphUp, BsGraphDown } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "High-Performance",
  WORST_CASE: "Under-Performance",
};

const AI_CONFIDENCE = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for continuous budgeting
const initialBudgetData = [
  {
    department: "Marketing", originalBudget: 150000, actuals: 165000,
    [SCENARIOS.BASELINE]:      { aiUpdated: 155000, userAdjustment: 155000, confidence: AI_CONFIDENCE.HIGH, justification: "Increased ad spend due to strong MQL-to-SQL conversion.", aiInsight: "Performance is 10% over forecast. Recommend increasing budget to capitalize on momentum." },
    [SCENARIOS.BEST_CASE]:     { aiUpdated: 170000, userAdjustment: 170000, confidence: AI_CONFIDENCE.HIGH, justification: "Double down on high-performing channels.", aiInsight: "High performance justifies significant budget increase." },
    [SCENARIOS.WORST_CASE]:    { aiUpdated: 140000, userAdjustment: 140000, confidence: AI_CONFIDENCE.MED, justification: "Pull back budget due to rising CAC.", aiInsight: "Despite high actuals, ROI is decreasing." },
  },
  {
    department: "Engineering", originalBudget: 250000, actuals: 240000,
    [SCENARIOS.BASELINE]:      { aiUpdated: 245000, userAdjustment: 245000, confidence: AI_CONFIDENCE.HIGH, justification: "Cloud cost optimizations are paying off.", aiInsight: "Actuals are 4% under budget. Recommending a slight decrease to lock in savings." },
    [SCENARIOS.BEST_CASE]:     { aiUpdated: 240000, userAdjustment: 240000, confidence: AI_CONFIDENCE.HIGH, justification: "Reallocate savings to R&D.", aiInsight: "Savings can be re-invested." },
    [SCENARIOS.WORST_CASE]:    { aiUpdated: 250000, userAdjustment: 250000, confidence: AI_CONFIDENCE.LOW, justification: "Keep buffer for unexpected infra needs.", aiInsight: "Potential for cost spikes remains." },
  },
  {
    department: "Sales", originalBudget: 180000, actuals: 175000,
    [SCENARIOS.BASELINE]:      { aiUpdated: 178000, userAdjustment: 178000, confidence: AI_CONFIDENCE.MED, justification: "Slightly lower T&E spend than anticipated.", aiInsight: "Team is performing efficiently. A small reduction is safe." },
    [SCENARIOS.BEST_CASE]:     { aiUpdated: 185000, userAdjustment: 185000, confidence: AI_CONFIDENCE.MED, justification: "Invest in new sales enablement tool.", aiInsight: "High team performance suggests readiness for new tools." },
    [SCENARIOS.WORST_CASE]:    { aiUpdated: 170000, userAdjustment: 170000, confidence: AI_CONFIDENCE.HIGH, justification: "Reduce budget due to lower deal velocity.", aiInsight: "Pipeline shows a slowdown, reduce discretionary spend." },
  },
  {
    department: "HR", originalBudget: 80000, actuals: 90000,
    [SCENARIOS.BASELINE]:      { aiUpdated: 85000, userAdjustment: 85000, confidence: AI_CONFIDENCE.MED, justification: "Unplanned recruitment agency fees for critical hire.", aiInsight: "Actuals are over due to one-time event. Adjusting slightly." },
    [SCENARIOS.BEST_CASE]:     { aiUpdated: 80000, userAdjustment: 80000, confidence: AI_CONFIDENCE.LOW, justification: "Absorb overage, no change.", aiInsight: "Low confidence in recurring need." },
    [SCENARIOS.WORST_CASE]:    { aiUpdated: 90000, userAdjustment: 90000, confidence: AI_CONFIDENCE.HIGH, justification: "Increased hiring needs expected to continue.", aiInsight: "Market trends suggest more hiring pressure." },
  },
];

const ContinuousBudgetUpdates = () => {
  const [activeTab, setActiveTab] = useState("live");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [budgetData, setBudgetData] = useState(JSON.parse(JSON.stringify(initialBudgetData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Budgets are adjusted based on a 1:0.5 ratio of actual variance to forecast. Performance is stable.",
    [SCENARIOS.BEST_CASE]: "High-performance allows for aggressive re-investment. Budgets are increased at a 1:1 ratio to positive variance.",
    [SCENARIOS.WORST_CASE]: "Under-performance requires capital preservation. Budgets are reduced at a 1:1.2 ratio to negative variance.",
  });

  const [budgetVersions, setBudgetVersions] = useState([]);
  const [budgetTotals, setBudgetTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { aiUpdated: item.originalBudget, userAdjustment: item.originalBudget, confidence: AI_CONFIDENCE.LOW, justification: "", aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { original: 0, actuals: 0, aiUpdated: 0, userAdjusted: 0, adjustmentsCount: 0, byDepartment: {} };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.original += item.originalBudget;
      totals.actuals += item.actuals;
      totals.aiUpdated += scenarioData.aiUpdated;
      totals.userAdjusted += scenarioData.userAdjustment;
      if (item.originalBudget !== scenarioData.userAdjustment) {
        totals.adjustmentsCount++;
      }
      totals.byDepartment[item.department] = { original: item.originalBudget, actuals: item.actuals };
    });
    return totals;
  };

  useEffect(() => {
    setBudgetTotals(calculateTotalsForScenario(budgetData, activeScenario));
  }, [budgetData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setBudgetData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (field === 'actuals' || field === 'originalBudget') {
          newData[index][field] = parseFloat(value) || 0;
      } else {
          newData[index][activeScenario][field] = (field === 'userAdjustment') ? (parseFloat(value) || 0) : value;
      }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(budgetData, scen);
    });
    setBudgetVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(budgetData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Budget plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = budgetData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Department': item.department,
        'Original Budget': item.originalBudget,
        'Actual Spend': item.actuals,
        'AI Updated Budget': scenarioData.aiUpdated,
        'User Adjusted Budget': scenarioData.userAdjustment,
        'Justification': scenarioData.justification,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Continuous Budget`);
    XLSX.writeFile(workbook, `Continuous_Budget_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(budgetData.map(d => [d.department, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const deptName = row['Department'];
        if (dataMap.has(deptName)) {
          const itemToUpdate = dataMap.get(deptName);
          itemToUpdate.actuals = row['Actual Spend'] ?? itemToUpdate.actuals;
          dataMap.set(deptName, itemToUpdate);
        }
      });
      setBudgetData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Actual performance data imported successfully. Review AI recommendations.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file. Please check the format.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setBudgetData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getConfidenceColor = (level) => {
    if (level === AI_CONFIDENCE.HIGH) return "bg-green-100 text-green-800";
    if (level === AI_CONFIDENCE.MED) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const lineChartData = {
    labels: budgetData.map(d => d.department),
    datasets: [
      { label: 'Original Budget', data: budgetData.map(d => d.originalBudget), borderColor: 'rgba(14, 165, 233, 1)', tension: 0.1 },
      { label: 'User Adjusted Budget', data: budgetData.map(d => getScenarioDataItem(d, activeScenario).userAdjustment), borderColor: 'rgba(239, 68, 68, 1)', tension: 0.1 },
    ],
  };
  const barChartData = {
    labels: Object.keys(budgetTotals.byDepartment || {}),
    datasets: [
        { label: 'Original Budget', data: Object.values(budgetTotals.byDepartment || {}).map(d => d.original), backgroundColor: 'rgba(156, 163, 175, 0.7)' },
        { label: 'Actual Spend', data: Object.values(budgetTotals.byDepartment || {}).map(d => d.actuals), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
    ]
  };
  
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
          to="/rolling-budgeting"
          className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
          Rolling & Flexible Budgeting
        </Link>
      </div>
    </li>
    <li aria-current="page">
      <div className="flex items-center">
        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
        <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
          Continuous Budget Updates
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Continuous Budget Updates</h1><p className="text-sky-100 text-x">Adjust budgets based on real-time business performance.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'live', label: 'Live Budget Updates'}, {id: 'import', label: 'Import Actual Performance'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'live' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Budget (Original vs User Adjusted)</p><p className="text-2xl font-bold text-sky-900">${(budgetTotals?.original || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-lg font-medium text-gray-500">→</span> ${(budgetTotals?.userAdjusted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Actuals vs Forecast Variance</p><p className={`text-2xl font-bold ${(budgetTotals.actuals - budgetTotals.original) >= 0 ? 'text-red-600' : 'text-green-600'}`}>${Math.abs(budgetTotals.actuals - budgetTotals.original).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Performance-Driven Adjustments</p><p className="text-2xl font-bold text-sky-900">{budgetTotals.adjustmentsCount} Items</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Original vs. Updated Budget Trend</h2><div className="h-[250px]"><Line data={lineChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Actuals vs. Forecast by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Live Budget Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[150px]">Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Original Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Real-Time Actuals</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Updated Budget (AI)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Adjustment</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[300px]">Justification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {budgetData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const variance = item.actuals - item.originalBudget;
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>{item.department}</td>
                            <td className="px-2 py-1 text-center text-s">${item.originalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1">
                                <input type="number" value={item.actuals} onChange={(e) => handleInputChange(index, 'actuals', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/>
                                <div className={`text-x mt-1 ${variance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {variance >= 0 ? <BsGraphUp className="inline-block mr-1"/> : <BsGraphDown className="inline-block mr-1"/>}
                                    ${Math.abs(variance).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} ({ (variance / item.originalBudget * 100).toFixed(getDecimalPrecision()) }%)
                                </div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiUpdated.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                                <div className={`text-x font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${getConfidenceColor(scenarioData.confidence)}`}>{scenarioData.confidence} Confidence</div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userAdjustment} onChange={(e) => handleInputChange(index, 'userAdjustment', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1"><textarea value={scenarioData.justification} onChange={(e) => handleInputChange(index, 'justification', e.target.value)} rows="2" className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.original || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.actuals || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.aiUpdated || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.userAdjusted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Real-Time Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Market conditions, competitive pressures...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Actual Performance Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with the latest actual spend data for each department. The AI will then generate new recommendations.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department' and 'Actual Spend' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Budget Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User Adjusted Budget', 'Total Original Budget', 'Variance vs Original', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(budgetData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total User Adjusted Budget') { value = `$${(totals.userAdjusted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total Original Budget') { value = `$${(totals.original || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Variance vs Original') { const variance = totals.userAdjusted - totals.original; value = `$${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Budget Version History</h2>
          {budgetVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} User Total</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {budgetVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userAdjusted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default ContinuousBudgetUpdates;