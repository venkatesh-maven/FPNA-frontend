import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import { FiSave, FiPrinter, FiEdit, FiLayers,FiChevronRight, FiAlertTriangle, FiCheckCircle, FiTrendingDown, FiLayout, FiBriefcase, FiTarget } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// --- MOCK DATA ---
const CURRENT_YEAR = 2025;
const DEPARTMENTS = ["Marketing", "R&D", "Sales", "HR", "IT"];

const budgetData = {
  Marketing: [
    { id: 1, category: "Salaries & Wages", type: "Fixed", budget: 750000, actual: 755000, aiBaseline: 740000, aiInsight: "Slightly over budget due to mid-year salary adjustment. Consider for next cycle." },
    { id: 2, category: "Paid Advertising", type: "Variable", budget: 500000, actual: 450000, aiBaseline: 480000, aiInsight: "Under budget. AI suggests reallocating the remaining $50k to Q4 campaigns for higher ROI." },
    { id: 3, category: "Software/Subscriptions", type: "Fixed", budget: 120000, actual: 120000, aiBaseline: 125000, aiInsight: "AI identified a 5% cost-saving opportunity by switching to annual billing for 'Martech Tool X'." },
    { id: 4, category: "Events & Conferences", type: "Variable", budget: 80000, actual: 95000, aiBaseline: 80000, aiInsight: "Overspend driven by higher-than-expected travel costs for 'Global Summit 2025'." },
  ],
  "R&D": [
    { id: 5, category: "Salaries & Wages", type: "Fixed", budget: 1200000, actual: 1180000, aiBaseline: 1200000, aiInsight: "Under budget due to a delayed new hire start date." },
    { id: 6, category: "Cloud Infrastructure", type: "Variable", budget: 600000, actual: 650000, aiBaseline: 610000, aiInsight: "Usage is 8% higher than projected. AI recommends exploring reserved instances for 15% savings." },
    { id: 7, category: "Prototyping & Materials", type: "Variable", budget: 50000, actual: 45000, aiBaseline: 50000, aiInsight: "On track. No optimization needed." },
  ],
  Sales: [
    { id: 8, category: "Salaries & Commissions", type: "Variable", budget: 950000, actual: 980000, aiBaseline: 950000, aiInsight: "Higher commission payout due to exceeding revenue targets by 5%." },
    { id: 9, category: "Travel & Entertainment (T&E)", type: "Variable", budget: 150000, actual: 180000, aiBaseline: 160000, aiInsight: "T&E is 20% over budget. AI suggests reviewing the current travel policy." },
  ],
  HR: [
    { id: 10, category: "Salaries & Wages", type: "Fixed", budget: 300000, actual: 300000, aiBaseline: 300000, aiInsight: "Budget is on track." },
    { id: 11, category: "Recruitment Fees", type: "Variable", budget: 75000, actual: 60000, aiBaseline: 70000, aiInsight: "Lower fees due to successful employee referral program." },
  ],
  IT: [
    { id: 12, category: "Salaries & Wages", type: "Fixed", budget: 450000, actual: 450000, aiBaseline: 450000, aiInsight: "Budget is on track." },
    { id: 13, category: "Hardware & Equipment", type: "Variable", budget: 100000, actual: 110000, aiBaseline: 100000, aiInsight: "Overspend due to unplanned laptop replacements." },
    { id: 14, category: "Enterprise Software", type: "Fixed", budget: 250000, actual: 250000, aiBaseline: 265000, aiInsight: "AI identified redundant licenses in 'Global CRM', suggesting a potential $15k annual saving." },
  ],
};

// Reusable KPICard component
const KPICard = ({ title, value, change, icon, tooltip, isPositive = true, aiNote }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          <div className="p-2 bg-sky-100 text-sky-600 rounded-full mr-3">{icon}</div>
          <div>
            <p className="text-s font-semibold text-sky-800">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
        {tooltip && <FiInfo className="text-gray-400" data-tooltip-id="info-tooltip" data-tooltip-content={tooltip} />}
      </div>
      {change && <p className={`text-x mt-2 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>{change}</p>}
      {aiNote && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-x text-blue-800 flex items-start">
          <BsStars className="mr-1 mt-0.5 flex-shrink-0" />
          <span>{aiNote}</span>
        </div>
      )}
    </div>
);

const OperationalBudgeting = () => {
  const [activeDepartment, setActiveDepartment] = useState("Marketing");
  const [data, setData] = useState(budgetData);
  const [scenario, setScenario] = useState('Base Case');
  const [version, setVersion] = useState(`FY${CURRENT_YEAR} Budget v1.2 - Approved`);

  const departmentTotals = useMemo(() => {
    const totals = {};
    Object.keys(data).forEach(dept => {
      totals[dept] = data[dept].reduce((acc, item) => {
        acc.budget += item.budget;
        acc.actual += item.actual;
        return acc;
      }, { budget: 0, actual: 0 });
      totals[dept].variance = totals[dept].budget - totals[dept].actual;
    });
    return totals;
  }, [data]);

  const activeDeptData = data[activeDepartment] || [];
  const activeDeptTotals = departmentTotals[activeDepartment] || { budget: 0, actual: 0, variance: 0 };
  const totalBudgeted = Object.values(departmentTotals).reduce((sum, dept) => sum + dept.budget, 0);

  const handleBudgetChange = (id, value) => {
    setData(prevData => {
      const newData = { ...prevData };
      const departmentData = newData[activeDepartment].map(item =>
        item.id === id ? { ...item, budget: parseFloat(value) || 0 } : item
      );
      newData[activeDepartment] = departmentData;
      return newData;
    });
  };

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);

  const pieChartData = {
    labels: Object.keys(departmentTotals),
    datasets: [{
      label: 'Budget by Department',
      data: Object.values(departmentTotals).map(d => d.budget),
      backgroundColor: ['#0ea5e9', '#14b8a6', '#f97316', '#8b5cf6', '#ef4444'],
      hoverOffset: 4
    }],
  };
  
  const barChartData = {
    labels: activeDeptData.map(item => item.category),
    datasets: [
        { label: 'Budget', data: activeDeptData.map(item => item.budget), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
        { label: 'Actual', data: activeDeptData.map(item => item.actual), backgroundColor: 'rgba(239, 68, 68, 0.7)' }
    ],
  };

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
		<nav className="flex mb-4" aria-label="Breadcrumb">
							<ol className="inline-flex items-center space-x-1 md:space-x-2">
								<li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
								<li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Operational Budgeting</span></div></li>
							</ol>
						</nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Operational Budgeting</h1>
          <p className="text-sky-100 text-s mt-1">Plan, track, and optimize core business expenses across all departments.</p>
        </div>
        <div className="flex items-center gap-4 text-s text-white">
            <div>
              <label className="font-medium mr-2">Scenario:</label>
              <select value={scenario} onChange={e => setScenario(e.target.value)} className="p-1 border bg-white/20 border-white/30 rounded text-white focus:ring-1 focus:ring-sky-300">
                <option className="text-black">Base Case</option>
                <option className="text-black">Growth</option>
                <option className="text-black">Conservative</option>
              </select>
            </div>
             <div className="hidden sm:block text-white/50">|</div>
             <div className="text-sky-100">
                <span className="font-medium">Version:</span> {version}
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Total Operational Budget" value={formatCurrency(totalBudgeted)} icon={<FiLayout />} />
        <KPICard title={`${activeDepartment} Budget`} value={formatCurrency(activeDeptTotals.budget)} change={`Actual: ${formatCurrency(activeDeptTotals.actual)}`} icon={<FiBriefcase />} />
        <KPICard title={`${activeDepartment} Variance`} value={formatCurrency(activeDeptTotals.variance)} isPositive={activeDeptTotals.variance >= 0} change={`${(activeDeptTotals.variance / activeDeptTotals.budget * 100).toFixed(getDecimalPrecision())}%`} icon={<FiTarget />} aiNote="Positive variance indicates underspend (savings)." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-sky-900 mb-3">Department Budget vs. Actual ({activeDepartment})</h2>
          <div className="h-80"><Bar data={barChartData} options={chartOptions}/></div>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-sky-900 mb-3">Total Budget by Department</h2>
          <div className="h-80"><Pie data={pieChartData} options={{...chartOptions, plugins: { legend: { position: 'right'}}}}/></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                {DEPARTMENTS.map(dept => (
                    <button key={dept} onClick={() => setActiveDepartment(dept)} className={`px-3 py-1.5 text-s font-medium rounded-md transition-colors ${activeDepartment === dept ? 'bg-white text-sky-800 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>{dept}</button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-sky-600 text-white text-s rounded-lg hover:bg-sky-700 flex items-center"><FiSave className="mr-2" /> Save Changes</button>
                <button className="px-4 py-2 bg-gray-200 text-gray-800 text-s rounded-lg hover:bg-gray-300 flex items-center"><FiPrinter className="mr-2" /> Print View</button>
            </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-s">
            <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3">Expense Category</th>
                <th className="p-3 text-center">Type (Fixed/Variable)</th>
                <th className="p-3 text-right">AI Baseline</th>
                <th className="p-3 text-right">Budget</th>
                <th className="p-3 text-right">Actual</th>
                <th className="p-3 text-right">Variance</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">AI Cost Optimization Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {activeDeptData.map(item => {
                const variance = item.budget - item.actual;
                const variancePercent = item.budget > 0 ? (variance / item.budget) * 100 : 0;
                const isOverBudget = variance < 0;
                
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-sky-50">
                    <td className="p-3 font-medium text-gray-800">{item.category}</td>
                    <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-x font-medium rounded-full ${item.type === 'Fixed' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.type}</span>
                    </td>
                    <td className="p-3 text-right text-gray-500 font-mono">{formatCurrency(item.aiBaseline)}</td>
                    <td className="p-3 text-right">
                        <input type="number" value={item.budget} onChange={(e) => handleBudgetChange(item.id, e.target.value)} className="w-28 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/>
                    </td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.actual)}</td>
                    <td className={`p-3 text-right font-mono font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(variance)} ({variancePercent.toFixed(getDecimalPrecision())}%)
                    </td>
                    <td className="p-3 text-center">
                        {isOverBudget ? <FiAlertTriangle className="mx-auto text-red-500" data-tooltip-id="info-tooltip" data-tooltip-content="Over Budget" /> : <FiCheckCircle className="mx-auto text-green-500" data-tooltip-id="info-tooltip" data-tooltip-content="On/Under Budget" />}
                    </td>
                    <td className="p-3 text-x text-blue-800">
                        <div className="flex items-start">
                            <BsStars className="mr-2 mt-0.5 flex-shrink-0" />
                            <span>{item.aiInsight}</span>
                        </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="font-bold text-gray-900 bg-gray-50">
                <tr className="border-t-2 border-gray-300">
                    <td className="p-3" colSpan="3">Total {activeDepartment}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(activeDeptTotals.budget)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(activeDeptTotals.actual)}</td>
                    <td className={`p-3 text-right font-mono ${activeDeptTotals.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(activeDeptTotals.variance)}</td>
                    <td colSpan="2"></td>
                </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <ReactTooltip id="info-tooltip" className="max-w-xs text-x z-50" />
    </div>
  );
};

export default OperationalBudgeting;