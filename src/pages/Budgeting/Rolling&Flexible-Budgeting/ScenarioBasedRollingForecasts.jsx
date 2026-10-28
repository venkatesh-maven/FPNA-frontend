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
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiTrendingUp, FiTrendingDown, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Best Case (Tailwinds)",
  WORST_CASE: "Worst Case (Headwinds)",
};

const CONFIDENCE_LEVEL = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
};

// Mock data for rolling forecasts
const initialForecastData = [
  {
    category: "Product Revenue", previousForecast: 1200000,
    [SCENARIOS.BASELINE]:    { marketImpact: 2,  aiAdjustment: 24000, userOverride: 24000, confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Market demand is up 2% based on industry reports." },
    [SCENARIOS.BEST_CASE]:   { marketImpact: 5,  aiAdjustment: 60000, userOverride: 60000, confidence: CONFIDENCE_LEVEL.MED,  aiInsight: "Strong economic indicators could boost demand by up to 5%." },
    [SCENARIOS.WORST_CASE]:  { marketImpact: -3, aiAdjustment: -36000,userOverride: -36000,confidence: CONFIDENCE_LEVEL.MED,  aiInsight: "Potential competitor launch could decrease market share." },
  },
  {
    category: "Cost of Goods Sold (COGS)", previousForecast: -400000,
    [SCENARIOS.BASELINE]:    { marketImpact: 1.5,aiAdjustment: -6000, userOverride: -6000, confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Supply chain costs show a minor inflationary increase." },
    [SCENARIOS.BEST_CASE]:   { marketImpact: -1, aiAdjustment: 4000,  userOverride: 4000,  confidence: CONFIDENCE_LEVEL.LOW,  aiInsight: "New supplier agreement could yield minor cost savings." },
    [SCENARIOS.WORST_CASE]:  { marketImpact: 4,  aiAdjustment: -16000,userOverride: -16000,confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Geopolitical tensions may increase raw material costs by 4%." },
  },
  {
    category: "Marketing Spend", previousForecast: -150000,
    [SCENARIOS.BASELINE]:    { marketImpact: 0,  aiAdjustment: 0,      userOverride: 0,      confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Ad platform costs are stable." },
    [SCENARIOS.BEST_CASE]:   { marketImpact: 10, aiAdjustment: -15000,userOverride: -15000,confidence: CONFIDENCE_LEVEL.MED,  aiInsight: "Increased revenue forecast allows for higher marketing investment." },
    [SCENARIOS.WORST_CASE]:  { marketImpact: -20,aiAdjustment: 30000, userOverride: 30000, confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Reduced revenue outlook requires a 20% cut in discretionary spend." },
  },
  {
    category: "Headcount Cost", previousForecast: -300000,
    [SCENARIOS.BASELINE]:    { marketImpact: 1,  aiAdjustment: -3000, userOverride: -3000, confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Standard cost-of-living salary adjustments." },
    [SCENARIOS.BEST_CASE]:   { marketImpact: 1,  aiAdjustment: -3000, userOverride: -3000, confidence: CONFIDENCE_LEVEL.HIGH, aiInsight: "Stable headcount costs." },
    [SCENARIOS.WORST_CASE]:  { marketImpact: 3,  aiAdjustment: -9000, userOverride: -9000, confidence: CONFIDENCE_LEVEL.MED,  aiInsight: "Competitive labor market may require higher salary adjustments to retain talent." },
  },
];

const ScenarioBasedRollingForecasts = () => {
  const [activeTab, setActiveTab] = useState("edit");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [forecastData, setForecastData] = useState(JSON.parse(JSON.stringify(initialForecastData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes GDP growth of 2.1% and inflation at 2.5%. No major FX fluctuations expected.",
    [SCENARIOS.BEST_CASE]: "Assumes strong consumer spending (GDP +3%), favorable FX rates, and decreased supply chain friction.",
    [SCENARIOS.WORST_CASE]: "Models a potential economic slowdown (GDP +1%), high inflation (4%), and a 5% appreciation of the USD, impacting international revenue.",
  });

  const [forecastVersions, setForecastVersions] = useState([]);
  const [forecastTotals, setForecastTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { marketImpact: 0, aiAdjustment: 0, userOverride: 0, confidence: CONFIDENCE_LEVEL.LOW, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { previous: 0, aiForecast: 0, userForecast: 0, adjustmentsCount: 0, byCategory: {} };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const aiFinal = item.previousForecast + scenarioData.aiAdjustment;
      const userFinal = item.previousForecast + scenarioData.userOverride;

      totals.previous += item.previousForecast;
      totals.aiForecast += aiFinal;
      totals.userForecast += userFinal;
      if (scenarioData.aiAdjustment !== 0) totals.adjustmentsCount++;
      
      totals.byCategory[item.category] = { previous: item.previousForecast, user: scenarioData.userOverride };
    });
    return totals;
  };

  useEffect(() => {
    setForecastTotals(calculateTotalsForScenario(forecastData, activeScenario));
  }, [forecastData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setForecastData(prev => {
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
        totalsByScenario[scen] = calculateTotalsForScenario(forecastData, scen);
    });
    setForecastVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(forecastData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Rolling forecast version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = forecastData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      const finalForecast = item.previousForecast + scenarioData.userOverride;
      return {
        'Category': item.category,
        'Previous Forecast': item.previousForecast,
        'Market Impact (%)': scenarioData.marketImpact,
        'AI Suggested Adjustment': scenarioData.aiAdjustment,
        'User Override Adjustment': scenarioData.userOverride,
        'Final Rolling Forecast': finalForecast,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rolling Forecast`);
    XLSX.writeFile(workbook, `Rolling_Forecast_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(forecastData.map(d => [d.category, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const category = row['Category'];
        if (dataMap.has(category)) {
          const itemToUpdate = dataMap.get(category);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userOverride = row['User Override Adjustment'] ?? scenarioItem.userOverride;
          scenarioItem.marketImpact = row['Market Impact (%)'] ?? scenarioItem.marketImpact;
          dataMap.set(category, itemToUpdate);
        }
      });
      setForecastData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review AI suggestions.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setForecastData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getConfidenceColor = (level) => {
    if (level === CONFIDENCE_LEVEL.HIGH) return "bg-green-100 text-green-800";
    if (level === CONFIDENCE_LEVEL.MED) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const lineChartData = {
    labels: forecastData.map(d => d.category),
    datasets: [
      { label: 'AI Rolling Forecast', data: forecastData.map(d => d.previousForecast + getScenarioDataItem(d, activeScenario).aiAdjustment), borderColor: 'rgba(16, 185, 129, 1)', tension: 0.1 },
      { label: 'User Rolling Forecast', data: forecastData.map(d => d.previousForecast + getScenarioDataItem(d, activeScenario).userOverride), borderColor: 'rgba(239, 68, 68, 1)', tension: 0.1 },
    ],
  };
  const barChartData = {
    labels: Object.keys(forecastTotals.byCategory || {}),
    datasets: [
        { label: 'Previous Forecast', data: Object.values(forecastTotals.byCategory || {}).map(d => d.previous), backgroundColor: 'rgba(156, 163, 175, 0.7)', stack: 'Stack 0' },
        { label: 'User Adjustment', data: Object.values(forecastTotals.byCategory || {}).map(d => d.user), backgroundColor: 'rgba(59, 130, 246, 0.7)', stack: 'Stack 0' },
    ]
  };
  const barChartOptions = { ...chartOptions, scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'Amount ($)' } } } };
  
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
          Scenario Based Rolling Forecast
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Scenario-Based Rolling Forecasts</h1><p className="text-sky-100 text-x">AI models suggest adjustments based on market trends.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'edit', label: 'Edit Rolling Forecast'}, {id: 'import', label: 'Import Market Data'}, {id: 'compare', label: 'Compare Forecasts'}].map(tab => (
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
        {activeTab === 'edit' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Forecast (AI vs User)</p><p className="text-2xl font-bold text-sky-900">${(forecastTotals?.aiForecast || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-lg font-medium text-gray-500">vs</span> ${(forecastTotals?.userForecast || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Market-Driven Adjustments</p><p className="text-2xl font-bold text-sky-900">{forecastTotals.adjustmentsCount} Items</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">AI Confidence Range</p><p className="text-2xl font-bold text-sky-900">± 5-10%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Rolling Forecast Trend</h2><div className="h-[250px]"><Line data={lineChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Forecast Category Impact</h2><div className="h-[250px]"><Bar data={barChartData} options={barChartOptions} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Forecast Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Forecast</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Category</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Previous Forecast</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Market Impact</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Final Forecast</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {forecastData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const finalForecast = item.previousForecast + scenarioData.userOverride;
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>{item.category}</td>
                            <td className="px-2 py-1 text-center text-s">${item.previousForecast.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className={`px-2 py-1 text-center text-s font-medium ${scenarioData.marketImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>{scenarioData.marketImpact.toFixed(getDecimalPrecision())}%</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiAdjustment.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                                <div className={`text-x font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${getConfidenceColor(scenarioData.confidence)}`}>{scenarioData.confidence}</div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${finalForecast.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Net Income / Loss</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(forecastTotals.previous || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td colSpan={2}></td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">${(forecastTotals.userForecast - forecastTotals.previous || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-lg text-center text-sky-900">${(forecastTotals.userForecast || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Market Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., FX rates, demand trends, interest rates...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Market Data / Forecasts</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with market data or manual forecast overrides. This will trigger new AI suggestions for the active scenario.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Category', 'Market Impact (%)', and/or 'User Override Adjustment' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Forecast Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['User Rolling Forecast', 'Previous Forecast', 'Net Change', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(forecastData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'User Rolling Forecast') { value = `$${(totals.userForecast || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Previous Forecast') { value = `$${(totals.previous || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Net Change') { const variance = totals.userForecast - totals.previous; value = `$${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Forecast Version History</h2>
          {forecastVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Net Income</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {forecastVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userForecast || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default ScenarioBasedRollingForecasts;