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
  HIGH_INFLATION: "High Inflation (5%)",
  FX_VOLATILITY: "FX Volatility (-3%)",
  RECESSION_RISK: "Recession Risk",
};

const RISK_LEVEL = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for simulations
const initialSimulationData = [
  {
    category: "Product Revenue", department: "Sales", originalBudget: 1200000, isRevenue: true,
    [SCENARIOS.BASELINE]:        { economicFactor: 0, aiImpact: 0, userOverride: 0, risk: RISK_LEVEL.LOW, aiInsight: "Market conditions stable." },
    [SCENARIOS.HIGH_INFLATION]:  { economicFactor: -2, aiImpact: -24000, userOverride: -24000, risk: RISK_LEVEL.MED, aiInsight: "Consumer spending power reduction may slightly decrease sales." },
    [SCENARIOS.FX_VOLATILITY]:   { economicFactor: -3, aiImpact: -36000, userOverride: -36000, risk: RISK_LEVEL.MED, aiInsight: "Negative FX translation on international sales." },
    [SCENARIOS.RECESSION_RISK]:  { economicFactor: -15, aiImpact: -180000, userOverride: -180000, risk: RISK_LEVEL.HIGH, aiInsight: "Significant demand drop projected in a recessionary environment." },
  },
  {
    category: "COGS", department: "Operations", originalBudget: -400000,
    [SCENARIOS.BASELINE]:        { economicFactor: 0, aiImpact: 0, userOverride: 0, risk: RISK_LEVEL.LOW, aiInsight: "Supplier costs are stable." },
    [SCENARIOS.HIGH_INFLATION]:  { economicFactor: 5, aiImpact: -20000, userOverride: -20000, risk: RISK_LEVEL.HIGH, aiInsight: "Raw material and shipping costs expected to rise with inflation." },
    [SCENARIOS.FX_VOLATILITY]:   { economicFactor: 1, aiImpact: -4000, userOverride: -4000, risk: RISK_LEVEL.LOW, aiInsight: "Minor cost increase from international suppliers." },
    [SCENARIOS.RECESSION_RISK]:  { economicFactor: -2, aiImpact: 8000, userOverride: 8000, risk: RISK_LEVEL.MED, aiInsight: "Supplier demand may drop, allowing for some price negotiation." },
  },
  {
    category: "Marketing Spend", department: "Marketing", originalBudget: -150000,
    [SCENARIOS.BASELINE]:        { economicFactor: 0, aiImpact: 0, userOverride: 0, risk: RISK_LEVEL.LOW, aiInsight: "Ad platform costs stable." },
    [SCENARIOS.HIGH_INFLATION]:  { economicFactor: 3, aiImpact: -4500, userOverride: -4500, risk: RISK_LEVEL.MED, aiInsight: "Digital ad platforms may increase pricing." },
    [SCENARIOS.FX_VOLATILITY]:   { economicFactor: 0, aiImpact: 0, userOverride: 0, risk: RISK_LEVEL.LOW, aiInsight: "Primarily domestic ad spend, minimal FX impact." },
    [SCENARIOS.RECESSION_RISK]:  { economicFactor: -25, aiImpact: 37500, userOverride: 37500, risk: RISK_LEVEL.HIGH, aiInsight: "Recommended to cut discretionary marketing spend significantly." },
  },
];

const MarketEconomicSimulations = () => {
  const [activeTab, setActiveTab] = useState("run");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [simulationData, setSimulationData] = useState(JSON.parse(JSON.stringify(initialSimulationData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes stable market conditions with 2% inflation and minimal FX movement, aligned with central bank targets.",
    [SCENARIOS.HIGH_INFLATION]: "Models a 5% inflation rate, impacting COGS and operating expenses. Assumes a 2% corresponding drop in consumer demand.",
    [SCENARIOS.FX_VOLATILITY]: "Models a -3% unfavorable foreign exchange movement, impacting international revenue and some supplier costs.",
    [SCENARIOS.RECESSION_RISK]: "Models a broad economic downturn, with a 15% projected decrease in revenue and a mandate to cut discretionary spending by 25%.",
  });

  const [simulationVersions, setSimulationVersions] = useState([]);
  const [simulationTotals, setSimulationTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { economicFactor: 0, aiImpact: 0, userOverride: 0, risk: RISK_LEVEL.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { original: 0, aiAdjusted: 0, userAdjusted: 0, costImpact: {}, revenueImpact: 0 };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const aiFinal = item.originalBudget + scenarioData.aiImpact;
      const userFinal = item.originalBudget + scenarioData.userOverride;

      totals.original += item.originalBudget;
      totals.aiAdjusted += aiFinal;
      totals.userAdjusted += userFinal;

      if(item.isRevenue) {
        totals.revenueImpact += scenarioData.userOverride;
      } else {
        totals.costImpact[item.category] = (totals.costImpact[item.category] || 0) + scenarioData.userOverride;
      }
    });
    return totals;
  };

  useEffect(() => {
    setSimulationTotals(calculateTotalsForScenario(simulationData, activeScenario));
  }, [simulationData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setSimulationData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      const parsedValue = parseFloat(value) || 0;
      
      if (field === 'economicFactor') {
        scenarioItem.economicFactor = parsedValue;
        const impact = newData[index].originalBudget * (parsedValue / 100);
        scenarioItem.aiImpact = impact;
        scenarioItem.userOverride = impact;
      } else {
        scenarioItem[field] = parsedValue;
      }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(simulationData, scen);
    });
    setSimulationVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(simulationData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Simulation version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = simulationData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      const finalForecast = item.originalBudget + scenarioData.userOverride;
      return {
        'Category': item.category, 'Department': item.department,
        'Original Budget': item.originalBudget, 'Economic Factor (%)': scenarioData.economicFactor,
        'User Override': scenarioData.userOverride, 'Final Forecast': finalForecast,
        'Risk Level': scenarioData.risk,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Market Simulation`);
    XLSX.writeFile(workbook, `Market_Simulation_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(simulationData.map(d => [d.category, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const category = row['Category'];
        if (dataMap.has(category)) {
          const itemToUpdate = dataMap.get(category);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.economicFactor = row['Economic Factor (%)'] ?? scenarioItem.economicFactor;
          scenarioItem.userOverride = row['User Override'] ?? scenarioItem.userOverride;
          dataMap.set(category, itemToUpdate);
        }
      });
      setSimulationData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review AI suggestions.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setSimulationData(JSON.parse(JSON.stringify(version.data)));
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
    labels: simulationData.map(d => d.category),
    datasets: [
      { label: 'Original Forecast', data: simulationData.map(d => d.originalBudget), borderColor: 'rgba(156, 163, 175, 1)', tension: 0.1 },
      { label: 'AI-Adjusted Forecast', data: simulationData.map(d => d.originalBudget + getScenarioDataItem(d, activeScenario).aiImpact), borderColor: 'rgba(16, 185, 129, 1)', tension: 0.1 },
      { label: 'User-Adjusted Forecast', data: simulationData.map(d => d.originalBudget + getScenarioDataItem(d, activeScenario).userOverride), borderColor: 'rgba(59, 130, 246, 1)', tension: 0.1 },
    ],
  };
  const barChartData = {
    labels: Object.keys(simulationTotals.costImpact || {}),
    datasets: [{ label: 'Cost Impact ($)', data: Object.values(simulationTotals.costImpact || {}), backgroundColor: 'rgba(239, 68, 68, 0.7)' }]
  };
  
  const budgetDeviation = (simulationTotals.userAdjusted || 0);

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
                      Market-Economic Simulations
                    </span>
                  </div>
                </li>
              </ol>
            </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Market & Economic Condition Simulations</h1><p className="text-sky-100 text-x">What happens if inflation rises by 5%?</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'run', label: 'Run Simulations'}, {id: 'import', label: 'Import Macro Data'}, {id: 'compare', label: 'Compare Outcomes'}].map(tab => (
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
        {activeTab === 'run' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Inflation Impact on Costs</p><p className="text-2xl font-bold text-red-600">${Object.values(simulationTotals.costImpact || {}).reduce((a,b)=>a+b, 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">AI-Adjusted Revenue Forecast</p><p className="text-2xl font-bold text-sky-900">${(simulationData[0].originalBudget + getScenarioDataItem(simulationData[0], activeScenario).aiImpact).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Net Budget Deviation</p><p className={`text-2xl font-bold ${budgetDeviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>${budgetDeviation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Original vs. AI-Adjusted Forecast</h2><div className="h-[250px]"><Line data={lineChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Cost Impact by Category</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Simulation Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Simulation</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Category / Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Original Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Economic Factor (%)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">AI Impact</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {simulationData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.category}</div><div className="text-x text-sky-600">{item.department}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.originalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.economicFactor} onChange={(e) => handleInputChange(index, 'economicFactor', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiImpact.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
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
                <label className="block text-md font-semibold text-sky-800 mb-2">Market Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Describe macroeconomic drivers, data sources...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Macroeconomic Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with economic factors or manual overrides. This will trigger new AI suggestions.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Category', 'Economic Factor (%)', and 'User Override' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Scenario Outcomes</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Final Net Budget', 'Original Net Budget', 'Net Impact', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(simulationData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Final Net Budget') { value = `$${(totals.userAdjusted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Original Net Budget') { value = `$${(totals.original || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Net Impact') { const impact = totals.userAdjusted - totals.original; value = `$${impact.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${impact >= 0 ? 'text-green-600' : 'text-red-600'}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Simulation Version History</h2>
          {simulationVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Net Budget</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {simulationVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { userAdjusted: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.userAdjusted.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default MarketEconomicSimulations;