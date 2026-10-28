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
import { Line, Doughnut } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo,FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Low-Risk Environment",
  WORST_CASE: "High-Risk Environment",
};

const LIKELIHOOD = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for contingency budgeting
const initialContingencyData = [
  {
    riskType: "IT System Downtime", department: "IT", historicalCost: 75000,
    [SCENARIOS.BASELINE]:    { aiReserve: 50000, userAdjustment: 50000, likelihood: LIKELIHOOD.MED, aiInsight: "Based on 2 minor outages last year. Suggests reserving 2/3 of historical max cost." },
    [SCENARIOS.BEST_CASE]:   { aiReserve: 30000, userAdjustment: 30000, likelihood: LIKELIHOOD.LOW, aiInsight: "Recent infrastructure upgrades lower the risk profile significantly." },
    [SCENARIOS.WORST_CASE]:  { aiReserve: 80000, userAdjustment: 80000, likelihood: LIKELIHOOD.HIGH, aiInsight: "Aging hardware increases risk of major failure. Full replacement cost should be considered." },
  },
  {
    riskType: "Supply Chain Disruption", department: "Operations", historicalCost: 120000,
    [SCENARIOS.BASELINE]:    { aiReserve: 60000, userAdjustment: 60000, likelihood: LIKELIHOOD.MED, aiInsight: "Standard buffer for potential shipping delays (avg. 5 days)." },
    [SCENARIOS.BEST_CASE]:   { aiReserve: 40000, userAdjustment: 40000, likelihood: LIKELIHOOD.LOW, aiInsight: "Supplier diversification and stable geopolitical climate reduces risk." },
    [SCENARIOS.WORST_CASE]:  { aiReserve: 150000, userAdjustment: 150000, likelihood: LIKELIHOOD.HIGH, aiInsight: "Trade tensions and port strikes could lead to prolonged disruption." },
  },
  {
    riskType: "Major Client Default", department: "Finance", historicalCost: 90000,
    [SCENARIOS.BASELINE]:    { aiReserve: 25000, userAdjustment: 25000, likelihood: LIKELIHOOD.LOW, aiInsight: "Client portfolio is healthy. Reserve covers 1 mid-tier client default." },
    [SCENARIOS.BEST_CASE]:   { aiReserve: 10000, userAdjustment: 10000, likelihood: LIKELIHOOD.LOW, aiInsight: "Strong credit checks and diversified revenue make this unlikely." },
    [SCENARIOS.WORST_CASE]:  { aiReserve: 100000, userAdjustment: 100000, likelihood: LIKELIHOOD.MED, aiInsight: "Economic downturn could impact our largest client in the retail sector." },
  },
  {
    riskType: "Cybersecurity Breach", department: "IT", historicalCost: 200000,
    [SCENARIOS.BASELINE]:    { aiReserve: 100000, userAdjustment: 100000, likelihood: LIKELIHOOD.LOW, aiInsight: "Based on insurance deductible and initial incident response costs." },
    [SCENARIOS.BEST_CASE]:   { aiReserve: 75000, userAdjustment: 75000, likelihood: LIKELIHOOD.LOW, aiInsight: "New EDR and SOC services have improved security posture." },
    [SCENARIOS.WORST_CASE]:  { aiReserve: 250000, userAdjustment: 250000, likelihood: LIKELIHOOD.MED, aiInsight: "Industry is facing a wave of sophisticated phishing attacks." },
  },
];

const EmergencyContingencyBudgeting = () => {
  const [activeTab, setActiveTab] = useState("plan");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [contingencyData, setContingencyData] = useState(JSON.parse(JSON.stringify(initialContingencyData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard risk assessment. Reserve funds are allocated based on a 50% probability-weighted impact of historical costs.",
    [SCENARIOS.BEST_CASE]: "Assumes a stable operating environment. Reserves are minimized to free up capital, covering only high-likelihood, low-impact events.",
    [SCENARIOS.WORST_CASE]: "Assumes a volatile environment. Reserves are increased to cover worst-case historical costs for all medium-to-high likelihood risks.",
  });

  const [contingencyVersions, setContingencyVersions] = useState([]);
  const [contingencyTotals, setContingencyTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { aiReserve: 0, userAdjustment: 0, likelihood: LIKELIHOOD.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { aiReserve: 0, userReserve: 0, totalExposure: 0, byRiskType: {} };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.aiReserve += scenarioData.aiReserve;
      totals.userReserve += scenarioData.userAdjustment;
      totals.totalExposure += item.historicalCost;
      totals.byRiskType[item.riskType] = (totals.byRiskType[item.riskType] || 0) + scenarioData.userAdjustment;
    });
    return totals;
  };

  useEffect(() => {
    setContingencyTotals(calculateTotalsForScenario(contingencyData, activeScenario));
  }, [contingencyData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setContingencyData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData[index][activeScenario][field] = field === 'userAdjustment' ? (parseFloat(value) || 0) : value;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(contingencyData, scen);
    });
    setContingencyVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(contingencyData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Contingency plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = contingencyData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Risk Type': item.riskType,
        'Department': item.department,
        'Historical Cost': item.historicalCost,
        'Likelihood': scenarioData.likelihood,
        'AI Suggested Reserve': scenarioData.aiReserve,
        'User Adjusted Reserve': scenarioData.userAdjustment,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Contingency Plan`);
    XLSX.writeFile(workbook, `Contingency_Plan_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(contingencyData.map(d => [d.riskType, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const riskType = row['Risk Type'];
        if (dataMap.has(riskType)) {
          const itemToUpdate = dataMap.get(riskType);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userAdjustment = row['User Adjusted Reserve'] ?? scenarioItem.userAdjustment;
          scenarioItem.likelihood = row['Likelihood'] ?? scenarioItem.likelihood;
          dataMap.set(riskType, itemToUpdate);
        }
      });
      setContingencyData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review AI suggestions.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setContingencyData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getLikelihoodColor = (level) => {
    if (level === LIKELIHOOD.HIGH) return "bg-red-100 text-red-800 border-red-300";
    if (level === LIKELIHOOD.MED) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-green-100 text-green-800 border-green-300";
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const lineChartData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      { label: 'Forecasted Risk Exposure', data: [contingencyTotals.totalExposure, contingencyTotals.totalExposure * 1.1, contingencyTotals.totalExposure * 0.9, contingencyTotals.totalExposure * 1.2].map(v => v || 0), borderColor: 'rgba(239, 68, 68, 1)', tension: 0.1 },
      { label: 'Emergency Reserve (User)', data: Array(4).fill(contingencyTotals.userReserve || 0), borderColor: 'rgba(14, 165, 233, 1)', borderDash: [5, 5] },
    ],
  };
  const donutChartData = {
    labels: Object.keys(contingencyTotals.byRiskType || {}),
    datasets: [{ data: Object.values(contingencyTotals.byRiskType || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'], hoverOffset: 4 }],
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
                Emergency Contigency
              </span>
            </div>
          </li>
        </ol>
      </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Emergency Fund & Contingency Budgeting</h1><p className="text-sky-100 text-x">Allocate funds for unexpected expenses or downturns.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'plan', label: 'Plan Contingency Budget'}, {id: 'import', label: 'Import Budget Plan'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'plan' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Reserve (AI vs User)</p><p className="text-2xl font-bold text-sky-900">${(contingencyTotals?.aiReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-lg font-medium text-gray-500">vs</span> ${(contingencyTotals?.userReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Historical Utilization Rate</p><p className="text-2xl font-bold text-sky-900">15%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Buffer vs Risk Exposure</p><p className={`text-2xl font-bold ${(contingencyTotals.userReserve - contingencyTotals.totalExposure) < 0 ? 'text-red-600' : 'text-green-600'}`}>${(contingencyTotals.userReserve - contingencyTotals.totalExposure).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Reserve Allocation by Risk Type</h2><div className="h-[250px]"><Doughnut data={donutChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Reserve vs Forecasted Exposure</h2><div className="h-[250px]"><Line data={lineChartData} options={chartOptions}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold text-sky-900">Contingency Plan Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Risk Type / Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Historical Cost</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Suggested Reserve</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Final Allocation</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Likelihood</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {contingencyData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.riskType}</div>
                                <div className="text-x text-sky-600">{item.department}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.historicalCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiReserve.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userAdjustment} onChange={(e) => handleInputChange(index, 'userAdjustment', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${scenarioData.userAdjustment.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center"><span className={`text-x font-medium px-2 py-1 rounded-full border ${getLikelihoodColor(scenarioData.likelihood)}`}>{scenarioData.likelihood}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(contingencyTotals.totalExposure || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(contingencyTotals.aiReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td></td>
                            <td className="px-4 py-3 text-lg text-center text-sky-900">${(contingencyTotals.userReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Risk Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Risk methodology, % buffer strategy...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Emergency Budget Plan</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your contingency plan data. The system will match by 'Risk Type'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Risk Type', 'User Adjusted Reserve', and 'Likelihood' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Contingency Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User Reserve', 'Total AI Reserve', 'Total Risk Exposure', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(contingencyData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total User Reserve') { value = `$${(totals.userReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total AI Reserve') { value = `$${(totals.aiReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Total Risk Exposure') { value = `$${(totals.totalExposure || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-red-600"; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Plan Version History</h2>
          {contingencyVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} User Reserve</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {contingencyVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userReserve || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default EmergencyContingencyBudgeting;