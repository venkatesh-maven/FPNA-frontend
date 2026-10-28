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
import { FiFilter, FiDollarSign, FiSave, FiUpload, FiDownload, FiPrinter, FiChevronRight} from "react-icons/fi";
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
  BEST_CASE: "Best Case",
  WORST_CASE: "Worst Case",
};

// Mock data for employees
const initialEmployeeData = [
  { id: 1, name: "Alice Johnson", role: "Sr. Software Engineer", department: "Engineering", currentSalary: 120000,
    [SCENARIOS.BASELINE]:    { raisePercentage: { ai: 3.0, user: 3.0 }, bonus: { ai: 10000, user: 10000 }, monthlyBenefits: { ai: 1200, user: 1200 } },
    [SCENARIOS.BEST_CASE]:   { raisePercentage: { ai: 5.0, user: 5.0 }, bonus: { ai: 15000, user: 15000 }, monthlyBenefits: { ai: 1250, user: 1250 } },
    [SCENARIOS.WORST_CASE]:  { raisePercentage: { ai: 1.0, user: 1.0 }, bonus: { ai: 5000,  user: 5000  }, monthlyBenefits: { ai: 1150, user: 1150 } },
  },
  { id: 2, name: "Bob Williams", role: "Product Manager", department: "Product", currentSalary: 110000,
    [SCENARIOS.BASELINE]:    { raisePercentage: { ai: 3.5, user: 3.5 }, bonus: { ai: 12000, user: 12000 }, monthlyBenefits: { ai: 1100, user: 1100 } },
    [SCENARIOS.BEST_CASE]:   { raisePercentage: { ai: 6.0, user: 6.0 }, bonus: { ai: 18000, user: 18000 }, monthlyBenefits: { ai: 1150, user: 1150 } },
    [SCENARIOS.WORST_CASE]:  { raisePercentage: { ai: 1.5, user: 1.5 }, bonus: { ai: 6000,  user: 6000  }, monthlyBenefits: { ai: 1050, user: 1050 } },
  },
  { id: 3, name: "Charlie Brown", role: "Marketing Lead", department: "Marketing", currentSalary: 95000,
    [SCENARIOS.BASELINE]:    { raisePercentage: { ai: 4.0, user: 4.0 }, bonus: { ai: 8000, user: 8000 }, monthlyBenefits: { ai: 950, user: 950 } },
    [SCENARIOS.BEST_CASE]:   { raisePercentage: { ai: 7.0, user: 7.0 }, bonus: { ai: 12000, user: 12000 }, monthlyBenefits: { ai: 1000, user: 1000 } },
    [SCENARIOS.WORST_CASE]:  { raisePercentage: { ai: 2.0, user: 2.0 }, bonus: { ai: 4000,  user: 4000  }, monthlyBenefits: { ai: 900, user: 900 } },
  },
  { id: 4, name: "Diana Prince", role: "UX Designer", department: "Design", currentSalary: 88000,
    [SCENARIOS.BASELINE]:    { raisePercentage: { ai: 3.0, user: 3.0 }, bonus: { ai: 7500, user: 7500 }, monthlyBenefits: { ai: 900, user: 900 } },
    [SCENARIOS.BEST_CASE]:   { raisePercentage: { ai: 5.5, user: 5.5 }, bonus: { ai: 11000, user: 11000 }, monthlyBenefits: { ai: 950, user: 950 } },
    [SCENARIOS.WORST_CASE]:  { raisePercentage: { ai: 1.0, user: 1.0 }, bonus: { ai: 3000,  user: 3000  }, monthlyBenefits: { ai: 850, user: 850 } },
  },
];

const SalaryCompensationBudgeting = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [employeeData, setEmployeeData] = useState(JSON.parse(JSON.stringify(initialEmployeeData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard 3-4% cost-of-living adjustments, market-rate bonuses, and standard benefits package.",
    [SCENARIOS.BEST_CASE]: "Higher performance-based raises (5-7%), accelerated hiring, and enhanced bonuses due to exceeding revenue targets.",
    [SCENARIOS.WORST_CASE]: "Minimal raises (1-2%), hiring freeze, and reduced bonus pool due to economic uncertainty.",
  });

  const [compensationVersions, setCompensationVersions] = useState([]);
  const [compensationTotals, setCompensationTotals] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);

  const getEmployeeScenarioData = (employee, scenarioKey) => {
    return employee[scenarioKey] || { 
      raisePercentage: { ai: 0, user: 0 }, 
      bonus: { ai: 0, user: 0 }, 
      monthlyBenefits: { ai: 0, user: 0 } 
    };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    if (!scenarioKey || !data || data.length === 0) return {};

    let totals = {
      ai: { salary: 0, bonus: 0, benefits: 0, total: 0, m1: 0, m2: 0, m3: 0 },
      user: { salary: 0, bonus: 0, benefits: 0, total: 0, m1: 0, m2: 0, m3: 0 },
    };

    data.forEach(emp => {
      const scenarioData = getEmployeeScenarioData(emp, scenarioKey);
      
      // AI Calculations
      const aiInputs = scenarioData.raisePercentage.ai;
      const aiNewSalary = emp.currentSalary * (1 + (aiInputs / 100));
      const aiMonthlySalary = aiNewSalary / 12;
      const aiM1 = aiMonthlySalary + scenarioData.bonus.ai + scenarioData.monthlyBenefits.ai;
      const aiM2_M3 = aiMonthlySalary + scenarioData.monthlyBenefits.ai;
      
      totals.ai.salary += aiNewSalary;
      totals.ai.bonus += scenarioData.bonus.ai;
      totals.ai.benefits += scenarioData.monthlyBenefits.ai * 3;
      totals.ai.total += aiM1 + (aiM2_M3 * 2);
      totals.ai.m1 += aiM1;
      totals.ai.m2 += aiM2_M3;
      totals.ai.m3 += aiM2_M3;
      
      // User Calculations
      const userInputs = scenarioData.raisePercentage.user;
      const userNewSalary = emp.currentSalary * (1 + (userInputs / 100));
      const userMonthlySalary = userNewSalary / 12;
      const userM1 = userMonthlySalary + scenarioData.bonus.user + scenarioData.monthlyBenefits.user;
      const userM2_M3 = userMonthlySalary + scenarioData.monthlyBenefits.user;
      
      totals.user.salary += userNewSalary;
      totals.user.bonus += scenarioData.bonus.user;
      totals.user.benefits += scenarioData.monthlyBenefits.user * 3;
      totals.user.total += userM1 + (userM2_M3 * 2);
      totals.user.m1 += userM1;
      totals.user.m2 += userM2_M3;
      totals.user.m3 += userM2_M3;
    });
    return totals;
  };

  useEffect(() => {
    setCompensationTotals(calculateTotalsForScenario(employeeData, activeScenario));
  }, [employeeData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setEmployeeData(prev => {
      const newEmployees = JSON.parse(JSON.stringify(prev));
      const scenarioData = newEmployees[index][activeScenario];
      
      if (field === 'raisePercentage') scenarioData.raisePercentage.user = parseFloat(value) || 0;
      if (field === 'bonus') scenarioData.bonus.user = parseFloat(value) || 0;
      if (field === 'monthlyBenefits') scenarioData.monthlyBenefits.user = parseFloat(value) || 0;
      
      return newEmployees;
    });
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const currentTotalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        currentTotalsByScenario[scen] = calculateTotalsForScenario(employeeData, scen);
    });

    setCompensationVersions(prev => [
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
    alert("Compensation budget version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = employeeData.map(emp => {
      const scenarioData = getEmployeeScenarioData(emp, activeScenario);
      return {
        'Employee Name': emp.name,
        'Role': emp.role,
        'Department': emp.department,
        'Current Annual Salary': emp.currentSalary,
        'Raise % (AI)': scenarioData.raisePercentage.ai,
        'Raise % (User)': scenarioData.raisePercentage.user,
        'Bonus (AI)': scenarioData.bonus.ai,
        'Bonus (User)': scenarioData.bonus.user,
        'Monthly Benefits (AI)': scenarioData.monthlyBenefits.ai,
        'Monthly Benefits (User)': scenarioData.monthlyBenefits.user,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Comp Forecast`);
    const fileName = `Compensation_Forecast_${activeScenario.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
      const employeeMap = new Map(employeeData.map(e => [e.name, JSON.parse(JSON.stringify(e))]));

      jsonData.forEach(row => {
        const empName = row['Employee Name'];
        if (employeeMap.has(empName)) {
          const empToUpdate = employeeMap.get(empName);
          const scenarioData = getEmployeeScenarioData(empToUpdate, activeScenario);

          scenarioData.raisePercentage.user = row['Raise % (User)'] ?? scenarioData.raisePercentage.user;
          scenarioData.bonus.user = row['Bonus (User)'] ?? scenarioData.bonus.user;
          scenarioData.monthlyBenefits.user = row['Monthly Benefits (User)'] ?? scenarioData.monthlyBenefits.user;
          
          employeeMap.set(empName, empToUpdate);
        }
      });
  
      setEmployeeData(Array.from(employeeMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} scenario imported successfully. Review and save changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file. Please check the format.");
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
    labels: ["Month 1", "Month 2", "Month 3"],
    datasets: [
      {
        label: `AI Forecast`,
        data: [compensationTotals?.ai?.m1, compensationTotals?.ai?.m2, compensationTotals?.ai?.m3],
        borderColor: "rgba(16, 185, 129, 1)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.4,
      },
      {
        label: `User Forecast`,
        data: [compensationTotals?.user?.m1, compensationTotals?.user?.m2, compensationTotals?.user?.m3],
        borderColor: "rgba(239, 68, 68, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        tension: 0.4,
      },
    ],
  };

  const breakdownChartData = {
    labels: ["Compensation Breakdown"],
    datasets: [
      {
        label: 'Salary',
        data: [compensationTotals?.user?.total - compensationTotals?.user?.bonus - compensationTotals?.user?.benefits],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      },
      {
        label: 'Bonus',
        data: [compensationTotals?.user?.bonus],
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
      },
      {
        label: 'Benefits',
        data: [compensationTotals?.user?.benefits],
        backgroundColor: 'rgba(249, 115, 22, 0.7)',
      },
    ],
  };
  
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false, callbacks: { label: ctx => `${ctx.dataset.label}: $${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}` } } },
    scales: { y: { beginAtZero: true, grid: { color: "rgba(0, 0, 0, 0.05)" }, title: { display: true, text: "Amount ($)" } }, x: { grid: { display: false } } },
  };

  const calculateQuarterlyTotal = (currentSalary, scenarioData, type) => {
    const newSalary = currentSalary * (1 + (scenarioData.raisePercentage[type] / 100));
    const monthlySalary = newSalary / 12;
    const bonus = scenarioData.bonus[type];
    const monthlyBenefits = scenarioData.monthlyBenefits[type];
    const m1 = monthlySalary + bonus + monthlyBenefits;
    const m2_m3 = monthlySalary + monthlyBenefits;
    return m1 + m2_m3 * 2;
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
          Salary Compensation
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Salary & Compensation Budgeting</h1>
            <p className="text-sky-100 text-x">Plan for raises, bonuses, and benefits costs.</p>
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
            {tabId === 'create' && 'Create/Edit Forecast'}
            {tabId === 'import' && 'Import Compensation Data'}
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
        <div className="relative ml-auto" ref={filtersRef}>
          <button onClick={() => setShowFilters(!showFilters)} className="py-2 px-3 text-gray-500 hover:text-blue-500 flex items-center text-s">
            <BsFilter className="mr-1" /> Filters
          </button>
        </div>
      </div>
      
      <div>
        {activeTab === 'create' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total User Forecast ({period})</p>
                <p className="text-2xl font-bold text-sky-900">${(compensationTotals?.user?.total || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Total AI Suggested ({period})</p>
                <p className="text-2xl font-bold text-sky-900">${(compensationTotals?.ai?.total || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Variance (User vs AI)</p>
                <p className={`text-2xl font-bold ${(compensationTotals?.user?.total || 0) >= (compensationTotals?.ai?.total || 0) ? 'text-red-600' : 'text-green-600'}`}>
                  ${Math.abs((compensationTotals?.user?.total || 0) - (compensationTotals?.ai?.total || 0)).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">Compensation Trend ({activeScenario})</h2>
                <div className="h-[250px]"><Line data={trendChartData} options={chartOptions} /></div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">User Forecast Breakdown ({activeScenario})</h2>
                <div className="h-[250px]"><Bar data={breakdownChartData} options={{...chartOptions, scales: {...chartOptions.scales, x: {...chartOptions.scales.x, stacked: true}, y: {...chartOptions.scales.y, stacked: true}}}} /></div>
              </div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Compensation Forecast Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 transition-colors flex items-center"><FiDownload className="mr-2" /> Export Scenario</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg transition-colors flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save All Changes</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Employee</th>
                        <th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase min-w-[120px]">Current Salary</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]" colSpan={2}>Raise %</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[200px]" colSpan={2}>Bonus ({period})</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[240px]" colSpan={2}>Monthly Benefits</th>
                        <th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase min-w-[150px]">Quarterly Total</th>
                      </tr>
                      <tr className="bg-sky-100 sticky top-[45px] z-10">
                        <th className="sticky left-0 bg-sky-100 z-20"></th>
                        <th className="bg-sky-100"></th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">AI</th><th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">AI</th><th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">AI</th><th className="px-2 py-2 text-x font-medium text-sky-700">User</th>
                        <th className="px-2 py-2 text-x font-medium text-sky-700">User Forecast</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {employeeData.map((emp, index) => {
                        const scenarioData = getEmployeeScenarioData(emp, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const quarterlyTotal = calculateQuarterlyTotal(emp.currentSalary, scenarioData, 'user');
                        return (
                          <tr key={emp.id} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass} min-w-[200px]`}>
                              <div className="font-semibold">{emp.name}</div>
                              <div className="text-x text-sky-600">{emp.role} / {emp.department}</div>
                            </td>
                            <td className="px-4 py-3 text-s text-right text-sky-800 min-w-[120px]">${emp.currentSalary.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-800 min-w-[75px]">{scenarioData.raisePercentage.ai.toFixed(getDecimalPrecision())}%</td>
                            <td className="px-2 py-1 min-w-[75px]"><input type="number" step="0.1" value={scenarioData.raisePercentage.user} onChange={(e) => handleInputChange(index, 'raisePercentage', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-center text-sky-800 min-w-[100px]">${scenarioData.bonus.ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 min-w-[100px]"><input type="number" step="100" value={scenarioData.bonus.user} onChange={(e) => handleInputChange(index, 'bonus', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-center text-sky-800 min-w-[120px]">${scenarioData.monthlyBenefits.ai.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 min-w-[120px]"><input type="number" step="50" value={scenarioData.monthlyBenefits.user} onChange={(e) => handleInputChange(index, 'monthlyBenefits', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-right font-semibold text-sky-900 min-w-[150px]">${quarterlyTotal.toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-semibold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6] min-w-[200px]">Total</td>
                            <td className="px-4 py-3 text-s text-right text-sky-900 min-w-[120px]">${employeeData.reduce((sum, e) => sum + e.currentSalary, 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td colSpan={6}></td>
                            <td className="px-4 py-3 text-s text-right font-bold text-sky-900 text-lg min-w-[150px]">${(compensationTotals?.user?.total || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border border-sky-200">
                <label htmlFor="scenarioAssumptionsText" className="block text-md font-semibold text-sky-800 mb-2">Assumptions for {activeScenario} Scenario:</label>
                <p className="text-x text-sky-700 mb-2">Detail key drivers for compensation changes in the <strong>{activeScenario}</strong>.</p>
                <textarea id="scenarioAssumptionsText" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s focus:ring-2 focus:ring-sky-500 bg-white" placeholder={`e.g., Performance multipliers, new hire budget, benefits cost increase...`} />
            </div>
          </>
        )}

        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Compensation Data for {activeScenario}</h2>
            <p className="text-s text-gray-600 mb-4">Upload a file to bulk-update user forecasts for the <strong>{activeScenario}</strong>. Match rows by 'Employee Name'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Supported formats: XLSX, XLS, CSV</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Compensation Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase tracking-wider">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase tracking-wider">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User Forecast', 'Total AI Suggested', 'Variance (User vs AI)', 'Total Bonus Pool (User)', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(employeeData, scenarioName);
                        let value;
                        let className = "text-s text-sky-700";
                        if (metric === 'Total User Forecast') {
                          value = `$${(totals?.user?.total || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}`;
                          className = "text-s font-semibold text-sky-800";
                        } else if (metric === 'Total AI Suggested') {
                          value = `$${(totals?.ai?.total || 0).toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}`;
                        } else if (metric === 'Variance (User vs AI)') {
                          const variance = (totals?.user?.total || 0) - (totals?.ai?.total || 0);
                          value = `${variance >= 0 ? '+' : ''}$${variance.toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}`;
                          className = `text-s font-semibold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`;
                        } else if (metric === 'Total Bonus Pool (User)') {
                          value = `$${(totals?.user?.bonus || 0).toLocaleString(undefined, {maximumFractionDigits: getDecimalPrecision()})}`;
                        } else if (metric === 'Assumptions') {
                          value = scenarioAssumptions[scenarioName] || 'N/A';
                          className = "text-x text-gray-600 whitespace-pre-wrap break-words max-w-xs"; 
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Compensation Version History</h2>
          {compensationVersions.length === 0 ? (
            <p className="text-s text-gray-500">No versions saved yet. Click "Save All Changes" to create a version.</p>
          ) : (
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
                  {compensationVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (
                        <td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.user?.total || 0).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}</td>
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

export default SalaryCompensationBudgeting;