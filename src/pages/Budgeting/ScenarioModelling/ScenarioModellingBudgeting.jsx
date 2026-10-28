import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { FiSave, FiPrinter, FiPlayCircle, FiZap,FiChevronRight, FiSliders, FiDollarSign, FiTrendingUp, FiBriefcase, FiBarChart2 } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- BASELINE DATA ---
const BASELINE_BUDGET = {
  revenue: 25000000,
  cogs: 8750000, // 35% of revenue
  marketing: 3000000, // 12% of revenue
  sales: 2500000, // 10% of revenue
  rd: 3750000, // 15% of revenue
  ga: 1250000, // 5% of revenue
};

const KPICard = ({ title, value, change, icon, isPositive = true }) => (
    <div className={`p-4 rounded-xl shadow-sm border ${isPositive ? 'bg-white' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center">
            <div className={`p-3 rounded-full mr-4 ${isPositive ? 'bg-sky-100 text-sky-600' : 'bg-red-100 text-red-600'}`}>{icon}</div>
            <div>
                <p className={`text-s font-semibold ${isPositive ? 'text-sky-800' : 'text-red-800'}`}>{title}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {change && <p className={`text-x mt-1 ${isPositive ? 'text-gray-500' : 'text-red-600'}`}>{change}</p>}
            </div>
        </div>
    </div>
);

const ScenarioModellingBudgeting = () => {
  const [drivers, setDrivers] = useState({
    revenueGrowth: 0,
    marketCondition: "Stable",
    costCuts: { marketing: 0, rd: 0, ga: 0 },
    investmentAllocation: 50, // 50% to R&D, 50% to S&M
  });

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);

  const scenarioResult = useMemo(() => {
    let scenario = { ...BASELINE_BUDGET };
    let aiSummary = [];

    // 1. Market & Economic Condition Simulation
    if (drivers.marketCondition === 'Recession') {
        scenario.revenue *= 0.90; // -10% revenue
        scenario.cogs *= 0.90;
        aiSummary.push("Recession scenario applied: Revenue reduced by 10%.");
    } else if (drivers.marketCondition === 'High Inflation') {
        scenario.cogs *= 1.05; // +5% COGS
        scenario.marketing *= 1.03;
        scenario.sales *= 1.03;
        scenario.rd *= 1.03;
        scenario.ga *= 1.03;
        aiSummary.push("High Inflation scenario applied: Costs increased by 3-5%.");
    }

    // 2. Revenue Growth vs. Budget Expansion
    const revenueModifier = 1 + drivers.revenueGrowth / 100;
    scenario.revenue *= revenueModifier;
    scenario.cogs *= revenueModifier; // COGS scales with revenue
    scenario.sales *= revenueModifier; // Sales budget scales with revenue
    if (drivers.revenueGrowth > 0) aiSummary.push(`Revenue increased by ${drivers.revenueGrowth}%, scaling COGS and Sales budgets.`);
    if (drivers.revenueGrowth < 0) aiSummary.push(`Revenue decreased by ${-drivers.revenueGrowth}%, scaling COGS and Sales budgets.`);


    // 3. Cost-Cutting Scenario Testing
    scenario.marketing *= (1 - drivers.costCuts.marketing / 100);
    scenario.rd *= (1 - drivers.costCuts.rd / 100);
    scenario.ga *= (1 - drivers.costCuts.ga / 100);
    if (drivers.costCuts.marketing > 0) aiSummary.push(`Marketing budget cut by ${drivers.costCuts.marketing}%.`);
    if (drivers.costCuts.rd > 0) aiSummary.push(`R&D budget cut by ${drivers.costCuts.rd}%.`);

    // 4. Investment Trade-Offs
    const totalInvestmentPot = BASELINE_BUDGET.rd + BASELINE_BUDGET.marketing + BASELINE_BUDGET.sales;
    const baseRdRatio = BASELINE_BUDGET.rd / totalInvestmentPot;
    const baseSmRatio = (BASELINE_BUDGET.marketing + BASELINE_BUDGET.sales) / totalInvestmentPot;
    
    // This is a simplified model. A real one would be more complex.
    const rdAllocationRatio = drivers.investmentAllocation / 100;
    const smAllocationRatio = 1 - rdAllocationRatio;
    
    // For this demo, we'll just show the text impact, as re-calculating the actual budget is complex.
    if(drivers.investmentAllocation > 60) aiSummary.push("Heavy focus on R&D may slow short-term growth but builds long-term product advantage.");
    if(drivers.investmentAllocation < 40) aiSummary.push("Heavy focus on Sales/Marketing may boost short-term revenue but risks future product competitiveness.");

    const grossProfit = scenario.revenue - scenario.cogs;
    const totalExpenses = scenario.marketing + scenario.sales + scenario.rd + scenario.ga;
    const netIncome = grossProfit - totalExpenses;

    return { ...scenario, grossProfit, totalExpenses, netIncome, aiSummary: aiSummary.join(' ') };
  }, [drivers]);

  const chartData = {
      labels: ['Baseline', 'Scenario'],
      datasets: [
          { label: 'Revenue', data: [BASELINE_BUDGET.revenue, scenarioResult.revenue], backgroundColor: '#3b82f6' },
          { label: 'Total Expenses', data: [BASELINE_BUDGET.marketing + BASELINE_BUDGET.sales + BASELINE_BUDGET.rd + BASELINE_BUDGET.ga, scenarioResult.totalExpenses], backgroundColor: '#ef4444' },
          { label: 'Net Income', data: [BASELINE_BUDGET.revenue - BASELINE_BUDGET.cogs - (BASELINE_BUDGET.marketing + BASELINE_BUDGET.sales + BASELINE_BUDGET.rd + BASELINE_BUDGET.ga), scenarioResult.netIncome], backgroundColor: '#10b981' },
      ],
  };

  const handleDriverChange = (driver, value) => {
    setDrivers(prev => ({ ...prev, [driver]: value }));
  };

  const handleCostCutChange = (dept, value) => {
    setDrivers(prev => ({ ...prev, costCuts: { ...prev.costCuts, [dept]: value } }));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
        <nav className="flex mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
                                <li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Scenario & What-If</span></div></li>
                            </ol>
                        </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md">
        <h1 className="text-xl font-bold text-white">Scenario Modeling & What-If Analysis</h1>
        <p className="text-sky-100 text-s mt-1">Simulate the impact of business decisions and market changes on your budget.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- INTERACTIVE DRIVERS PANEL --- */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
          <h2 className="text-xl font-semibold text-sky-900 flex items-center gap-2"><FiSliders/> Key Driver Adjustments</h2>
          
          {/* Market & Economic Conditions */}
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Market & Economic Condition</label>
            <select value={drivers.marketCondition} onChange={e => handleDriverChange('marketCondition', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-sky-500">
              <option>Stable</option>
              <option>Recession</option>
              <option>High Inflation</option>
            </select>
          </div>

          {/* Revenue Growth */}
          <div>
            <label className="block text-s font-medium text-gray-700">Revenue Growth / Decline (%)</label>
            <div className="flex items-center gap-4">
              <input type="range" min="-20" max="20" value={drivers.revenueGrowth} onChange={e => handleDriverChange('revenueGrowth', parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
              <span className="font-bold text-sky-800 w-16 text-center">{drivers.revenueGrowth}%</span>
            </div>
          </div>

          {/* Cost Cutting */}
          <div>
            <label className="block text-s font-medium text-gray-700 mb-2">Cost-Cutting Scenarios (%)</label>
            <div className="space-y-2">
              <div className="flex items-center gap-4"><span className="w-20">Marketing</span><input type="range" min="0" max="50" value={drivers.costCuts.marketing} onChange={e => handleCostCutChange('marketing', parseFloat(e.target.value))} className="w-full"/><span>{drivers.costCuts.marketing}%</span></div>
              <div className="flex items-center gap-4"><span className="w-20">R&D</span><input type="range" min="0" max="50" value={drivers.costCuts.rd} onChange={e => handleCostCutChange('rd', parseFloat(e.target.value))} className="w-full"/><span>{drivers.costCuts.rd}%</span></div>
              <div className="flex items-center gap-4"><span className="w-20">G&A</span><input type="range" min="0" max="50" value={drivers.costCuts.ga} onChange={e => handleCostCutChange('ga', parseFloat(e.target.value))} className="w-full"/><span>{drivers.costCuts.ga}%</span></div>
            </div>
          </div>
          
          {/* Investment Trade-Off */}
           <div>
            <label className="block text-s font-medium text-gray-700">Investment Trade-Offs</label>
            <input type="range" min="0" max="100" value={drivers.investmentAllocation} onChange={e => handleDriverChange('investmentAllocation', parseFloat(e.target.value))} className="w-full h-2 bg-gradient-to-r from-teal-200 to-blue-200 rounded-lg appearance-none cursor-pointer"/>
            <div className="flex justify-between text-x mt-1">
              <span className="font-semibold text-blue-600">{100 - drivers.investmentAllocation}% Sales/Marketing</span>
              <span className="font-semibold text-teal-600">{drivers.investmentAllocation}% R&D</span>
            </div>
          </div>
        </div>

        {/* --- SCENARIO IMPACT PANEL --- */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h2 className="text-xl font-semibold text-sky-900 flex items-center gap-2"><FiZap/> Scenario P&L Impact</h2>
           <div className="mt-4 overflow-x-auto">
             <table className="w-full text-s">
                <thead>
                    <tr className="border-b">
                        <th className="py-2 text-left font-semibold text-gray-600">Metric</th>
                        <th className="py-2 text-right font-semibold text-gray-600">Baseline</th>
                        <th className="py-2 text-right font-semibold text-sky-600">Scenario</th>
                        <th className="py-2 text-right font-semibold text-gray-600">Impact</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        { label: 'Revenue', icon: <FiDollarSign className="text-green-500"/>, base: BASELINE_BUDGET.revenue, scenario: scenarioResult.revenue },
                        { label: 'COGS', icon: <FiBriefcase className="text-amber-500"/>, base: BASELINE_BUDGET.cogs, scenario: scenarioResult.cogs },
                        { label: 'Gross Profit', icon: <FiTrendingUp className="text-green-500"/>, base: BASELINE_BUDGET.revenue - BASELINE_BUDGET.cogs, scenario: scenarioResult.grossProfit, isBold: true },
                        { label: 'Marketing', icon: <FiBriefcase className="text-amber-500"/>, base: BASELINE_BUDGET.marketing, scenario: scenarioResult.marketing },
                        { label: 'Sales', icon: <FiBriefcase className="text-amber-500"/>, base: BASELINE_BUDGET.sales, scenario: scenarioResult.sales },
                        { label: 'R&D', icon: <FiBriefcase className="text-amber-500"/>, base: BASELINE_BUDGET.rd, scenario: scenarioResult.rd },
                        { label: 'G&A', icon: <FiBriefcase className="text-amber-500"/>, base: BASELINE_BUDGET.ga, scenario: scenarioResult.ga },
                        { label: 'Total Expenses', icon: <FiBriefcase className="text-red-500"/>, base: BASELINE_BUDGET.marketing + BASELINE_BUDGET.sales + BASELINE_BUDGET.rd + BASELINE_BUDGET.ga, scenario: scenarioResult.totalExpenses, isBold: true },
                        { label: 'Net Income', icon: <FiBarChart2 className="text-green-500"/>, base: BASELINE_BUDGET.revenue - BASELINE_BUDGET.cogs - (BASELINE_BUDGET.marketing + BASELINE_BUDGET.sales + BASELINE_BUDGET.rd + BASELINE_BUDGET.ga), scenario: scenarioResult.netIncome, isBold: true },
                    ].map(item => {
                        const impact = item.scenario - item.base;
                        const isPositiveImpact = impact >= 0;
                        return (
                            <tr key={item.label} className={`border-b border-gray-100 ${item.isBold ? 'font-bold' : ''}`}>
                                <td className="py-2 flex items-center gap-2">{item.icon} {item.label}</td>
                                <td className="py-2 text-right font-mono">{formatCurrency(item.base)}</td>
                                <td className="py-2 text-right font-mono text-sky-700">{formatCurrency(item.scenario)}</td>
                                <td className={`py-2 text-right font-mono ${isPositiveImpact ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(impact)}</td>
                            </tr>
                        )
                    })}
                </tbody>
             </table>
           </div>
           <div className="mt-4 p-3 bg-blue-50 rounded-lg text-s text-blue-800 flex items-start gap-2">
                <BsStars className="mt-0.5 flex-shrink-0"/>
                <div>
                    <h4 className="font-semibold">AI Summary of Changes:</h4>
                    <p>{scenarioResult.aiSummary}</p>
                </div>
            </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-sky-900 mb-3">Baseline vs. Scenario Comparison</h2>
        <div className="h-96"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }}}}/></div>
      </div>
    </div>
  );
};

export default ScenarioModellingBudgeting;