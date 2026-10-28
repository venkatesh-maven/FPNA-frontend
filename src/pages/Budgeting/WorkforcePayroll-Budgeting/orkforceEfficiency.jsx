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
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend
);

const SCENARIOS = {
  BASELINE: "Baseline",
  BEST_CASE: "Best Case (High Efficiency)",
  WORST_CASE: "Worst Case (Low Efficiency)",
};

// Mock data for workforce efficiency
const initialEfficiencyData = [
  {
    department: "Engineering", currentFTE: 20, costPerFTE: 8500, // Monthly
    [SCENARIOS.BASELINE]:    { aiOptimalFTE: 17, userFTE: 20, suggestedAction: "Reduce by 3 FTEs via natural attrition." },
    [SCENARIOS.BEST_CASE]:   { aiOptimalFTE: 16, userFTE: 18, suggestedAction: "High efficiency allows for 2 FTE reduction." },
    [SCENARIOS.WORST_CASE]:  { aiOptimalFTE: 21, userFTE: 21, suggestedAction: "Monitor workload; may need to hire 1 FTE." },
  },
  {
    department: "Sales", currentFTE: 15, costPerFTE: 9000,
    [SCENARIOS.BASELINE]:    { aiOptimalFTE: 13, userFTE: 15, suggestedAction: "2 FTEs over benchmark; review sales process." },
    [SCENARIOS.BEST_CASE]:   { aiOptimalFTE: 12, userFTE: 13, suggestedAction: "Streamline process to save 2-3 FTEs." },
    [SCENARIOS.WORST_CASE]:  { aiOptimalFTE: 16, userFTE: 16, suggestedAction: "High demand requires 1 additional FTE." },
  },
  {
    department: "Customer Support", currentFTE: 10, costPerFTE: 6000,
    [SCENARIOS.BASELINE]:    { aiOptimalFTE: 10, userFTE: 10, suggestedAction: "FTE count is optimal for current ticket volume." },
    [SCENARIOS.BEST_CASE]:   { aiOptimalFTE: 9,  userFTE: 9,  suggestedAction: "Automation can reduce need by 1 FTE." },
    [SCENARIOS.WORST_CASE]:  { aiOptimalFTE: 12, userFTE: 12, suggestedAction: "High ticket volume requires 2 more FTEs." },
  },
  {
    department: "Marketing", currentFTE: 8, costPerFTE: 7500,
    [SCENARIOS.BASELINE]:    { aiOptimalFTE: 7, userFTE: 8, suggestedAction: "Outsource some content creation to save 1 FTE." },
    [SCENARIOS.BEST_CASE]:   { aiOptimalFTE: 6, userFTE: 7, suggestedAction: "Increased agency work could save 2 FTEs." },
    [SCENARIOS.WORST_CASE]:  { aiOptimalFTE: 9, userFTE: 9, suggestedAction: "New campaigns require an additional FTE." },
  },
];

const WorkforceEfficiencyAnalysis = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [efficiencyData, setEfficiencyData] = useState(JSON.parse(JSON.stringify(initialEfficiencyData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Assumes standard productivity levels and historical workloads. No major changes to technology stack or business processes.",
    [SCENARIOS.BEST_CASE]: "Assumes successful implementation of new automation tools, reduced manual work, and higher-than-average employee productivity.",
    [SCENARIOS.WORST_CASE]: "Considers potential project delays, increased manual oversight, and lower-than-expected productivity, requiring more staff.",
  });

  const [efficiencyVersions, setEfficiencyVersions] = useState([]);
  const [efficiencyTotals, setEfficiencyTotals] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);

  const getDeptScenarioData = (dept, scenarioKey) => {
    return dept[scenarioKey] || { aiOptimalFTE: 0, userFTE: dept.currentFTE, suggestedAction: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    if (!scenarioKey || !data || data.length === 0) return {};
    
    let totals = {
      currentFTE: 0,
      aiOptimalFTE: 0,
      userFTE: 0,
      aiTotalCost: 0,
      userTotalCost: 0,
      monthlyCosts: { ai: [0,0,0], user: [0,0,0] }
    };

    data.forEach(dept => {
      const scenarioData = getDeptScenarioData(dept, scenarioKey);
      totals.currentFTE += dept.currentFTE;
      totals.aiOptimalFTE += scenarioData.aiOptimalFTE;
      totals.userFTE += scenarioData.userFTE;

      const aiMonthlyCost = scenarioData.aiOptimalFTE * dept.costPerFTE;
      const userMonthlyCost = scenarioData.userFTE * dept.costPerFTE;
      
      totals.aiTotalCost += aiMonthlyCost * 3; // For the quarter
      totals.userTotalCost += userMonthlyCost * 3;

      totals.monthlyCosts.ai[0] += aiMonthlyCost;
      totals.monthlyCosts.ai[1] += aiMonthlyCost;
      totals.monthlyCosts.ai[2] += aiMonthlyCost;
      totals.monthlyCosts.user[0] += userMonthlyCost;
      totals.monthlyCosts.user[1] += userMonthlyCost;
      totals.monthlyCosts.user[2] += userMonthlyCost;
    });

    return totals;
  };

  useEffect(() => {
    setEfficiencyTotals(calculateTotalsForScenario(efficiencyData, activeScenario));
  }, [efficiencyData, activeScenario]);

  const handleInputChange = (index, value) => {
    setEfficiencyData(prev => {
      const newDepts = JSON.parse(JSON.stringify(prev));
      newDepts[index][activeScenario].userFTE = parseFloat(value) || 0;
      return newDepts;
    });
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const currentTotalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
        currentTotalsByScenario[scen] = calculateTotalsForScenario(efficiencyData, scen);
    });

    setEfficiencyVersions(prev => [
      ...prev, { 
        period, timestamp, 
        data: JSON.parse(JSON.stringify(efficiencyData)), 
        totalsByScenario: currentTotalsByScenario,
        assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))
      },
    ]);
    setHasChanges(false);
    alert("Efficiency plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = efficiencyData.map(dept => {
      const scenarioData = getDeptScenarioData(dept, activeScenario);
      return {
        'Department': dept.department,
        'Current FTE': dept.currentFTE,
        'Cost Per FTE (Monthly)': dept.costPerFTE,
        'AI Optimal FTE': scenarioData.aiOptimalFTE,
        'User Adjusted FTE': scenarioData.userFTE,
        'AI Suggested Action': scenarioData.suggestedAction,
        'Projected Monthly Cost (User)': scenarioData.userFTE * dept.costPerFTE,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Efficiency Plan`);
    const fileName = `Workforce_Efficiency_${activeScenario.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
      const deptMap = new Map(efficiencyData.map(d => [d.department, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const deptName = row['Department'];
        if (deptMap.has(deptName)) {
          const deptToUpdate = deptMap.get(deptName);
          const scenarioData = getDeptScenarioData(deptToUpdate, activeScenario);
          scenarioData.userFTE = row['User Adjusted FTE'] ?? scenarioData.userFTE;
          deptMap.set(deptName, deptToUpdate);
        }
      });
      setEfficiencyData(Array.from(deptMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review and save changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setEfficiencyData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };

  // Chart Data
  const trendChartData = {
    labels: ["Month 1", "Month 2", "Month 3"],
    datasets: [
      { label: `AI Projected Cost`, data: efficiencyTotals?.monthlyCosts?.ai, borderColor: "rgba(16, 185, 129, 1)", tension: 0.1 },
      { label: `User Projected Cost`, data: efficiencyTotals?.monthlyCosts?.user, borderColor: "rgba(239, 68, 68, 1)", tension: 0.1 },
    ],
  };

  const breakdownChartData = {
    labels: efficiencyData.map(d => d.department),
    datasets: [
      { label: 'Current FTE', data: efficiencyData.map(d => d.currentFTE), backgroundColor: 'rgba(14, 165, 233, 0.7)'},
      { label: 'AI Optimal FTE', data: efficiencyData.map(d => getDeptScenarioData(d, activeScenario).aiOptimalFTE), backgroundColor: 'rgba(16, 185, 129, 0.7)' },
      { label: 'User Adjusted FTE', data: efficiencyData.map(d => getDeptScenarioData(d, activeScenario).userFTE), backgroundColor: 'rgba(239, 68, 68, 0.7)' },
    ],
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: false } } };

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
          workforce Efficiency
        </span>
      </div>
    </li>
  </ol>
</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">AI-Driven Workforce Efficiency Analysis</h1>
            <p className="text-sky-100 text-x">Identify cost-saving opportunities in staffing levels.</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="">
              <label htmlFor="forecastPeriodSelect" className="text-s text-white font-medium mr-2">Forecast Period:</label>
              <select id="forecastPeriodSelect" value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x focus:ring-sky-500">
                <option>Q1 2025</option><option>Q2 2025</option><option>Q3 2025</option><option>Q4 2025</option>
              </select>
            </div>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors">
                <FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'create', label: 'Efficiency Overview'}, {id: 'import', label: 'Import Staffing Data'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
          <button key={tab.id} className={`py-2 px-4 font-medium text-s ${activeTab === tab.id ? 'text-sky-50 border-b-2 border-sky-600 bg-sky-800 rounded-t-lg' : 'text-sky-900 hover:text-sky-500 hover:bg-sky-100 rounded-t-lg'}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
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
                <p className="text-x font-medium text-sky-700">Total Headcount (User vs AI)</p>
                <p className="text-2xl font-bold text-sky-900">{efficiencyTotals?.userFTE} <span className="text-lg font-medium text-gray-500">vs</span> {efficiencyTotals?.aiOptimalFTE}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Projected Quarterly Cost (User)</p>
                <p className="text-2xl font-bold text-sky-900">${(efficiencyTotals?.userTotalCost || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <p className="text-x font-medium text-sky-700">Estimated Quarterly Savings</p>
                <p className={`text-2xl font-bold ${(efficiencyTotals?.aiTotalCost || 0) <= (efficiencyTotals?.userTotalCost || 0) ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs((efficiencyTotals?.userTotalCost || 0) - (efficiencyTotals?.aiTotalCost || 0)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">FTE Efficiency Gap ({activeScenario})</h2>
                <div className="h-[250px]"><Bar data={breakdownChartData} options={{...chartOptions, plugins: {...chartOptions.plugins, tooltip: {callbacks: {label: ctx => `${ctx.dataset.label}: ${ctx.raw} FTEs`}}}}}/></div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border border-gray-200">
                <h2 className="text-lg font-semibold text-sky-900 mb-3">Total Cost Trend ({activeScenario})</h2>
                <div className="h-[250px]"><Line data={trendChartData} options={{...chartOptions, plugins: {...chartOptions.plugins, tooltip: {callbacks: {label: ctx => `${ctx.dataset.label}: $${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`}}}}}/></div>
              </div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Efficiency Plan Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Current FTE</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Cost/FTE</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px] relative group">AI Optimal FTE<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">AI insight based on benchmarks and workload.</span></th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Adjusted FTE</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">AI Suggested Action</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Projected Monthly Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {efficiencyData.map((dept, index) => {
                        const scenarioData = getDeptScenarioData(dept, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        const userMonthlyCost = scenarioData.userFTE * dept.costPerFTE;
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass} min-w-[200px]`}>{dept.department}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-800">{dept.currentFTE}</td>
                            <td className="px-4 py-3 text-s text-center text-sky-800">${dept.costPerFTE.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-4 py-3 text-s text-center font-medium text-green-600 bg-green-50">{scenarioData.aiOptimalFTE}</td>
                            <td className="px-2 py-1 min-w-[120px]"><input type="number" value={scenarioData.userFTE} onChange={(e) => handleInputChange(index, e.target.value)} className="w-24 p-1.5 border border-sky-300 rounded-md text-s text-center focus:ring-1 focus:ring-sky-500 bg-white"/></td>
                            <td className="px-4 py-3 text-s text-left text-sky-800">{scenarioData.suggestedAction}</td>
                            <td className="px-4 py-3 text-s text-center font-semibold text-sky-900">${userMonthlyCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-sky-100 font-bold sticky bottom-0 z-[5]">
                        <tr>
                            <td className="px-4 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[6]">Total</td>
                            <td className="px-4 py-3 text-s text-center text-sky-900">{efficiencyTotals?.currentFTE}</td>
                            <td></td>
                            <td className="px-4 py-3 text-s text-center text-green-700">{efficiencyTotals?.aiOptimalFTE}</td>
                            <td className="px-4 py-3 text-s text-center text-red-700">{efficiencyTotals?.userFTE}</td>
                            <td></td>
                            <td className="px-4 py-3 text-lg text-center text-sky-900">${(efficiencyTotals?.userTotalCost / 3 || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border border-sky-200">
                <label htmlFor="scenarioAssumptionsText" className="block text-md font-semibold text-sky-800 mb-2">Assumptions for {activeScenario}:</label>
                <textarea id="scenarioAssumptionsText" value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s focus:ring-2 focus:ring-sky-500 bg-white" placeholder={`e.g., Describe cost strategies, hiring freezes, or workload shifts...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Staffing Data for {activeScenario}</h2>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" /><label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">Match by 'Department'. Import updates 'User Adjusted FTE' column.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Efficiency Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total User FTE', 'Total AI Optimal FTE', 'Projected Quarterly Cost (User)', 'Potential Quarterly Savings', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(efficiencyData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total User FTE') { value = totals.userFTE; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Total AI Optimal FTE') { value = totals.aiOptimalFTE; }
                        else if (metric === 'Projected Quarterly Cost (User)') { value = `$${(totals.userTotalCost || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Potential Quarterly Savings') { value = `$${(totals.userTotalCost - totals.aiTotalCost).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${(totals.userTotalCost - totals.aiTotalCost) >= 0 ? 'text-green-600' : 'text-red-600'}`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Efficiency Plan Version History</h2>
          {efficiencyVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} User Cost</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {efficiencyVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => (
                        <td key={`${index}-${scen}`} className="px-4 py-3 text-s text-sky-800">${(version.totalsByScenario[scen]?.userTotalCost || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default WorkforceEfficiencyAnalysis;