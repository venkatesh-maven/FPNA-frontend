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
  GROWTH_HIRING: "Growth Hiring Plan",
  COST_CONSCIOUS: "Cost-Conscious Plan",
};

const HIRING_TYPE = {
  NEW: "New",
  REPLACEMENT: "Replacement",
};

// Mock data for headcount planning
const initialHeadcountData = [
  {
    role: "Software Engineer II", department: "Engineering",
    [SCENARIOS.BASELINE]:        { type: HIRING_TYPE.NEW, startDate: "2025-02-01", salary: 120000, bonus: 10, userOverride: 132000, aiInsight: "Total cost includes 10% bonus and prorated salary." },
    [SCENARIOS.GROWTH_HIRING]:   { type: HIRING_TYPE.NEW, startDate: "2025-01-15", salary: 125000, bonus: 12, userOverride: 140000, aiInsight: "Higher salary to attract talent in a competitive market." },
    [SCENARIOS.COST_CONSCIOUS]:  { type: HIRING_TYPE.REPLACEMENT, startDate: "2025-04-01", salary: 115000, bonus: 8, userOverride: 124200, aiInsight: "Delayed start and lower salary to conserve budget." },
  },
  {
    role: "Account Executive", department: "Sales",
    [SCENARIOS.BASELINE]:        { type: HIRING_TYPE.NEW, startDate: "2025-03-01", salary: 80000, bonus: 100, userOverride: 160000, aiInsight: "Includes on-target earnings (OTE)." },
    [SCENARIOS.GROWTH_HIRING]:   { type: HIRING_TYPE.NEW, startDate: "2025-02-01", salary: 85000, bonus: 100, userOverride: 170000, aiInsight: "Accelerated hiring to capture market share." },
    [SCENARIOS.COST_CONSCIOUS]:  { type: HIRING_TYPE.REPLACEMENT, startDate: "2025-07-01", salary: 75000, bonus: 100, userOverride: 150000, aiInsight: "Backfill only, no net new headcount." },
  },
  {
    role: "Product Marketing Manager", department: "Marketing",
    [SCENARIOS.BASELINE]:        { type: HIRING_TYPE.NEW, startDate: "2025-04-15", salary: 95000, bonus: 15, userOverride: 109250, aiInsight: "Standard hire for upcoming product launch." },
    [SCENARIOS.GROWTH_HIRING]:   { type: HIRING_TYPE.NEW, startDate: "2025-03-01", salary: 100000, bonus: 15, userOverride: 115000, aiInsight: "Early hire to support accelerated GTM." },
    [SCENARIOS.COST_CONSCIOUS]:  { type: HIRING_TYPE.NEW, startDate: "2025-08-01", salary: 90000, bonus: 10, userOverride: 99000, aiInsight: "Hiring deferred until H2." },
  },
];

const HeadcountPlanning = () => {
  const [activeTab, setActiveTab] = useState("plan");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [headcountData, setHeadcountData] = useState(JSON.parse(JSON.stringify(initialHeadcountData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes a 5% annual attrition rate. Hiring plan is aligned with 15% revenue growth targets.",
    [SCENARIOS.GROWTH_HIRING]: "Accelerated hiring to support a 25% revenue growth target. Accepts higher recruitment costs and faster ramp time.",
    [SCENARIOS.COST_CONSCIOUS]: "Hiring freeze on all non-essential roles. Only critical backfills are approved. Aims to reduce payroll growth to near zero.",
  });

  const [headcountVersions, setHeadcountVersions] = useState([]);
  const [headcountTotals, setHeadcountTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { type: HIRING_TYPE.NEW, startDate: "N/A", salary: 0, bonus: 0, userOverride: 0, aiInsight: "N/A" };
  };
  
  const calculateAiCost = (salary, bonus) => salary * (1 + bonus / 100);

  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { plannedHeadcount: 0, payrollCost: 0, byDepartment: {}, byType: { [HIRING_TYPE.NEW]: 0, [HIRING_TYPE.REPLACEMENT]: 0 } };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.plannedHeadcount++;
      totals.payrollCost += scenarioData.userOverride;
      
      totals.byDepartment[item.department] = (totals.byDepartment[item.department] || 0) + scenarioData.userOverride;
      totals.byType[scenarioData.type]++;
    });
    return totals;
  };

  useEffect(() => {
    setHeadcountTotals(calculateTotalsForScenario(headcountData, activeScenario));
  }, [headcountData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setHeadcountData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      
      if(field === 'salary' || field === 'bonus') {
          scenarioItem[field] = parseFloat(value) || 0;
          scenarioItem.userOverride = calculateAiCost(scenarioItem.salary, scenarioItem.bonus);
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
      totalsByScenario[scen] = calculateTotalsForScenario(headcountData, scen);
    });
    setHeadcountVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(headcountData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Headcount plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = headcountData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Role': item.role, 'Department': item.department,
        'Hiring Type': scenarioData.type, 'Start Date': scenarioData.startDate,
        'Salary': scenarioData.salary, 'Bonus (%)': scenarioData.bonus,
        'Total Cost': scenarioData.userOverride,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Headcount Plan`);
    XLSX.writeFile(workbook, `Headcount_Plan_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(headcountData.map(d => [`${d.department}-${d.role}`, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const key = `${row['Department']}-${row['Role']}`;
        if (dataMap.has(key)) {
          const itemToUpdate = dataMap.get(key);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.type = row['Hiring Type'] ?? scenarioItem.type;
          scenarioItem.startDate = row['Start Date'] ?? scenarioItem.startDate;
          scenarioItem.salary = row['Salary'] ?? scenarioItem.salary;
          scenarioItem.bonus = row['Bonus (%)'] ?? scenarioItem.bonus;
          scenarioItem.userOverride = row['Total Cost'] ?? calculateAiCost(scenarioItem.salary, scenarioItem.bonus);
          dataMap.set(key, itemToUpdate);
        }
      });
      setHeadcountData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Workforce data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setHeadcountData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(headcountTotals.byDepartment || {}),
    datasets: [{ label: 'Payroll Cost by Department', data: Object.values(headcountTotals.byDepartment || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316'] }],
  };
  const pieChartData = {
    labels: Object.keys(headcountTotals.byType || {}),
    datasets: [{ data: Object.values(headcountTotals.byType || {}), backgroundColor: ['#3b82f6', '#6ee7b7'], hoverOffset: 4 }],
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
                to="/workforce-budgeting"
                className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Workforce & Payroll
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                Headcount Planning
              </span>
            </div>
          </li>
        </ol>
      </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Headcount Planning & Cost Forecasting</h1><p className="text-sky-100 text-x">Align hiring plans with company growth goals.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'plan', label: 'Plan Headcount'}, {id: 'import', label: 'Import Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Planned Headcount</p><p className="text-2xl font-bold text-sky-900">{headcountTotals?.plannedHeadcount || 0}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Estimated Payroll Cost</p><p className="text-2xl font-bold text-sky-900">${(headcountTotals?.payrollCost || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Avg. Cost per Hire</p><p className="text-2xl font-bold text-sky-900">${(headcountTotals.plannedHeadcount > 0 ? headcountTotals.payrollCost / headcountTotals.plannedHeadcount : 0).toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Payroll Cost by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Headcount by Type</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Headcount Plan Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Role / Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Hiring Type</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Start Date</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Salary</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Bonus %</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Total Cost</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">User Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {headcountData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const aiCost = calculateAiCost(scenarioData.salary, scenarioData.bonus);
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.role}</div><div className="text-x text-sky-600">{item.department}</div>
                            </td>
                            <td className="px-2 py-1"><select value={scenarioData.type} onChange={(e) => handleInputChange(index, 'type', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">{Object.values(HIRING_TYPE).map(t=><option key={t}>{t}</option>)}</select></td>
                            <td className="px-2 py-1"><input type="date" value={scenarioData.startDate} onChange={(e) => handleInputChange(index, 'startDate', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.salary} onChange={(e) => handleInputChange(index, 'salary', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.bonus} onChange={(e) => handleInputChange(index, 'bonus', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${aiCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Workforce Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Hiring targets, attrition expectations...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Workforce Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your workforce plan. Match by 'Department' and 'Role'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Role', 'Hiring Type', 'Start Date', 'Salary', 'Bonus (%)', and 'Total Cost'.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Hiring Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Payroll Cost', 'Planned Headcount', 'New Hires', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(headcountData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total Payroll Cost') { value = `$${(totals.payrollCost || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Planned Headcount') { value = `${totals.plannedHeadcount} hires`; }
                        else if (metric === 'New Hires') { value = `${totals.byType[HIRING_TYPE.NEW] || 0} new`; }
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
          {headcountVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Payroll Cost</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {headcountVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { payrollCost: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.payrollCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default HeadcountPlanning;