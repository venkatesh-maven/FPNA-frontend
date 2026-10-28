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
  STRETCH: "Stretch Budget",
  CONSERVATIVE: "Conservative Budget",
};

const ALERT_LEVEL = {
  HIGH: "High",
  LOW: "Low",
  NONE: "None",
};

// Mock data for variance tracking
const initialVarianceData = [
  {
    department: "Marketing", expenseCategory: "Campaigns",
    [SCENARIOS.BASELINE]:    { budgeted: {m1: 50000, m2: 50000, m3: 55000}, actual: {m1: 58000, m2: 52000, m3: 60000}, threshold: 10, justification: "Higher CPC in Q1.", aiInsight: "Overspend driven by increased competition on keywords." },
    [SCENARIOS.STRETCH]:     { budgeted: {m1: 60000, m2: 65000, m3: 70000}, actual: {m1: 68000, m2: 66000, m3: 75000}, threshold: 10, justification: "Aggressive push for market share.", aiInsight: "Spend is tracking with aggressive growth targets." },
    [SCENARIOS.CONSERVATIVE]:{ budgeted: {m1: 40000, m2: 40000, m3: 40000}, actual: {m1: 45000, m2: 41000, m3: 42000}, threshold: 5, justification: "New channel test overshot slightly.", aiInsight: "Exceeded conservative threshold, requires review." },
  },
  {
    department: "IT", expenseCategory: "Cloud Services",
    [SCENARIOS.BASELINE]:    { budgeted: {m1: 25000, m2: 25000, m3: 25000}, actual: {m1: 26000, m2: 25500, m3: 27000}, threshold: 5, justification: "Minor usage spike.", aiInsight: "Variance within normal operational fluctuation." },
    [SCENARIOS.STRETCH]:     { budgeted: {m1: 30000, m2: 30000, m3: 30000}, actual: {m1: 32000, m2: 31000, m3: 33000}, threshold: 5, justification: "Supporting new product launch.", aiInsight: "Usage spike correlates with new feature deployment." },
    [SCENARIOS.CONSERVATIVE]:{ budgeted: {m1: 22000, m2: 22000, m3: 22000}, actual: {m1: 21000, m2: 21500, m3: 22000}, threshold: 5, justification: "Cost optimizations are effective.", aiInsight: "Underspend is a positive efficiency gain." },
  },
  {
    department: "HR", expenseCategory: "Recruitment Fees",
    [SCENARIOS.BASELINE]:    { budgeted: {m1: 10000, m2: 10000, m3: 15000}, actual: {m1: 18000, m2: 12000, m3: 15000}, threshold: 20, justification: "Unexpected executive hire.", aiInsight: "High one-time variance due to agency fee for a critical role." },
    [SCENARIOS.STRETCH]:     { budgeted: {m1: 20000, m2: 20000, m3: 25000}, actual: {m1: 22000, m2: 21000, m3: 26000}, threshold: 15, justification: "Scaling team faster than planned.", aiInsight: "Spend is aligned with accelerated hiring goals." },
    [SCENARIOS.CONSERVATIVE]:{ budgeted: {m1: 5000, m2: 5000, m3: 5000}, actual: {m1: 5000, m2: 5000, m3: 5000}, threshold: 10, justification: "Hiring freeze is holding.", aiInsight: "No variance detected." },
  },
];

const BudgetVsActualsTracking = () => {
  const [activeTab, setActiveTab] = useState("track");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [varianceData, setVarianceData] = useState(JSON.parse(JSON.stringify(initialVarianceData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard alert thresholds: High >10%, Low >5%. Focus on significant deviations from plan.",
    [SCENARIOS.STRETCH]: "Tolerant thresholds for growth-related spend (e.g., Marketing). Alerting is relaxed to High >20% to allow for investment flexibility.",
    [SCENARIOS.CONSERVATIVE]: "Strict control thresholds. All variances over 5% are flagged as High. Department heads must provide justification for any overspend.",
  });

  const [varianceVersions, setVarianceVersions] = useState([]);
  const [varianceTotals, setVarianceTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { budgeted: {m1:0,m2:0,m3:0}, actual: {m1:0,m2:0,m3:0}, threshold: 10, justification: "", aiInsight: "N/A" };
  };
  
  const getAlertLevel = (variancePercent, threshold) => {
    const absVariance = Math.abs(variancePercent);
    if (absVariance > threshold) return ALERT_LEVEL.HIGH;
    if (absVariance > threshold / 2) return ALERT_LEVEL.LOW;
    return ALERT_LEVEL.NONE;
  };

  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { totalBudgeted: 0, totalActual: 0, highAlerts: 0, alerts: {}, byDepartment: {} };
    if (!data || data.length === 0) return totals;
    Object.values(ALERT_LEVEL).forEach(level => totals.alerts[level] = 0);

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const qBudget = (scenarioData.budgeted.m1 || 0) + (scenarioData.budgeted.m2 || 0) + (scenarioData.budgeted.m3 || 0);
      const qActual = (scenarioData.actual.m1 || 0) + (scenarioData.actual.m2 || 0) + (scenarioData.actual.m3 || 0);
      
      totals.totalBudgeted += qBudget;
      totals.totalActual += qActual;

      const variancePercent = qBudget === 0 ? 0 : ((qActual - qBudget) / qBudget) * 100;
      const alertLevel = getAlertLevel(variancePercent, scenarioData.threshold);
      totals.alerts[alertLevel]++;
      if (alertLevel === ALERT_LEVEL.HIGH) totals.highAlerts++;
      
      if (!totals.byDepartment[item.department]) totals.byDepartment[item.department] = { budget: 0, actual: 0 };
      totals.byDepartment[item.department].budget += qBudget;
      totals.byDepartment[item.department].actual += qActual;
    });
    return totals;
  };

  useEffect(() => {
    setVarianceTotals(calculateTotalsForScenario(varianceData, activeScenario));
  }, [varianceData, activeScenario]);

  const handleInputChange = (index, field, value, month = null) => {
    setVarianceData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      if (month) {
        scenarioItem.actual[month] = parseFloat(value) || 0;
      } else {
        scenarioItem[field] = value;
      }
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
      const qBudget = (scenarioData.budgeted.m1||0) + (scenarioData.budgeted.m2||0) + (scenarioData.budgeted.m3||0);
      const qActual = (scenarioData.actual.m1||0) + (scenarioData.actual.m2||0) + (scenarioData.actual.m3||0);
      const variance = qActual - qBudget;
      const variancePercent = qBudget === 0 ? 0 : (variance / qBudget) * 100;
      return {
        'Department': item.department, 'Expense Category': item.expenseCategory,
        'Budgeted': qBudget, 'Actual': qActual,
        'Variance ($)': variance, 'Variance (%)': variancePercent.toFixed(getDecimalPrecision()),
        'Alert Level': getAlertLevel(variancePercent, scenarioData.threshold),
        'Justification': scenarioData.justification,
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
      
      const dataMap = new Map(varianceData.map(d => [`${d.department}-${d.expenseCategory}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Expense Category']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.actual.m1 = row['Actual M1'] ?? scenarioItem.actual.m1;
          scenarioItem.actual.m2 = row['Actual M2'] ?? scenarioItem.actual.m2;
          scenarioItem.actual.m3 = row['Actual M3'] ?? scenarioItem.actual.m3;
          dataMap.set(key, itemToUpdate);
        }
      });
      setVarianceData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Actuals data imported successfully for ${activeScenario}. Review alerts.`);
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
    if (level === ALERT_LEVEL.LOW) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const pieChartData = {
    labels: Object.keys(varianceTotals.alerts || {}),
    datasets: [{ data: Object.values(varianceTotals.alerts || {}), backgroundColor: ['#ef4444', '#f97316', '#d1d5db'], hoverOffset: 4 }],
  };
  const barChartData = {
    labels: Object.keys(varianceTotals.byDepartment || {}),
    datasets: [
        { label: 'Budgeted', data: Object.values(varianceTotals.byDepartment || {}).map(d => d.budget), backgroundColor: 'rgba(156, 163, 175, 0.7)' },
        { label: 'Actual', data: Object.values(varianceTotals.byDepartment || {}).map(d => d.actual), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
    ]
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
                                        <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Budget vs. Actual Tracking</span>
                                      </div>
                                    </li>
                                  </ol>
                                </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Budget vs. Actuals Tracking</h1><p className="text-sky-100 text-x">Automated variance analysis and spending control alerts.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Time Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'track', label: 'Track Variance'}, {id: 'import', label: 'Import Actuals'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'track' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Budgeted vs Actual</p><p className="text-2xl font-bold text-sky-900">${(varianceTotals?.totalBudgeted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-lg font-medium text-gray-500">vs</span> ${(varianceTotals?.totalActual || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Overall Variance</p><p className={`text-2xl font-bold ${(varianceTotals.totalActual - varianceTotals.totalBudgeted) >= 0 ? 'text-red-600' : 'text-green-600'}`}>{(((varianceTotals.totalActual - varianceTotals.totalBudgeted) / (varianceTotals.totalBudgeted || 1)) * 100).toFixed(getDecimalPrecision())}%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">High Variance Alerts</p><p className="text-2xl font-bold text-red-600">{varianceTotals.highAlerts} Items</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget vs. Actual by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Variance Severity Distribution</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' }}}} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Variance Analysis ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department / Expense</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[360px]" colSpan={3}>Budgeted vs Actual (Monthly)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Quarterly Variance</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Alert Level</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">Justification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {varianceData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const qBudget = (scenarioData.budgeted.m1||0) + (scenarioData.budgeted.m2||0) + (scenarioData.budgeted.m3||0);
                        const qActual = (scenarioData.actual.m1||0) + (scenarioData.actual.m2||0) + (scenarioData.actual.m3||0);
                        const qVariance = qActual - qBudget;
                        const qVariancePercent = qBudget === 0 ? 0 : (qVariance / qBudget) * 100;
                        const alertLevel = getAlertLevel(qVariancePercent, scenarioData.threshold);
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.department}</div><div className="text-x text-sky-600">{item.expenseCategory}</div>
                            </td>
                            {['m1', 'm2', 'm3'].map(month => (
                                <td key={month} className="px-2 py-1">
                                    <div className="text-x text-gray-500 text-center">Budget: ${scenarioData.budgeted[month].toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                                    <input type="number" value={scenarioData.actual[month]} onChange={(e) => handleInputChange(index, 'actual', e.target.value, month)} className="w-full mt-1 p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/>
                                </td>
                            ))}
                            <td className={`px-2 py-1 text-center text-s font-medium ${qVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>${qVariance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-gray-500">({qVariancePercent.toFixed(getDecimalPrecision())}%)</span></td>
                            <td className="px-2 py-1 text-center"><span className={`text-x font-bold px-2 py-1 rounded-full border relative group ${getAlertColor(alertLevel)}`}>{alertLevel}<FiInfo className="inline-block ml-1 text-gray-500"/><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span></span></td>
                            <td className="px-2 py-1"><textarea value={scenarioData.justification} onChange={(e) => handleInputChange(index, 'justification', e.target.value)} rows="1" className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Alert Rules & Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Alert if >10% deviation...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Actual Spend Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your latest actual spend data. Match by 'Department' and 'Expense Category'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Expense Category', 'Actual M1', 'Actual M2', and 'Actual M3' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Budget vs Actual Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Variance', 'Total Budgeted', 'Total Actual', 'High Alerts', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(varianceData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        const variance = totals.totalActual - totals.totalBudgeted;
                        if (metric === 'Total Variance') { value = `$${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`; }
                        else if (metric === 'Total Budgeted') { value = `$${(totals.totalBudgeted || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Total Actual') { value = `$${(totals.totalActual || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'High Alerts') { value = `${totals.highAlerts} alerts`; className = "text-s font-semibold text-red-600"; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Report Version History</h2>
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
                        const total = version.totalsByScenario?.[scen] || { totalBudgeted: 0, totalActual: 0 };
                        const variance = total.totalActual - total.totalBudgeted;
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

export default BudgetVsActualsTracking;