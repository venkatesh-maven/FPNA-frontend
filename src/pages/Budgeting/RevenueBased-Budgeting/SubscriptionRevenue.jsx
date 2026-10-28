import React, { useState, useRef, useEffect } from "react";
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
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  GROWTH_MRR: "Growth MRR",
  CHURN_RISK: "Churn Risk",
};

// Mock data for subscription budgeting
const initialSubscriptionData = [
  {
    product: "Pro Plan",
    [SCENARIOS.BASELINE]:        { currentMrr: 120000, forecastedMrr: 125000, allocation: 25000, userOverride: 25000, aiInsight: "Steady growth based on historical trends." },
    [SCENARIOS.GROWTH_MRR]:      { currentMrr: 120000, forecastedMrr: 140000, allocation: 35000, userOverride: 35000, aiInsight: "Assumes successful Q1 marketing campaign drives higher sign-ups." },
    [SCENARIOS.CHURN_RISK]:      { currentMrr: 120000, forecastedMrr: 110000, allocation: 20000, userOverride: 20000, aiInsight: "Models a 5% churn event due to competitor launch." },
  },
  {
    product: "Enterprise Plan",
    [SCENARIOS.BASELINE]:        { currentMrr: 300000, forecastedMrr: 320000, allocation: 80000, userOverride: 80000, aiInsight: "Includes two major enterprise renewals expected in Q1." },
    [SCENARIOS.GROWTH_MRR]:      { currentMrr: 300000, forecastedMrr: 350000, allocation: 95000, userOverride: 95000, aiInsight: "Higher forecast includes a major upsell opportunity." },
    [SCENARIOS.CHURN_RISK]:      { currentMrr: 300000, forecastedMrr: 280000, allocation: 70000, userOverride: 70000, aiInsight: "One major renewal is at risk of downgrading." },
  },
  {
    product: "Starter Plan",
    [SCENARIOS.BASELINE]:        { currentMrr: 50000, forecastedMrr: 52000, allocation: 10000, userOverride: 10000, aiInsight: "Stable, with slight organic growth." },
    [SCENARIOS.GROWTH_MRR]:      { currentMrr: 50000, forecastedMrr: 55000, allocation: 12000, userOverride: 12000, aiInsight: "Benefits from top-of-funnel marketing halo effect." },
    [SCENARIOS.CHURN_RISK]:      { currentMrr: 50000, forecastedMrr: 48000, allocation: 8000, userOverride: 8000, aiInsight: "Slight churn expected as users upgrade or leave." },
  },
];

const SubscriptionRevenueBudgeting = () => {
  const [activeTab, setActiveTab] = useState("forecast");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [subscriptionData, setSubscriptionData] = useState(JSON.parse(JSON.stringify(initialSubscriptionData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes a 2% monthly net MRR growth and a 5% annual churn rate. Budget allocation is set at 25% of forecasted MRR.",
    [SCENARIOS.GROWTH_MRR]: "Models a 4% monthly net MRR growth, driven by expansion revenue. Budget allocation increased to 30% to fuel growth.",
    [SCENARIOS.CHURN_RISK]: "Models a one-time 10% churn event, with flat growth otherwise. Budget allocation reduced to 20% to conserve cash.",
  });

  const [budgetVersions, setBudgetVersions] = useState([]);
  const [budgetTotals, setBudgetTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { currentMrr: 0, forecastedMrr: 0, allocation: 0, userOverride: 0, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { mrr: 0, arr: 0, totalBudget: 0, byProduct: {} };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const finalBudget = scenarioData.userOverride;

      totals.mrr += scenarioData.forecastedMrr;
      totals.totalBudget += finalBudget;
      totals.byProduct[item.product] = finalBudget;
    });
    totals.arr = totals.mrr * 12;
    return totals;
  };

  useEffect(() => {
    setBudgetTotals(calculateTotalsForScenario(subscriptionData, activeScenario));
  }, [subscriptionData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setSubscriptionData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      scenarioItem[field] = parseFloat(value) || 0;
      
      if (field === 'forecastedMrr') {
        const newAiAllocation = (parseFloat(value) || 0) * 0.25;
        scenarioItem.allocation = newAiAllocation;
        scenarioItem.userOverride = newAiAllocation;
      }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(subscriptionData, scen);
    });
    setBudgetVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(subscriptionData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Subscription budget version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = subscriptionData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Product': item.product,
        'Current MRR': scenarioData.currentMrr,
        'Forecasted MRR': scenarioData.forecastedMrr,
        'ARR Projection': scenarioData.forecastedMrr * 12,
        'Final Budget': scenarioData.userOverride,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Subscription Budget`);
    XLSX.writeFile(workbook, `Subscription_Budget_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(subscriptionData.map(d => [d.product, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const product = row['Product'];
        if (dataMap.has(product)) {
          const itemToUpdate = dataMap.get(product);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.forecastedMrr = row['Forecasted MRR'] ?? scenarioItem.forecastedMrr;
          scenarioItem.userOverride = row['Final Budget'] ?? scenarioItem.userOverride;
          dataMap.set(product, itemToUpdate);
        }
      });
      setSubscriptionData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setSubscriptionData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(budgetTotals.byProduct || {}),
    datasets: [{ label: 'Budget by Product', data: Object.values(budgetTotals.byProduct || {}), backgroundColor: 'rgba(16, 185, 129, 0.7)' }],
  };
  const pieChartData = {
    labels: ['Linked to Recurring Revenue'],
    datasets: [{ data: [100], backgroundColor: ['#3b82f6'], hoverOffset: 4 }],
  };
  const lineChartData = {
    labels: subscriptionData.map(d => d.product),
    datasets: [
        { label: 'Forecasted MRR', yAxisID: 'y', data: subscriptionData.map(d => getScenarioDataItem(d, activeScenario).forecastedMrr), borderColor: 'rgba(16, 185, 129, 1)'},
        { label: 'Forecasted ARR', yAxisID: 'y1', data: subscriptionData.map(d => getScenarioDataItem(d, activeScenario).forecastedMrr * 12), borderColor: 'rgba(59, 130, 246, 1)'},
    ]
  };
  const lineChartOptions = { ...chartOptions, scales: { y: { position: 'left', title: {display: true, text: 'MRR ($)'} }, y1: { position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'ARR ($)'} } } };
  
  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Subscription & Recurring Revenue Considerations</h1><p className="text-sky-100 text-x">Plan budgets based on forecasted MRR & ARR.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'forecast', label: 'Forecast MRR/ARR Impact'}, {id: 'import', label: 'Import Revenue Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Forecasted MRR</p><p className="text-2xl font-bold text-green-600">${(budgetTotals?.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Forecasted ARR</p><p className="text-2xl font-bold text-green-600">${(budgetTotals?.arr || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Budget as % of ARR</p><p className="text-2xl font-bold text-sky-900">{budgetTotals.arr > 0 ? ((budgetTotals.totalBudget / budgetTotals.arr) * 100).toFixed(getDecimalPrecision()) : 0}%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">MRR & ARR Forecast Trends</h2><div className="h-[250px]"><Line data={lineChartData} options={lineChartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Allocation by Product</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Subscription Forecast Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Forecast</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Product / Service</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Current MRR</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Forecasted MRR</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">ARR Projection</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Budget Allocation</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Final Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {subscriptionData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>{item.product}</td>
                            <td className="px-2 py-1 text-center text-s">${scenarioData.currentMrr.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.forecastedMrr} onChange={(e) => handleInputChange(index, 'forecastedMrr', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-medium">${(scenarioData.forecastedMrr * 12).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.allocation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${scenarioData.userOverride.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Churn rate, expansion revenue, billing cycle...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Recurring Revenue Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with MRR/ARR forecasts and budget allocations. Match by 'Product'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Product', 'Forecasted MRR', and 'Final Budget' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare MRR-Based Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Forecasted MRR', 'Forecasted ARR', 'Total Budget', 'Budget as % of ARR', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(subscriptionData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Forecasted MRR') { value = `$${(totals.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-green-600"; }
                        else if (metric === 'Forecasted ARR') { value = `$${(totals.arr || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-green-700"; }
                        else if (metric === 'Total Budget') { value = `$${(totals.totalBudget || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Budget as % of ARR') { value = totals.arr > 0 ? `${((totals.totalBudget / totals.arr) * 100).toFixed(getDecimalPrecision())}%` : '0%'; }
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
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Budget</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {budgetVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { totalBudget: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.totalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default SubscriptionRevenueBudgeting;