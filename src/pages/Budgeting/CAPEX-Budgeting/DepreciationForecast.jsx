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
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight} from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  ACCELERATED: "Accelerated Depreciation",
  STRAIGHT_LINE: "Straight-Line (Default)",
};

const DEPRECIATION_METHOD = {
  STRAIGHT_LINE: "Straight-Line",
  DOUBLE_DECLINING: "Double-Declining Balance",
  NONE: "N/A (Amortization)",
};

// Mock data for D&A forecasting
const initialAssetData = [
  {
    assetName: "Manufacturing Equipment", category: "Equipment", cost: 500000,
    [SCENARIOS.BASELINE]:        { life: 10, method: DEPRECIATION_METHOD.STRAIGHT_LINE, aiInsight: "Standard 10-year life for heavy machinery." },
    [SCENARIOS.ACCELERATED]:     { life: 10, method: DEPRECIATION_METHOD.DOUBLE_DECLINING, aiInsight: "Higher expense in early years, reflecting faster loss of utility." },
    [SCENARIOS.STRAIGHT_LINE]:   { life: 10, method: DEPRECIATION_METHOD.STRAIGHT_LINE, aiInsight: "Even expense distribution over the asset's life." },
  },
  {
    assetName: "Custom Software Development", category: "Intangible Asset", cost: 120000,
    [SCENARIOS.BASELINE]:        { life: 3, method: DEPRECIATION_METHOD.NONE, aiInsight: "Amortized over 3 years, typical for software." },
    [SCENARIOS.ACCELERATED]:     { life: 3, method: DEPRECIATION_METHOD.NONE, aiInsight: "Amortization period is fixed by accounting standards." },
    [SCENARIOS.STRAIGHT_LINE]:   { life: 3, method: DEPRECIATION_METHOD.NONE, aiInsight: "Amortization period is fixed by accounting standards." },
  },
  {
    assetName: "Office Computers", category: "Technology", cost: 80000,
    [SCENARIOS.BASELINE]:        { life: 5, method: DEPRECIATION_METHOD.STRAIGHT_LINE, aiInsight: "Standard 5-year lifespan for IT hardware." },
    [SCENARIOS.ACCELERATED]:     { life: 5, method: DEPRECIATION_METHOD.DOUBLE_DECLINING, aiInsight: "Reflects faster obsolescence of technology." },
    [SCENARIOS.STRAIGHT_LINE]:   { life: 5, method: DEPRECIATION_METHOD.STRAIGHT_LINE, aiInsight: "Simple, consistent expense recognition." },
  },
];

const DepreciationAmortizationForecasting = () => {
  const [activeTab, setActiveTab] = useState("forecast");
  const [period, setPeriod] = useState("12 Months");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [assetData, setAssetData] = useState(JSON.parse(JSON.stringify(initialAssetData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Uses a mix of Straight-Line and accelerated methods based on asset class to balance tax benefits and P&L impact.",
    [SCENARIOS.ACCELERATED]: "Prioritizes accelerated depreciation (e.g., Double-Declining Balance) to maximize early-year tax deductions.",
    [SCENARIOS.STRAIGHT_LINE]: "Uses Straight-Line depreciation for all applicable assets for simplicity and predictable expense reporting.",
  });

  const [forecastVersions, setForecastVersions] = useState([]);
  const [forecastTotals, setForecastTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { life: 0, method: DEPRECIATION_METHOD.STRAIGHT_LINE, aiInsight: "N/A" };
  };
  
  const calculateMonthlyExpense = (cost, life, method) => {
    if (life <= 0) return 0;
    if (method === DEPRECIATION_METHOD.STRAIGHT_LINE) {
        return cost / (life * 12);
    }
    if (method === DEPRECIATION_METHOD.DOUBLE_DECLINING) {
        // This is a simplified calculation for one month. A real implementation would track remaining book value.
        return (cost / life) * 2 / 12; 
    }
    // Amortization (treated like Straight-Line here)
    if (method === DEPRECIATION_METHOD.NONE) {
        return cost / (life * 12);
    }
    return 0;
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { depreciation: 0, amortization: 0, byCategory: {} };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const monthlyExpense = calculateMonthlyExpense(item.cost, scenarioData.life, scenarioData.method);
      const totalExpense = monthlyExpense * 12; // For annual view

      if (scenarioData.method === DEPRECIATION_METHOD.NONE) {
        totals.amortization += totalExpense;
      } else {
        totals.depreciation += totalExpense;
      }
      
      totals.byCategory[item.category] = (totals.byCategory[item.category] || 0) + totalExpense;
    });
    return totals;
  };

  useEffect(() => {
    setForecastTotals(calculateTotalsForScenario(assetData, activeScenario));
  }, [assetData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setAssetData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      scenarioItem[field] = (field === 'life') ? parseFloat(value) || 0 : value;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
      totalsByScenario[scen] = calculateTotalsForScenario(assetData, scen);
    });
    setForecastVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(assetData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("D&A forecast version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = assetData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Asset Name': item.assetName, 'Category': item.category,
        'Purchase Cost': item.cost, 'Useful Life (Years)': scenarioData.life,
        'Depreciation Method': scenarioData.method,
        'Monthly Expense': calculateMonthlyExpense(item.cost, scenarioData.life, scenarioData.method),
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Depreciation Forecast`);
    XLSX.writeFile(workbook, `Depreciation_Forecast_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(assetData.map(d => [d.assetName, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const assetName = row['Asset Name'];
        if (dataMap.has(assetName)) {
          const itemToUpdate = dataMap.get(assetName);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          itemToUpdate.cost = row['Purchase Cost'] ?? itemToUpdate.cost;
          scenarioItem.life = row['Useful Life (Years)'] ?? scenarioItem.life;
          scenarioItem.method = row['Depreciation Method'] ?? scenarioItem.method;
          dataMap.set(assetName, itemToUpdate);
        }
      });
      setAssetData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Asset data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setAssetData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(forecastTotals.byCategory || {}),
    datasets: [{ label: 'Annual Expense by Asset Category', data: Object.values(forecastTotals.byCategory || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316'] }],
  };
  const pieChartData = {
    labels: ['Depreciation', 'Amortization'],
    datasets: [{ data: [forecastTotals.depreciation || 0, forecastTotals.amortization || 0], backgroundColor: ['#3b82f6', '#f97316'], hoverOffset: 4 }],
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
					Depreciation Forecast
				</span>
			</div>
		</li>
	</ol>
</nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Depreciation & Amortization Forecasting</h1><p className="text-sky-100 text-x">Understand the financial impact of capital assets over time.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>12 Months</option><option>24 Months</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'forecast', label: 'Forecast D&A'}, {id: 'import', label: 'Import Assets'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'forecast' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Depreciation Forecast (Annual)</p><p className="text-2xl font-bold text-sky-900">${(forecastTotals?.depreciation || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Amortization Forecast (Annual)</p><p className="text-2xl font-bold text-sky-900">${(forecastTotals?.amortization || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Cumulative Expense Impact</p><p className="text-2xl font-bold text-red-600">${((forecastTotals.depreciation || 0) + (forecastTotals.amortization || 0)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Asset Category Impact</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Expense Allocation by Type</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">D&A Forecast Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Forecast</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Asset Name / Category</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Purchase Cost</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Useful Life (Yrs)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[200px]">Depreciation Method</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Monthly Expense</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {assetData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const monthlyExpense = calculateMonthlyExpense(item.cost, scenarioData.life, scenarioData.method);
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.assetName}</div><div className="text-x text-sky-600">{item.category}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.cost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.life} onChange={(e) => handleInputChange(index, 'life', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1">
                                <select value={scenarioData.method} onChange={(e) => handleInputChange(index, 'method', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">{Object.values(DEPRECIATION_METHOD).map(d=><option key={d}>{d}</option>)}</select>
                            </td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">
                                <div className="relative group">${monthlyExpense.toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Depreciation methods, useful life rationale...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Asset Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your asset data. This will update the forecast for the active scenario.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Asset Name', 'Purchase Cost', 'Useful Life (Years)', and 'Depreciation Method'.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Financial Impact Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total D&A Expense', 'Depreciation', 'Amortization', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(assetData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total D&A Expense') { value = `$${((totals.depreciation || 0) + (totals.amortization || 0)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Depreciation') { value = `$${(totals.depreciation || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Amortization') { value = `$${(totals.amortization || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
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
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Expense</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {forecastVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { depreciation: 0, amortization: 0 };
                        const totalExpense = total.depreciation + total.amortization;
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${totalExpense.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default DepreciationAmortizationForecasting;