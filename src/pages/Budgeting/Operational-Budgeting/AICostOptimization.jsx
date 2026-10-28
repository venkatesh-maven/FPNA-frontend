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
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  AI_OPTIMIZED: "AI-Optimized",
  AGGRESSIVE_SAVINGS: "Aggressive Savings",
};

const USER_DECISION = {
  ACCEPT: "Accept",
  ADJUST: "Adjust",
  REJECT: "Reject",
};

const AI_CONFIDENCE = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for cost optimization
const initialOptimizationData = [
  {
    expenseCategory: "SaaS Subscriptions", department: "IT", currentAllocation: 85000,
    [SCENARIOS.BASELINE]:        { aiReduction: 15000, userDecision: USER_DECISION.ACCEPT, userAdjustment: 15000, impact: "Low. Consolidate redundant tools.", confidence: AI_CONFIDENCE.HIGH, aiInsight: "Usage data shows overlap between Tool A & B. 80% of users only use Tool A." },
    [SCENARIOS.AI_OPTIMIZED]:    { aiReduction: 15000, userDecision: USER_DECISION.ACCEPT, userAdjustment: 15000, impact: "Low. Consolidate redundant tools.", confidence: AI_CONFIDENCE.HIGH, aiInsight: "Usage data shows overlap between Tool A & B. 80% of users only use Tool A." },
    [SCENARIOS.AGGRESSIVE_SAVINGS]:{ aiReduction: 25000, userDecision: USER_DECISION.ADJUST, userAdjustment: 20000, impact: "Medium. Requires migrating all teams to a single, cheaper alternative.", confidence: AI_CONFIDENCE.MED, aiInsight: "A more aggressive plan involves migrating all users to a lower-cost platform." },
  },
  {
    expenseCategory: "Digital Ad Spend", department: "Marketing", currentAllocation: 120000,
    [SCENARIOS.BASELINE]:        { aiReduction: 10000, userDecision: USER_DECISION.REJECT, userAdjustment: 0, impact: "None. Rejecting to maintain lead volume.", confidence: AI_CONFIDENCE.MED, aiInsight: "Suggest reallocating 10% from low-performing Display ads to high-performing Search ads." },
    [SCENARIOS.AI_OPTIMIZED]:    { aiReduction: 10000, userDecision: USER_DECISION.ACCEPT, userAdjustment: 10000, impact: "Neutral. Reallocation should maintain lead volume.", confidence: AI_CONFIDENCE.MED, aiInsight: "Suggest reallocating 10% from low-performing Display ads to high-performing Search ads." },
    [SCENARIOS.AGGRESSIVE_SAVINGS]:{ aiReduction: 30000, userDecision: USER_DECISION.ADJUST, userAdjustment: 20000, impact: "High. -15% lead volume expected.", confidence: AI_CONFIDENCE.HIGH, aiInsight: "Cutting all but the top-performing campaign will significantly reduce spend but impact pipeline." },
  },
  {
    expenseCategory: "Travel", department: "Sales", currentAllocation: 75000,
    [SCENARIOS.BASELINE]:        { aiReduction: 5000, userDecision: USER_DECISION.ACCEPT, userAdjustment: 5000, impact: "Low. Shift some internal meetings to virtual.", confidence: AI_CONFIDENCE.HIGH, aiInsight: "Analysis of travel logs indicates 10% of trips are for internal meetings." },
    [SCENARIOS.AI_OPTIMIZED]:    { aiReduction: 5000, userDecision: USER_DECISION.ACCEPT, userAdjustment: 5000, impact: "Low. Shift some internal meetings to virtual.", confidence: AI_CONFIDENCE.HIGH, aiInsight: "Analysis of travel logs indicates 10% of trips are for internal meetings." },
    [SCENARIOS.AGGRESSIVE_SAVINGS]:{ aiReduction: 25000, userDecision: USER_DECISION.ACCEPT, userAdjustment: 25000, impact: "Medium. Limit travel to strategic accounts only.", confidence: AI_CONFIDENCE.MED, aiInsight: "Reduces travel budget by 33%, focusing only on top-tier client visits." },
  },
];

const AICostOptimizationSuggestions = () => {
  const [activeTab, setActiveTab] = useState("recommendations");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [optimizationData, setOptimizationData] = useState(JSON.parse(JSON.stringify(initialOptimizationData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard review. User decisions override AI suggestions. No major operational changes assumed.",
    [SCENARIOS.AI_OPTIMIZED]: "Assumes AI suggestions are accepted by default unless there's a strong business case to reject. Aims for max efficiency.",
    [SCENARIOS.AGGRESSIVE_SAVINGS]: "Prioritizes cash preservation. Accepts all AI suggestions and seeks further manual reductions where possible, accepting higher operational risk.",
  });

  const [optimizationVersions, setOptimizationVersions] = useState([]);
  const [optimizationTotals, setOptimizationTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { aiReduction: 0, userDecision: USER_DECISION.REJECT, userAdjustment: 0, impact: "N/A", confidence: AI_CONFIDENCE.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { identified: 0, approved: 0, current: 0, byDepartment: {}, decisions: { Accept: 0, Adjust: 0, Reject: 0 } };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.identified += scenarioData.aiReduction;
      totals.current += item.currentAllocation;
      
      if (scenarioData.userDecision !== USER_DECISION.REJECT) {
        totals.approved += scenarioData.userAdjustment;
      }
      
      totals.decisions[scenarioData.userDecision]++;

      if (!totals.byDepartment[item.department]) totals.byDepartment[item.department] = { savings: 0 };
      if (scenarioData.userDecision !== USER_DECISION.REJECT) {
        totals.byDepartment[item.department].savings += scenarioData.userAdjustment;
      }
    });
    return totals;
  };

  useEffect(() => {
    setOptimizationTotals(calculateTotalsForScenario(optimizationData, activeScenario));
  }, [optimizationData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setOptimizationData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      scenarioItem[field] = field === 'userAdjustment' ? (parseFloat(value) || 0) : value;
      // Auto-adjust decision based on input
      if (field === 'userAdjustment') {
        if(parseFloat(value) === 0) scenarioItem.userDecision = USER_DECISION.REJECT;
        else if(parseFloat(value) === scenarioItem.aiReduction) scenarioItem.userDecision = USER_DECISION.ACCEPT;
        else scenarioItem.userDecision = USER_DECISION.ADJUST;
      }
      if (field === 'userDecision' && value === USER_DECISION.REJECT) scenarioItem.userAdjustment = 0;
      if (field === 'userDecision' && value === USER_DECISION.ACCEPT) scenarioItem.userAdjustment = scenarioItem.aiReduction;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(optimizationData, scen);
    });
    setOptimizationVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(optimizationData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Optimization plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = optimizationData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Expense Category': item.expenseCategory, 'Department': item.department,
        'Current Allocation': item.currentAllocation, 'AI Suggested Reduction': scenarioData.aiReduction,
        'User Decision': scenarioData.userDecision, 'Final Reduction': scenarioData.userAdjustment,
        'Forecasted Impact': scenarioData.impact, 'AI Confidence': scenarioData.confidence,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Cost Optimization`);
    XLSX.writeFile(workbook, `Cost_Optimization_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(optimizationData.map(d => [`${d.department}-${d.expenseCategory}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Expense Category']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userDecision = row['User Decision'] ?? scenarioItem.userDecision;
          scenarioItem.userAdjustment = row['Final Reduction'] ?? scenarioItem.userAdjustment;
          dataMap.set(key, itemToUpdate);
        }
      });
      setOptimizationData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setOptimizationData(JSON.parse(JSON.stringify(version.data)));
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
  const barChartData = {
    labels: Object.keys(optimizationTotals.byDepartment || {}),
    datasets: [{ label: 'Approved Savings by Department', data: Object.values(optimizationTotals.byDepartment || {}).map(d => d.savings), backgroundColor: 'rgba(16, 185, 129, 0.7)' }],
  };
  const pieChartData = {
    labels: Object.keys(optimizationTotals.decisions || {}),
    datasets: [{ data: Object.values(optimizationTotals.decisions || {}), backgroundColor: ['#10b981', '#f97316', '#ef4444'], hoverOffset: 4 }],
  };
  
  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Breadcrumb Navigation */}
                                <nav className="flex mb-4" aria-label="Breadcrumb">
                                  <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                                    <li className="inline-flex items-center">
                                      <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
                                        <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
                                        </svg>
                                        Home
                                      </Link>
                                    </li>
                                    <li>
                                      <div className="flex items-center">
                                        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                        <Link to="/operational-budgeting" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                                          Operational Budgeting
                                        </Link>
                                      </div>
                                    </li>
                                    <li aria-current="page">
                                      <div className="flex items-center">
                                        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                        <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">AI Cost Opimization</span>
                                      </div>
                                    </li>
                                  </ol>
                                </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">AI-Based Cost Optimization Suggestions</h1><p className="text-sky-100 text-x">Identify areas to reduce spending without impacting operations.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'recommendations', label: 'AI Recommendations'}, {id: 'import', label: 'Import Suggestions'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'recommendations' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Optimization Identified</p><p className="text-2xl font-bold text-sky-900">${(optimizationTotals?.identified || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Approved Reductions</p><p className="text-2xl font-bold text-green-600">${(optimizationTotals?.approved || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Potential Savings % of Budget</p><p className="text-2xl font-bold text-green-600">{optimizationTotals.current > 0 ? ((optimizationTotals.approved / optimizationTotals.current) * 100).toFixed(getDecimalPrecision()) : 0}%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Savings by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Accepted vs. Rejected Suggestions</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Cost Optimization Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Expense / Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Current Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">AI Reduction</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Decision</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Final Reduction</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Adjusted Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {optimizationData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.expenseCategory}</div><div className="text-x text-sky-600">{item.department}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.currentAllocation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiReduction.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                                <div className={`text-x font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${getConfidenceColor(scenarioData.confidence)}`}>{scenarioData.confidence}</div>
                            </td>
                            <td className="px-2 py-1"><select value={scenarioData.userDecision} onChange={(e) => handleInputChange(index, 'userDecision', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">{Object.values(USER_DECISION).map(t=><option key={t}>{t}</option>)}</select></td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userAdjustment} onChange={(e) => handleInputChange(index, 'userAdjustment', e.target.value)} disabled={scenarioData.userDecision === USER_DECISION.REJECT} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white disabled:bg-gray-100"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${(item.currentAllocation - scenarioData.userAdjustment).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Optimization Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Operational constraints, review notes...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Suggested Savings</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with optimization suggestions. Match by 'Department' and 'Expense Category'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Expense Category', 'User Decision', and 'Final Reduction' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Optimization Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Approved Savings', 'Total Identified by AI', 'Final Budget', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(optimizationData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total Approved Savings') { value = `$${(totals.approved || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-green-600"; }
                        else if (metric === 'Total Identified by AI') { value = `$${(totals.identified || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Final Budget') { value = `$${(totals.current - totals.approved).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Optimization Plan Version History</h2>
          {optimizationVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Savings</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {optimizationVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { approved: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-green-600">${total.approved.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default AICostOptimizationSuggestions;