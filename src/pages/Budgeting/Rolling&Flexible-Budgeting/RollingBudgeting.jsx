import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, BarElement, Title, Tooltip, Legend, Filler
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { FiSave, FiPrinter, FiRefreshCw, FiDollarSign,FiChevronRight, FiTrendingUp, FiAlertTriangle, FiShield, FiSliders } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Title, Tooltip, Legend, Filler);

// --- MOCK DATA ---
const QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];

const initialBudgetData = [
  { id: 1, category: "Revenue", type: "Income", q1_actual: 5200000, q1_forecast: 5000000, q2_forecast: 5500000, q3_forecast: 5800000, q4_forecast: 6200000, aiInsight: "Revenue is tracking 4% ahead of forecast. AI suggests increasing Q3/Q4 revenue forecast by 2-3%." },
  { id: 2, category: "COGS", type: "Expense", q1_actual: 1850000, q1_forecast: 1800000, q2_forecast: 1950000, q3_forecast: 2050000, q4_forecast: 2200000, aiInsight: "Slightly over due to increased material costs. The forecast for future quarters has been adjusted upwards by AI." },
  { id: 3, category: "Marketing", type: "Expense", q1_actual: 600000, q1_forecast: 600000, q2_forecast: 650000, q3_forecast: 700000, q4_forecast: 680000, aiInsight: "On track. With strong revenue, consider pulling Q3 spend into Q2 to accelerate lead generation." },
  { id: 4, category: "Sales", type: "Expense", q1_actual: 780000, q1_forecast: 750000, q2_forecast: 800000, q3_forecast: 820000, q4_forecast: 850000, aiInsight: "Commissions are higher due to strong revenue performance. This is a healthy overage." },
  { id: 5, category: "R&D", type: "Expense", q1_actual: 950000, q1_forecast: 900000, q2_forecast: 920000, q3_forecast: 930000, q4_forecast: 950000, aiInsight: "Cloud spend is 18% over forecast due to unplanned data processing for a new model. AI suggests a one-time budget adjustment." },
  { id: 6, category: "G&A", type: "Expense", q1_actual: 450000, q1_forecast: 450000, q2_forecast: 450000, q3_forecast: 460000, q4_forecast: 460000, aiInsight: "Stable. No adjustments needed." },
];

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

const ContingencyFund = ({ budget, used, onUpdate }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-sky-900 flex items-center gap-2"><FiShield/>Contingency Fund</h3>
        <div className="mt-4">
            <label className="block text-s font-medium text-gray-700 mb-1">Total Fund Budget</label>
            <input type="number" value={budget} onChange={e => onUpdate('budget', parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-sky-500"/>
        </div>
        <div className="mt-4">
            <label className="block text-s font-medium text-gray-700 mb-1">Fund Used to Date</label>
            <input type="number" value={used} onChange={e => onUpdate('used', parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-sky-500"/>
        </div>
        <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-amber-500 h-4 rounded-full" style={{ width: `${(used / budget) * 100}%` }}></div>
            </div>
            <div className="text-s font-bold text-gray-700 mt-1 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' , minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }).format(budget - used)} Remaining</div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-x text-blue-800 flex items-start gap-2">
            <BsStars className="mt-0.5 flex-shrink-0"/>
            <span>AI Analysis: Based on historical spending volatility, a contingency of 5% of OpEx is recommended. Your current fund is adequate.</span>
        </div>
    </div>
);


const RollingBudgeting = () => {
  const [budgetData, setBudgetData] = useState(initialBudgetData);
  const [contingency, setContingency] = useState({ budget: 500000, used: 85000 });
  const [currentQuarterIndex, setCurrentQuarterIndex] = useState(0); // Q1 is the current quarter

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);

  const handleForecastChange = (id, quarter, value) => {
    setBudgetData(prev => prev.map(item => item.id === id ? { ...item, [quarter]: parseFloat(value) || 0 } : item));
  };
  
  const summary = useMemo(() => {
    const revenue = budgetData.find(d => d.category === 'Revenue');
    const expenses = budgetData.filter(d => d.type === 'Expense');
    
    const fullYearForecast = revenue ? (revenue.q1_actual + revenue.q2_forecast + revenue.q3_forecast + revenue.q4_forecast) : 0;
    const fullYearExpense = expenses.reduce((sum, item) => sum + item.q1_actual + item.q2_forecast + item.q3_forecast + item.q4_forecast, 0);
    const actualsYTD = revenue ? revenue.q1_actual : 0;
    const forecastYTD = revenue ? revenue.q1_forecast : 0;
    
    return {
      fullYearForecast,
      fullYearProfit: fullYearForecast - fullYearExpense,
      ytdVariance: actualsYTD - forecastYTD,
    };
  }, [budgetData]);

  const lineChartData = {
    labels: QUARTERS,
    datasets: [
      {
        label: 'Revenue',
        data: budgetData.filter(d => d.type === 'Income').flatMap(d => [d.q1_actual, d.q2_forecast, d.q3_forecast, d.q4_forecast]),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.2,
        fill: true,
      },
      {
        label: 'Total Expenses',
        data: QUARTERS.map((q, i) => budgetData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + (i === 0 ? d.q1_actual : d[`q${i+1}_forecast`]), 0)),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.2,
        fill: true,
      },
    ]
  };
  
  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
        <nav className="flex mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
                                <li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Rolling & Flexible</span></div></li>
                            </ol>
                        </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md">
        <h1 className="text-xl font-bold text-white">Rolling & Flexible Budgeting</h1>
        <p className="text-sky-100 text-s mt-1">Continuously adapt your budget to real-time performance and market changes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Full Year Revenue Forecast" value={formatCurrency(summary.fullYearForecast)} icon={<FiDollarSign />} />
        <KPICard title="Full Year Profit Forecast" value={formatCurrency(summary.fullYearProfit)} icon={<FiTrendingUp />} />
        <KPICard title="YTD Revenue Variance" value={formatCurrency(summary.ytdVariance)} change={summary.ytdVariance > 0 ? 'Ahead of Plan' : 'Behind Plan'} icon={<FiSliders />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-sky-900 mb-3">Rolling 12-Month Forecast</h2>
              <div className="h-96"><Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }}/></div>
          </div>
          <div className="lg:col-span-2 space-y-6">
              <ContingencyFund budget={contingency.budget} used={contingency.used} onUpdate={(field, value) => setContingency(c => ({...c, [field]: value}))} />
          </div>
      </div>
      
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-sky-900 mb-4">Automated Variance Alerts & AI Forecasts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Significant Variance Alerts (Q1)</h3>
              <div className="p-3 bg-red-50 border-l-4 border-red-400 flex items-start gap-3">
                  <FiAlertTriangle className="text-red-500 text-xl mt-0.5 flex-shrink-0"/>
                  <div>
                      <h4 className="font-semibold text-red-800">R&D Cloud Spend is 18% over forecast</h4>
                      <p className="text-s text-red-700">AI Analysis: Unplanned data processing for a new model. Recommend a one-time budget top-up of $50k from the contingency fund.</p>
                  </div>
              </div>
               <div className="p-3 bg-green-50 border-l-4 border-green-400 flex items-start gap-3">
                  <BsStars className="text-green-500 text-xl mt-0.5 flex-shrink-0"/>
                  <div>
                      <h4 className="font-semibold text-green-800">Revenue is 4% ahead of forecast</h4>
                      <p className="text-s text-green-700">AI Recommendation: Reinvest 50% of the surplus ($100k) into Q2 marketing campaigns to accelerate momentum.</p>
                  </div>
              </div>
          </div>
          <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">AI-Powered Forecast Scenarios (for Q2-Q4)</h3>
               <div className="p-3 bg-blue-50 border-l-4 border-blue-400">
                  <h4 className="font-semibold text-blue-800">Optimistic Scenario (e.g., strong market)</h4>
                  <p className="text-s text-blue-700 mt-1">AI suggests: Increase revenue forecast by 5%. Allocate an additional $200k to marketing and $100k to sales commissions.</p>
              </div>
              <div className="p-3 bg-amber-50 border-l-4 border-amber-400">
                  <h4 className="font-semibold text-amber-800">Pessimistic Scenario (e.g., downturn)</h4>
                  <p className="text-s text-amber-700 mt-1">AI suggests: Decrease revenue forecast by 8%. Implement a hiring freeze and reduce T&E budget by 50% to preserve cash.</p>
              </div>
          </div>
        </div>
       </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-sky-900">Budget & Forecast Editor</h2>
          <button className="px-4 py-2 bg-sky-600 text-white text-s rounded-lg hover:bg-sky-700 flex items-center"><FiSave className="mr-2" /> Save Forecast</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s">
            <thead className="bg-gray-50 text-x uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Actuals YTD (Q1)</th>
                <th className="p-3 text-right">Forecast (Q1)</th>
                <th className="p-3 text-right">Variance (Q1)</th>
                <th className="p-3 text-right">Forecast (Q2)</th>
                <th className="p-3 text-right">Forecast (Q3)</th>
                <th className="p-3 text-right">Forecast (Q4)</th>
                <th className="p-3 text-left">AI Insight</th>
              </tr>
            </thead>
            <tbody>
              {budgetData.map(item => {
                const variance = item.q1_actual - item.q1_forecast;
                const isExpenseOver = item.type === 'Expense' && variance > 0;
                const isIncomeUnder = item.type === 'Income' && variance < 0;
                const isUnfavorable = isExpenseOver || isIncomeUnder;

                return(
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-sky-50">
                    <td className="p-3 font-medium text-gray-800">{item.category}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.q1_actual)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.q1_forecast)}</td>
                    <td className={`p-3 text-right font-mono font-semibold ${isUnfavorable ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(variance)}</td>
                    {[ 'q2_forecast', 'q3_forecast', 'q4_forecast'].map(q_key => (
                      <td key={q_key} className="p-3 text-right">
                        <input type="number" value={item[q_key]} onChange={(e) => handleForecastChange(item.id, q_key, e.target.value)} className="w-28 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/>
                      </td>
                    ))}
                    <td className="p-3 text-x text-blue-800 max-w-xs">
                        <div className="flex items-start"><BsStars className="mr-2 mt-0.5 flex-shrink-0" /><span>{item.aiInsight}</span></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RollingBudgeting;