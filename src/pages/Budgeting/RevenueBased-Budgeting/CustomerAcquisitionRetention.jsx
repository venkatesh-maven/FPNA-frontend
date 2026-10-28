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
  BASELINE: "Baseline (Balanced)",
  GROWTH_FOCUSED: "Growth Focused (Acquisition)",
  RETENTION_FOCUSED: "Retention Focused (Profitability)",
};

const CUSTOMER_SEGMENT = {
  NEW: "New",
  EXISTING: "Existing",
};

// Mock data for customer budgeting
const initialBudgetData = [
  {
    activity: "Paid Ads (Google/Meta)", segment: CUSTOMER_SEGMENT.NEW,
    [SCENARIOS.BASELINE]:        { allocationPercent: 40, aiSpend: 200000, userOverride: 200000, roi: 3.5, aiInsight: "Standard allocation to top-of-funnel acquisition channels." },
    [SCENARIOS.GROWTH_FOCUSED]:  { allocationPercent: 50, aiSpend: 300000, userOverride: 300000, roi: 3.2, aiInsight: "Increased spend to maximize reach and new customer volume." },
    [SCENARIOS.RETENTION_FOCUSED]:{ allocationPercent: 20, aiSpend: 100000, userOverride: 100000, roi: 4.0, aiInsight: "Reduced spend to most efficient campaigns to fund retention." },
  },
  {
    activity: "Customer Onboarding Program", segment: CUSTOMER_SEGMENT.EXISTING,
    [SCENARIOS.BASELINE]:        { allocationPercent: 10, aiSpend: 50000, userOverride: 50000, roi: 5.0, aiInsight: "Standard budget for onboarding resources and success managers." },
    [SCENARIOS.GROWTH_FOCUSED]:  { allocationPercent: 5, aiSpend: 30000, userOverride: 30000, roi: 4.5, aiInsight: "Reduced investment to reallocate funds to acquisition." },
    [SCENARIOS.RETENTION_FOCUSED]:{ allocationPercent: 20, aiSpend: 120000, userOverride: 120000, roi: 6.5, aiInsight: "Heavy investment to reduce churn and increase first-year LTV." },
  },
  {
    activity: "Loyalty & Rewards Program", segment: CUSTOMER_SEGMENT.EXISTING,
    [SCENARIOS.BASELINE]:        { allocationPercent: 15, aiSpend: 75000, userOverride: 75000, roi: 4.2, aiInsight: "Maintains current program benefits and engagement." },
    [SCENARIOS.GROWTH_FOCUSED]:  { allocationPercent: 10, aiSpend: 60000, userOverride: 60000, roi: 4.0, aiInsight: "Reduced program scope to fund top-of-funnel." },
    [SCENARIOS.RETENTION_FOCUSED]:{ allocationPercent: 25, aiSpend: 150000, userOverride: 150000, roi: 5.5, aiInsight: "Enhanced rewards to increase repeat purchase rate and LTV." },
  },
  {
    activity: "Content & SEO", segment: CUSTOMER_SEGMENT.NEW,
    [SCENARIOS.BASELINE]:        { allocationPercent: 20, aiSpend: 100000, userOverride: 100000, roi: 4.8, aiInsight: "Consistent investment in organic acquisition." },
    [SCENARIOS.GROWTH_FOCUSED]:  { allocationPercent: 20, aiSpend: 120000, userOverride: 120000, roi: 4.8, aiInsight: "Maintaining organic efforts alongside paid growth." },
    [SCENARIOS.RETENTION_FOCUSED]:{ allocationPercent: 15, aiSpend: 90000, userOverride: 90000, roi: 5.0, aiInsight: "Slight reduction to fund customer-focused content." },
  },
];

const CustomerAcquisitionRetention = () => {
  const [activeTab, setActiveTab] = useState("plan");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [budgetData, setBudgetData] = useState(JSON.parse(JSON.stringify(initialBudgetData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "A balanced 60/40 split between customer acquisition (CAC) and retention efforts. Assumes a stable LTV:CAC ratio of 4:1.",
    [SCENARIOS.GROWTH_FOCUSED]: "An aggressive 80/20 split favoring acquisition. Aims to maximize new user growth, accepting a temporary drop in LTV:CAC to 3:1.",
    [SCENARIOS.RETENTION_FOCUSED]: "A profit-focused 40/60 split favoring retention. Aims to maximize LTV and profitability, targeting an LTV:CAC ratio of 5:1 or higher.",
  });

  const [budgetVersions, setBudgetVersions] = useState([]);
  const [budgetTotals, setBudgetTotals] = useState({});
  const filtersRef = useRef(null);
  
  const MOCK_LTV = 1200; // Mock Customer Lifetime Value for ratio calculation

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { allocationPercent: 0, aiSpend: 0, userOverride: 0, roi: 0, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { cacSpend: 0, retentionSpend: 0, totalSpend: 0, newCustomers: 0 };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const finalSpend = scenarioData.userOverride;
      
      if(item.segment === CUSTOMER_SEGMENT.NEW) {
        totals.cacSpend += finalSpend;
        if(item.activity.includes("Ads")) {
            totals.newCustomers += finalSpend / 200; // Mock CAC of $200
        }
      } else {
        totals.retentionSpend += finalSpend;
      }
    });
    totals.totalSpend = totals.cacSpend + totals.retentionSpend;
    return totals;
  };

  useEffect(() => {
    setBudgetTotals(calculateTotalsForScenario(budgetData, activeScenario));
  }, [budgetData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setBudgetData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData[index][activeScenario][field] = parseFloat(value) || 0;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => { /* ... Save logic ... */ };
  const handleExport = () => { /* ... Export logic ... */ };
  const handleImport = async (e) => { /* ... Import logic ... */ };
  const handleRestoreVersion = (version) => { /* ... Restore logic ... */ };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: ['Acquisition', 'Retention'],
    datasets: [{ label: 'Budget Allocation', data: [budgetTotals.cacSpend || 0, budgetTotals.retentionSpend || 0], backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)'] }],
  };
  const pieChartData = {
    labels: ['New Customer Spend', 'Existing Customer Spend'],
    datasets: [{ data: [budgetTotals.cacSpend || 0, budgetTotals.retentionSpend || 0], backgroundColor: ['#3b82f6', '#10b981'], hoverOffset: 4 }],
  };
  
  const ltvToCac = budgetTotals.newCustomers > 0 ? (MOCK_LTV / (budgetTotals.cacSpend / budgetTotals.newCustomers)).toFixed(getDecimalPrecision()) : 0;
  
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
               Revenue Based Budgeting
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                Customer Acquisition Retention
              </span>
            </div>
          </li>
        </ol>
      </nav>
      
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Customer Acquisition & Retention Budgeting</h1><p className="text-sky-100 text-x">Optimize spending on new vs. existing customers.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'plan', label: 'Plan Budget'}, {id: 'import', label: 'Import Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total CAC Spend</p><p className="text-2xl font-bold text-sky-900">${(budgetTotals?.cacSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Retention Spend</p><p className="text-2xl font-bold text-sky-900">${(budgetTotals?.retentionSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">LTV to CAC Ratio</p><p className="text-2xl font-bold text-green-600">{ltvToCac}:1</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Acquisition vs. Retention Spend</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Split by Segment</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold text-sky-900">Customer Budget Editor ({activeScenario})</h2>{/* ... buttons ... */}</div>
                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Activity / Expense</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Customer Segment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">AI Suggested Spend</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Final Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Est. ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {budgetData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>{item.activity}</td>
                            <td className="px-2 py-1 text-center text-s"><span className={`px-2 py-1 rounded-full text-x font-medium ${item.segment === CUSTOMER_SEGMENT.NEW ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.segment}</span></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiSpend.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${scenarioData.userOverride.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s font-bold text-green-600">{scenarioData.roi}x</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Acquisition/Retention Strategy for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., ROI thresholds, CRM insights...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import CAC / Retention Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your campaign and segment-level budget data. Match by 'Activity'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Activity', 'Segment', and 'User Override' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Customer Budget Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Budget', 'CAC Spend', 'Retention Spend', 'LTV:CAC Ratio', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(budgetData, scenarioName);
                        const cac = totals.newCustomers > 0 ? (totals.cacSpend / totals.newCustomers) : 0;
                        const ltvCacRatio = cac > 0 ? (MOCK_LTV / cac).toFixed(getDecimalPrecision()) : 0;
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total Budget') { value = `$${(totals.totalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'CAC Spend') { value = `$${(totals.cacSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Retention Spend') { value = `$${(totals.retentionSpend || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'LTV:CAC Ratio') { value = `${ltvCacRatio}:1`; className = "text-s font-semibold text-green-600"; }
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
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Spend</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {budgetVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { totalSpend: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.totalSpend.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default CustomerAcquisitionRetention;