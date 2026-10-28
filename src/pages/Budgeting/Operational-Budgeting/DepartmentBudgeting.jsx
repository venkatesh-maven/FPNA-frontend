import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight, FiChevronDown, FiChevronUp, FiZoomIn } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = { BASELINE: "Baseline", STRETCH: "Stretch", CONSERVATIVE: "Conservative" };
const EXPENSE_TYPE = { RECURRING: "Recurring", ONE_TIME: "One-Time" };
const AI_CONFIDENCE = { HIGH: "High", MED: "Medium", LOW: "Low" };
const PERIODS = { ANNUAL: "Annual", Q1: "Q1", Q2: "Q2", Q3: "Q3", Q4: "Q4" };

const createAnnualData = (q1, q2, q3, q4) => ({ ...q1, ...q2, ...q3, ...q4 });

const initialDeptData = [
  // Marketing
  {
    id: 1, department: "Marketing", group: "People", expenseCategory: "Salaries & Benefits", drillDownType: "people",
    [SCENARIOS.BASELINE]:    { ...createAnnualData({ m1: {ai: 150000, user: 150000}, m2: {ai: 150000, user: 150000}, m3: {ai: 150000, user: 150000}}, {m4:{ai:150000,user:150000},m5:{ai:150000,user:150000},m6:{ai:150000,user:150000}}, {m7:{ai:155000,user:155000},m8:{ai:155000,user:155000},m9:{ai:155000,user:155000}}, {m10:{ai:155000,user:155000},m11:{ai:155000,user:155000},m12:{ai:155000,user:155000}}), type: EXPENSE_TYPE.RECURRING, confidence: AI_CONFIDENCE.HIGH, notes: "Includes mid-year merit increases.", aiInsight: "Based on current payroll data + 3% merit pool." },
    [SCENARIOS.STRETCH]:     { ...createAnnualData({ m1: {ai: 165000, user: 165000}, m2: {ai: 165000, user: 165000}, m3: {ai: 165000, user: 165000}}, {m4:{ai:165000,user:165000},m5:{ai:165000,user:165000},m6:{ai:165000,user:165000}}, {m7:{ai:170000,user:170000},m8:{ai:170000,user:170000},m9:{ai:170000,user:170000}}, {m10:{ai:170000,user:170000},m11:{ai:170000,user:170000},m12:{ai:170000,user:170000}}), type: EXPENSE_TYPE.RECURRING, confidence: AI_CONFIDENCE.MED, notes: "Includes 2 new hires in Q1.", aiInsight: "Projected cost for 2 new hires." },
    [SCENARIOS.CONSERVATIVE]:{ ...createAnnualData({ m1: {ai: 145000, user: 145000}, m2: {ai: 145000, user: 145000}, m3: {ai: 145000, user: 145000}}, {m4:{ai:145000,user:145000},m5:{ai:145000,user:145000},m6:{ai:145000,user:145000}}, {m7:{ai:145000,user:145000},m8:{ai:145000,user:145000},m9:{ai:145000,user:145000}}, {m10:{ai:145000,user:145000},m11:{ai:145000,user:145000},m12:{ai:145000,user:145000}}), type: EXPENSE_TYPE.RECURRING, confidence: AI_CONFIDENCE.HIGH, notes: "Hiring freeze assumed.", aiInsight: "Payroll minus one attrition." },
  },
  {
    id: 2, department: "Marketing", group: "Marketing Spend", expenseCategory: "Campaigns", drillDownType: "campaign",
    [SCENARIOS.BASELINE]:    { ...createAnnualData({ m1: {ai: 50000, user: 50000}, m2: {ai: 50000, user: 50000}, m3: {ai: 55000, user: 55000}}, {m4:{ai:50000,user:50000},m5:{ai:50000,user:50000},m6:{ai:55000,user:55000}}, {m7:{ai:50000,user:50000},m8:{ai:50000,user:50000},m9:{ai:55000,user:55000}}, {m10:{ai:60000,user:60000},m11:{ai:65000,user:65000},m12:{ai:70000,user:70000}}), type: EXPENSE_TYPE.RECURRING, confidence: AI_CONFIDENCE.HIGH, notes: "Standard lead gen + Q4 holiday push.", aiInsight: "Based on historical spend + seasonality." },
  },
  // IT
  {
    id: 4, department: "IT", group: "IT Spend", expenseCategory: "Cloud Tools (SaaS)", drillDownType: "saas",
    [SCENARIOS.BASELINE]:    { ...createAnnualData({ m1: {ai: 25000, user: 25000}, m2: {ai: 25000, user: 25000}, m3: {ai: 25000, user: 25000}}, {m4:{ai:26000,user:26000},m5:{ai:26000,user:26000},m6:{ai:26000,user:26000}}, {m7:{ai:27000,user:27000},m8:{ai:27000,user:27000},m9:{ai:27000,user:27000}}, {m10:{ai:28000,user:28000},m11:{ai:28000,user:28000},m12:{ai:28000,user:28000}}), type: EXPENSE_TYPE.RECURRING, confidence: AI_CONFIDENCE.HIGH, notes: "AWS, GCP, etc. with slight growth.", aiInsight: "Stable usage pattern with projected growth." },
  },
  // Sales
  {
    id: 6, department: "Sales", group: "Sales Spend", expenseCategory: "Travel & Entertainment", drillDownType: null,
    [SCENARIOS.BASELINE]:    { ...createAnnualData({ m1: {ai: 15000, user: 15000}, m2: {ai: 15000, user: 15000}, m3: {ai: 20000, user: 20000}}, {m4:{ai:25000,user:25000},m5:{ai:25000,user:25000},m6:{ai:15000,user:15000}}, {m7:{ai:15000,user:15000},m8:{ai:15000,user:15000},m9:{ai:15000,user:15000}}, {m10:{ai:30000,user:30000},m11:{ai:20000,user:20000},m12:{ai:15000,user:15000}}), type: EXPENSE_TYPE.ONE_TIME, confidence: AI_CONFIDENCE.MED, notes: "Includes Q1, Q2 & Q4 industry conferences.", aiInsight: "Travel costs aligned with prior years & events." },
  },
];


const DrillDownModal = ({ isOpen, onClose, data, scenario }) => {
    if (!isOpen || !data) return null;
    const getTitle = () => {
        if (!data) return "Details";
        switch (data.drillDownType) {
            case 'people': return `Employee-Level Plan: ${data.department}`;
            case 'saas': case 'campaign': return `Spend Breakdown: ${data.expenseCategory}`;
            default: return "Details";
        }
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}><h2 className="text-xl font-bold text-sky-900 mb-4">{getTitle()}</h2><div className="text-s text-gray-600 bg-gray-100 p-4 rounded-md"><p className="font-semibold">Line Item:</p><p>{data.department} - {data.expenseCategory}</p><p className="mt-2 font-semibold">Current Scenario:</p><p>{scenario}</p><hr className="my-4"/><p className="font-semibold text-center text-gray-700">Detailed Planning Interface</p><p className="text-center text-gray-500 mt-2">A detailed editor for this specific budget line would be available here.</p></div><div className="mt-6 flex justify-end"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Close</button></div></div></div>
    );
};

const DepartmentLevelBudgeting = () => {
  const [activeTab, setActiveTab] = useState("budgets");
  const [hasChanges, setHasChanges] = useState(false);
  const [departmentData, setDepartmentData] = useState(JSON.parse(JSON.stringify(initialDeptData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [displayPeriod, setDisplayPeriod] = useState(PERIODS.ANNUAL);

  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard operating budget. Assumes linear growth and stable market conditions. Corporate guidelines followed.",
    [SCENARIOS.STRETCH]: "Stretch budget for aggressive growth. Higher allocation to demand generation and sales capacity, accepting higher risk for higher potential reward.",
    [SCENARIOS.CONSERVATIVE]: "Conservative budget focused on capital preservation. Reduced discretionary spending across all departments.",
  });

  const [budgetVersions, setBudgetVersions] = useState([]);
  const [budgetTotals, setBudgetTotals] = useState({});
  const [collapsedDepts, setCollapsedDepts] = useState(new Set());
  const [modalState, setModalState] = useState({ isOpen: false, data: null });
  const ALL_MONTHS = useMemo(() => Array.from({ length: 12 }, (_, i) => `m${i + 1}`), []);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { ...ALL_MONTHS.reduce((acc, m) => ({ ...acc, [m]: {ai:0, user:0} }), {}), type: EXPENSE_TYPE.RECURRING, confidence: AI_CONFIDENCE.LOW, notes: "", aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { aiTotal: 0, userTotal: 0, byDepartment: {}, byType: { [EXPENSE_TYPE.RECURRING]: 0, [EXPENSE_TYPE.ONE_TIME]: 0 } };
    if (!data || data.length === 0) return totals;
    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const userAnnual = ALL_MONTHS.reduce((sum, m) => sum + (scenarioData[m]?.user || 0), 0);
      const aiAnnual = ALL_MONTHS.reduce((sum, m) => sum + (scenarioData[m]?.ai || 0), 0);
      totals.userTotal += userAnnual;
      totals.aiTotal += aiAnnual;
      totals.byDepartment[item.department] = (totals.byDepartment[item.department] || 0) + userAnnual;
      if (scenarioData.type) {
        totals.byType[scenarioData.type] = (totals.byType[scenarioData.type] || 0) + userAnnual;
      }
    });
    return totals;
  };

  const visibleMonths = useMemo(() => {
    switch (displayPeriod) {
        case PERIODS.Q1: return ALL_MONTHS.slice(0, 3);
        case PERIODS.Q2: return ALL_MONTHS.slice(3, 6);
        case PERIODS.Q3: return ALL_MONTHS.slice(6, 9);
        case PERIODS.Q4: return ALL_MONTHS.slice(9, 12);
        default: return ALL_MONTHS;
    }
  }, [displayPeriod, ALL_MONTHS]);
  
  const groupedData = useMemo(() => {
    return departmentData.reduce((acc, item) => {
        (acc[item.department] = acc[item.department] || []).push(item);
        return acc;
    }, {});
  }, [departmentData]);

  useEffect(() => { setBudgetTotals(calculateTotalsForScenario(departmentData, activeScenario)); }, [departmentData, activeScenario]);

  const handleInputChange = (id, field, value, month = null) => {
    setDepartmentData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const itemToUpdate = newData.find(item => item.id === id);
      if (!itemToUpdate) return prev;
      const scenarioItem = itemToUpdate[activeScenario];
      if (month) { scenarioItem[month].user = parseFloat(value) || 0; }
      else { scenarioItem[field] = value; }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => { totalsByScenario[scen] = calculateTotalsForScenario(departmentData, scen); });
    setBudgetVersions(prev => [...prev, { timestamp, data: JSON.parse(JSON.stringify(departmentData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Department budget version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = departmentData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      const row = { 'Department': item.department, 'Group': item.group, 'Expense Category': item.expenseCategory };
      ALL_MONTHS.forEach(m => { row[`${m.toUpperCase()} Budget`] = scenarioData[m]?.user || 0; });
      row['Type'] = scenarioData.type;
      row['Notes'] = scenarioData.notes;
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Dept Budget`);
    XLSX.writeFile(workbook, `Dept_Budget_${activeScenario.replace(/\s+/g, '_')}_${displayPeriod}.xlsx`);
  };

  const toggleDeptCollapse = (deptName) => setCollapsedDepts(prev => { const newSet = new Set(prev); newSet.has(deptName) ? newSet.delete(deptName) : newSet.add(deptName); return newSet; });
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = { labels: Object.keys(budgetTotals.byDepartment || {}), datasets: [{ label: 'Budget by Department', data: Object.values(budgetTotals.byDepartment || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'] }] };
  const pieChartData = { labels: Object.keys(budgetTotals.byType || {}), datasets: [{ data: Object.values(budgetTotals.byType || {}), backgroundColor: ['#3b82f6', '#f97316'], hoverOffset: 4 }] };
  
  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen bg-sky-50">
        <DrillDownModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, data: null })} data={modalState.data} scenario={activeScenario} />
        <nav className="flex mb-4" aria-label="Breadcrumb"><ol className="inline-flex items-center space-x-1 md:space-x-2"><li className="inline-flex items-center"><Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600"><svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/></svg>Home</Link></li><li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><Link to="/operational-budgeting" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">Operational Budgeting</Link></div></li><li aria-current="page"><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Department-Level Budgeting</span></div></li></ol></nav>
        <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm"><div className="flex justify-between items-center"><div><h1 className="text-xl font-bold text-white">Department-Level Budgeting</h1><p className="text-sky-100 text-s">Plan and manage departmental operating expenses for 2025.</p></div><div className="flex items-center space-x-4"><button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button></div></div></div>

        <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
          {[{id: 'budgets', label: 'Department Budgets'}, {id: 'import', label: 'Import Plans'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => ( <button key={tab.id} className={`py-2 px-4 font-medium text-s ${activeTab === tab.id ? 'text-sky-50 border-b-2 border-sky-600 bg-sky-800 rounded-t-lg' : 'text-sky-900 hover:text-sky-500 hover:bg-sky-100 rounded-t-lg'}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>))}
          <div className="ml-auto flex items-center gap-4"><label className="text-s font-medium text-sky-800">Active Scenario:</label><select value={activeScenario} onChange={(e) => { if(hasChanges && !window.confirm("Unsaved changes. Switch anyway?")) return; setActiveScenario(e.target.value); setHasChanges(false); }} className="p-2 border border-sky-300 bg-white text-sky-900 rounded-md text-s shadow-sm focus:ring-2 focus:ring-blue-500">{Object.values(SCENARIOS).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        </div>
      
      <div>
        {activeTab === 'budgets' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Annual Budget (User vs AI)</p><p className="text-2xl font-bold text-sky-900">${(budgetTotals?.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <span className="text-lg font-medium text-gray-500">vs</span> ${(budgetTotals?.aiTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div><div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Variance from Guidelines</p><p className={`text-2xl font-bold ${(budgetTotals.userTotal - budgetTotals.aiTotal) > 0 ? 'text-red-600' : 'text-green-600'}`}>${(budgetTotals.userTotal - budgetTotals.aiTotal).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div><div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Pending Approvals</p><p className="text-2xl font-bold text-sky-900">3 Items</p></div></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6"><div className="bg-white p-4 rounded-lg shadow-sm border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Annual Spend by Department</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div><div className="bg-white p-4 rounded-lg shadow-sm border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Annual Recurring vs. One-Time</h2><div className="h-[250px]"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right' } }}}/></div></div></div>
            
            <div className="bg-white rounded-lg mt-5 shadow-sm border">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <div><h2 className="text-xl font-semibold text-sky-900">Budget Editor ({activeScenario})</h2><div className="mt-2 flex items-center bg-sky-100/70 rounded-lg p-1 w-fit"><button onClick={()=>setDisplayPeriod(PERIODS.ANNUAL)} className={`px-3 py-1 text-s font-semibold rounded-md ${displayPeriod===PERIODS.ANNUAL?'bg-white text-blue-600 shadow-sm':'text-sky-700 hover:bg-sky-200'}`}>Annual</button><div className="w-px h-5 bg-sky-200 mx-1"></div>{Object.values(PERIODS).filter(p=>p!=='Annual').map(p => (<button key={p} onClick={() => setDisplayPeriod(p)} className={`px-3 py-1 text-s font-semibold rounded-md ${displayPeriod === p ? 'bg-white text-blue-600 shadow-sm' : 'text-sky-700 hover:bg-sky-200'}`}>{p}</button>))}</div></div>
                  <div className="flex space-x-2"><button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center font-semibold"><FiDownload className="mr-2"/>Export</button><button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center font-semibold ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2"/>Save Budget</button></div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
                  <table className="min-w-full">
                    <thead className="bg-sky-50 sticky top-0 z-20">
                        <tr><th className="px-4 py-3 text-left text-x font-semibold text-sky-800 uppercase sticky left-0 bg-sky-50 z-30 min-w-[280px]">Category</th>{visibleMonths.map(m => <th key={m} className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">{m.toUpperCase()}</th>)}<th className="px-4 py-3 text-center text-x font-semibold text-sky-800 uppercase min-w-[140px] bg-sky-100">Total ({displayPeriod})</th><th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Type</th><th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[250px]">Notes / Justification</th><th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Details</th></tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {Object.entries(groupedData).map(([department, items]) => {
                        const isCollapsed = collapsedDepts.has(department);
                        const itemsByGroup = items.reduce((acc, item) => { (acc[item.group] = acc[item.group] || []).push(item); return acc; }, {});
                        const deptPeriodTotal = items.reduce((sum, item) => sum + visibleMonths.reduce((monthlySum, m) => monthlySum + (getScenarioDataItem(item, activeScenario)[m]?.user || 0), 0), 0);
                        return (
                          <React.Fragment key={department}>
                            <tr className="bg-sky-200/50 border-y border-sky-300/70"><td className="px-4 py-3 text-base font-bold text-sky-900 sticky left-0 bg-sky-200/50 z-10"><button onClick={() => toggleDeptCollapse(department)} className="flex items-center gap-2 w-full">{isCollapsed ? <FiChevronRight /> : <FiChevronDown />} {department}</button></td><td colSpan={visibleMonths.length} className="px-4 py-2 text-s font-bold text-sky-800 text-right">{displayPeriod} Total:</td><td className="px-4 py-2 text-s font-bold text-sky-900 text-center bg-sky-200/50">${deptPeriodTotal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td><td colSpan={3}></td></tr>
                            {!isCollapsed && Object.entries(itemsByGroup).map(([group, groupItems]) => (
                              <React.Fragment key={group}>
                                <tr className="bg-sky-100/70"><td colSpan={visibleMonths.length + 5} className="px-6 py-1.5 text-s font-semibold text-sky-800 sticky left-0 bg-sky-100/70 z-10">{group}</td></tr>
                                {groupItems.map((item) => {
                                  const scenarioData = getScenarioDataItem(item, activeScenario);
                                  const lineTotal = visibleMonths.reduce((sum, m) => sum + (scenarioData[m]?.user || 0), 0);
                                  return (
                                    <tr key={item.id} className="bg-white hover:bg-sky-100/50">
                                      <td className="pl-10 pr-4 py-3 text-s font-medium text-sky-800 sticky left-0 z-[5] bg-inherit">{item.expenseCategory}</td>
                                      {visibleMonths.map(month => (<td key={month} className="px-2 py-2"><div className="text-x text-sky-500 text-center relative group">AI: ${scenarioData[month]?.ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-sky-400" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-40 pointer-events-none">{scenarioData.aiInsight}</span></div><input type="number" value={scenarioData[month]?.user} onChange={(e) => handleInputChange(item.id, null, e.target.value, month)} className="w-full mt-1 p-1.5 border border-sky-300 rounded-md text-s text-center bg-white shadow-sm focus:ring-1 focus:ring-blue-500"/></td>))}
                                      <td className="px-4 py-2 font-semibold text-center text-sky-800 bg-sky-50/70">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                                      <td className="px-2 py-2"><select value={scenarioData.type} onChange={(e) => handleInputChange(item.id, 'type', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white shadow-sm">{Object.values(EXPENSE_TYPE).map(t=><option key={t}>{t}</option>)}</select></td>
                                      <td className="px-2 py-2"><textarea value={scenarioData.notes} onChange={(e) => handleInputChange(item.id, 'notes', e.target.value)} rows="1" className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white shadow-sm"/></td>
                                      <td className="px-2 py-2 text-center">{item.drillDownType && <button onClick={() => setModalState({ isOpen: true, data: item })} className="p-2 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded-full"><FiZoomIn/></button>}</td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="mb-6 mt-6 p-4 bg-white rounded-lg shadow-sm border"><label htmlFor="assumptions" className="block text-md font-semibold text-sky-800 mb-2">Budget Assumptions for {activeScenario}:</label><textarea id="assumptions" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white focus:ring-1 focus:ring-blue-500" placeholder={`e.g., Allocation rules, team-level commentary...`} /></div>
          </>
        )}
        
        {activeTab === 'import' && (<div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200"><h2 className="text-xl font-semibold text-sky-900 mb-4">Import Department Expense Plans</h2><p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV file with your department budget data. Match by 'Department' and 'Expense Category'.</p><div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center"><FiUpload className="mx-auto text-4xl text-sky-500 mb-3" /><label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label><input id="importFile" type="file" onChange={()=>{}} accept=".xlsx,.xls,.csv" className="hidden"/><p className="text-x text-gray-500 mt-3">File must contain 'Department', 'Expense Category', monthly budget columns (e.g., 'M1 Budget'), 'Type', and 'Notes'.</p></div></div>)}
        {activeTab === 'compare' && (<div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200"><h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Department Scenarios</h2><div className="overflow-x-auto"><table className="min-w-full divide-y divide-sky-200"><thead className="bg-sky-100"><tr><th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>{Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}</tr></thead><tbody className="bg-white divide-y divide-sky-100">{['Total User Budget', 'Total AI Budget', 'Variance vs AI', 'Assumptions'].map(metric => (<tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}><td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>{Object.values(SCENARIOS).map(scenarioName => {const totals = calculateTotalsForScenario(departmentData, scenarioName); let value, className = "text-s text-sky-700"; if (metric === 'Total User Budget') { value = `$${(totals.userTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; } else if (metric === 'Total AI Budget') { value = `$${(totals.aiTotal || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; } else if (metric === 'Variance vs AI') { const variance = totals.userTotal - totals.aiTotal; value = `$${variance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`; } else if (metric === 'Assumptions') { value = scenarioAssumptions[scenarioName] || 'N/A'; className = "text-x text-gray-600 whitespace-pre-wrap max-w-xs"; } return <td key={`${metric}-${scenarioName}`} className={`px-5 py-4 ${className}`}>{value}</td>;})}</tr>))}</tbody></table></div></div>)}
        <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200"><h2 className="text-xl font-semibold text-sky-900 mb-4">Budget Version History</h2>{budgetVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-sky-100"><thead className="bg-sky-50"><tr><th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>{Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} User Total</th>)}<th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th></tr></thead><tbody className="divide-y divide-sky-100">{budgetVersions.map((version, index) => (<tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}><td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>{Object.values(SCENARIOS).map(scen => {const total = version.totalsByScenario?.[scen] || { userTotal: 0 }; return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.userTotal.toLocaleString()}</td>})}<td className="px-4 py-3"><button onClick={() => {}} className="text-s text-sky-700 hover:text-sky-900 hover:underline">Restore</button></td></tr>))}</tbody></table></div>)}</div>
      </div>
    </div>
  );
};

export default DepartmentLevelBudgeting;