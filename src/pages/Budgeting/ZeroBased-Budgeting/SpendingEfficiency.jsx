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
import { FiSave, FiUpload, FiDownload, FiPrinter, FiTrendingUp, FiTrendingDown, FiDollarSign, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Aggressive Growth",
  WORST_CASE: "Conservative Shift",
};

const USER_ACTIONS = {
  ACCEPT: "Accept",
  ADJUST: "Adjust",
  REJECT: "Reject",
};

// Mock data for spending efficiency
const initialEfficiencyData = [
  {
    department: "Marketing", category: "Performance Ads",
    [SCENARIOS.BASELINE]:   { current: 50000, ai: 65000, user: 50000, roiScore: 95, suggestion: "Increase spend; high CVR.", action: "Adjust", notes: "Will increase, but by $10k not $15k.", aiInsight: "This channel has a 5.2x ROI, well above the 3.0x average." },
    [SCENARIOS.BEST_CASE]:  { current: 50000, ai: 75000, user: 50000, roiScore: 95, suggestion: "Double down for market share.", action: "Adjust", notes: "", aiInsight: "Opportunity to capture competitor's audience." },
    [SCENARIOS.WORST_CASE]: { current: 50000, ai: 40000, user: 50000, roiScore: 95, suggestion: "Reduce spend to improve profitability.", action: "Adjust", notes: "", aiInsight: "High ROI but high absolute cost." },
  },
  {
    department: "Marketing", category: "Content & SEO",
    [SCENARIOS.BASELINE]:   { current: 20000, ai: 20000, user: 20000, roiScore: 80, suggestion: "Maintain current spend.", action: "Accept", notes: "", aiInsight: "Consistent organic traffic growth." },
    [SCENARIOS.BEST_CASE]:  { current: 20000, ai: 25000, user: 20000, roiScore: 80, suggestion: "Invest in more long-form content.", action: "Adjust", notes: "", aiInsight: "Topic clusters show high potential." },
    [SCENARIOS.WORST_CASE]: { current: 20000, ai: 15000, user: 20000, roiScore: 80, suggestion: "Shift funds to paid channels.", action: "Adjust", notes: "", aiInsight: "Longer payback period than ads." },
  },
  {
    department: "IT", category: "SaaS Tools",
    [SCENARIOS.BASELINE]:   { current: 15000, ai: 12000, user: 15000, roiScore: 30, suggestion: "Reduce spend; redundant tools.", action: "Adjust", notes: "Will review for next quarter.", aiInsight: "Overlap found between Tool A and Tool B." },
    [SCENARIOS.BEST_CASE]:  { current: 15000, ai: 10000, user: 15000, roiScore: 30, suggestion: "Consolidate tools immediately.", action: "Adjust", notes: "", aiInsight: "Can save $5k/mo by eliminating redundancy." },
    [SCENARIOS.WORST_CASE]: { current: 15000, ai: 15000, user: 15000, roiScore: 30, suggestion: "Maintain spend for stability.", action: "Accept", notes: "", aiInsight: "Migration cost may be high." },
  },
  {
    department: "Product", category: "User Research",
    [SCENARIOS.BASELINE]:   { current: 8000, ai: 10000, user: 8000, roiScore: 90, suggestion: "Increase for better feature validation.", action: "Accept", notes: "Agreed, allocating.", aiInsight: "Reduces risk of building wrong features." },
    [SCENARIOS.BEST_CASE]:  { current: 8000, ai: 12000, user: 8000, roiScore: 90, suggestion: "Invest heavily in discovery.", action: "Adjust", notes: "", aiInsight: "High impact on roadmap success." },
    [SCENARIOS.WORST_CASE]: { current: 8000, ai: 8000, user: 8000, roiScore: 90, suggestion: "Maintain current level.", action: "Accept", notes: "", aiInsight: "Sufficient for current scope." },
  },
];

const SpendingEfficiencyRecommendations = () => {
  const [activeTab, setActiveTab] = useState("review");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [efficiencyData, setEfficiencyData] = useState(JSON.parse(JSON.stringify(initialEfficiencyData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Focus on balancing growth and efficiency. Reallocate funds from low-ROI (<40) to high-ROI (>80) activities. Target a 5% overall budget shift.",
    [SCENARIOS.BEST_CASE]: "Aggressive growth strategy. Reallocate up to 20% of the budget towards high-ROI activities, even if it means taking on more risk.",
    [SCENARIOS.WORST_CASE]: "Conservative, capital preservation strategy. Reallocate funds only from very low-ROI (<20) activities to proven, stable-ROI channels.",
  });

  const [efficiencyVersions, setEfficiencyVersions] = useState([]);
  const [efficiencyTotals, setEfficiencyTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { current: 0, ai: 0, user: 0, roiScore: 0, suggestion: "", action: USER_ACTIONS.REJECT, notes: "", aiInsight: "N/A" };
  };

  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { totalReallocation: 0, highRoiOpps: 0, budgetAtRisk: 0, byDepartment: {}, userTotal: 0, aiTotal: 0 };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const reallocation = scenarioData.ai - scenarioData.current;
      totals.totalReallocation += reallocation;
      totals.userTotal += scenarioData.user;
      totals.aiTotal += scenarioData.ai;
      
      if (scenarioData.roiScore > 80) totals.highRoiOpps += reallocation > 0 ? reallocation : 0;
      if (scenarioData.roiScore < 40) totals.budgetAtRisk += scenarioData.current;
      
      if (!totals.byDepartment[item.department]) totals.byDepartment[item.department] = { current: 0, user: 0, roiSum: 0, count: 0 };
      totals.byDepartment[item.department].current += scenarioData.current;
      totals.byDepartment[item.department].user += scenarioData.user;
      totals.byDepartment[item.department].roiSum += scenarioData.roiScore;
      totals.byDepartment[item.department].count += 1;
    });
    return totals;
  };

  useEffect(() => {
    setEfficiencyTotals(calculateTotalsForScenario(efficiencyData, activeScenario));
  }, [efficiencyData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setEfficiencyData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      scenarioItem[field] = field === 'user' ? (parseFloat(value) || 0) : value;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(efficiencyData, scen);
    });

    setEfficiencyVersions(prev => [
      ...prev, { period, timestamp, data: JSON.parse(JSON.stringify(efficiencyData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions)) },
    ]);
    setHasChanges(false);
    alert("Efficiency plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = efficiencyData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Department': item.department, 'Category': item.category, 
        'Current Allocation': scenarioData.current, 'AI Recommended Allocation': scenarioData.ai, 'User Adjusted Allocation': scenarioData.user,
        'ROI Score': scenarioData.roiScore, 'AI Suggestion': scenarioData.suggestion, 'User Action': scenarioData.action, 'User Notes': scenarioData.notes,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Efficiency Plan`);
    const fileName = `Spending_Efficiency_${activeScenario.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(efficiencyData.map(d => [`${d.department}-${d.category}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Category']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.user = row['User Adjusted Allocation'] ?? scenarioItem.user;
          scenarioItem.action = row['User Action'] ?? scenarioItem.action;
          scenarioItem.notes = row['User Notes'] ?? scenarioItem.notes;
          dataMap.set(key, itemToUpdate);
        }
      });
      setEfficiencyData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review and save changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setEfficiencyData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getRoiColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score < 40) return "text-red-600";
    return "text-yellow-600";
  };

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(efficiencyTotals.byDepartment || {}),
    datasets: [
        { label: 'Total Spending (User)', yAxisID: 'y', data: Object.values(efficiencyTotals.byDepartment || {}).map(d => d.user), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
        { label: 'Average ROI Score', yAxisID: 'y1', data: Object.values(efficiencyTotals.byDepartment || {}).map(d => d.roiSum / d.count), backgroundColor: 'rgba(249, 115, 22, 0.7)' },
    ]
  };
  const barChartOptions = { ...chartOptions, scales: { y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Total Spend'} }, y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'Avg. ROI Score'} } } };

  const pieData = efficiencyData.reduce((acc, item) => {
    const scenarioData = getScenarioDataItem(item, activeScenario);
    acc.current[item.department] = (acc.current[item.department] || 0) + scenarioData.current;
    acc.user[item.department] = (acc.user[item.department] || 0) + scenarioData.user;
    return acc;
  }, { current: {}, user: {} });

  const pieChartData = {
    labels: Object.keys(pieData.current),
    datasets: [
      { label: 'Current Allocation', data: Object.values(pieData.current), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444'] },
      { label: 'User Allocation', data: Object.values(pieData.user), backgroundColor: ['#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5'] },
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
                Spending Efficiency
              </span>
            </div>
          </li>
        </ol>
      </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">AI-Based Spending Efficiency Recommendations</h1>
            <p className="text-sky-100 text-x">Identify areas where funds can be reallocated for higher ROI.</p>
          </div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'review', label: 'Review Recommendations'}, {id: 'import', label: 'Import Efficiency Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'review' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Suggested Reallocation</p><p className={`text-2xl font-bold ${(efficiencyTotals?.totalReallocation || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${(efficiencyTotals?.totalReallocation || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">High-ROI Opportunities</p><p className="text-2xl font-bold text-green-600">${(efficiencyTotals?.highRoiOpps || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Budget at Risk (Low ROI)</p><p className="text-2xl font-bold text-red-600">${(efficiencyTotals?.budgetAtRisk || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Department Spending vs. ROI</h2><div className="h-[250px]"><Bar data={barChartData} options={barChartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Fund Distribution (Current vs. User)</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Efficiency Recommendations Editor ({activeScenario})</h2>
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
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[240px]">Allocation (Current vs AI vs User)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">ROI Score</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">AI Suggestion</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Action</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">User Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {efficiencyData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                              <div className="font-semibold">{item.department}</div><div className="text-x text-sky-600">{item.category}</div>
                            </td>
                            <td className="px-2 py-1 space-x-2 flex">
                                <div className="flex-1"><div className="text-x text-center text-gray-500">Current</div><input type="text" readOnly value={`$${scenarioData.current.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`} className="w-full mt-1 p-1.5 border-none rounded-md text-s text-center bg-gray-100"/></div>
                                <div className="flex-1"><div className="text-x text-center text-gray-500 relative group">AI Rec. <FiInfo className="inline-block ml-1 text-gray-400" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span></div><input type="text" readOnly value={`$${scenarioData.ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`} className="w-full mt-1 p-1.5 border-none rounded-md text-s text-center bg-green-100 text-green-800"/></div>
                                <div className="flex-1"><div className="text-x text-center text-gray-500">User Adj.</div><input type="number" value={scenarioData.user} onChange={(e) => handleInputChange(index, 'user', e.target.value)} className="w-full mt-1 p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></div>
                            </td>
                            <td className={`px-4 py-3 text-center text-lg font-bold ${getRoiColor(scenarioData.roiScore)}`}>{scenarioData.roiScore}</td>
                            <td className="px-4 py-3 text-s text-left text-sky-800">{scenarioData.suggestion}</td>
                            <td className="px-2 py-1">
                              <select value={scenarioData.action} onChange={(e) => handleInputChange(index, 'action', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">
                                {Object.values(USER_ACTIONS).map(s => <option key={s}>{s}</option>)}
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
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">ROI Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., ROI is calculated based on...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Efficiency Data for {activeScenario}</h2>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" /><label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Match by 'Department'-'Category'. Updates user allocation and notes.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Efficiency Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User Allocation', 'Total AI Allocation', 'Total Reallocation', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(efficiencyData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total User Allocation') { value = `$${(totals.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total AI Allocation') { value = `$${(totals.aiTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Total Reallocation') { value = `$${(totals.totalReallocation || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${(totals.totalReallocation || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Efficiency Plan Version History</h2>
          {efficiencyVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
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
                  {efficiencyVersions.map((version, index) => (
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

export default SpendingEfficiencyRecommendations;