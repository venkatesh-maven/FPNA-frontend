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
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiAlertTriangle, FiChevronRight} from "react-icons/fi";
import { BsFilter, BsGraphUp, BsGraphDown } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline Thresholds",
  BEST_CASE: "Tolerant Thresholds",
  WORST_CASE: "Strict Thresholds",
};

const ALERT_LEVEL = {
  HIGH: "High",
  MED: "Medium",
  LOW: "Low",
  NONE: "None",
};

// Mock data for variance alerts
const initialVarianceData = [
  {
    department: "Marketing", expense: "Q1 Ad Campaign", budgeted: 100000,
    [SCENARIOS.BASELINE]:      { actual: 115000, threshold: 10, userComment: "CPC higher than expected, but lead volume is strong.", aiInsight: "15% overspend driven by increased competition on keywords." },
    [SCENARIOS.BEST_CASE]:     { actual: 115000, threshold: 20, userComment: "", aiInsight: "Variance is within the higher tolerance for growth initiatives." },
    [SCENARIOS.WORST_CASE]:    { actual: 115000, threshold: 5,  userComment: "Immediate review required.", aiInsight: "Variance significantly exceeds strict threshold." },
  },
  {
    department: "IT", expense: "Cloud Services (AWS)", budgeted: 80000,
    [SCENARIOS.BASELINE]:      { actual: 82000,  threshold: 5, userComment: "Minor spike due to data processing job.", aiInsight: "2.5% variance is within normal operational fluctuation." },
    [SCENARIOS.BEST_CASE]:     { actual: 82000,  threshold: 10, userComment: "", aiInsight: "Nominal variance." },
    [SCENARIOS.WORST_CASE]:    { actual: 82000,  threshold: 2, userComment: "Investigate the processing job.", aiInsight: "Breached strict 2% threshold." },
  },
  {
    department: "Engineering", expense: "SaaS Subscriptions", budgeted: 50000,
    [SCENARIOS.BASELINE]:      { actual: 45000,  threshold: 10, userComment: "Decommissioned a legacy tool ahead of schedule.", aiInsight: "10% underspend is a positive efficiency gain." },
    [SCENARIOS.BEST_CASE]:     { actual: 45000,  threshold: 15, userComment: "", aiInsight: "Underspend is not flagged as an issue." },
    [SCENARIOS.WORST_CASE]:    { actual: 45000,  threshold: 5, userComment: "Good saving, but monitor if it impacts productivity.", aiInsight: "Variance is positive but still flagged for review under strict rules." },
  },
  {
    department: "HR", expense: "Headcount Costs", budgeted: 300000,
    [SCENARIOS.BASELINE]:      { actual: 330000, threshold: 5, userComment: "Accelerated hiring for two senior roles.", aiInsight: "Overspend directly linked to approved headcount changes." },
    [SCENARIOS.BEST_CASE]:     { actual: 330000, threshold: 10, userComment: "", aiInsight: "Variance acceptable due to growth plan." },
    [SCENARIOS.WORST_CASE]:    { actual: 330000, threshold: 3, userComment: "Flagged for exec review due to high impact.", aiInsight: "High-cost variance requires immediate attention." },
  },
];

const AutomatedVarianceAlerts = () => {
  const [activeTab, setActiveTab] = useState("monitoring");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [varianceData, setVarianceData] = useState(JSON.parse(JSON.stringify(initialVarianceData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard thresholds: 10% for variable spend (e.g., Marketing), 5% for operational spend (e.g., IT).",
    [SCENARIOS.BEST_CASE]: "Tolerant thresholds during growth phases. Alerting is relaxed to 20% for strategic initiatives.",
    [SCENARIOS.WORST_CASE]: "Strict control mode. All variances over 5% are flagged as High. Department heads must provide justification.",
  });

  const [varianceVersions, setVarianceVersions] = useState([]);
  const [varianceTotals, setVarianceTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { actual: 0, threshold: 10, userComment: "", aiInsight: "N/A" };
  };
  
  const getAlertLevel = (variancePercent, threshold) => {
    const absVariance = Math.abs(variancePercent);
    if (absVariance > threshold) {
      if (absVariance > threshold * 2) return ALERT_LEVEL.HIGH;
      return ALERT_LEVEL.MED;
    }
    if (absVariance > threshold / 2) return ALERT_LEVEL.LOW;
    return ALERT_LEVEL.NONE;
  };

  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { totalBudgeted: 0, totalActual: 0, highRiskCount: 0, alertsByCategory: {}, varianceByDept: {} };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const variance = scenarioData.actual - item.budgeted;
      const variancePercent = item.budgeted === 0 ? 0 : (variance / item.budgeted) * 100;
      const alertLevel = getAlertLevel(variancePercent, scenarioData.threshold);

      totals.totalBudgeted += item.budgeted;
      totals.totalActual += scenarioData.actual;
      if (alertLevel === ALERT_LEVEL.HIGH) totals.highRiskCount++;
      if (alertLevel !== ALERT_LEVEL.NONE) totals.alertsByCategory[item.expense] = (totals.alertsByCategory[item.expense] || 0) + 1;
      
      if (!totals.varianceByDept[item.department]) totals.varianceByDept[item.department] = { budget: 0, actual: 0 };
      totals.varianceByDept[item.department].budget += item.budgeted;
      totals.varianceByDept[item.department].actual += scenarioData.actual;
    });
    return totals;
  };

  useEffect(() => {
    setVarianceTotals(calculateTotalsForScenario(varianceData, activeScenario));
  }, [varianceData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setVarianceData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData[index][activeScenario][field] = field === 'actual' ? (parseFloat(value) || 0) : value;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        totalsByScenario[scen] = calculateTotalsForScenario(varianceData, scen);
    });
    setVarianceVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(varianceData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Variance report version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = varianceData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      const variance = scenarioData.actual - item.budgeted;
      const variancePercent = item.budgeted === 0 ? 0 : (variance / item.budgeted) * 100;
      const alertLevel = getAlertLevel(variancePercent, scenarioData.threshold);
      return {
        'Department': item.department, 'Expense': item.expense,
        'Budgeted': item.budgeted, 'Actual': scenarioData.actual,
        'Variance ($)': variance, 'Variance (%)': variancePercent.toFixed(getDecimalPrecision()),
        'Alert Level': alertLevel, 'User Comment': scenarioData.userComment,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Variance Report`);
    XLSX.writeFile(workbook, `Variance_Report_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(varianceData.map(d => [`${d.department}-${d.expense}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Expense']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioData = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioData.actual = row['Actual'] ?? scenarioData.actual;
          itemToUpdate.budgeted = row['Budgeted'] ?? itemToUpdate.budgeted;
          dataMap.set(key, itemToUpdate);
        }
      });
      setVarianceData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Actuals data imported successfully. Review alerts.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setVarianceData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const getAlertColor = (level) => {
    if (level === ALERT_LEVEL.HIGH) return "bg-red-100 text-red-800 border-red-300";
    if (level === ALERT_LEVEL.MED) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (level === ALERT_LEVEL.LOW) return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const pieChartData = {
    labels: Object.keys(varianceTotals.alertsByCategory || {}),
    datasets: [{ data: Object.values(varianceTotals.alertsByCategory || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'], hoverOffset: 4 }],
  };
  const lineChartData = {
    labels: varianceData.map(d => d.expense),
    datasets: [
        { label: 'Budgeted', data: varianceData.map(d => d.budgeted), borderColor: 'rgba(14, 165, 233, 1)', tension: 0.1 },
        { label: 'Actual', data: varianceData.map(d => getScenarioDataItem(d, activeScenario).actual), borderColor: 'rgba(239, 68, 68, 1)', tension: 0.1 },
    ]
  };
  const barChartData = {
    labels: Object.keys(varianceTotals.varianceByDept || {}),
    datasets: [{
      label: 'Variance %',
      data: Object.values(varianceTotals.varianceByDept || {}).map(d => d.budget === 0 ? 0 : ((d.actual - d.budget) / d.budget * 100)),
      backgroundColor: (context) => {
        const value = context.raw;
        return value >= 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)';
      }
    }]
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
          Automated Variance Alerts
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Automated Variance Alerts</h1><p className="text-sky-100 text-x">Get notified when spending deviates significantly from budget.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'monitoring', label: 'Variance Monitoring'}, {id: 'import', label: 'Import Budget vs Actuals'}, {id: 'compare', label: 'Compare Alerts'}].map(tab => (
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
        {activeTab === 'monitoring' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Variance (Budget vs Actual)</p><p className={`text-2xl font-bold ${(varianceTotals.totalActual - varianceTotals.totalBudgeted) >= 0 ? 'text-red-600' : 'text-green-600'}`}>${(varianceTotals.totalActual - varianceTotals.totalBudgeted).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">High-Risk Variances Detected</p><p className="text-2xl font-bold text-red-600">{varianceTotals.highRiskCount} Alerts</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Average Variance %</p><p className="text-2xl font-bold text-sky-900">{((varianceTotals.totalActual - varianceTotals.totalBudgeted) / varianceTotals.totalBudgeted * 100).toFixed(getDecimalPrecision())}%</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Distribution of Alerts</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Variance % by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={{...chartOptions, plugins: { ...chartOptions.plugins, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw.toFixed(getDecimalPrecision())}%` } }}}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Variance Alert Dashboard ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Report</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department / Expense</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Budgeted</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Actual</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Variance ($ / %)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Alert Level</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">User Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {varianceData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const variance = scenarioData.actual - item.budgeted;
                        const variancePercent = item.budgeted === 0 ? 0 : (variance / item.budgeted) * 100;
                        const alertLevel = getAlertLevel(variancePercent, scenarioData.threshold);
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.department}</div><div className="text-x text-sky-600">{item.expense}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.budgeted.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.actual} onChange={(e) => handleInputChange(index, 'actual', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className={`px-2 py-1 text-center text-s font-medium ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-gray-500">({variancePercent.toFixed(getDecimalPrecision())}%)</span>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <span className={`text-x font-bold px-2 py-1 rounded-full border relative group ${getAlertColor(alertLevel)}`}>
                                {alertLevel}
                                {alertLevel !== ALERT_LEVEL.NONE && <FiInfo className="inline-block ml-1 text-gray-500" />}
                                {alertLevel !== ALERT_LEVEL.NONE && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>}
                              </span>
                            </td>
                            <td className="px-2 py-1"><textarea value={scenarioData.userComment} onChange={(e) => handleInputChange(index, 'userComment', e.target.value)} rows="1" className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Alert Assumptions & Thresholds for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Alert if >10% deviation...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Budget vs Actuals</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your latest budget and actual spend data. This will refresh the dashboard and trigger new alerts.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Expense', 'Budgeted', and 'Actual' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Alert Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Variance', 'High-Risk Alert Count', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(varianceData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        const variance = totals.totalActual - totals.totalBudgeted;
                        if (metric === 'Total Variance') { value = `$${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`; }
                        else if (metric === 'High-Risk Alert Count') { value = `${totals.highRiskCount} alerts`; className = "text-s font-semibold text-red-600"; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Variance Report History</h2>
          {varianceVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Variance</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {varianceVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario[scen] || {};
                        const variance = (total.totalActual || 0) - (total.totalBudgeted || 0);
                        return <td key={`${index}-${scen}`} className={`px-4 py-3 text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default AutomatedVarianceAlerts;