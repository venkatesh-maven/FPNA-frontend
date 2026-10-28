import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Best Case (Low Attrition)",
  WORST_CASE: "Worst Case (High Attrition)",
};

// Mock data for employees/roles
const initialEmployeeData = [
  {
    name: "Sr. Software Engineer", department: "Engineering", headcount: 15,
    [SCENARIOS.BASELINE]:              { attritionProbability: { ai: 12, user: 12 }, replacementSalary: { ai: 140000, user: 140000 }, oneTimeCost: { ai: 30000, user: 30000 } },
    [SCENARIOS.BEST_CASE]:             { attritionProbability: { ai: 5, user: 5 },   replacementSalary: { ai: 135000, user: 135000 }, oneTimeCost: { ai: 28000, user: 28000 } },
    [SCENARIOS.WORST_CASE]:            { attritionProbability: { ai: 25, user: 25 }, replacementSalary: { ai: 150000, user: 150000 }, oneTimeCost: { ai: 35000, user: 35000 } },
  },
  {
    name: "Product Manager", department: "Product", headcount: 5,
    [SCENARIOS.BASELINE]:              { attritionProbability: { ai: 10, user: 10 }, replacementSalary: { ai: 130000, user: 130000 }, oneTimeCost: { ai: 25000, user: 25000 } },
    [SCENARIOS.BEST_CASE]:             { attritionProbability: { ai: 4, user: 4 },   replacementSalary: { ai: 125000, user: 125000 }, oneTimeCost: { ai: 22000, user: 22000 } },
    [SCENARIOS.WORST_CASE]:            { attritionProbability: { ai: 20, user: 20 }, replacementSalary: { ai: 140000, user: 140000 }, oneTimeCost: { ai: 30000, user: 30000 } },
  },
  {
    name: "Sales Development Rep", department: "Sales", headcount: 20,
    [SCENARIOS.BASELINE]:              { attritionProbability: { ai: 25, user: 25 }, replacementSalary: { ai: 75000, user: 75000 }, oneTimeCost: { ai: 15000, user: 15000 } },
    [SCENARIOS.BEST_CASE]:             { attritionProbability: { ai: 15, user: 15 }, replacementSalary: { ai: 70000, user: 70000 }, oneTimeCost: { ai: 12000, user: 12000 } },
    [SCENARIOS.WORST_CASE]:            { attritionProbability: { ai: 40, user: 40 }, replacementSalary: { ai: 80000, user: 80000 }, oneTimeCost: { ai: 18000, user: 18000 } },
  },
  {
    name: "Customer Support Agent", department: "Support", headcount: 12,
    [SCENARIOS.BASELINE]:              { attritionProbability: { ai: 30, user: 30 }, replacementSalary: { ai: 55000, user: 55000 }, oneTimeCost: { ai: 8000, user: 8000 } },
    [SCENARIOS.BEST_CASE]:             { attritionProbability: { ai: 20, user: 20 }, replacementSalary: { ai: 52000, user: 52000 }, oneTimeCost: { ai: 7000, user: 7000 } },
    [SCENARIOS.WORST_CASE]:            { attritionProbability: { ai: 45, user: 45 }, replacementSalary: { ai: 60000, user: 60000 }, oneTimeCost: { ai: 10000, user: 10000 } },
  },
];

const AttritionReplacementCostProjections = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [employeeData, setEmployeeData] = useState(JSON.parse(JSON.stringify(initialEmployeeData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes market-average turnover rates based on historical data. Standard hiring timelines and market-rate replacement salaries.",
    [SCENARIOS.BEST_CASE]: "Assumes high employee satisfaction, successful retention initiatives, and an efficient internal mobility program, leading to lower attrition and costs.",
    [SCENARIOS.WORST_CASE]: "Considers increased market competition for talent, potential impact of a challenging quarter on morale, and higher replacement costs due to a tight labor market.",
  });

  const [attritionVersions, setAttritionVersions] = useState([]);
  const [attritionTotals, setAttritionTotals] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);

  const getRoleScenarioData = (role, scenarioKey) => {
    return role[scenarioKey] || { 
      attritionProbability: { ai: 0, user: 0 }, 
      replacementSalary: { ai: 0, user: 0 }, 
      oneTimeCost: { ai: 0, user: 0 } 
    };
  };

  const calculateTotalCostForRole = (prob, salary, oneTime, headcount) => {
    const expectedAttritedCount = headcount * (prob / 100);
    if (expectedAttritedCount === 0) return 0;
    const quarterlySalaryCost = (salary / 12) * 3;
    const totalCostPerReplacement = quarterlySalaryCost + oneTime;
    return totalCostPerReplacement * expectedAttritedCount;
  };

  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = {
      ai: { expectedAttritionCount: 0, replacementSalaryCost: 0, oneTimeCost: 0, totalCost: 0 },
      user: { expectedAttritionCount: 0, replacementSalaryCost: 0, oneTimeCost: 0, totalCost: 0 },
      initialHeadcount: data.reduce((sum, role) => sum + role.headcount, 0)
    };

    data.forEach(role => {
      const scenarioData = getRoleScenarioData(role, scenarioKey);
      
      const aiExpectedCount = role.headcount * (scenarioData.attritionProbability.ai / 100);
      totals.ai.expectedAttritionCount += aiExpectedCount;
      totals.ai.replacementSalaryCost += (scenarioData.replacementSalary.ai / 12 * 3) * aiExpectedCount;
      totals.ai.oneTimeCost += scenarioData.oneTimeCost.ai * aiExpectedCount;
      
      const userExpectedCount = role.headcount * (scenarioData.attritionProbability.user / 100);
      totals.user.expectedAttritionCount += userExpectedCount;
      totals.user.replacementSalaryCost += (scenarioData.replacementSalary.user / 12 * 3) * userExpectedCount;
      totals.user.oneTimeCost += scenarioData.oneTimeCost.user * userExpectedCount;
    });

    totals.ai.totalCost = totals.ai.replacementSalaryCost + totals.ai.oneTimeCost;
    totals.user.totalCost = totals.user.replacementSalaryCost + totals.user.oneTimeCost;
    return totals;
  };
  
  useEffect(() => {
    setAttritionTotals(calculateTotalsForScenario(employeeData, activeScenario));
  }, [employeeData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setEmployeeData(prev => {
      const newRoles = JSON.parse(JSON.stringify(prev));
      const scenarioData = newRoles[index][activeScenario];
      
      if (field === 'attritionProbability') scenarioData.attritionProbability.user = parseFloat(value) || 0;
      if (field === 'replacementSalary') scenarioData.replacementSalary.user = parseFloat(value) || 0;
      if (field === 'oneTimeCost') scenarioData.oneTimeCost.user = parseFloat(value) || 0;
      
      return newRoles;
    });
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const currentTotalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        currentTotalsByScenario[scen] = calculateTotalsForScenario(employeeData, scen);
    });

    setAttritionVersions(prev => [
      ...prev,
      { 
        period, 
        timestamp, 
        data: JSON.parse(JSON.stringify(employeeData)), 
        totalsByScenario: currentTotalsByScenario,
        assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))
      },
    ]);
    setHasChanges(false);
    alert("Attrition projection version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = employeeData.map(role => {
      const scenarioData = getRoleScenarioData(role, activeScenario);
      return {
        'Role': role.name,
        'Department': role.department,
        'Current Headcount': role.headcount,
        'Attrition Probability % (AI)': scenarioData.attritionProbability.ai,
        'Attrition Probability % (User)': scenarioData.attritionProbability.user,
        'Replacement Salary (AI)': scenarioData.replacementSalary.ai,
        'Replacement Salary (User)': scenarioData.replacementSalary.user,
        'One-Time Replacement Cost (AI)': scenarioData.oneTimeCost.ai,
        'One-Time Replacement Cost (User)': scenarioData.oneTimeCost.user,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Attrition Forecast`);
    const fileName = `Attrition_Forecast_${activeScenario.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
      const roleMap = new Map(employeeData.map(r => [r.name, JSON.parse(JSON.stringify(r))]));
      jsonData.forEach(row => {
        const roleName = row['Role'];
        if (roleMap.has(roleName)) {
          const roleToUpdate = roleMap.get(roleName);
          const scenarioData = getRoleScenarioData(roleToUpdate, activeScenario);
          scenarioData.attritionProbability.user = row['Attrition Probability % (User)'] ?? scenarioData.attritionProbability.user;
          scenarioData.replacementSalary.user = row['Replacement Salary (User)'] ?? scenarioData.replacementSalary.user;
          scenarioData.oneTimeCost.user = row['One-Time Replacement Cost (User)'] ?? scenarioData.oneTimeCost.user;
          roleMap.set(roleName, roleToUpdate);
        }
      });
  
      setEmployeeData(Array.from(roleMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review and save changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setEmployeeData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  // Chart Data
  const trendChartData = {
    labels: ["Start of Q", "End of Q"],
    datasets: [
        {
            label: `Projected Headcount (User)`,
            data: [attritionTotals?.initialHeadcount, attritionTotals?.initialHeadcount - (attritionTotals?.user?.expectedAttritionCount || 0)],
            borderColor: "rgba(239, 68, 68, 1)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            tension: 0.1,
        },
        {
            label: `Projected Headcount (AI)`,
            data: [attritionTotals?.initialHeadcount, attritionTotals?.initialHeadcount - (attritionTotals?.ai?.expectedAttritionCount || 0)],
            borderColor: "rgba(16, 185, 129, 1)",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            tension: 0.1,
      },
    ],
  };

  const breakdownChartData = {
    labels: ["Cost Breakdown (User Forecast)"],
    datasets: [
      { label: 'Replacement Salary Cost', data: [attritionTotals?.user?.replacementSalaryCost], backgroundColor: 'rgba(59, 130, 246, 0.7)' },
      { label: 'Recruitment & Onboarding Cost', data: [attritionTotals?.user?.oneTimeCost], backgroundColor: 'rgba(249, 115, 22, 0.7)' },
    ],
  };
  
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: ctx.dataset.label.includes('Cost') ? 0 : 1})}` } } },
    scales: { y: { beginAtZero: false, grid: { color: "rgba(0, 0, 0, 0.05)" }, title: { display: true, text: "Value" } }, x: { grid: { display: false } } },
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
					Attrition Replacement
				</span>
			</div>
		</li>
	</ol>
</nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Attrition & Replacement Cost Projections</h1>
            <p className="text-sky-100 text-x">Budget for turnover & new hiring needs.</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="">
              <label htmlFor="forecastPeriodSelect" className="text-s text-white font-medium mr-2">Forecast Period:</label>
              <select id="forecastPeriodSelect" value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x focus:ring-sky-500 focus:border-sky-500">
                <option>Q1 2025</option><option>Q2 2025</option><option>Q3 2025</option><option>Q4 2025</option>
              </select>
            </div>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                <FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {['create', 'import', 'compare'].map(tabId => (
          <button key={tabId} className={`py-2 px-4 font-medium text-s ${activeTab === tabId ? 'text-sky-50 border-b-2 border-sky-600 bg-sky-800 rounded-t-lg' : 'text-sky-900 hover:text-sky-500 hover:bg-sky-100 rounded-t-lg'}`} onClick={() => setActiveTab(tabId)}>
            {tabId === 'create' && 'Create/Edit Projections'}
            {tabId === 'import' && 'Import Attrition Data'}
            {tabId === 'compare' && 'Compare Scenarios'}
          </button>
        ))}
        <div className="ml-4">
            <label htmlFor="scenarioSelectTab" className="text-s font-medium text-sky-800 mr-2">Active Scenario:</label>
            <select id="scenarioSelectTab" value={activeScenario} onChange={(e) => {
                if(hasChanges && !window.confirm("You have unsaved changes. Are you sure you want to switch?")) return;
                setActiveScenario(e.target.value);
                setHasChanges(false);
            }} className="p-1.5 border border-sky-300 bg-white text-sky-900 rounded-md text-x focus:ring-1 focus:ring-sky-500">
                {Object.values(SCENARIOS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
        <div className="relative ml-auto" ref={filtersRef}><button onClick={() => setShowFilters(!showFilters)} className="py-2 px-3 text-gray-500 hover:text-blue-500 flex items-center text-s"><BsFilter className="mr-1" /> Filters</button></div>
      </div>
      
      <div>
        {activeTab === 'create' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total Attrition Forecast (User)</p>
                <p className="text-2xl font-bold text-sky-900">{(attritionTotals?.user?.expectedAttritionCount || 0).toFixed(getDecimalPrecision())} Employees</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total Replacement Cost (User)</p>
                <p className="text-2xl font-bold text-sky-900">${(attritionTotals?.user?.totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Cost Variance (User vs AI)</p>
                <p className={`text-2xl font-bold ${(attritionTotals?.user?.totalCost || 0) >= (attritionTotals?.ai?.totalCost || 0) ? 'text-red-600' : 'text-green-600'}`}>${Math.abs((attritionTotals?.user?.totalCost || 0) - (attritionTotals?.ai?.totalCost || 0)).toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">Projected Headcount Change ({activeScenario})</h2>
                <div className="h-[250px]"><Line data={trendChartData} options={chartOptions} /></div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">Attrition Cost Breakdown ({activeScenario})</h2>
                <div className="h-[250px]"><Bar data={breakdownChartData} options={{...chartOptions, scales: {...chartOptions.scales, x: {...chartOptions.scales.x, stacked: true}, y: {...chartOptions.scales.y, stacked: true}}}} /></div>
              </div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Attrition Cost Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Role / Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[180px]" colSpan={2}>Attrition Prob. (%)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[240px]" colSpan={2}>Replacement Salary</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[240px]" colSpan={2}>One-Time Costs</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[240px]" colSpan={2}>Total Quarterly Cost</th>
                      </tr>
                      <tr className="bg-sky-100 sticky top-[45px] z-10">
                        <th className="sticky left-0 bg-sky-100 z-20"></th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700 relative group">AI<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">Based on historical turnover and market data.</span></th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">AI</th><th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">AI</th><th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">AI</th><th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {employeeData.map((role, index) => {
                        const scenarioData = getRoleScenarioData(role, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const aiTotalCost = calculateTotalCostForRole(scenarioData.attritionProbability.ai, scenarioData.replacementSalary.ai, scenarioData.oneTimeCost.ai, role.headcount);
                        const userTotalCost = calculateTotalCostForRole(scenarioData.attritionProbability.user, scenarioData.replacementSalary.user, scenarioData.oneTimeCost.user, role.headcount);
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass} min-w-[200px]`}>
                              <div className="font-semibold">{role.name}</div>
                              <div className="text-x text-sky-600">{role.department} ({role.headcount} employees)</div>
                            </td>
                            <td className="px-4 py-3 text-s text-center text-sky-800">{scenarioData.attritionProbability.ai}%</td>
                            <td className="px-2 py-1"><input type="number" value={scenarioData.attritionProbability.user} onChange={(e) => handleInputChange(index, 'attritionProbability', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-center text-sky-800">${scenarioData.replacementSalary.ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" step="1000" value={scenarioData.replacementSalary.user} onChange={(e) => handleInputChange(index, 'replacementSalary', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-center text-sky-800">${scenarioData.oneTimeCost.ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1"><input type="number" step="500" value={scenarioData.oneTimeCost.user} onChange={(e) => handleInputChange(index, 'oneTimeCost', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-center text-sky-800 bg-sky-50/70">${aiTotalCost.toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}</td>
                            <td className="px-4 py-3 text-s text-center font-semibold text-sky-900 bg-sky-50/70">${userTotalCost.toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-semibold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td colSpan={6}></td>
                            <td className="px-4 py-3 text-s text-center text-sky-900 bg-sky-200">${(attritionTotals?.ai?.totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</td>
                            <td className="px-4 py-3 text-s text-center font-bold text-sky-900 bg-sky-200 text-lg">${(attritionTotals?.user?.totalCost || 0).toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border border-sky-200">
                <label htmlFor="scenarioAssumptionsText" className="block text-md font-semibold text-sky-800 mb-2">Assumptions for {activeScenario}:</label>
                <textarea id="scenarioAssumptionsText" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s focus:ring-2 focus:ring-sky-500 bg-white" placeholder={`e.g., Key drivers of turnover, hiring policies, expected time-to-fill, market salary adjustments...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Attrition Data for {activeScenario}</h2>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" /><label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Match by 'Role' column. Import updates user-adjusted values.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Attrition Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Expected Attrition (User)', 'Total Replacement Cost (User)', 'Total Replacement Cost (AI)', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(employeeData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Expected Attrition (User)') {
                          value = `${(totals?.user?.expectedAttritionCount || 0).toFixed(getDecimalPrecision())} employees`;
                        } else if (metric === 'Total Replacement Cost (User)') {
                          value = `$${(totals?.user?.totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}`;
                          className = "text-s font-semibold text-sky-800";
                        } else if (metric === 'Total Replacement Cost (AI)') {
                          value = `$${(totals?.ai?.totalCost || 0).toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}`;
                        } else if (metric === 'Assumptions') {
                          value = scenarioAssumptions[scenarioName] || 'N/A';
                          className = "text-x text-gray-600 whitespace-pre-wrap max-w-xs"; 
                        }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Projection Version History</h2>
          {attritionVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Cost</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {attritionVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (
                        <td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.user?.totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</td>
                      ))}
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

export default AttritionReplacementCostProjections;