import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { FiSave, FiPrinter, FiTrendingDown, FiHardDrive, FiChevronRight, FiTrendingUp, FiDollarSign, FiCalendar, FiActivity } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

// --- MOCK DATA ---
const CURRENT_YEAR = 2025;

const initialCapexData = [
  { id: 1, department: "IT", project: "Data Center Modernization", category: "Equipment", cost: 750000, purchaseDate: "2025-03-15", usefulLife: 5, expectedReturn: 200000, status: "Approved", aiInsight: "High ROI project, critical for supporting 50% user growth." },
  { id: 2, department: "Operations", project: "New Warehouse Facility", category: "Facilities", cost: 1200000, purchaseDate: "2025-08-01", usefulLife: 20, expectedReturn: 150000, status: "Pending", aiInsight: "AI forecasts a 3-year payback period. Essential for expanding distribution." },
  { id: 3, department: "R&D", project: "AI Research Lab Setup", category: "R&D Investment", cost: 450000, purchaseDate: "2025-05-20", usefulLife: 3, expectedReturn: 300000, status: "Approved", aiInsight: "Strategic investment to accelerate product innovation. High-risk, high-reward." },
  { id: 4, department: "IT", project: "Employee Laptop Refresh", category: "Equipment", cost: 150000, purchaseDate: "2025-02-01", usefulLife: 4, expectedReturn: 0, status: "Approved", aiInsight: "Operational necessity. Return is measured in productivity, not direct revenue." },
];

// Reusable KPICard component
const KPICard = ({ title, value, change, icon }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
        <div className="flex items-center">
            <div className="p-3 bg-sky-100 text-sky-600 rounded-full mr-4">{icon}</div>
            <div>
                <p className="text-s font-semibold text-sky-800">{title}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {change && <p className="text-x mt-1 text-gray-500">{change}</p>}
            </div>
        </div>
    </div>
);

const CapexBudgeting = () => {
  const [capexData, setCapexData] = useState(initialCapexData);
  const [scenario, setScenario] = useState('Base Case');
  const [version, setVersion] = useState(`FY${CURRENT_YEAR} CAPEX Plan v1.1`);
  const [scenarioProject, setScenarioProject] = useState(capexData[1]); // Default to the warehouse project

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);

  const handleDataChange = (id, field, value) => {
    setCapexData(prevData =>
      prevData.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const totalCapexSpend = useMemo(() => capexData.reduce((sum, item) => sum + item.cost, 0), [capexData]);
  const totalAnnualDepreciation = useMemo(() => capexData.reduce((sum, item) => sum + (item.cost / item.usefulLife), 0), [capexData]);

  const depreciationForecast = useMemo(() => {
    const forecast = {};
    for (let i = 0; i < 5; i++) {
        const year = CURRENT_YEAR + i;
        forecast[year] = capexData.reduce((sum, item) => {
            const startYear = new Date(item.purchaseDate).getFullYear();
            if (year >= startYear && year < startYear + item.usefulLife) {
                return sum + (item.cost / item.usefulLife);
            }
            return sum;
        }, 0);
    }
    return forecast;
  }, [capexData]);
  
  const depreciationChartData = {
    labels: Object.keys(depreciationForecast),
    datasets: [{
      label: 'Annual Depreciation Expense',
      data: Object.values(depreciationForecast),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };
  
  const capexByCategoryChartData = {
    labels: [...new Set(capexData.map(item => item.category))],
    datasets: [{
      label: 'CAPEX Spend by Category',
      data: [...new Set(capexData.map(item => item.category))].map(cat => 
        capexData.filter(item => item.category === cat).reduce((sum, item) => sum + item.cost, 0)
      ),
      backgroundColor: ['#0ea5e9', '#f97316', '#8b5cf6'],
    }]
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
        <nav className="flex mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
                                <li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">CAPEX Budgeting</span></div></li>
                            </ol>
                        </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Capital Expenditure (CAPEX) Budgeting</h1>
          <p className="text-sky-100 text-s mt-1">Plan and analyze long-term asset investments and their financial impact.</p>
        </div>
        <div className="flex items-center gap-4 text-s text-white">
            <div>
              <label className="font-medium mr-2">Scenario:</label>
              <select value={scenario} onChange={e => setScenario(e.target.value)} className="p-1 border bg-white/20 border-white/30 rounded text-white focus:ring-1 focus:ring-sky-300">
                <option className="text-black">Base Case</option>
                <option className="text-black">Accelerated Growth</option>
                <option className="text-black">Conservative</option>
              </select>
            </div>
             <div className="text-sky-100"><span className="font-medium">Version:</span> {version}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Total CAPEX Budget" value={formatCurrency(totalCapexSpend)} icon={<FiHardDrive />} />
        <KPICard title="Projected Annual Depreciation" value={formatCurrency(totalAnnualDepreciation)} change="For all active assets" icon={<FiTrendingDown />} />
        <KPICard title="Total Projects" value={capexData.length} change={`${capexData.filter(d => d.status === 'Approved').length} Approved`} icon={<FiActivity />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-sky-900 mb-3">5-Year Depreciation Forecast</h2>
          <div className="h-80"><Line data={depreciationChartData} options={chartOptions} /></div>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-sky-900 mb-3">CAPEX Spend by Category</h2>
          <div className="h-80"><Bar data={capexByCategoryChartData} options={{...chartOptions, indexAxis: 'y'}} /></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-sky-900">Capital Investment Plan</h2>
            <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-sky-600 text-white text-s rounded-lg hover:bg-sky-700 flex items-center"><FiSave className="mr-2" /> Save Plan</button>
                <button className="px-4 py-2 bg-gray-200 text-gray-800 text-s rounded-lg hover:bg-gray-300 flex items-center"><FiPrinter className="mr-2" /> Print View</button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s">
            <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3">Project / Asset</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-center">Purchase Date</th>
                <th className="p-3 text-center">Useful Life (Yrs)</th>
                <th className="p-3 text-right">Expected Annual Return</th>
                <th className="p-3 text-center">Simple ROI</th>
                <th className="p-3 text-right">Annual Depreciation</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">AI Insight / Justification</th>
              </tr>
            </thead>
            <tbody>
              {capexData.map(item => {
                const annualDepreciation = item.cost / item.usefulLife;
                const roi = item.cost > 0 ? (item.expectedReturn / item.cost) * 100 : 0;
                
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-sky-50">
                    <td className="p-3 font-medium text-gray-800">
                      <div>{item.project}</div>
                      <div className="text-x text-gray-500">{item.department} - {item.category}</div>
                    </td>
                    <td className="p-3 text-right"><input type="number" value={item.cost} onChange={(e) => handleDataChange(item.id, 'cost', parseFloat(e.target.value))} className="w-28 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-center"><input type="date" value={item.purchaseDate} onChange={(e) => handleDataChange(item.id, 'purchaseDate', e.target.value)} className="p-1 bg-transparent border border-gray-300 rounded text-x focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-center"><input type="number" value={item.usefulLife} onChange={(e) => handleDataChange(item.id, 'usefulLife', parseFloat(e.target.value))} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-right"><input type="number" value={item.expectedReturn} onChange={(e) => handleDataChange(item.id, 'expectedReturn', parseFloat(e.target.value))} className="w-28 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className={`p-3 text-center font-semibold ${roi >= 20 ? 'text-green-600' : 'text-amber-600'}`}>{roi.toFixed(getDecimalPrecision())}%</td>
                    <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(annualDepreciation)}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-1 text-x font-medium rounded-full ${item.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{item.status}</span></td>
                    <td className="p-3 text-x text-blue-800">
                        <div className="flex items-start"><BsStars className="mr-2 mt-0.5 flex-shrink-0" /><span>{item.aiInsight}</span></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-sky-900 mb-4">Scenario-Based CAPEX Modeling</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <label htmlFor="scenario-project" className="block text-s font-medium text-gray-700 mb-1">Select Project to Model:</label>
            <select id="scenario-project" value={scenarioProject?.id} onChange={(e) => setScenarioProject(capexData.find(p => p.id === parseInt(e.target.value)))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-sky-500">
              {capexData.map(p => <option key={p.id} value={p.id}>{p.project}</option>)}
            </select>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800">{scenarioProject.project}</h4>
                <p className="text-s text-gray-600 mt-1">Base Cost: {formatCurrency(scenarioProject.cost)}</p>
                <p className="text-s text-gray-600">Base Purchase Date: {scenarioProject.purchaseDate}</p>
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800">Accelerate by 6 Months</h4>
                <p className="text-s text-green-700 mt-2">FY25 Cash Flow Impact:</p>
                <p className="text-lg font-bold text-green-900">-{formatCurrency(scenarioProject.cost)}</p>
                <p className="text-s text-green-700 mt-2">FY25 Net Income Impact:</p>
                <p className="text-lg font-bold text-green-900">-{formatCurrency(scenarioProject.cost / scenarioProject.usefulLife / 2)}</p>
                <p className="text-x text-green-600 mt-2">(Earlier depreciation start)</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-800">Delay by 12 Months</h4>
                <p className="text-s text-red-700 mt-2">FY25 Cash Flow Impact:</p>
                <p className="text-lg font-bold text-red-900">+{formatCurrency(scenarioProject.cost)}</p>
                 <p className="text-s text-red-700 mt-2">FY25 Net Income Impact:</p>
                <p className="text-lg font-bold text-red-900">+{formatCurrency(scenarioProject.cost / scenarioProject.usefulLife)}</p>
                <p className="text-x text-red-600 mt-2">(No FY25 depreciation)</p>
              </div>
          </div>
        </div>
      </div>

      <ReactTooltip id="info-tooltip" className="max-w-xs text-x z-50" />
    </div>
  );
};

export default CapexBudgeting;