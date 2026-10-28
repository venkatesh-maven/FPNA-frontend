import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  BubbleController,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";
import { Bar, Bubble, Pie } from "react-chartjs-2";
import { FiSave, FiUpload, FiDownload, FiPrinter, FiInfo, FiChevronRight } from "react-icons/fi";
import { BsFilter } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, BubbleController, ArcElement, Title, Tooltip, Legend);

const SCENARIOS = {
  BASELINE: "Baseline",
  HIGH_ROI_FOCUS: "High-ROI Focus",
  BALANCED_INVESTMENT: "Balanced Investment",
};

const DECISION = {
  APPROVE: "Approve",
  DEFER: "Defer",
  REJECT: "Reject",
};

const CATEGORY = {
  IT: "IT",
  INFRA: "Infrastructure",
  RD: "R&D",
};

// Mock data for ROI-based CAPEX
const initialCapexData = [
  {
    project: "Warehouse Automation", category: CATEGORY.INFRA, cost: 1200000,
    [SCENARIOS.BASELINE]:        { roi: 25, payback: 48, aiScore: 85, aiAllocation: 1200000, userOverride: 1200000, decision: DECISION.APPROVE, aiInsight: "High ROI and efficiency gains. Meets all criteria." },
    [SCENARIOS.HIGH_ROI_FOCUS]:  { roi: 25, payback: 48, aiScore: 85, aiAllocation: 1200000, userOverride: 1200000, decision: DECISION.APPROVE, aiInsight: "Strong ROI, fits high-return strategy." },
    [SCENARIOS.BALANCED_INVESTMENT]:{ roi: 25, payback: 48, aiScore: 85, aiAllocation: 1200000, userOverride: 1200000, decision: DECISION.APPROVE, aiInsight: "Key project for operational efficiency." },
  },
  {
    project: "New Data Center", category: CATEGORY.IT, cost: 2000000,
    [SCENARIOS.BASELINE]:        { roi: 18, payback: 60, aiScore: 70, aiAllocation: 2000000, userOverride: 2000000, decision: DECISION.APPROVE, aiInsight: "Necessary for scaling, moderate ROI." },
    [SCENARIOS.HIGH_ROI_FOCUS]:  { roi: 18, payback: 60, aiScore: 70, aiAllocation: 0, userOverride: 0, decision: DECISION.DEFER, aiInsight: "ROI below the 20% threshold for this aggressive scenario." },
    [SCENARIOS.BALANCED_INVESTMENT]:{ roi: 18, payback: 60, aiScore: 70, aiAllocation: 2000000, userOverride: 2000000, decision: DECISION.APPROVE, aiInsight: "Fundamental for stability, approved despite moderate ROI." },
  },
  {
    project: "AI Research Initiative", category: CATEGORY.RD, cost: 800000,
    [SCENARIOS.BASELINE]:        { roi: 45, payback: 36, aiScore: 95, aiAllocation: 800000, userOverride: 800000, decision: DECISION.APPROVE, aiInsight: "High potential for future product lines." },
    [SCENARIOS.HIGH_ROI_FOCUS]:  { roi: 45, payback: 36, aiScore: 95, aiAllocation: 800000, userOverride: 800000, decision: DECISION.APPROVE, aiInsight: "Top priority due to very high ROI." },
    [SCENARIOS.BALANCED_INVESTMENT]:{ roi: 45, payback: 36, aiScore: 95, aiAllocation: 600000, userOverride: 600000, decision: DECISION.ADJUST, aiInsight: "Phased investment to balance with other needs." },
  },
];

const ROIBasedCapexAllocation = () => {
  const [activeTab, setActiveTab] = useState("prioritize");
  const [period, setPeriod] = useState("Q1 2025");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [capexData, setCapexData] = useState(JSON.parse(JSON.stringify(initialCapexData)));
  const [activeScenario, setActiveScenario] = useState(SCENARIOS.BASELINE);
  const [scenarioAssumptions, setScenarioAssumptions] = useState({
    [SCENARIOS.BASELINE]: "Standard ROI-based prioritization. Projects with ROI > 15% are considered. All core infrastructure projects are approved.",
    [SCENARIOS.HIGH_ROI_FOCUS]: "Aggressive focus on high returns. Only projects with ROI > 20% are approved, regardless of category. Aims to maximize financial returns.",
    [SCENARIOS.BALANCED_INVESTMENT]: "A portfolio approach. Ensures a mix of investments across IT, R&D, and Infrastructure, even if some have lower ROIs, to mitigate risk.",
  });

  const [capexVersions, setCapexVersions] = useState([]);
  const [capexTotals, setCapexTotals] = useState({});
  const filtersRef = useRef(null);

  const getScenarioDataItem = (item, scenarioKey) => {
    return item[scenarioKey] || { roi: 0, payback: 0, aiScore: 0, aiAllocation: 0, userOverride: 0, decision: DECISION.REJECT, aiInsight: "N/A" };
  };
  
  const calculateTotalsForScenario = (data, scenarioKey) => {
    const totals = { totalAllocation: 0, weightedRoi: 0, approvedCount: 0, totalRequested: 0, byCategory: {}, byRoiBand: { Low: 0, Medium: 0, High: 0 } };
    if (!data || data.length === 0) return totals;

    let totalRoiWeight = 0;

    data.forEach(item => {
      const scenarioData = getScenarioDataItem(item, scenarioKey);
      const finalAllocation = scenarioData.userOverride;
      
      if (scenarioData.decision !== DECISION.REJECT) {
        totals.totalAllocation += finalAllocation;
        totals.weightedRoi += scenarioData.roi * finalAllocation;
        totalRoiWeight += finalAllocation;
        totals.approvedCount++;

        if (scenarioData.roi < 20) totals.byRoiBand.Low += finalAllocation;
        else if (scenarioData.roi < 30) totals.byRoiBand.Medium += finalAllocation;
        else totals.byRoiBand.High += finalAllocation;
      }
      
      totals.byCategory[item.category] = (totals.byCategory[item.category] || 0) + finalAllocation;
    });
    
    totals.weightedRoi = totalRoiWeight > 0 ? totals.weightedRoi / totalRoiWeight : 0;
    
    return totals;
  };

  useEffect(() => {
    setCapexTotals(calculateTotalsForScenario(capexData, activeScenario));
  }, [capexData, activeScenario]);

  const handleInputChange = (index, field, value) => {
    setCapexData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const scenarioItem = newData[index][activeScenario];
      
      if(field === 'decision'){
        scenarioItem.decision = value;
        if(value === DECISION.REJECT) scenarioItem.userOverride = 0;
        if(value === DECISION.APPROVE) scenarioItem.userOverride = scenarioItem.aiAllocation;
      } else {
        scenarioItem[field] = parseFloat(value) || 0;
      }
      return newData;
    });
    setHasChanges(true);
  };
  
  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    const totalsByScenario = {};
    Object.values(SCENARIOS).forEach(scen => {
      totalsByScenario[scen] = calculateTotalsForScenario(capexData, scen);
    });
    setCapexVersions(prev => [...prev, { period, timestamp, data: JSON.parse(JSON.stringify(capexData)), totalsByScenario, assumptions: JSON.parse(JSON.stringify(scenarioAssumptions))}]);
    setHasChanges(false);
    alert("CAPEX plan version saved successfully!");
  };

  const handleExport = () => {
    const dataForExport = capexData.map(item => {
      const scenarioData = getScenarioDataItem(item, activeScenario);
      return {
        'Project': item.project, 'Category': item.category,
        'Cost': item.cost, 'ROI (%)': scenarioData.roi,
        'Payback (Months)': scenarioData.payback, 'Decision': scenarioData.decision,
        'Final Allocation': scenarioData.userOverride,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `CAPEX Plan`);
    XLSX.writeFile(workbook, `CAPEX_Plan_${activeScenario.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      const dataMap = new Map(capexData.map(d => [d.project, JSON.parse(JSON.stringify(d))]));
      jsonData.forEach(row => {
        const project = row['Project'];
        if (dataMap.has(project)) {
          const itemToUpdate = dataMap.get(project);
          const scenarioItem = getScenarioDataItem(itemToUpdate, activeScenario);
          scenarioItem.userOverride = row['Final Allocation'] ?? scenarioItem.userOverride;
          scenarioItem.decision = row['Decision'] ?? scenarioItem.decision;
          dataMap.set(project, itemToUpdate);
        }
      });
      setCapexData(Array.from(dataMap.values()));
      setHasChanges(true);
      alert(`Data for ${activeScenario} imported. Review changes.`);
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file.");
    }
  };
  
  const handleRestoreVersion = (version) => {
    setCapexData(JSON.parse(JSON.stringify(version.data)));
    setScenarioAssumptions(JSON.parse(JSON.stringify(version.assumptions)));
    setHasChanges(false);
    alert(`Version from ${new Date(version.timestamp).toLocaleString()} restored.`);
  };
  
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const barChartData = {
    labels: Object.keys(capexTotals.byRoiBand || {}),
    datasets: [{ label: 'Allocation by ROI Band', data: Object.values(capexTotals.byRoiBand || {}), backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(249, 115, 22, 0.7)', 'rgba(16, 185, 129, 0.7)'] }],
  };
  const pieChartData = {
    labels: Object.keys(capexTotals.byCategory || {}),
    datasets: [{ data: Object.values(capexTotals.byCategory || {}), backgroundColor: ['#3b82f6', '#10b981', '#f97316'], hoverOffset: 4 }],
  };
  const bubbleChartData = {
      datasets: capexData.map(item => {
          const scenarioData = getScenarioDataItem(item, activeScenario);
          return {
              label: item.project,
              data: [{
                  x: scenarioData.roi,
                  y: scenarioData.payback,
                  r: (scenarioData.userOverride / 100000)
              }],
              backgroundColor: `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.7)`
          }
      })
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
                to="/capex-budgeting"
                className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                CAPEX Budgeting
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                ROI Allocation
              </span>
            </div>
          </li>
        </ol>
      </nav>
      
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div><h1 className="text-lg font-bold text-white">ROI-Based CAPEX Allocation</h1><p className="text-sky-100 text-x">Prioritize capital projects based on expected returns.</p></div>
          <div className="flex items-center space-x-4">
             <div><label className="text-s text-white font-medium mr-2">Forecast Period:</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x"><option>Q1 2025</option><option>Q2 2025</option></select></div>
             <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors"><FiPrinter className="text-sky-50" /><span className="text-sky-50">Print</span></button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b mt-5 py-3 border-gray-200 mb-6">
        {[{id: 'prioritize', label: 'Prioritize CAPEX'}, {id: 'import', label: 'Import Projects'}, {id: 'compare', label: 'Compare Scenarios'}].map(tab => (
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
        {activeTab === 'prioritize' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Total CAPEX Allocation</p><p className="text-2xl font-bold text-sky-900">${(capexTotals?.totalAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Weighted Average ROI</p><p className="text-2xl font-bold text-green-600">{(capexTotals?.weightedRoi || 0).toFixed(getDecimalPrecision())}%</p></div>
              <div className="p-4 bg-white rounded-lg shadow-sm border"><p className="text-x font-medium text-sky-700">Approved Projects</p><p className="text-2xl font-bold text-sky-900">{capexTotals.approvedCount} / {capexData.length}</p></div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">Allocation by ROI Band</h2><div className="h-[250px]"><Bar data={barChartData} options={chartOptions}/></div></div>
                <div className="bg-white p-4 rounded-lg shadow-sm flex-1 border"><h2 className="text-lg font-semibold text-sky-900 mb-3">ROI vs. Payback vs. Size</h2><div className="h-[250px]"><Bubble data={bubbleChartData} options={{...chartOptions, plugins: { ...chartOptions.plugins, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ROI ${ctx.raw.x}%, Payback ${ctx.raw.y} mos` }}}}}/></div></div>
            </div>

            <div className="bg-white rounded-lg mt-5 shadow-sm overflow-hidden border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-sky-900">ROI Prioritization Editor ({activeScenario})</h2>
                  <div className="flex space-x-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiDownload className="mr-2" /> Export</button>
                    <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-4 py-2 text-s rounded-lg flex items-center ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2" /> Save Plan</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[calc(100vh-250px)] relative">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-20 min-w-[200px]">Project</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Cost</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">ROI (%)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px]">Payback (Mos)</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[150px]">AI Recommended</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">User Override</th>
                        <th className="px-4 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[130px]">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {capexData.map((item, index) => {
                        const scenarioData = getScenarioDataItem(item, activeScenario);
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                          <tr key={index} className={`${rowBgClass} hover:bg-sky-100/50`}>
                            <td className={`px-4 py-3 text-s font-medium text-sky-900 sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold">{item.project}</div><div className="text-x text-sky-600">{item.category}</div>
                            </td>
                            <td className="px-2 py-1 text-center text-s">${item.cost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            <td className="px-2 py-1 text-center text-s font-bold text-green-600">{scenarioData.roi}%</td>
                            <td className="px-2 py-1 text-center text-s">{scenarioData.payback}</td>
                            <td className="px-2 py-1 text-center text-s">
                                <div className="relative group">${scenarioData.aiAllocation.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} <FiInfo className="inline-block ml-1 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max p-1.5 text-x text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 z-30 pointer-events-none">{scenarioData.aiInsight}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1"><input type="number" step="10000" value={scenarioData.userOverride} onChange={(e) => handleInputChange(index, 'userOverride', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s text-center bg-white"/></td>
                            <td className="px-2 py-1"><select value={scenarioData.decision} onChange={(e) => handleInputChange(index, 'decision', e.target.value)} className="w-full p-1.5 border border-sky-300 rounded-md text-s bg-white">{Object.values(DECISION).map(d=><option key={d}>{d}</option>)}</select></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mb-6 mt-6 p-4 bg-sky-100/70 rounded-lg shadow-sm border">
                <label className="block text-md font-semibold text-sky-800 mb-2">ROI Assumptions for {activeScenario}:</label>
                <textarea value={scenarioAssumptions[activeScenario] || ''} onChange={(e) => { setScenarioAssumptions(prev => ({...prev, [activeScenario]: e.target.value})); setHasChanges(true); }} rows="3" className="w-full p-2 border border-sky-300 rounded-lg text-s bg-white" placeholder={`e.g., ROI thresholds, risk profiles...`} />
            </div>
          </>
        )}
        
        {activeTab === 'import' && (
          <div className="bg-white p-6 mt-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-sky-900 mb-4">Import Project ROI Data</h2>
            <p className="text-s text-gray-600 mb-4">Upload an Excel (.xlsx) or CSV (.csv) file with your project data. Match by 'Project'.</p>
            <div className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center">
              <FiUpload className="mx-auto text-4xl text-sky-500 mb-3" />
              <label htmlFor="importFile" className="px-6 py-3 bg-blue-600 text-white text-md font-medium rounded-lg hover:bg-blue-700 cursor-pointer">Choose File to Import</label>
              <input id="importFile" type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/>
              <p className="text-x text-gray-500 mt-3">File must contain 'Project', 'User Override', and 'Decision' columns.</p>
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
                  {['Total Allocation', 'Approved Projects', 'Weighted ROI', 'Assumptions'].map(metric => (
                    <tr key={metric} className={metric === 'Assumptions' ? 'align-top' : ''}>
                      <td className="px-5 py-4 whitespace-nowrap text-s font-medium text-sky-900">{metric}</td>
                      {Object.values(SCENARIOS).map(scenarioName => {
                        const totals = calculateTotalsForScenario(capexData, scenarioName);
                        let value, className = "text-s text-sky-700";
                        if (metric === 'Total Allocation') { value = `$${(totals.totalAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`; className = "text-s font-semibold text-sky-800"; }
                        else if (metric === 'Approved Projects') { value = `${totals.approvedCount} Projects`; }
                        else if (metric === 'Weighted ROI') { value = `${(totals.weightedRoi || 0).toFixed(getDecimalPrecision())}%`; className = "text-s font-semibold text-green-600"; }
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
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Plan Version History</h2>
          {capexVersions.length === 0 ? <p className="text-s text-gray-500">No versions saved yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Timestamp</th>
                    {Object.values(SCENARIOS).map(scen => <th key={scen} className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">{scen} Total Allocation</th>)}
                    <th className="px-4 py-3 text-left text-x font-medium text-sky-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {capexVersions.map((version, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}>
                      <td className="px-4 py-3 text-s text-sky-800">{new Date(version.timestamp).toLocaleString()}</td>
                      {Object.values(SCENARIOS).map(scen => {
                        const total = version.totalsByScenario?.[scen] || { totalBudget: 0 };
                        return <td key={`${index}-${scen}`} className="px-4 py-3 text-s font-semibold text-sky-800">${total.totalBudget.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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

export default ROIBasedCapexAllocation;