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
  RadarController,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Radar } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, RadialLinearScale, RadarController, Filler, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline (Balanced)",
  PRODUCT_FOCUSED: "Product-Focused",
  SALES_FOCUSED: "Sales-Focused",
};

const INVESTMENT_TYPE = {
  GROWTH: "Growth",
  MAINTENANCE: "Maintenance",
  INNOVATION: "Innovation",
};

// Mock data for investment trade-offs
const initialTradeOffData = [
  {
    department: "Product Dev", currentAllocation: 500000,
    [SCENARIOS.BASELINE]:        { aiAdjustment: 50000, userOverride: 50000, roi: 25, impact: "+1 new core feature", type: INVESTMENT_TYPE.INNOVATION, aiInsight: "Balanced investment to maintain roadmap velocity." },
    [SCENARIOS.PRODUCT_FOCUSED]: { aiAdjustment: 150000, userOverride: 150000, roi: 35, impact: "+3 new features, faster time-to-market", type: INVESTMENT_TYPE.INNOVATION, aiInsight: "Aggressive R&D to accelerate product leadership." },
    [SCENARIOS.SALES_FOCUSED]:   { aiAdjustment: -50000, userOverride: -50000, roi: 15, impact: "Roadmap delayed by 1 quarter", type: INVESTMENT_TYPE.MAINTENANCE, aiInsight: "Reduces budget to core maintenance to fund sales." },
  },
  {
    department: "Sales Team", currentAllocation: 400000,
    [SCENARIOS.BASELINE]:        { aiAdjustment: 40000, userOverride: 40000, roi: 40, impact: "+5% sales capacity", type: INVESTMENT_TYPE.GROWTH, aiInsight: "Standard headcount increase to meet demand." },
    [SCENARIOS.PRODUCT_FOCUSED]: { aiAdjustment: 0, userOverride: 0, roi: 30, impact: "Sales capacity remains flat", type: INVESTMENT_TYPE.MAINTENANCE, aiInsight: "Hiring freeze to reallocate funds to product." },
    [SCENARIOS.SALES_FOCUSED]:   { aiAdjustment: 100000, userOverride: 100000, roi: 55, impact: "+15% sales capacity, new market entry", type: INVESTMENT_TYPE.GROWTH, aiInsight: "Aggressive hiring to expand market coverage." },
  },
  {
    department: "Marketing", currentAllocation: 250000,
    [SCENARIOS.BASELINE]:        { aiAdjustment: 25000, userOverride: 25000, roi: 30, impact: "Supports 10% revenue growth", type: INVESTMENT_TYPE.GROWTH, aiInsight: "Standard marketing budget increase." },
    [SCENARIOS.PRODUCT_FOCUSED]: { aiAdjustment: 10000, userOverride: 10000, roi: 25, impact: "Focus on product marketing", type: INVESTMENT_TYPE.MAINTENANCE, aiInsight: "Budget shifts from demand-gen to product launch support." },
    [SCENARIOS.SALES_FOCUSED]:   { aiAdjustment: 50000, userOverride: 50000, roi: 45, impact: "Aggressive lead generation for new sales team", type: INVESTMENT_TYPE.GROWTH, aiInsight: "Increased spend needed to create pipeline for expanded sales team." },
  },
];

const InvestmentTradeOffs = () => {
  const [activeTab, setActiveTab] = useState("simulate");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [tradeOffData, setTradeOffData] = useState(JSON.parse(JSON.stringify(initialTradeOffData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "A balanced approach, distributing incremental budget across key departments to support stable, linear growth.",
    [SCENARIOS.PRODUCT_FOCUSED]: "Prioritizes long-term competitive advantage by heavily investing in R&D and product innovation, potentially at the cost of short-term sales growth.",
    [SCENARIOS.SALES_FOCUSED]: "Focuses on maximizing short-term revenue by aggressively expanding the sales team and marketing efforts, potentially delaying new product features.",
  });

  const [tradeOffVersions, setTradeOffVersions] = useState([]);
  const [tradeOffTotals, setTradeOffTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { aiAdjustment: 0, userOverride: 0, roi: 0, impact: "N/A", type: INVESTMENT_TYPE.MAINTENANCE, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { reallocated: 0, productRoi: 0, salesRoi: 0, byDepartment: {}, currentTotal: 0 };
    if (!data || data.length === 0) return totals;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      totals.reallocated += scenarioData.userOverride;
      totals.currentTotal += item.currentAllocation;
      
      if(item.department === "Product Dev") totals.productRoi = scenarioData.roi;
      if(item.department === "Sales Team") totals.salesRoi = scenarioData.roi;

      totals.byDepartment[item.department] = { current: item.currentAllocation, final: item.currentAllocation + scenarioData.userOverride };
    });
    return totals;
  };

  useEffect(() => {
    setTradeOffTotals(calculateTotalsForScenario(tradeOffData, activeScenario));
  }, [tradeOffData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setTradeOffData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      scenarioItem[field] = field === 'userOverride' ? (parseFloat(value) || 0) : value;
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
      totalsByScenario[scen] = calculateTotalsForScenario(tradeOffData, scen);
    });
    setTradeOffVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(tradeOffData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("Investment model version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = tradeOffData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Department': item.department,
        'Current Allocation': item.currentAllocation,
        'User Override': scenarioData.userOverride,
        'Final Allocation': item.currentAllocation + scenarioData.userOverride,
        'Projected ROI (%)': scenarioData.roi,
        'Business Impact': scenarioData.impact,
        'Investment Type': scenarioData.type,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Investment Trade-Offs`);
    XLSX.writeFile(workbook, `Investment_TradeOffs_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(tradeOffData.map(d => [d.department, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const dept = row['Department'];
        if (dataMap.has(dept)) {
          const itemToUpdate = dataMap.get(dept);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userOverride = row['User Override'] ?? scenarioItem.userOverride;
          scenarioItem.type = row['Investment Type'] ?? scenarioItem.type;
          dataMap.set(dept, itemToUpdate);
        }
      });
      setTradeOffData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setTradeOffData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(tradeOffTotals.byDepartment || {}),
    datasets: [
        { label: 'Current Allocation', data: Object.values(tradeOffTotals.byDepartment || {}).map(d => d.current), backgroundColor: 'rgba(156, 163, 175, 0.7)' },
        { label: 'Final Allocation', data: Object.values(tradeOffTotals.byDepartment || {}).map(d => d.final), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
    ]
  };

  const lineChartData = {
    labels: tradeOffData.map(d => d.department),
    datasets: [{
        label: 'Projected ROI (%)',
        data: tradeOffData.map(d => getScenarioDataItem(d, activeScenario).roi),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: true,
        tension: 0.1,
    }]
  };

  const radarChartData = {
      labels: ['Growth', 'Maintenance', 'Innovation'],
      datasets: [{
          label: 'Risk/Return Profile',
          data: [65, 59, 80],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
      }]
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
                to="/scenario-modelling-budgeting"
                className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Scenario Modelling
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                Investment Trade-Offs
              </span>
            </div>
          </li>
        </ol>
      </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">Investment Trade-Offs</h1><p className="text-sky-100 text-x">Should we allocate more budget to product development or sales?</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'simulate', label: 'Simulate Investments'}, {id: 'import', label: 'Import Models'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'simulate' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total Budget Reallocated</p><p className={`text-2xl font-bold ${(tradeOffTotals.reallocated || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${(tradeOffTotals.reallocated || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">ROI Projection (Product vs Sales)</p><p className="text-2xl font-bold text-sky-900">{(tradeOffTotals.productRoi || 0)}% vs {(tradeOffTotals.salesRoi || 0)}%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Risk/Reward Index</p><p className="text-2xl font-bold text-sky-900">7.8 / 10</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Budget Allocation by Focus Area</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">ROI Trend Across Departments</h2><div className="h-[250px]"><Line data={lineChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Risk vs. Return Profile</h2><div className="h-[250px]"><Radar data={radarChartData} options={chartOptions}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">Trade-Off Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Model</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[150px]">Department</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">Current Budget</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Adjustment</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[120px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Est. ROI</th>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[250px]">Business Impact</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">Investment Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {tradeOffData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-semibold text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>{item.department}</td>
                            <td className="px-2 py-1 text-center text-s">${item.currentAllocation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiAdjustment.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" step="5000" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1 text-center text-s font-bold text-green-600">{scenarioData.roi}%</td>
                            <td className="px-4 py-3 text-s text-left text-sky-800">{scenarioData.impact}</td>
                            <td className="px-2 py-1"><select value={scenarioData.type} onChange={(e) => handleInputChange(index, 'type', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">{Object.values(INVESTMENT_TYPE).map(t=><option key={t}>{t}</option>)}</select></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">Decision Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., Rationale for trade-offs, investment priorities...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Trade-Off Models</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your investment model data. Match by 'Department'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Department', 'User Override', and 'Investment Type' columns.</p>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-6">Compare Investment Scenarios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">Metric</th>
                    {Object.values(SCENARIOS).map(name => <th key={name} className="px-5 py-3 text-left text-x font-semibold text-sky-800 uppercase">{name}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-100">
                  {['Total Reallocated', 'Final Budget', 'Product ROI', 'Sales ROI', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(tradeOffData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total Reallocated') { value = `$${(totals.reallocated || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = `text-s font-semibold ${(totals.reallocated || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`; }
                        else if (metric === 'Final Budget') { value = `$${(totals.currentTotal + totals.reallocated).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; }
                        else if (metric === 'Product ROI') { value = `${totals.productRoi || 0}%`; }
                        else if (metric === 'Sales ROI') { value = `${totals.salesRoi || 0}%`; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Model Version History</h2>
          {tradeOffVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Reallocation</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {tradeOffVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { reallocated: 0 };
                        return <td key={`${index}-${scen}`} className={`px-4 py-3 text-s font-semibold ${total.reallocated >= 0 ? 'text-green-600' : 'text-red-600'}`}>${total.reallocated.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default InvestmentTradeOffs;