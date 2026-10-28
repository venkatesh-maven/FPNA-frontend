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
  OPTIMISTIC_REVENUE: "Optimistic Revenue",
  PESSIMISTIC_REVENUE: "Pessimistic Revenue",
};

// Mock data for revenue-driven allocation
const initialAllocationData = [
  {
    department: "Marketing", expenseType: "Demand Generation", linkedRevenue: "New Business ARR",
    [SCENARIOS.BASELINE]:            { revenueForecast: 1200000, allocationPercent: 12, userAdjustment: 0, aiInsight: "12% is the historical average for this revenue stream to maintain growth." },
    [SCENARIOS.OPTIMISTIC_REVENUE]:  { revenueForecast: 1500000, allocationPercent: 15, userAdjustment: 0, aiInsight: "Increased allocation to 15% to capitalize on strong market demand and accelerate growth." },
    [SCENARIOS.PESSIMISTIC_REVENUE]: { revenueForecast: 900000,  allocationPercent: 10, userAdjustment: 0, aiInsight: "Reduced allocation to 10% to preserve cash in a slower market." },
  },
  {
    department: "Sales", expenseType: "Commissions & Bonuses", linkedRevenue: "New Business ARR",
    [SCENARIOS.BASELINE]:            { revenueForecast: 1200000, allocationPercent: 10, userAdjustment: 0, aiInsight: "Standard 10% commission rate on new business revenue." },
    [SCENARIOS.OPTIMISTIC_REVENUE]:  { revenueForecast: 1500000, allocationPercent: 11, userAdjustment: 0, aiInsight: "Includes accelerator bonuses for hitting stretch targets." },
    [SCENARIOS.PESSIMISTIC_REVENUE]: { revenueForecast: 900000,  allocationPercent: 9, userAdjustment: 0, aiInsight: "Lower commission payouts due to smaller deal sizes." },
  },
  {
    department: "Support", expenseType: "Customer Support Staff", linkedRevenue: "Total ARR",
    [SCENARIOS.BASELINE]:            { revenueForecast: 5000000, allocationPercent: 5, userAdjustment: 0, aiInsight: "Support costs are consistently 5% of total revenue base." },
    [SCENARIOS.OPTIMISTIC_REVENUE]:  { revenueForecast: 6000000, allocationPercent: 5, userAdjustment: 0, aiInsight: "Support scales linearly with the total customer base." },
    [SCENARIOS.PESSIMISTIC_REVENUE]: { revenueForecast: 4500000, allocationPercent: 6, userAdjustment: 0, aiInsight: "Higher support ratio due to potential for more issues from cost-sensitive customers." },
  },
];

const RevenueDrivenExpenseAllocation = () => {
  const [activeTab, setActiveTab] = useState("allocate");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [allocationData, setAllocationData] = useState(JSON.parse(JSON.stringify(initialAllocationData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard allocation model. Marketing and Sales budgets are a direct percentage of New Business ARR. Support costs are a percentage of Total ARR.",
    [SCENARIOS.OPTIMISTIC_REVENUE]: "Aggressive investment model. In a high-growth scenario, allocation percentages for Marketing and Sales are increased to fuel further expansion.",
    [SCENARIOS.PESSIMISTIC_REVENUE]: "Conservative model. In a downturn, allocation percentages are reduced to preserve margin and focus on profitability.",
  });

  const [allocationVersions, setAllocationVersions] = useState([]);
  const [allocationTotals, setAllocationTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { revenueForecast: 0, allocationPercent: 0, userAdjustment: 0, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { totalRevenue: 0, totalAllocated: 0, byDepartment: {}, byRevenueStream: {} };
    if (!data || data.length === 0) return totals;
    
    const revenueStreams = {};

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      if (!revenueStreams[item.linkedRevenue]) {
        revenueStreams[item.linkedRevenue] = scenarioData.revenueForecast;
      }
      const aiAllocation = scenarioData.revenueForecast * (scenarioData.allocationPercent / 100);
      const finalAllocation = aiAllocation + scenarioData.userAdjustment;

      totals.totalAllocated += finalAllocation;
      
      if (!totals.byDepartment[item.department]) totals.byDepartment[item.department] = 0;
      totals.byDepartment[item.department] += finalAllocation;

      if (!totals.byRevenueStream[item.linkedRevenue]) totals.byRevenueStream[item.linkedRevenue] = 0;
      totals.byRevenueStream[item.linkedRevenue] += finalAllocation;
    });
    
    totals.totalRevenue = Object.values(revenueStreams).reduce((sum, rev) => sum + rev, 0);

    return totals;
  };

  useEffect(() => {
    setAllocationTotals(calculateTotalsForScenario(allocationData, activeScenario));
  }, [allocationData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setAllocationData(prev => {
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
      totalsByScenario[scen] = calculateTotalsForScenario(allocationData, scen);
    });
    setAllocationVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(allocationData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Allocation model version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = allocationData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      const aiAllocation = scenarioData.revenueForecast * (scenarioData.allocationPercent / 100);
      const finalAllocation = aiAllocation + scenarioData.userAdjustment;
      return {
        'Department': item.department, 'Expense Type': item.expenseType, 'Linked Revenue': item.linkedRevenue,
        'Revenue Forecast': scenarioData.revenueForecast, 'Allocation (%)': scenarioData.allocationPercent,
        'User Adjustment': scenarioData.userAdjustment, 'Final Allocation': finalAllocation,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Revenue-Driven Budget`);
    XLSX.writeFile(workbook, `Revenue_Driven_Budget_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(allocationData.map(d => [`${d.department}-${d.expenseType}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Expense Type']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.revenueForecast = row['Revenue Forecast'] ?? scenarioItem.revenueForecast;
          scenarioItem.allocationPercent = row['Allocation (%)'] ?? scenarioItem.allocationPercent;
          scenarioItem.userAdjustment = row['User Adjustment'] ?? scenarioItem.userAdjustment;
          dataMap.set(key, itemToUpdate);
        }
      });
      setAllocationData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setAllocationData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const pieChartData = {
    labels: Object.keys(allocationTotals.byDepartment || {}),
    datasets: [{ data: Object.values(allocationTotals.byDepartment || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'], hoverOffset: 4 }],
  };
  const barChartData = {
    labels: Object.keys(allocationTotals.byRevenueStream || {}),
    datasets: [{ label: 'Expense Allocation by Revenue Stream', data: Object.values(allocationTotals.byRevenueStream || {}), backgroundColor: 'rgba(16, 185, 129, 0.7)' }],
  };
  
  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Revenue-Driven Expense Allocation</h1><p className="text-sky-100 text-x">Adjust budgets based on expected income trends.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'allocate', label: 'Allocate by Revenue'}, {id: 'import', label: 'Import Budgets'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'allocate' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Expected Revenue</p><p className="text-2xl font-bold text-green-600">${(allocationTotals?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Allocated Budget</p><p className="text-2xl font-bold text-sky-900">${(allocationTotals?.totalAllocated || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Spend-to-Revenue Ratio</p><p className="text-2xl font-bold text-sky-900">{allocationTotals.totalRevenue > 0 ? ((allocationTotals.totalAllocated / allocationTotals.totalRevenue) * 100).toFixed(1) : 0}%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Expense by Linked Revenue</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Allocation by Department</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Revenue-Linked Allocation Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department / Expense</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Linked Revenue Stream</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Revenue Forecast</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Allocation %</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">AI-Suggested</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Final Allocation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {allocationData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const aiAllocation = scenarioData.revenueForecast * (scenarioData.allocationPercent / 100);
                        const finalAllocation = aiAllocation + scenarioData.userAdjustment;
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.department}</div><div className="text-x text-sky-600">{item.expenseType}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">{item.linkedRevenue}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.revenueForecast} onChange={(e) => handleInputChange(index, 'revenueForecast', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.allocationPercent} onChange={(e) => handleInputChange(index, 'allocationPercent', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${aiAllocation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userAdjustment} onChange={(e) => handleInputChange(index, 'userAdjustment', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-sky-900">${finalAllocation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Allocation Strategy & Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Allocation logic, income dependency...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Revenue-Linked Budgets</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your allocation data. Match by 'Department' and 'Expense Type'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Expense Type', 'Revenue Forecast', 'Allocation (%)', and 'User Adjustment'.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Revenue-Based Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Revenue', 'Total Allocated Budget', 'Spend-to-Revenue Ratio', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(allocationData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total Revenue') { value = `$${(totals.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-green-600"; }
                        else if (metric === 'Total Allocated Budget') { value = `$${(totals.totalAllocated || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Spend-to-Revenue Ratio') { value = totals.totalRevenue > 0 ? `${((totals.totalAllocated / totals.totalRevenue) * 100).toFixed(1)}%` : '0%'; }
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
          {allocationVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Allocation</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {allocationVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { totalAllocated: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.totalAllocated.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default RevenueDrivenExpenseAllocation;