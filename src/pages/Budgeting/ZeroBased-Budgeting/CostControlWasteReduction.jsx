import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiAlertCircle, FiChevronRight} from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend
);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Aggressive Cost-Cutting",
  WORST_CASE: "Conservative Review",
};

// Mock data for cost control
const initialExpenseData = [
  {
    category: "SaaS Subscriptions", department: "Marketing",
    [SCENARIOS.BASELINE]:            { m1: { ai: 5000, user: 5000 }, m2: { ai: 5000, user: 5000 }, m3: { ai: 5000, user: 5000 }, wasteFlag: true, action: "Reduce", notes: "Review user licenses.", aiInsight: "Low usage detected for 5/20 seats." },
    [SCENARIOS.BEST_CASE]:           { m1: { ai: 5000, user: 3000 }, m2: { ai: 5000, user: 3000 }, m3: { ai: 5000, user: 3000 }, wasteFlag: true, action: "Eliminate", notes: "Cancel and migrate to cheaper alternative.", aiInsight: "Low usage detected." },
    [SCENARIOS.WORST_CASE]:          { m1: { ai: 5000, user: 5000 }, m2: { ai: 5000, user: 5000 }, m3: { ai: 5000, user: 5000 }, wasteFlag: true, action: "Justify", notes: "Keep for strategic purposes.", aiInsight: "Low usage detected." },
  },
  {
    category: "Cloud Services (Dev)", department: "Engineering",
    [SCENARIOS.BASELINE]:            { m1: { ai: 8000, user: 8000 }, m2: { ai: 8200, user: 8200 }, m3: { ai: 8500, user: 8500 }, wasteFlag: true, action: "Reduce", notes: "Optimize server configurations.", aiInsight: "Unused instances running overnight." },
    [SCENARIOS.BEST_CASE]:           { m1: { ai: 8000, user: 6000 }, m2: { ai: 8200, user: 6000 }, m3: { ai: 8500, user: 6500 }, wasteFlag: true, action: "Reduce", notes: "Implement auto-shutdown scripts.", aiInsight: "Unused instances." },
    [SCENARIOS.WORST_CASE]:          { m1: { ai: 8000, user: 8000 }, m2: { ai: 8200, user: 8200 }, m3: { ai: 8500, user: 8500 }, wasteFlag: false, action: "Justify", notes: "Required for staging environment tests.", aiInsight: "No waste detected." },
  },
  {
    category: "Travel & Entertainment", department: "Sales",
    [SCENARIOS.BASELINE]:            { m1: { ai: 12000, user: 12000 }, m2: { ai: 12000, user: 12000 }, m3: { ai: 12000, user: 12000 }, wasteFlag: false, action: "Justify", notes: "Client visits for key accounts.", aiInsight: "Spend is within policy limits." },
    [SCENARIOS.BEST_CASE]:           { m1: { ai: 12000, user: 8000 }, m2: { ai: 12000, user: 8000 }, m3: { ai: 12000, user: 8000 }, wasteFlag: false, action: "Reduce", notes: "Focus on virtual meetings.", aiInsight: "Spend within limits." },
    [SCENARIOS.WORST_CASE]:          { m1: { ai: 12000, user: 15000 }, m2: { ai: 12000, user: 15000 }, m3: { ai: 12000, user: 15000 }, wasteFlag: true, action: "Justify", notes: "Major industry conference.", aiInsight: "Spend above historical average." },
  },
  {
    category: "Office Supplies", department: "Operations",
    [SCENARIOS.BASELINE]:            { m1: { ai: 1500, user: 1500 }, m2: { ai: 1500, user: 1500 }, m3: { ai: 1500, user: 1500 }, wasteFlag: false, action: "Justify", notes: "Standard quarterly restock.", aiInsight: "Normal consumption." },
    [SCENARIOS.BEST_CASE]:           { m1: { ai: 1500, user: 1000 }, m2: { ai: 1500, user: 1000 }, m3: { ai: 1500, user: 1000 }, wasteFlag: false, action: "Reduce", notes: "Bulk order discount applied.", aiInsight: "Normal consumption." },
    [SCENARIOS.WORST_CASE]:          { m1: { ai: 1500, user: 1500 }, m2: { ai: 1500, user: 1500 }, m3: { ai: 1500, user: 1500 }, wasteFlag: false, action: "Justify", notes: "Standard restock.", aiInsight: "Normal consumption." },
  },
];

const CostControlWasteReduction = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [expenseData, setExpenseData] = useState(JSON.parse(JSON.stringify(initialExpenseData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard review of all expenses flagged by AI. Reductions are encouraged but not mandatory if justification is strong.",
    [SCENARIOS.BEST_CASE]: "Aggressive cost-cutting mandate. All flagged items must be eliminated or reduced by at least 50%. New justifications are heavily scrutinized.",
    [SCENARIOS.WORST_CASE]: "Conservative approach. Only high-confidence, low-impact waste is eliminated. Focus is on maintaining operational stability.",
  });

  const [costVersions, setCostVersions] = useState([]);
  const [costTotals, setCostTotals] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);

  const getExpenseScenarioData = (expense, scenarioKey) => {
    return expense[scenarioKey] || { m1: { ai: 0, user: 0 }, m2: { ai: 0, user: 0 }, m3: { ai: 0, user: 0 }, wasteFlag: false, action: "Justify", notes: "", aiInsight: "" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { aiTotalSpend: 0, userTotalSpend: 0, aiFlaggedWaste: 0, potentialSavings: 0, byCategory: {}, byDepartment: {} };
    
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getExpenseScenarioData(item, scenarioKey);
      const aiQuarterlySpend = (scenarioData.m1.ai || 0) + (scenarioData.m2.ai || 0) + (scenarioData.m3.ai || 0);
      const userQuarterlySpend = (scenarioData.m1.user || 0) + (scenarioData.m2.user || 0) + (scenarioData.m3.user || 0);

      totals.aiTotalSpend += aiQuarterlySpend;
      totals.userTotalSpend += userQuarterlySpend;
      if (scenarioData.wasteFlag) {
        totals.aiFlaggedWaste += aiQuarterlySpend;
      }
      totals.potentialSavings += (aiQuarterlySpend - userQuarterlySpend);
      
      totals.byCategory[item.category] = (totals.byCategory[item.category] || 0) + userQuarterlySpend;
      if (!totals.byDepartment[item.department]) {
        totals.byDepartment[item.department] = { ai: 0, user: 0 };
      }
      totals.byDepartment[item.department].ai += aiQuarterlySpend;
      totals.byDepartment[item.department].user += userQuarterlySpend;
    });
    return totals;
  };

  useEffect(() => {
    setCostTotals(calculateTotalsForScenario(expenseData, activeScenario));
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

    setCostVersions(prev => [
      ...prev, { period, timestamp, data: JSON.parse(JSON.stringify(expenseData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions)) },
    ]);
    setHasChanges(false);
    alert("Cost plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = expenseData.map(item => {
      const scenarioData = getExpenseScenarioData(item, activeScenario);
      return {
        'Expense Category': item.category, 'Department': item.department, 
        'AI Waste Flag': scenarioData.wasteFlag ? 'Yes' : 'No', 'User Action': scenarioData.action, 'User Notes': scenarioData.notes,
        'M1 User': scenarioData.m1.user, 'M2 User': scenarioData.m2.user, 'M3 User': scenarioData.m3.user,
        'M1 AI': scenarioData.m1.ai, 'M2 AI': scenarioData.m2.ai, 'M3 AI': scenarioData.m3.ai,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Cost Plan`);
    const fileName = `Cost_Control_Plan_${activeScenario.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const expenseMap = new Map(expenseData.map(d => [d.category, JSON.parse(JSON.stringify(d))]));

      jsonData.forEach(row => {
        const category = row['Expense Category'];
        if (expenseMap.has(category)) {
          const itemToUpdate = expenseMap.get(category);
          const scenarioData = getExpenseScenarioData(itemToUpdate, activeScenario);

          scenarioData.m1.user = row['M1 User'] ?? scenarioData.m1.user;
          scenarioData.m2.user = row['M2 User'] ?? scenarioData.m2.user;
          scenarioData.m3.user = row['M3 User'] ?? scenarioData.m3.user;
          scenarioData.action = row['User Action'] ?? scenarioData.action;
          scenarioData.notes = row['User Notes'] ?? scenarioData.notes;

          expenseMap.set(category, itemToUpdate);
        }
      });

      setExpenseData(Array.from(expenseMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} scenario imported. Review and save changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file. Please check the format and try again.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setExpenseData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const pieChartData = {
    labels: Object.keys(costTotals.byCategory || {}),
    datasets: [{
      data: Object.values(costTotals.byCategory || {}),
      backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#64748b'],
      hoverOffset: 4,
    }],
  };
  
  const barChartData = {
    labels: Object.keys(costTotals.byDepartment || {}),
    datasets: [
        { label: 'AI Baseline Spend', data: Object.values(costTotals.byDepartment || {}).map(d => d.ai), backgroundColor: 'rgba(16, 185, 129, 0.7)' },
        { label: 'User Adjusted Spend', data: Object.values(costTotals.byDepartment || {}).map(d => d.user), backgroundColor: 'rgba(239, 68, 68, 0.7)' },
    ]
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
                Cost Control & Waste Reduction
              </span>
            </div>
          </li>
        </ol>
      </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Cost Control & Waste Reduction</h1>
            <p className="text-sky-100 text-x">Identify unnecessary expenses and eliminate waste.</p>
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
        {[{id: 'create', label: 'Analyze Costs'}, {id: 'import', label: 'Import Expense Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
                <p className="text-x font-medium text-sky-700">Total AI-Flagged Waste</p>
                <p className="text-2xl font-bold text-red-600">${(costTotals?.aiFlaggedWaste || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total Potential Savings (User)</p>
                <p className="text-2xl font-bold text-green-600">${(costTotals?.potentialSavings || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Cost Reduction Variance</p>
                <p className={`text-2xl font-bold ${(costTotals?.potentialSavings || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    { (costTotals.aiTotalSpend > 0 ? ((costTotals.potentialSavings / costTotals.aiTotalSpend) * 100).toFixed(getDecimalPrecision()) : 0) }%
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                    <h2 className="text-lg font-semibold text-sky-900 mb-3">User Spend by Category</h2>
                    <div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: {legend: {position: 'right'}}}} /></div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                    <h2 className="text-lg font-semibold text-sky-900 mb-3">Spend by Department (AI vs User)</h2>
                    <div className="h-[250px]"><Bar data={barChartData} options={{...chartOptions, scales: {y: {title: {display: true, text: 'Quarterly Spend ($)'}}}}}/></div>
                </div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Expense Analysis Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Expense / Dept</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Waste Flag</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[300px]">M1 / M2 / M3 Spend</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Action</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">User Notes</th>
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
                            <td className="px-4 py-3 text-center text-s relative group">
                                {scenarioData.wasteFlag ? <span className="inline-flex items-center font-bold text-red-600"><FiAlertCircle className="mr-1"/> Yes</span> : <span className="text-gray-500">No</span>}
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                            </td>
                            <td className="px-2 py-1 space-x-2 flex">
                                {['m1', 'm2', 'm3'].map(m => (
                                    <div key={m} className="flex-1">
                                        <div className="text-x text-center text-gray-500">AI: ${scenarioData[m].ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                                        <input type="number" value={scenarioData[m].user} onChange={(e) => handleInputChange(index, null, e.target.value, m)} className="w-full mt-1 p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/>
                                    </div>
                                ))}
                            </td>
                            <td className="px-2 py-1">
                              <select value={scenarioData.action} onChange={(e) => handleInputChange(index, 'action', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">
                                <option>Eliminate</option><option>Reduce</option><option>Justify</option>
                              </select>
                            </td>
                            <td className="px-2 py-1"><textarea value={scenarioData.notes} onChange={(e) => handleInputChange(index, 'notes', e.target.value)} rows="2" className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border border-sky-200">
                <label htmlFor="scenarioAssumptionsText" className="block text-md font-semibold text-sky-800 mb-2">Cost-Cutting Principles for {activeScenario}:</label>
                <textarea id="scenarioAssumptionsText" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s focus:ring-2 focus:ring-sky-500 bg-white" placeholder={`e.g., All SaaS tools with less than 80% utilization are flagged...`} />
            </div>
          </>
        )}

        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Expense Data for {activeScenario}</h2>
            <p className="text-s text-gray-600 mb-4">
              Upload a file to bulk-update user-adjusted spend, actions, and notes for the <strong>{activeScenario}</strong> scenario.
            </p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Match rows by 'Expense Category'. Supported formats: XLSX, XLS, CSV.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Cost-Control Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User Spend', 'Total AI Baseline Spend', 'Potential Savings', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(expenseData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total User Spend') { value = `$${(totals.userTotalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total AI Baseline Spend') { value = `$${(totals.aiTotalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Potential Savings') { value = `$${(totals.potentialSavings || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${(totals.potentialSavings || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Cost Plan Version History</h2>
          {costVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
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
                  {costVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userTotalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default CostControlWasteReduction;