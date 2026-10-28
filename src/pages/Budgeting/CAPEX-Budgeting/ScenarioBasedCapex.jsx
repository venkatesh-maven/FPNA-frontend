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
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  ACCELERATED: "Accelerated Investment",
  DELAYED: "Delayed Execution",
};

const RISK_LEVEL = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for CAPEX modeling
const initialCapexData = [
  {
    project: "New Factory Equipment", category: "Equipment", cost: 1500000,
    [SCENARIOS.BASELINE]:    { plannedStart: "2025-06-01", aiAdjustment: "On Schedule", userOverride: "2025-06-01", impact: "Improves output by 15% starting Q3.", risk: RISK_LEVEL.LOW, aiInsight: "Timing aligns with production demand forecast." },
    [SCENARIOS.ACCELERATED]: { plannedStart: "2025-06-01", aiAdjustment: "Accelerate to Q1", userOverride: "2025-03-01", impact: "Increases Q2 output, but higher upfront cash burn.", risk: RISK_LEVEL.MED, aiInsight: "Accelerating captures early market demand but strains cash." },
    [SCENARIOS.DELAYED]:     { plannedStart: "2025-06-01", aiAdjustment: "Delay to Q4", userOverride: "2025-10-01", impact: "Preserves cash but risks production bottleneck in Q3.", risk: RISK_LEVEL.HIGH, aiInsight: "Delaying saves cash but may fail to meet Q4 peak demand." },
  },
  {
    project: "HQ Office Expansion", category: "Facilities", cost: 3000000,
    [SCENARIOS.BASELINE]:    { plannedStart: "2025-09-01", aiAdjustment: "On Schedule", userOverride: "2025-09-01", impact: "Supports planned 2026 headcount growth.", risk: RISK_LEVEL.LOW, aiInsight: "Standard expansion project." },
    [SCENARIOS.ACCELERATED]: { plannedStart: "2025-09-01", aiAdjustment: "Accelerate to Q2", userOverride: "2025-05-01", impact: "Prepares for faster-than-expected hiring.", risk: RISK_LEVEL.MED, aiInsight: "Builds capacity ahead of need." },
    [SCENARIOS.DELAYED]:     { plannedStart: "2025-09-01", aiAdjustment: "Delay to 2026", userOverride: "2026-01-01", impact: "Significant cash savings, but may cause overcrowding.", risk: RISK_LEVEL.MED, aiInsight: "Defers major cash outlay, assuming slower hiring." },
  },
  {
    project: "GenAI R&D Initiative", category: "R&D", cost: 750000,
    [SCENARIOS.BASELINE]:    { plannedStart: "2025-01-15", aiAdjustment: "On Schedule", userOverride: "2025-01-15", impact: "Maintains competitive edge in product.", risk: RISK_LEVEL.MED, aiInsight: "Strategic imperative to keep pace with market." },
    [SCENARIOS.ACCELERATED]: { plannedStart: "2025-01-15", aiAdjustment: "On Schedule", userOverride: "2025-01-15", impact: "Cannot be accelerated further.", risk: RISK_LEVEL.MED, aiInsight: "Already on an aggressive timeline." },
    [SCENARIOS.DELAYED]:     { plannedStart: "2025-01-15", aiAdjustment: "Delay to Q3", userOverride: "2025-07-01", impact: "Loses first-mover advantage.", risk: RISK_LEVEL.HIGH, aiInsight: "Delaying this project cedes a 6-month window to competitors." },
  },
];

const ScenarioBasedCapexModeling = () => {
  const [activeTab, setActiveTab] = useState("model");
  const [period, setPeriod] = useState("12 Months");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [capexData, setCapexData] = useState(JSON.parse(JSON.stringify(initialCapexData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes all projects proceed as per the original timeline. Cash flow planning is based on these dates.",
    [SCENARIOS.ACCELERATED]: "Pulls forward all strategic projects to capture market opportunities sooner, accepting a higher near-term cash burn.",
    [SCENARIOS.DELAYED]: "Pushes back all non-essential CapEx by at least one quarter to preserve cash, accepting potential operational risks.",
  });

  const [capexVersions, setCapexVersions] = useState([]);
  const [capexTotals, setCapexTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { plannedStart: "N/A", aiAdjustment: "N/A", userOverride: "N/A", impact: "N/A", risk: RISK_LEVEL.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { totalCapex: 0, cashFlowImpact: 0, highRiskCount: 0, byCategory: {} };
    if (!data || data.length === 0) return totals;
    
    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.totalCapex += item.cost;
      if (scenarioData.risk === RISK_LEVEL.HIGH) totals.highRiskCount++;
      
      const baselineDate = new Date(getScenarioDataItem(item, SCENARIOS.BASELINE).plannedStart);
      const scenarioDate = new Date(scenarioData.userOverride);
      if(scenarioDate < baselineDate) totals.cashFlowImpact -= item.cost;
      if(scenarioDate > baselineDate) totals.cashFlowImpact += item.cost;

      if (!totals.byCategory[item.category]) totals.byCategory[item.category] = { cost: 0, count: 0 };
      totals.byCategory[item.category].cost += item.cost;
      totals.byCategory[item.category].count++;
    });
    return totals;
  };

  useEffect(() => {
    setCapexTotals(calculateTotalsForScenario(capexData, activeScenario));
  }, [capexData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setCapexData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData[index][activeScenario][field] = value;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
      totalsByScenario[scen] = calculateTotalsForScenario(capexData, scen);
    });
    setCapexVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(capexData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("CAPEX timing model saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = capexData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Project': item.project, 'Category': item.category, 'Cost': item.cost,
        'User Override Start Date': scenarioData.userOverride,
        'Financial Impact': scenarioData.impact, 'Risk Level': scenarioData.risk
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `CAPEX Timing`);
    XLSX.writeFile(workbook, `CAPEX_Timing_Model_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(capexData.map(d => [d.project, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const project = row['Project'];
        if (dataMap.has(project)) {
          const itemToUpdate = dataMap.get(project);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userOverride = row['User Override Start Date'] ?? scenarioItem.userOverride;
          dataMap.set(project, itemToUpdate);
        }
      });
      setCapexData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setCapexData(JSON.parse(JSON.stringify(version.data)));
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
  const lineChartData = {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
          { label: 'Baseline Outflow', data: [750000, 1500000, 3000000, 0], borderColor: 'rgba(156, 163, 175, 1)', tension: 0.1},
          { label: `${activeScenario} Outflow`, data: [2750000, 3000000, 0, 0], borderColor: 'rgba(59, 130, 246, 1)', tension: 0.1},
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
                to="/capex-budgeting"
                className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                CAPEX Budgeting
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                Scenario Based CAPEX
              </span>
            </div>
          </li>
        </ol>
      </nav>
      
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Scenario-Based CAPEX Modeling</h1><p className="text-sky-100 text-x">How does delaying or accelerating CAPEX affect finances?</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>12 Months</option><option>24 Months</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'model', label: 'Model Timing Scenarios'}, {id: 'import', label: 'Import Models'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total CAPEX Planned</p><p className="text-2xl font-bold text-sky-900">${(capexTotals?.totalCapex || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Cash Flow Impact this Q</p><p className={`text-2xl font-bold ${(capexTotals?.cashFlowImpact || 0) <= 0 ? 'text-red-600' : 'text-green-600'}`}>${(capexTotals?.cashFlowImpact || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Operational Risk from Delay</p><p className="text-2xl font-bold text-red-600">{capexTotals.highRiskCount} High Risk Items</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">CAPEX Outflow Over Time</h2><div className="h-[250px]"><Line data={lineChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Project Timing vs. Impact</h2><div className="h-[250px]">{/* Placeholder for second chart */}</div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">CAPEX Timing Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Project / Category</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Cost</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Planned Start</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">User Override</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">Financial Impact</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {capexData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.project}</div><div className="text-x text-sky-600">{item.category}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.cost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s">{getScenarioDataItem(item, SCENARIOS.BASELINE).plannedStart}</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">{scenarioData.aiAdjustment} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="date" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-4 py-3 text-s text-left text-red-600">{scenarioData.impact}</td>
                            <td className="px-2 py-1 text-center"><span className={`text-x font-bold px-2 py-1 rounded-full border ${getRiskColor(scenarioData.risk)}`}>{scenarioData.risk}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Timing Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Timing strategies, market conditions, project dependencies...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Timing Models</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your CAPEX project dates. Match by 'Project'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Project' and 'User Override Start Date' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Timing Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total CAPEX', 'Cash Flow Impact (Q1)', 'High-Risk Delays', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(capexData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total CAPEX') { value = `$${(totals.totalCapex || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Cash Flow Impact (Q1)') { value = `$${(totals.cashFlowImpact || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${(totals.cashFlowImpact || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`; }
                        else if (metric === 'High-Risk Delays') { value = `${totals.highRiskCount} items`; className = "text-s font-semibold text-red-600"; }
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
          {capexVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total CAPEX</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {capexVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { totalCapex: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.totalCapex.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default ScenarioBasedCapexModeling;