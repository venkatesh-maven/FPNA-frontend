// src/pages/Budgeting/RevenueBasedBudgeting/RevenuebasedBudgeting.jsx
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { FiDollarSign, FiTrendingUp, FiTarget,FiChevronRight, FiRepeat, FiInfo, FiEdit2, FiUser, FiBriefcase, FiHardDrive, FiBarChart2 } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { motion, AnimatePresence } from "framer-motion";
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

// --- MOCK DATA ALIGNED WITH NEW SPECIFICATION ---
const CURRENT_YEAR = 2025;
const PREVIOUS_YEAR = 2024;

const MOCK_DATA = {
  revenue: [
    { id: 1, client: "Global Tech Inc.", status: 'Existing', type: 'Recurring', units: 220, price: 520, churn: 1, upsell: 7, winProb: 100, aiNote: "Increased units based on historical usage growth." },
    { id: 2, client: "Innovate Solutions", status: 'Existing', type: 'Recurring', units: 150, price: 480, churn: 2, upsell: 10, winProb: 100, aiNote: "Higher upsell potential identified from product engagement." },
    { id: 3, client: "Data Driven LLC", status: 'Existing', type: 'Services', units: 1, price: 600000, churn: 0, upsell: 0, winProb: 100, aiNote: "Contract renewal with price increase." },
    { id: 4, client: "Future Corp (Pipeline)", status: 'Pipeline', type: 'Recurring', units: 100, price: 500, churn: 0, upsell: 0, winProb: 75, aiNote: "High probability deal based on CRM stage." },
    { id: 5, client: "New Ventures (Pipeline)", status: 'Pipeline', type: 'Recurring', units: 50, price: 450, churn: 0, upsell: 0, winProb: 50, aiNote: "Mid-stage opportunity, probability reflects discovery phase." },
    { id: 6, client: "One-Time Project", status: 'Pipeline', type: 'One-time', units: 1, price: 150000, churn: 0, upsell: 0, winProb: 90, aiNote: "SOW accepted, awaiting signature." },
  ],
  cogs: [
      { id: 1, product: 'SaaS Plan', costPerUnit: 85, forecastedUnits: 4250, vendor: 'Cloud Services Inc.', aiNote: 'Unit cost reflects 3% vendor increase.' },
      { id: 2, product: 'Services', costPerUnit: 250000, forecastedUnits: 1, vendor: 'Consultant Pool', aiNote: 'Based on average project staffing costs.' },
      { id: 3, product: 'One-time', costPerUnit: 60000, forecastedUnits: 1, vendor: 'Implementation Partner', aiNote: 'Fixed cost from SOW.' },
  ],
  opex: {
    'Marketing': [
      { id: 1, category: 'Paid Advertising', monthly: 50000, type: 'Recurring', aiBaseline: 45000, aiNote: 'Increased budget for new market campaign based on CPL analysis.' },
      { id: 2, category: 'Software/Subscriptions', monthly: 15000, type: 'Recurring', aiBaseline: 15000, aiNote: 'Reflects known contract renewals for Martech stack.' },
      { id: 3, category: 'Events/Conferences', monthly: 10000, type: 'One-Time', aiBaseline: 20000, aiNote: 'AI suggests shifting spend from events to higher ROI digital channels.' },
    ],
    'R&D': [
      { id: 1, category: 'Cloud Infrastructure', monthly: 120000, type: 'Recurring', aiBaseline: 115000, aiNote: 'Scaled with projected platform usage.'},
      { id: 2, category: 'Software/Subscriptions', monthly: 25000, type: 'Recurring', aiBaseline: 25000, aiNote: 'Developer tooling costs.'},
    ],
    'G&A': [
      { id: 1, category: 'Office Lease', monthly: 40000, type: 'Recurring', aiBaseline: 40000, aiNote: 'Fixed cost per current lease agreement.'},
      { id: 2, category: 'Professional Services (Legal/Audit)', monthly: 15000, type: 'Recurring', aiBaseline: 12000, aiNote: 'Increased audit fees expected for this year.'},
    ]
  },
  headcount: [
    { id: 1, name: 'Alice Johnson', title: 'Lead Developer', department: 'R&D', salary: 150000, raise: 5, bonus: 10, status: 'Active', startDate: '2023-01-01', termDate: null },
    { id: 2, name: 'Bob Williams', title: 'Sales Director', department: 'Sales', salary: 120000, raise: 3, bonus: 20, status: 'Active', startDate: '2023-01-01', termDate: null },
    { id: 3, name: 'Charlie Brown', title: 'Marketing Manager', department: 'Marketing', salary: 90000, raise: 4, bonus: 10, status: 'Active', startDate: '2023-01-01', termDate: '2025-06-30' },
    { id: 4, name: 'New Hire - Engineer', title: 'Software Engineer', department: 'R&D', salary: 110000, raise: 0, bonus: 5, status: 'New Hire', startDate: '2025-03-01', termDate: null },
    { id: 5, name: 'New Hire - Account Exec', title: 'Account Executive', department: 'Sales', salary: 75000, raise: 0, bonus: 25, status: 'New Hire', startDate: '2025-04-01', termDate: null },
  ],
  capex: [
    { id: 1, asset: 'Server Farm Upgrade', cost: 250000, purchaseDate: '2025-02-15', usefulLife: 5, aiNote: 'Required to support projected 40% user growth.' },
    { id: 2, asset: 'New Office Build-out', cost: 150000, purchaseDate: '2025-08-01', usefulLife: 10, aiNote: 'Capex for planned office expansion.' },
  ],
  multiYearPlan: {
    drivers: {
      revenueGrowth: { '2026': 25, '2027': 22, '2028': 20 },
      grossMargin: { '2026': 67, '2027': 68, '2028': 69 },
      opexAsRevenue: { '2026': 43, '2027': 41, '2028': 38 },
      fteGrowth: { '2026': 20, '2027': 15, '2028': 15 },
    }
  },
};

const CORPORATE_GUIDELINES = {
    'opex': "Overall Opex growth should not exceed 80% of revenue growth. Prioritize investments with clear ROI. All new software spend over $10k/year requires CFO approval.",
    'headcount': `Hiring is limited to roles approved in the annual plan. Salary increases to average 3-5%. Exceptions require executive approval.`,
    'capex': "Capital expenditures are limited to $500k for FY2025. All requests must include a business case detailing the expected return on investment.",
};

const formatCurrency = (value, compact = false) => {
  if (compact) {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(getDecimalPrecision())}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(getDecimalPrecision())}K`;
    return `$${value}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);
};

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

const GuidelinePanel = ({ guideline }) => (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 mb-6 rounded-r-lg">
        <div className="flex">
            <div className="py-1"><FiInfo className="h-5 w-5 text-yellow-500 mr-3"/></div>
            <div>
                <p className="font-bold">Corporate Guideline</p>
                <p className="text-s">{guideline}</p>
            </div>
        </div>
    </div>
);


const RevenueBasedBudgeting = () => {
  const [activeTab, setActiveTab] = useState("revenue");
  const [activeOpexDept, setActiveOpexDept] = useState('Marketing');
  const [scenario, setScenario] = useState('Base Case');
  const [version, setVersion] = useState(`FY${CURRENT_YEAR} Budget v1.0 - Draft`);
  
  // State for all budget modules
  const [revenueLines, setRevenueLines] = useState(MOCK_DATA.revenue);
  const [cogsLines, setCogsLines] = useState(MOCK_DATA.cogs);
  const [opex, setOpex] = useState(MOCK_DATA.opex);
  const [headcount, setHeadcount] = useState(MOCK_DATA.headcount);
  const [capex, setCapex] = useState(MOCK_DATA.capex);
  const [multiYearPlan, setMultiYearPlan] = useState(MOCK_DATA.multiYearPlan);


  // --- Driver-based Calculations ---
  const calculateAnnualRevenue = (line) => {
    const baseRevenue = line.units * line.price * (line.type === 'Recurring' ? 12 : 1);
    let finalRevenue = baseRevenue;
    if (line.status === 'Existing' && line.type === 'Recurring') {
      finalRevenue = baseRevenue * (1 - (line.churn / 100)) * (1 + (line.upsell / 100));
    } else if (line.status === 'Pipeline') {
      finalRevenue = baseRevenue * (line.winProb / 100);
    }
    return finalRevenue;
  };
  
  const totalRevenue = useMemo(() => revenueLines.reduce((sum, line) => sum + calculateAnnualRevenue(line), 0), [revenueLines]);

  const totalCOGS = useMemo(() => cogsLines.reduce((sum, line) => sum + line.costPerUnit * line.forecastedUnits * (line.product === 'SaaS Plan' ? 12 : 1), 0), [cogsLines]);
  
  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const calculateProratedCost = (employee) => {
      const year = CURRENT_YEAR;
      const startDate = new Date(employee.startDate);
      const termDate = employee.termDate ? new Date(employee.termDate) : null;

      let startMonth = 0;
      if (startDate.getFullYear() === year) {
          startMonth = startDate.getMonth();
      }
      
      let endMonth = 11;
      if (termDate && termDate.getFullYear() === year) {
          endMonth = termDate.getMonth();
      }
      
      const activeMonths = endMonth - startMonth + 1;
      if (activeMonths <= 0) return 0;
      
      const adjustedSalary = employee.salary * (1 + (employee.raise || 0) / 100);
      const bonusAmount = adjustedSalary * ((employee.bonus || 0) / 100);
      const totalAnnualComp = adjustedSalary + bonusAmount;

      return (totalAnnualComp / 12) * activeMonths;
  };

  const totalHeadcountCost = useMemo(() => headcount.reduce((sum, emp) => sum + calculateProratedCost(emp), 0), [headcount]);
  
  const totalOpex = useMemo(() => {
      const nonSalaryOpex = Object.values(opex).flat().reduce((sum, line) => sum + (line.monthly * 12), 0);
      return nonSalaryOpex + totalHeadcountCost;
  }, [opex, totalHeadcountCost]);

  const totalCapex = useMemo(() => capex.reduce((sum, item) => sum + item.cost, 0), [capex]);

  const netIncome = grossProfit - totalOpex;

  // --- Change Handlers for Edit Functionality ---
  const handleStateChange = (setter, id, field, value, isNumeric = true) => {
    setter(prevItems => prevItems.map(item => 
      item.id === id ? { ...item, [field]: isNumeric ? (parseFloat(value) || 0) : value } : item
    ));
  };

  const handleRevenueLineChange = (id, field, value) => handleStateChange(setRevenueLines, id, field, value);
  const handleCogsLineChange = (id, field, value) => handleStateChange(setCogsLines, id, field, value);
  const handleHeadcountChange = (id, field, value, isNumeric = true) => handleStateChange(setHeadcount, id, field, value, isNumeric);
  const handleCapexChange = (id, field, value, isNumeric = true) => handleStateChange(setCapex, id, field, value, isNumeric);

  const handleOpexChange = (department, id, field, value) => {
    setOpex(prevOpex => {
      const newOpex = { ...prevOpex };
      newOpex[department] = newOpex[department].map(line => 
        line.id === id ? { ...line, [field]: parseFloat(value) || 0 } : line
      );
      return newOpex;
    });
  };

  const handleMultiYearPlanChange = (driverKey, year, value) => {
    setMultiYearPlan(prevPlan => ({
        ...prevPlan,
        drivers: {
            ...prevPlan.drivers,
            [driverKey]: {
                ...prevPlan.drivers[driverKey],
                [year]: parseFloat(value) || 0
            }
        }
    }));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
        <nav className="flex mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
                                <li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Revenue Based</span></div></li>
                            </ol>
                        </nav>
      {/* --- Header & Global Controls (Restored Style) --- */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">FP&A Budgeting Module - {CURRENT_YEAR} Plan</h1>
            <p className="text-sky-100 text-s mt-1">AI-driven, collaborative budget planning and forecasting.</p>
          </div>
          <div className="flex items-center gap-4 text-s text-white">
            <div className="flex items-center">
              <label className="font-medium mr-2">Scenario:</label>
              <select value={scenario} onChange={e => setScenario(e.target.value)} className="p-1 border bg-white/20 border-white/30 rounded text-white focus:ring-1 focus:ring-sky-300">
                <option className="text-black">Base Case</option>
                <option className="text-black">Stretch</option>
                <option className="text-black">Worst Case</option>
              </select>
            </div>
             <div className="hidden sm:block text-white/50">|</div>
             <div className="text-sky-800">
                <span className="font-medium">Version:</span> {version}
            </div>
          </div>
      </div>
      
      {/* --- Main Navigation Tabs --- */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-0 overflow-x-auto">
        {[
          { id: "revenue", label: "Revenue", icon: FiDollarSign },
          { id: "cogs", label: "COGS", icon: FiTrendingUp },
          { id: "opex", label: "Operating Expenses", icon: FiBriefcase },
          { id: "headcount", label: "Headcount", icon: FiUser },
          { id: "capex", label: "CapEx", icon: FiHardDrive },
          { id: "multi_year_plan", label: "Multi-Year Plan", icon: FiBarChart2 },
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center py-3 px-4 font-medium text-s rounded-t-lg -mb-px transition-colors duration-200 whitespace-nowrap
                        ${activeTab === tab.id 
                          ? "text-white bg-sky-800 border-b-2 border-sky-500" 
                          : "text-sky-700 hover:text-sky-900 hover:bg-sky-100 border-b-2 border-transparent"
                        }`}
          >
            <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* --- MODULE: Revenue Budgeting --- */}
          {activeTab === "revenue" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <KPICard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<FiDollarSign />} aiNote="Growth driven by strong upsell and high-probability pipeline."/>
                 <KPICard title="Gross Profit" value={formatCurrency(grossProfit)} change={`${grossMargin.toFixed(getDecimalPrecision())}% Margin`} icon={<FiTrendingUp />} aiNote="Margin improvement expected from favorable product mix." />
                 <KPICard title="Net Income" value={formatCurrency(netIncome)} change={`${(netIncome/totalRevenue * 100).toFixed(getDecimalPrecision())}% of Revenue`} icon={<FiTarget />} isPositive={netIncome > 0} aiNote="Profitability target is on track based on current plan." />
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-sky-900 mb-4">Revenue Drivers Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-s">
                    <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
                      <tr>
                        <th className="p-2">Client / Product</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 text-center">Units</th>
                        <th className="p-2 text-center">Unit Price</th>
                        <th className="p-2 text-center">Churn %</th>
                        <th className="p-2 text-center">Upsell %</th>
                        <th className="p-2 text-center">Win Prob %</th>
                        <th className="p-2 text-right">Annual Forecast</th>
                        <th className="p-2">AI Insight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueLines.map(line => (
                          <tr key={line.id} className={`border-b border-gray-100 hover:bg-sky-50`}>
                            <td className="p-2 font-medium text-gray-800">{line.client}</td>
                            <td className="p-2"><span className={`px-2 py-1 text-x font-medium rounded-full ${line.type === 'Recurring' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{line.type}</span></td>
                            <td className="p-2"><input type="number" value={line.units} onChange={(e) => handleRevenueLineChange(line.id, 'units', e.target.value)} className="w-20 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                            <td className="p-2"><input type="number" value={line.price} onChange={(e) => handleRevenueLineChange(line.id, 'price', e.target.value)} className="w-20 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                            <td className="p-2"><input type="number" value={line.churn} onChange={(e) => handleRevenueLineChange(line.id, 'churn', e.target.value)} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" disabled={line.status === 'Pipeline'}/></td>
                            <td className="p-2"><input type="number" value={line.upsell} onChange={(e) => handleRevenueLineChange(line.id, 'upsell', e.target.value)} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" disabled={line.status === 'Pipeline'}/></td>
                            <td className="p-2"><input type="number" value={line.winProb} onChange={(e) => handleRevenueLineChange(line.id, 'winProb', e.target.value)} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" disabled={line.status !== 'Pipeline'}/></td>
                            <td className="p-2 text-right font-semibold text-gray-900">{formatCurrency(calculateAnnualRevenue(line))}</td>
                            <td className="p-2 text-blue-600 text-x"><BsStars className="inline mr-2" />{line.aiNote}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="font-bold text-gray-900 bg-gray-50">
                      <tr className="border-t-2 border-gray-300">
                        <td className="p-2" colSpan="7">Total Annual Projected Revenue</td>
                        <td className="p-2 text-right">{formatCurrency(totalRevenue)}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --- MODULE: COGS Budgeting --- */}
          {activeTab === "cogs" && (
            <div className="space-y-6">
              <KPICard title="Total COGS" value={formatCurrency(totalCOGS)} change={`Linked to revenue forecast`} icon={<FiTrendingUp />} aiNote="COGS scales automatically with unit sales from the Revenue tab." />
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-sky-900 mb-4">Cost of Goods Sold (COGS) Drivers</h3>
                 <div className="overflow-x-auto">
                  <table className="w-full text-s">
                    <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
                      <tr>
                        <th className="p-2">Product / Service</th>
                        <th className="p-2">Vendor</th>
                        <th className="p-2 text-center">Cost Per Unit</th>
                        <th className="p-2 text-center">Forecasted Units (from Revenue)</th>
                        <th className="p-2 text-right">Total Annual Cost</th>
                        <th className="p-2">AI Insight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cogsLines.map(line => (
                        <tr key={line.id} className="border-b border-gray-100 hover:bg-sky-50">
                            <td className="p-2 font-medium">{line.product}</td>
                            <td className="p-2 text-gray-600">{line.vendor}</td>
                            <td className="p-2"><input type="number" value={line.costPerUnit} onChange={e => handleCogsLineChange(line.id, 'costPerUnit', e.target.value)} className="w-24 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                            <td className="p-2 text-center text-gray-600">{line.forecastedUnits.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrency(line.costPerUnit * line.forecastedUnits * (line.product === 'SaaS Plan' ? 12 : 1))}</td>
                            <td className="p-2 text-blue-600 text-x"><BsStars className="inline mr-2" />{line.aiNote}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-bold text-gray-900 bg-gray-50">
                      <tr className="border-t-2 border-gray-300">
                        <td colSpan="4" className="p-2">Total COGS</td>
                        <td className="p-2 text-right">{formatCurrency(totalCOGS)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --- MODULE: Operating Expenses (Opex) --- */}
          {activeTab === "opex" && (
            <div className="space-y-6">
              <GuidelinePanel guideline={CORPORATE_GUIDELINES.opex} />
              <KPICard title="Total Operating Expenses" value={formatCurrency(totalOpex)} change={`${(totalOpex/totalRevenue * 100).toFixed(getDecimalPrecision())}% of Revenue`} icon={<FiBriefcase />} aiNote={`Includes ${formatCurrency(totalHeadcountCost, true)} from Headcount Plan.`}/>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-sky-900">Departmental Expense Budget</h3>
                    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                        {Object.keys(opex).map(dept => (
                            <button key={dept} onClick={() => setActiveOpexDept(dept)} className={`px-3 py-1 text-s font-medium rounded-md transition-colors ${activeOpexDept === dept ? 'bg-white text-sky-800 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>{dept}</button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-s">
                        <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="p-2">Expense Category</th>
                                <th className="p-2">Type</th>
                                <th className="p-2 text-center">Monthly Cost</th>
                                <th className="p-2 text-center">AI Baseline</th>
                                <th className="p-2 text-right">Annual Budget</th>
                                <th className="p-2 text-center">Status</th>
                                <th className="p-2">AI Insight / Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Special Row for Salaries */}
                            <tr className="border-b border-gray-100 bg-blue-50">
                                <td className="p-2 font-medium">Salaries & Wages</td>
                                <td className="p-2 italic">From Headcount</td>
                                <td className="p-2 text-center text-gray-500">-</td>
                                <td className="p-2 text-center text-gray-500">-</td>
                                <td className="p-2 text-right font-semibold">{formatCurrency(headcount.filter(h => h.department === activeOpexDept).reduce((sum, e) => sum + calculateProratedCost(e), 0))}</td>
                                <td className="p-2 text-center"><span className="text-blue-700 font-medium text-x">Linked</span></td>
                                <td className="p-2 text-x">Total cost calculated from the Headcount module. Click tab to edit.</td>
                            </tr>
                            {opex[activeOpexDept].map(line => (
                                <tr key={line.id} className="border-b border-gray-100 hover:bg-sky-50">
                                    <td className="p-2 font-medium">{line.category}</td>
                                    <td className="p-2 text-gray-600">{line.type}</td>
                                    <td className="p-2"><input type="number" value={line.monthly} onChange={e => handleOpexChange(activeOpexDept, line.id, 'monthly', e.target.value)} className="w-24 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center text-gray-500">{formatCurrency(line.aiBaseline)}</td>
                                    <td className="p-2 text-right font-semibold">{formatCurrency(line.monthly * 12)}</td>
                                    <td className="p-2 text-center"><span className="px-2 py-1 text-x font-medium rounded-full bg-gray-100 text-gray-700">Draft</span></td>
                                    <td className="p-2 text-blue-600 text-x"><BsStars className="inline mr-2" />{line.aiNote}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}

          {/* --- MODULE: Headcount --- */}
          {activeTab === "headcount" && (
            <div className="space-y-6">
              <GuidelinePanel guideline={CORPORATE_GUIDELINES.headcount} />
              <KPICard title="Total Headcount Cost" value={formatCurrency(totalHeadcountCost)} change={`${headcount.length} Total Headcount`} icon={<FiUser />} aiNote="Costs are prorated for mid-year start/termination dates." />
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-sky-900 mb-4">Employee & Headcount Planning</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-s">
                        <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="p-2">Employee Name / Role</th>
                                <th className="p-2">Department</th>
                                <th className="p-2 text-right">Current Salary</th>
                                <th className="p-2 text-center">Raise %</th>
                                <th className="p-2 text-center">Bonus %</th>
                                <th className="p-2 text-center">Start Date</th>
                                <th className="p-2 text-center">Term Date</th>
                                <th className="p-2 text-right">FY25 Cost</th>
                                <th className="p-2 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {headcount.map(emp => (
                                <tr key={emp.id} className={`border-b border-gray-100 hover:bg-sky-50 ${emp.status === 'New Hire' ? 'bg-green-50' : ''}`}>
                                    <td className="p-2 font-medium">{emp.name}<div className="text-x text-gray-500">{emp.title}</div></td>
                                    <td className="p-2">{emp.department}</td>
                                    <td className="p-2 text-right"><input type="number" value={emp.salary} onChange={e => handleHeadcountChange(emp.id, 'salary', e.target.value)} className="w-24 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><input type="number" value={emp.raise} onChange={e => handleHeadcountChange(emp.id, 'raise', e.target.value)} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><input type="number" value={emp.bonus} onChange={e => handleHeadcountChange(emp.id, 'bonus', e.target.value)} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><input type="date" value={emp.startDate} onChange={e => handleHeadcountChange(emp.id, 'startDate', e.target.value, false)} className="p-1 bg-transparent border border-gray-300 rounded text-x focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><input type="date" value={emp.termDate || ''} onChange={e => handleHeadcountChange(emp.id, 'termDate', e.target.value, false)} className="p-1 bg-transparent border border-gray-300 rounded text-x focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-right font-semibold">{formatCurrency(calculateProratedCost(emp))}</td>
                                    <td className="p-2 text-center"><span className={`px-2 py-1 text-x font-medium rounded-full ${emp.status === 'New Hire' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{emp.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="font-bold text-gray-900 bg-gray-50">
                            <tr className="border-t-2 border-gray-300">
                                <td colSpan="7" className="p-2">Total Headcount Cost</td>
                                <td className="p-2 text-right">{formatCurrency(totalHeadcountCost)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              </div>
            </div>
          )}

          {/* --- MODULE: Capital Expenditures (CapEx) --- */}
          {activeTab === "capex" && (
            <div className="space-y-6">
              <GuidelinePanel guideline={CORPORATE_GUIDELINES.capex} />
              <KPICard title="Total Capital Expenditure" value={formatCurrency(totalCapex)} icon={<FiHardDrive />} aiNote="Represents major investments in long-term assets." />
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-sky-900 mb-4">Capital Asset Planning</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-s">
                        <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="p-2">Asset Description</th>
                                <th className="p-2 text-right">One-time Cost</th>
                                <th className="p-2 text-center">Purchase Date</th>
                                <th className="p-2 text-center">Useful Life (Yrs)</th>
                                <th className="p-2 text-center">Status</th>
                                <th className="p-2">AI Insight / Business Case</th>
                            </tr>
                        </thead>
                        <tbody>
                            {capex.map(item => (
                                <tr key={item.id} className="border-b border-gray-100 hover:bg-sky-50">
                                    <td className="p-2 font-medium">{item.asset}</td>
                                    <td className="p-2 text-right"><input type="number" value={item.cost} onChange={e => handleCapexChange(item.id, 'cost', e.target.value)} className="w-32 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><input type="date" value={item.purchaseDate} onChange={e => handleCapexChange(item.id, 'purchaseDate', e.target.value, false)} className="p-1 bg-transparent border border-gray-300 rounded text-x focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><input type="number" value={item.usefulLife} onChange={e => handleCapexChange(item.id, 'usefulLife', e.target.value)} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" /></td>
                                    <td className="p-2 text-center"><span className="px-2 py-1 text-x font-medium rounded-full bg-yellow-100 text-yellow-800">Pending Approval</span></td>
                                    <td className="p-2 text-blue-600 text-x"><BsStars className="inline mr-2" />{item.aiNote}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="font-bold text-gray-900 bg-gray-50">
                            <tr className="border-t-2 border-gray-300">
                                <td className="p-2">Total CapEx</td>
                                <td className="p-2 text-right">{formatCurrency(totalCapex)}</td>
                                <td colSpan="4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              </div>
            </div>
          )}

          {/* --- MODULE: Multi-Year Plan --- */}
          {activeTab === "multi_year_plan" && (
            <div className="space-y-6">
                <KPICard title="3-Year Strategic Plan" value="FY26 - FY28" icon={<FiBarChart2 />} aiNote="High-level financial projections based on macro-economic and business growth drivers." />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-sky-900 mb-4">High-Level Growth Drivers</h3>
                        <div className="space-y-4 text-s">
                            {['revenueGrowth', 'grossMargin', 'opexAsRevenue', 'fteGrowth'].map(driverKey => (
                                <div key={driverKey}>
                                    <label className="font-medium text-gray-700 capitalize">{driverKey.replace(/([A-Z])/g, ' $1')}</label>
                                    <div className="grid grid-cols-3 gap-2 mt-1">
                                        {Object.keys(multiYearPlan.drivers[driverKey]).map(year => (
                                            <div key={year}>
                                                <span className="text-x text-gray-500">{`FY${year}`}</span>
                                                <div className="flex items-center">
                                                    <input type="number" value={multiYearPlan.drivers[driverKey][year]} onChange={e => handleMultiYearPlanChange(driverKey, year, e.target.value)} className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-sky-500" />
                                                    <span className="ml-1 font-medium">%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-sky-900 mb-4">Projected 3-Year P&L</h3>
                        <table className="w-full text-s">
                            <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
                                <tr>
                                    <th className="p-2">Metric</th>
                                    <th className="p-2 text-right">FY2026</th>
                                    <th className="p-2 text-right">FY2027</th>
                                    <th className="p-2 text-right">FY2028</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                  {label: 'Revenue', values: [15.2, 18.5, 22.2]},
                                  {label: 'Gross Profit', values: [10.2, 12.6, 15.3]},
                                  {label: 'Operating Expense', values: [6.5, 7.6, 8.4]},
                                  {label: 'Net Income', values: [3.7, 5.0, 6.9]},
                                ].map(row => (
                                    <tr key={row.label} className="border-b border-gray-100">
                                        <td className="p-2 font-medium">{row.label}</td>
                                        <td className="p-2 text-right">{formatCurrency(row.values[0] * 1e6, true)}</td>
                                        <td className="p-2 text-right">{formatCurrency(row.values[1] * 1e6, true)}</td>
                                        <td className="p-2 text-right">{formatCurrency(row.values[2] * 1e6, true)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-x text-blue-800 flex items-start">
                           <BsStars className="mr-2 mt-0.5 flex-shrink-0" />
                           <span>AI Insight: Projections are based on your drivers. The model suggests a slightly more conservative revenue growth in FY28 due to market saturation benchmarks.</span>
                        </div>
                    </div>
                </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
      
      <ReactTooltip id="info-tooltip" className="max-w-xs text-x z-50" />
    </div>
  );
};

export default RevenueBasedBudgeting;