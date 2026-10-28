import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline Budget",
  BEST_CASE: "Cost-Reduction Plan",
  WORST_CASE: "Strategic Investment Plan",
};

const APPROVAL_STATUS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// Mock data for ZBB
const initialZBBData = [
  {
    department: "IT", project: "Cloud Infrastructure", approverRole: "CTO",
    [SCENARIOS.BASELINE]:    { m1: {ai: 25000, user: 25000}, m2: {ai: 25000, user: 25000}, m3: {ai: 25000, user: 25000}, justificationRequired: true, status: "Approved", comments: "Core AWS/GCP spend.", aiInsight: "Usage consistent with last quarter." },
    [SCENARIOS.BEST_CASE]:   { m1: {ai: 22000, user: 22000}, m2: {ai: 22000, user: 22000}, m3: {ai: 22000, user: 22000}, justificationRequired: true, status: "Draft", comments: "Cost optimization via reserved instances.", aiInsight: "Potential savings identified." },
    [SCENARIOS.WORST_CASE]:  { m1: {ai: 30000, user: 30000}, m2: {ai: 32000, user: 32000}, m3: {ai: 32000, user: 32000}, justificationRequired: true, status: "Draft", comments: "Scaling up for new product launch.", aiInsight: "Projected usage increase." },
  },
  {
    department: "Marketing", project: "Q1 Digital Campaigns", approverRole: "CMO",
    [SCENARIOS.BASELINE]:    { m1: {ai: 40000, user: 40000}, m2: {ai: 40000, user: 40000}, m3: {ai: 40000, user: 40000}, justificationRequired: true, status: "Approved", comments: "Standard lead-gen spend.", aiInsight: "CPL is within industry benchmark." },
    [SCENARIOS.BEST_CASE]:   { m1: {ai: 30000, user: 30000}, m2: {ai: 30000, user: 30000}, m3: {ai: 30000, user: 30000}, justificationRequired: true, status: "Draft", comments: "Focus on high-ROI channels only.", aiInsight: "Optimizing for higher CPL channels." },
    [SCENARIOS.WORST_CASE]:  { m1: {ai: 50000, user: 50000}, m2: {ai: 55000, user: 55000}, m3: {ai: 55000, user: 55000}, justificationRequired: true, status: "Draft", comments: "Aggressive market share capture campaign.", aiInsight: "High spend needed to outbid competitor." },
  },
  {
    department: "HR", project: "Recruitment Tools", approverRole: "CPO",
    [SCENARIOS.BASELINE]:    { m1: {ai: 7000, user: 7000}, m2: {ai: 7000, user: 7000}, m3: {ai: 7000, user: 7000}, justificationRequired: false, status: "Approved", comments: "LinkedIn Recruiter, Greenhouse.", aiInsight: "Standard tools." },
    [SCENARIOS.BEST_CASE]:   { m1: {ai: 5000, user: 5000}, m2: {ai: 5000, user: 5000}, m3: {ai: 5000, user: 5000}, justificationRequired: true, status: "Draft", comments: "Consolidating on one platform.", aiInsight: "Redundant tool functionality detected." },
    [SCENARIOS.WORST_CASE]:  { m1: {ai: 8000, user: 8000}, m2: {ai: 8000, user: 8000}, m3: {ai: 8000, user: 8000}, justificationRequired: true, status: "Draft", comments: "Adding new sourcing tool.", aiInsight: "Standard tools." },
  },
];

const DepartmentZBBImplementation = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [zbbData, setZbbData] = useState(JSON.parse(JSON.stringify(initialZBBData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard ZBB rules. All new projects over $10k require justification. Department head is primary approver.",
    [SCENARIOS.BEST_CASE]: "Cost-reduction mandate. All budgets start at 80% of baseline. Department head and CFO must co-approve any increases.",
    [SCENARIOS.WORST_CASE]: "Strategic investment period. Justification required for all items, but approval process is expedited for growth-related projects.",
  });

  const [zbbVersions, setZbbVersions] = useState([]);
  const [zbbTotals, setZbbTotals] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { m1: {ai:0,user:0}, m2:{ai:0,user:0}, m3:{ai:0,user:0}, justificationRequired: false, status: APPROVAL_STATUS.DRAFT, comments: "", aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { aiTotal: 0, userTotal: 0, statusCounts: {}, byDepartment: {}, monthly: { ai: [0,0,0], user: [0,0,0] } };
    Object.values(APPROVAL_STATUS).forEach(s => totals.statusCounts[s] = 0);

    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const userQuarterly = (scenarioData.m1.user || 0) + (scenarioData.m2.user || 0) + (scenarioData.m3.user || 0);
      const aiQuarterly = (scenarioData.m1.ai || 0) + (scenarioData.m2.ai || 0) + (scenarioData.m3.ai || 0);
      
      totals.aiTotal += aiQuarterly;
      totals.userTotal += userQuarterly;
      totals.statusCounts[scenarioData.status]++;
      
      totals.byDepartment[item.department] = (totals.byDepartment[item.department] || 0) + userQuarterly;
      totals.monthly.ai[0] += scenarioData.m1.ai || 0;
      totals.monthly.user[0] += scenarioData.m1.user || 0;
      totals.monthly.ai[1] += scenarioData.m2.ai || 0;
      totals.monthly.user[1] += scenarioData.m2.user || 0;
      totals.monthly.ai[2] += scenarioData.m3.ai || 0;
      totals.monthly.user[2] += scenarioData.m3.user || 0;
    });
    return totals;
  };

  useEffect(() => {
    setZbbTotals(calculateTotalsForScenario(zbbData, activeScenario));
  }, [zbbData, activeScenario]);

  const handleInputChange = (index, field, value, month = null) => {
    setZbbData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      if (month) {
        scenarioItem[month].user = parseFloat(value) || 0;
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
        totalsByScenario[scen] = calculateTotalsForScenario(zbbData, scen);
    });
    setZbbVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(zbbData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("ZBB plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = zbbData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return { 'Department': item.department, 'Project': item.project, 'Approver Role': item.approverRole, 'Status': scenarioData.status, 'Comments': scenarioData.comments, 'M1': scenarioData.m1.user, 'M2': scenarioData.m2.user, 'M3': scenarioData.m3.user, };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `ZBB Plan`);
    XLSX.writeFile(workbook, `ZBB_Plan_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      const dataMap = new Map(zbbData.map(d => [`${d.department}-${d.project}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Project']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.m1.user = row['M1'] ?? scenarioItem.m1.user;
          scenarioItem.m2.user = row['M2'] ?? scenarioItem.m2.user;
          scenarioItem.m3.user = row['M3'] ?? scenarioItem.m3.user;
          scenarioItem.status = row['Status'] ?? scenarioItem.status;
          scenarioItem.comments = row['Comments'] ?? scenarioItem.comments;
          dataMap.set(key, itemToUpdate);
        }
      });
      setZbbData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review and save changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setZbbData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  const donutChartData = {
    labels: Object.keys(zbbTotals.byDepartment || {}),
    datasets: [{ data: Object.values(zbbTotals.byDepartment || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'], hoverOffset: 4 }],
  };
  
  const barChartData = {
    labels: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    datasets: [{ label: 'Budget Requests by Status', data: Object.values(zbbTotals.statusCounts || {}), backgroundColor: ['#64748b', '#f97316', '#10b981', '#ef4444'] }]
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };

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
          to="/zeroBased-budgeting"
          className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
          Zero-Based Budgeting
        </Link>
      </div>
    </li>
    <li aria-current="page">
      <div className="flex items-center">
        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
        <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
          Department-Wide ZBB Implementation
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Department-Wide ZBB Implementation</h1>
            <p className="text-sky-100 text-x">Set different approval rules for teams & projects.</p>
          </div>
          <div className="flex items-center space-x-4">
             <div><label htmlFor="forecastPeriodSelect" className="text-s text-white font-medium mr-2">Forecast Period:</label><select id="forecastPeriodSelect" value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x focus:ring-sky-500"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'create', label: 'Configure Department Budgets'}, {id: 'import', label: 'Import Department ZBB Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
          <button key={tab.id} className={`py-2 px-4 font-medium text-s ${activeTab === tab.id ? 'text-sky-50 border-b-2 border-sky-600 bg-sky-800 rounded-t-lg' : 'text-sky-900 hover:text-sky-500 hover:bg-sky-100 rounded-t-lg'}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
        <div className="ml-4">
            <label htmlFor="scenarioSelectTab" className="text-s font-medium text-sky-800 mr-2">Active Scenario:</label>
            <select id="scenarioSelectTab" value={activeScenario} onChange={(e) => { if(hasChanges && !window.confirm("You have unsaved changes. Are you sure?")) return; setActiveScenario(e.target.value); setHasChanges(false); }} className="p-1.5 border border-sky-300 bg-white text-sky-900 rounded-md text-x focus:ring-1 focus:ring-sky-500">
                {Object.values(SCENARIOS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
        <div className="relative ml-auto" ref={filtersRef}><button onClick={() => setShowFilters(!showFilters)} className="py-2 px-3 text-gray-500 hover:text-blue-500 flex items-center text-s"><BsFilter className="mr-1" /> Filters</button></div>
      </div>
      
      <div>
        {activeTab === 'create' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200"><p className="text-x font-medium text-sky-700">Total Budget (User vs AI)</p><p className="text-2xl font-bold text-sky-900">${(zbbTotals?.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-lg font-medium text-gray-500">vs</span> ${(zbbTotals?.aiTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200"><p className="text-x font-medium text-sky-700">Approval Status</p><p className="text-2xl font-bold text-sky-900">{(zbbTotals?.statusCounts?.[APPROVAL_STATUS.APPROVED] || 0)} <span className="text-green-600">Approved</span> / {(zbbTotals?.statusCounts?.[APPROVAL_STATUS.SUBMITTED] || 0)} <span className="text-orange-500">Pending</span></p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200"><p className="text-x font-medium text-sky-700">Budget Deviation Alerts</p><p className="text-2xl font-bold text-red-600">{(zbbTotals?.statusCounts?.[APPROVAL_STATUS.REJECTED] || 0)} Rejected</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget by Department</h2><div className="h-[250px]"><Doughnut data={donutChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}} /></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Requests by Status</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions} /></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">ZBB Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department / Project</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[300px]">Monthly Budget (AI vs User)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Status / Approver</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[300px]">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {zbbData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                              <div className="font-semibold">{item.department}</div>
                              <div className="text-x text-sky-600">{item.project}</div>
                            </td>
                            <td className="px-2 py-1 space-x-2 flex">
                                {['m1', 'm2', 'm3'].map(m => (
                                    <div key={m} className="flex-1">
                                        <div className="text-x text-center text-gray-500 relative group">AI: ${scenarioData[m].ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span></div>
                                        <input type="number" value={scenarioData[m].user} onChange={(e) => handleInputChange(index, null, e.target.value, m)} className="w-full mt-1 p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/>
                                    </div>
                                ))}
                            </td>
                            <td className="px-2 py-1">
                              <select value={scenarioData.status} onChange={(e) => handleInputChange(index, 'status', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">
                                {Object.values(APPROVAL_STATUS).map(s => <option key={s}>{s}</option>)}
                              </select>
                              <div className="text-x text-center text-gray-500 mt-1">Approver: {item.approverRole}</div>
                            </td>
                            <td className="px-2 py-1"><textarea value={scenarioData.comments} onChange={(e) => handleInputChange(index, 'comments', e.target.value)} rows="2" className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border border-sky-200">
                <label htmlFor="scenarioAssumptionsText" className="block text-md font-semibold text-sky-800 mb-2">Approval Workflow Notes for {activeScenario}:</label>
                <textarea id="scenarioAssumptionsText" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s focus:ring-2 focus:ring-sky-500 bg-white" placeholder={`e.g., Department heads approve up to $50k, CFO approves above...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Department ZBB Data for {activeScenario}</h2>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" /><label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Match by 'Department'-'Project'. Updates budget, status, and comments.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare ZBB Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User Budget', 'Total AI Budget', 'Approved Items', 'Pending Items', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(zbbData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total User Budget') { value = `$${(totals.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total AI Budget') { value = `$${(totals.aiTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Approved Items') { value = `${totals.statusCounts[APPROVAL_STATUS.APPROVED] || 0} items`; }
                        else if (metric === 'Pending Items') { value = `${totals.statusCounts[APPROVAL_STATUS.SUBMITTED] || 0} items`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">ZBB Version History</h2>
          {zbbVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} User Total</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {zbbVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (<td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>))}
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

export default DepartmentZBBImplementation;