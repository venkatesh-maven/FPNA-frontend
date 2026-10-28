import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components, including ArcElement for Pie charts
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend
);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Best Case (Cost Savings)",
  WORST_CASE: "Worst Case (High Spend)",
};

// Mock data for justification-based budgeting
const initialExpenseData = [
  {
    category: "SaaS Subscriptions", department: "Marketing",
    [SCENARIOS.BASELINE]:    { month1: { ai: 5000, user: 5000 }, month2: { ai: 5000, user: 5000 }, month3: { ai: 5000, user: 5000 }, justification: "Core marketing automation platform (HubSpot).", type: "Recurring" },
    [SCENARIOS.BEST_CASE]:   { month1: { ai: 4500, user: 4500 }, month2: { ai: 4500, user: 4500 }, month3: { ai: 4500, user: 4500 }, justification: "Downgraded plan, removed unused seats.", type: "Recurring" },
    [SCENARIOS.WORST_CASE]:  { month1: { ai: 6000, user: 6000 }, month2: { ai: 6000, user: 6000 }, month3: { ai: 6000, user: 6000 }, justification: "Enterprise plan upgrade for new features.", type: "Recurring" },
  },
  {
    category: "Cloud Services", department: "Engineering",
    [SCENARIOS.BASELINE]:    { month1: { ai: 12000, user: 12000 }, month2: { ai: 12500, user: 12500 }, month3: { ai: 13000, user: 13000 }, justification: "Standard AWS/GCP usage for production.", type: "Recurring" },
    [SCENARIOS.BEST_CASE]:   { month1: { ai: 10000, user: 10000 }, month2: { ai: 10000, user: 10000 }, month3: { ai: 10500, user: 10500 }, justification: "Refactored services for cost optimization.", type: "Recurring" },
    [SCENARIOS.WORST_CASE]:  { month1: { ai: 15000, user: 15000 }, month2: { ai: 16000, user: 16000 }, month3: { ai: 17000, user: 17000 }, justification: "Unexpected spike in traffic and data processing.", type: "Recurring" },
  },
  {
    category: "Digital Ad Spend", department: "Marketing",
    [SCENARIOS.BASELINE]:    { month1: { ai: 20000, user: 20000 }, month2: { ai: 20000, user: 20000 }, month3: { ai: 20000, user: 20000 }, justification: "Q1 lead generation campaigns on Google/LinkedIn.", type: "One-Time" },
    [SCENARIOS.BEST_CASE]:   { month1: { ai: 15000, user: 15000 }, month2: { ai: 15000, user: 15000 }, month3: { ai: 15000, user: 15000 }, justification: "High organic traffic allows for reduced ad spend.", type: "One-Time" },
    [SCENARIOS.WORST_CASE]:  { month1: { ai: 25000, user: 25000 }, month2: { ai: 28000, user: 28000 }, month3: { ai: 30000, user: 30000 }, justification: "Aggressive push to capture market share from competitor.", type: "One-Time" },
  },
  {
    category: "Office Rent", department: "Operations",
    [SCENARIOS.BASELINE]:    { month1: { ai: 15000, user: 15000 }, month2: { ai: 15000, user: 15000 }, month3: { ai: 15000, user: 15000 }, justification: "Lease agreement for main office space.", type: "Recurring" },
    [SCENARIOS.BEST_CASE]:   { month1: { ai: 15000, user: 15000 }, month2: { ai: 15000, user: 15000 }, month3: { ai: 15000, user: 15000 }, justification: "Fixed cost per lease agreement.", type: "Recurring" },
    [SCENARIOS.WORST_CASE]:  { month1: { ai: 15000, user: 15000 }, month2: { ai: 15000, user: 15000 }, month3: { ai: 15000, user: 15000 }, justification: "Fixed cost per lease agreement.", type: "Recurring" },
  },
];

const JustificationBasedBudgeting = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [expenseData, setExpenseData] = useState(JSON.parse(JSON.stringify(initialExpenseData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "All expenses must be justified against core operational needs. ROI is required for all new one-time expenses over $5,000.",
    [SCENARIOS.BEST_CASE]: "Focus on cost-saving. All recurring expenses reviewed for potential reduction. Non-essential nice-to-haves are deferred.",
    [SCENARIOS.WORST_CASE]: "Strategic investment focus. Higher spend is permissible if strongly justified by growth opportunities or competitive threats.",
  });

  const [budgetVersions, setBudgetVersions] = useState([]);
  const [budgetTotals, setBudgetTotals] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);

  const getExpenseScenarioData = (expense, scenarioKey) => {
    return expense[scenarioKey] || { month1: { ai: 0, user: 0 }, month2: { ai: 0, user: 0 }, month3: { ai: 0, user: 0 }, justification: "", type: "One-Time" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { aiTotal: 0, userTotal: 0, month1Ai: 0, month1User: 0, month2Ai: 0, month2User: 0, month3Ai: 0, month3User: 0, byCategory: {} };
    data.forEach(item => {
      const scenarioData = getExpenseScenarioData(item, scenarioKey);
      const userCategoryTotal = (scenarioData.month1.user || 0) + (scenarioData.month2.user || 0) + (scenarioData.month3.user || 0);
      totals.byCategory[item.category] = (totals.byCategory[item.category] || 0) + userCategoryTotal;
      
      totals.aiTotal += (scenarioData.month1.ai || 0) + (scenarioData.month2.ai || 0) + (scenarioData.month3.ai || 0);
      totals.userTotal += userCategoryTotal;
      totals.month1Ai += scenarioData.month1.ai || 0;
      totals.month1User += scenarioData.month1.user || 0;
      totals.month2Ai += scenarioData.month2.ai || 0;
      totals.month2User += scenarioData.month2.user || 0;
      totals.month3Ai += scenarioData.month3.ai || 0;
      totals.month3User += scenarioData.month3.user || 0;
    });
    return totals;
  };

  useEffect(() => {
    setBudgetTotals(calculateTotalsForScenario(expenseData, activeScenario));
  }, [expenseData, activeScenario]);

  const handleInputChange = (index, field, value, month = null) => {
    setExpenseData(prev => {
      const newExpenses = JSON.parse(JSON.stringify(prev));
      const scenarioData = newExpenses[index][activeScenario];
      if (month) {
        scenarioData[month].user = parseFloat(value) || 0;
      } else {
        scenarioData[field] = value;
      }
      return newExpenses;
    });
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(expenseData, scen);
    });

    setBudgetVersions(prev => [
      ...prev, { 
        period, timestamp, 
        data: JSON.parse(JSON.stringify(expenseData)), 
        totalsByScenario,
        assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))
      },
    ]);
    setHasChanges(false);
    alert("Budget version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = expenseData.map(item => {
      const scenarioData = getExpenseScenarioData(item, activeScenario);
      return {
        'Expense Category': item.category, 'Department': item.department, 'Type': scenarioData.type,
        'Justification': scenarioData.justification,
        'Month 1 Budget (User)': scenarioData.month1.user, 'Month 2 Budget (User)': scenarioData.month2.user, 'Month 3 Budget (User)': scenarioData.month3.user,
        'Month 1 Budget (AI)': scenarioData.month1.ai, 'Month 2 Budget (AI)': scenarioData.month2.ai, 'Month 3 Budget (AI)': scenarioData.month3.ai,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Budget Plan`);
    const fileName = `Justification_Budget_${activeScenario.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImport = async (e) => {
    // Implementation for importing budget data
  };
  
  const handleRestoreVersion = (version) => {
    setExpenseData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  // Chart Data
  const trendChartData = {
    labels: ["Month 1", "Month 2", "Month 3"],
    datasets: [
      { label: `AI Suggested Budget`, data: [budgetTotals.month1Ai, budgetTotals.month2Ai, budgetTotals.month3Ai], borderColor: "rgba(16, 185, 129, 1)", tension: 0.1 },
      { label: `User Entered Budget`, data: [budgetTotals.month1User, budgetTotals.month2User, budgetTotals.month3User], borderColor: "rgba(239, 68, 68, 1)", tension: 0.1 },
    ],
  };

  const pieChartData = {
    labels: Object.keys(budgetTotals.byCategory || {}),
    datasets: [{
      data: Object.values(budgetTotals.byCategory || {}),
      backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#64748b'],
      hoverOffset: 4,
    }],
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };

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
          to="/zeroBased-budgeting"
          className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
          Zero-Based Budgeting
        </Link>
      </div>
    </li>
    <li aria-current="page">
      <div className="flex items-center">
        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
        <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
          Justification Based
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Justification-Based Budgeting</h1>
            <p className="text-sky-100 text-x">Each expense must be justified from zero each cycle.</p>
          </div>
          <div className="flex items-center space-x-4">
             <div>
              <label htmlFor="forecastPeriodSelect" className="text-s text-white font-medium mr-2">Forecast Period:</label>
              <select id="forecastPeriodSelect" value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x focus:ring-sky-500">
                <option>Q1 2025</option><option>Q2 2025</option><option>Q3 2025</option><option>Q4 2025</option>
              </select>
            </div>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors">
                <FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'create', label: 'Create/Edit Budget'}, {id: 'import', label: 'Import Expense Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
          <button key={tab.id} className={`py-2 px-4 font-medium text-s ${activeTab === tab.id ? 'text-sky-50 border-b-2 border-sky-600 bg-sky-800 rounded-t-lg' : 'text-sky-900 hover:text-sky-500 hover:bg-sky-100 rounded-t-lg'}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
        <div className="ml-4">
            <label htmlFor="scenarioSelectTab" className="text-s font-medium text-sky-800 mr-2">Active Scenario:</label>
            <select id="scenarioSelectTab" value={activeScenario} onChange={(e) => {
                if(hasChanges && !window.confirm("You have unsaved changes. Are you sure you want to switch?")) return;
                setActiveScenario(e.target.value);
                setHasChanges(false);
            }} className="p-1.5 border border-sky-300 bg-white text-sky-900 rounded-md text-x focus:ring-1 focus:ring-sky-500">
                {Object.values(SCENARIOS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
        <div className="relative ml-auto" ref={filtersRef}><button onClick={() => setShowFilters(!showFilters)} className="py-2 px-3 text-gray-500 hover:text-blue-500 flex items-center text-s"><BsFilter className="mr-1" /> Filters</button></div>
      </div>
      
      <div>
        {activeTab === 'create' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total User-Entered Budget</p>
                <p className="text-2xl font-bold text-sky-900">${(budgetTotals?.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total AI Suggested Budget</p>
                <p className="text-2xl font-bold text-sky-900">${(budgetTotals?.aiTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Variance (User vs AI)</p>
                <p className={`text-2xl font-bold ${(budgetTotals?.userTotal || 0) >= (budgetTotals?.aiTotal || 0) ? 'text-red-600' : 'text-green-600'}`}>${Math.abs((budgetTotals?.userTotal || 0) - (budgetTotals?.aiTotal || 0)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Share by Category (User)</h2>
                <div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: {legend: {position: 'right'}}}} /></div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Trend ({activeScenario})</h2>
                <div className="h-[250px]"><Line data={trendChartData} options={{...chartOptions, scales: {y: {title: {display: true, text: 'Monthly Budget ($)'}}}}} /></div>
              </div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Budget Justification Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Budget</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Expense / Dept</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[300px]">Justification</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Type</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Month 1</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Month 2</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Month 3</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {expenseData.map((item, index) => {
                        const scenarioData = getExpenseScenarioData(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                              <div className="font-semibold">{item.category}</div><div className="text-x text-sky-600">{item.department}</div>
                            </td>
                            <td className="px-2 py-1"><input type="text" value={scenarioData.justification} onChange={(e) => handleInputChange(index, 'justification', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white"/></td>
                            <td className="px-2 py-1">
                              <select value={scenarioData.type} onChange={(e) => handleInputChange(index, 'type', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">
                                <option>Recurring</option><option>One-Time</option>
                              </select>
                            </td>
                            {['month1', 'month2', 'month3'].map(month => (
                              <td key={month} className="px-2 py-1">
                                <div className="text-x text-gray-500 text-center relative group">AI: ${scenarioData[month].ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">AI suggests this based on historicals.</span></div>
                                <input type="number" value={scenarioData[month].user} onChange={(e) => handleInputChange(index, null, e.target.value, month)} className="w-full mt-1 p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td colSpan={2}></td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.month1User || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.month2User || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(budgetTotals.month3User || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border border-sky-200">
                <label htmlFor="scenarioAssumptionsText" className="block text-md font-semibold text-sky-800 mb-2">Justification Principles for {activeScenario}:</label>
                <textarea id="scenarioAssumptionsText" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s focus:ring-2 focus:ring-sky-500 bg-white" placeholder={`e.g., All recurring expenses require review...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Expense Data for {activeScenario}</h2>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" /><label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Match by 'Expense Category'. Updates user budget, justification, and type.</p>
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
                  {['Total User Budget', 'Total AI Budget', 'Variance', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(expenseData, scenarioName);
                        let value;
                        let className = "text-s text-sky-700";
                        if (metric === 'Total User Budget') { value = `$${totals.userTotal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total AI Budget') { value = `$${totals.aiTotal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Variance') { const variance = totals.userTotal - totals.aiTotal; value = `$${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`; }
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
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default JustificationBasedBudgeting;