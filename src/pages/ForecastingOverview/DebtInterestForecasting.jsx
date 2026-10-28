
import React, { useState, useRef, useEffect } from "react";
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
  Filler // Added for area fill in charts if needed
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { FiFilter, FiDollarSign, FiClock, FiCheckCircle, FiSave, FiUpload, FiDownload, FiPrinter, FiRefreshCw, FiCreditCard, FiTrendingUp } from "react-icons/fi"; // Added more icons
import { BsStars, BsThreeDotsVertical, BsFilter as BsFilterIcon, BsCheckCircle, BsClock as BsClockIcon, BsXCircle } from 'react-icons/bs'; // Renamed BsFilter to BsFilterIcon
import { Tooltip as ReactTooltip } from 'react-tooltip'; // Renamed to avoid conflict
import { getDecimalPrecision } from '../../utils/formatters';

// Register ChartJS components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler
);

const DebtInterestForecasting = () => {
  const [activeTab, setActiveTab] = useState("schedule");
  const [period, setPeriod] = useState("Q1 2025");
  const filtersRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [loans, setLoans] = useState([
    {
      id: 1, name: "Term Loan A", type: "Term Loan", principal: 500000, interestRate: 5.2, term: 60, startDate: "2023-01-01", remainingBalance: 420000,
      repaymentSchedule: [ { month: "Jan 2025", principal: 15000, interest: 1820, remaining: 405000 }, { month: "Feb 2025", principal: 15100, interest: 1800, remaining: 389900 }, { month: "Mar 2025", principal: 15200, interest: 1780, remaining: 374700 }, ],
      aiAdjustments: [ { month: "Jan 2025", principal: 15000, interest: 1820 }, { month: "Feb 2025", principal: 15100, interest: 1800 }, { month: "Mar 2025", principal: 15200, interest: 1780 }, ],
      userAdjustments: [ { month: "Jan 2025", principal: 0, interest: 0 }, { month: "Feb 2025", principal: 0, interest: 0 }, { month: "Mar 2025", principal: 0, interest: 0 }, ]
    },
    {
      id: 2, name: "Revolving Credit", type: "Line of Credit", principal: 1000000, interestRate: 6.5, term: 36, startDate: "2023-06-01", remainingBalance: 750000,
      repaymentSchedule: [ { month: "Jan 2025", principal: 25000, interest: 4062, remaining: 725000 }, { month: "Feb 2025", principal: 25500, interest: 3928, remaining: 699500 }, { month: "Mar 2025", principal: 26000, interest: 3789, remaining: 673500 }, ],
      aiAdjustments: [ { month: "Jan 2025", principal: 25000, interest: 4062 }, { month: "Feb 2025", principal: 25500, interest: 3928 }, { month: "Mar 2025", principal: 26000, interest: 3789 }, ],
      userAdjustments: [ { month: "Jan 2025", principal: 0, interest: 0 }, { month: "Feb 2025", principal: 0, interest: 0 }, { month: "Mar 2025", principal: 0, interest: 0 }, ]
    },
    {
      id: 3, name: "Equipment Financing", type: "Lease", principal: 300000, interestRate: 4.8, term: 48, startDate: "2024-01-01", remainingBalance: 280000,
      repaymentSchedule: [ { month: "Jan 2025", principal: 6250, interest: 1120, remaining: 273750 }, { month: "Feb 2025", principal: 6270, interest: 1105, remaining: 267480 }, { month: "Mar 2025", principal: 6290, interest: 1090, remaining: 261190 }, ],
      aiAdjustments: [ { month: "Jan 2025", principal: 6250, interest: 1120 }, { month: "Feb 2025", principal: 6270, interest: 1105 }, { month: "Mar 2025", principal: 6290, interest: 1090 }, ],
      userAdjustments: [ { month: "Jan 2025", principal: 0, interest: 0 }, { month: "Feb 2025", principal: 0, interest: 0 }, { month: "Mar 2025", principal: 0, interest: 0 }, ]
    }
  ]);

  const [refinancingScenarios, setRefinancingScenarios] = useState([
    { id: 1, name: "Current Terms", interestRate: 5.2, termExtension: 0, fees: 0, monthlyPayment: 9480, totalInterest: 68800, savings: 0 },
    { id: 2, name: "Bank Refinance Offer", interestRate: 4.5, termExtension: 12, fees: 5000, monthlyPayment: 8650, totalInterest: 59000, savings: 9800 },
    { id: 3, name: "Alternative Lender", interestRate: 4.8, termExtension: 6, fees: 3000, monthlyPayment: 8920, totalInterest: 63200, savings: 5600 }
  ]);

  const [creditUtilization, setCreditUtilization] = useState([
    { month: "Jan 2025", available: 500000, utilized: 250000, utilizationRate: 50 },
    { month: "Feb 2025", available: 500000, utilized: 275000, utilizationRate: 55 },
    { month: "Mar 2025", available: 500000, utilized: 300000, utilizationRate: 60 }
  ]);

  const [financialRatios, setFinancialRatios] = useState([
    { month: "Jan 2025", leverageRatio: 2.5, interestCoverage: 4.2, dscr: 1.8 },
    { month: "Feb 2025", leverageRatio: 2.4, interestCoverage: 4.5, dscr: 1.9 },
    { month: "Mar 2025", leverageRatio: 2.3, interestCoverage: 4.8, dscr: 2.0 }
  ]);

  const [versions, setVersions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // toNum, not a bare `+=`: a userAdjustments value can be the raw string
  // the user is mid-typing (see handleAdjustmentChange below), and
  // `0 + "<string>"` concatenates instead of adding.
  const toNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const calculateTotals = () => {
    const totals = { principal: 0, interest: 0, aiPrincipal: 0, aiInterest: 0, userPrincipal: 0, userInterest: 0, remainingBalance: 0 };
    loans.forEach(loan => {
      loan.repaymentSchedule.forEach(payment => { totals.principal += payment.principal; totals.interest += payment.interest; });
      loan.aiAdjustments.forEach(payment => { totals.aiPrincipal += payment.principal; totals.aiInterest += payment.interest; });
      loan.userAdjustments.forEach(payment => { totals.userPrincipal += toNum(payment.principal); totals.userInterest += toNum(payment.interest); });
      totals.remainingBalance += loan.remainingBalance;
    });
    return totals;
  };

  const [totals, setTotals] = useState(calculateTotals());

  useEffect(() => { setTotals(calculateTotals()); }, [loans]);

  const handleAdjustmentChange = (loanId, month, field, value) => {
    // Store exactly what the user typed — "", "13", "13.5" — instead of
    // collapsing it with `parseFloat(value) || 0` on every keystroke, which
    // rounds off a not-yet-finished decimal and fights Backspace-to-clear.
    // calculateTotals (toNum) resolves it to a real number wherever needed.
    setLoans(prevLoans => prevLoans.map(loan => {
        if (loan.id === loanId) {
          const updatedAdjustments = loan.userAdjustments.map(adj =>
            adj.month === month ? { ...adj, [field]: value } : adj
          );
          return { ...loan, userAdjustments: updatedAdjustments };
        }
        return loan;
      })
    );
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const timestamp = new Date().toISOString();
    setVersions(prev => [ ...prev, { period, timestamp, data: [...loans], totals: {...totals} }, ]);
    setHasChanges(false);
    alert("Debt forecast saved!");
  };

  const handleExport = () => { /* ... (export logic remains the same) ... */ 
    const exportData = loans.map(loan => ({
      'Loan Name': loan.name, 'Loan Type': loan.type, 'Principal': loan.principal, 'Remaining Balance': loan.remainingBalance, 'Interest Rate': loan.interestRate,
      'Jan Principal (AI)': loan.aiAdjustments[0].principal, 'Jan Principal (User)': loan.userAdjustments[0].principal, 'Jan Interest (AI)': loan.aiAdjustments[0].interest, 'Jan Interest (User)': loan.userAdjustments[0].interest,
      'Feb Principal (AI)': loan.aiAdjustments[1].principal, 'Feb Principal (User)': loan.userAdjustments[1].principal, 'Feb Interest (AI)': loan.aiAdjustments[1].interest, 'Feb Interest (User)': loan.userAdjustments[1].interest,
      'Mar Principal (AI)': loan.aiAdjustments[2].principal, 'Mar Principal (User)': loan.userAdjustments[2].principal, 'Mar Interest (AI)': loan.aiAdjustments[2].interest, 'Mar Interest (User)': loan.userAdjustments[2].interest,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Debt Forecast");
    const fileName = `Debt_Forecast_${period.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };
  const handleImport = async (e) => { /* ... (import logic remains the same) ... */ 
    alert("Import functionality would be implemented here."); e.target.value = '';
  };

  const repaymentChartData = {
    labels: loans[0]?.repaymentSchedule.map(p => p.month) || [], // Added fallback for empty loans
    datasets: [
      { label: "Principal Payments (AI)", data: loans[0]?.aiAdjustments.map(p => p.principal) || [], backgroundColor: "rgba(16, 185, 129, 0.6)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 1, },
      { label: "Principal Payments (User)", data: loans[0]?.userAdjustments.map(p => p.principal) || [], backgroundColor: "rgba(239, 68, 68, 0.6)", borderColor: "rgba(239, 68, 68, 1)", borderWidth: 1, },
      { label: "Interest Payments (AI)", data: loans[0]?.aiAdjustments.map(p => p.interest) || [], backgroundColor: "rgba(14, 165, 233, 0.6)", borderColor: "rgba(14, 165, 233, 1)", borderWidth: 1, },
      { label: "Interest Payments (User)", data: loans[0]?.userAdjustments.map(p => p.interest) || [], backgroundColor: "rgba(245, 158, 11, 0.6)", borderColor: "rgba(245, 158, 11, 1)", borderWidth: 1, },
    ],
  };

  const utilizationChartData = { /* ... same ... */ 
    labels: creditUtilization.map(u => u.month),
    datasets: [
      { label: "Available Credit", data: creditUtilization.map(u => u.available), backgroundColor: "rgba(16, 185, 129, 0.2)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 2, tension: 0.4, fill: true },
      { label: "Utilized Credit", data: creditUtilization.map(u => u.utilized), backgroundColor: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 1)", borderWidth: 2, tension: 0.4, fill: true },
    ],
  };
  const ratiosChartData = { /* ... same ... */
    labels: financialRatios.map(r => r.month),
    datasets: [
      { label: "Leverage Ratio", data: financialRatios.map(r => r.leverageRatio), borderColor: "rgba(14, 165, 233, 1)", backgroundColor: "rgba(14, 165, 233, 0.1)", borderWidth: 2, tension: 0.4, yAxisID: 'y', fill: true},
      { label: "Interest Coverage", data: financialRatios.map(r => r.interestCoverage), borderColor: "rgba(16, 185, 129, 1)", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, tension: 0.4, yAxisID: 'y1', fill: true},
      { label: "DSCR", data: financialRatios.map(r => r.dscr), borderColor: "rgba(245, 158, 11, 1)", backgroundColor: "rgba(245, 158, 11, 0.1)", borderWidth: 2, tension: 0.4, yAxisID: 'y1', fill: true},
    ],
  };
  
  const mainTabsConfig = [
    { id: "schedule", label: "Repayment Schedule", icon: FiClock },
    { id: "refinancing", label: "Refinancing Scenarios", icon: FiRefreshCw },
    { id: "utilization", label: "Credit Utilization", icon: FiCreditCard },
    { id: "ratios", label: "Financial Ratios", icon: FiTrendingUp },
    // { id: "create", label: "Create Forecast", icon: FiDollarSign }, // Can be added if distinct from schedule
    // { id: "import", label: "Import Data", icon: FiUpload },
    // { id: "compare", label: "Compare Versions", icon: FiGitMerge },
  ];


  return (
    <div className="forecasting-pnl-theme space-y-6 p-4 min-h-screen relative bg-sky-50">
      <div className="bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white"><FiDollarSign className="mr-2 inline-block" />Debt & Interest Forecasting</h1>
            <p className="text-sky-100 text-x">Manage liabilities, debt structuring, and interest payments.</p>
          </div>
          <div className="flex items-center space-x-4">
            <div>
              <label className="text-s text-white font-medium mr-2">Forecast Period:</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="p-1.5 border bg-sky-50 text-sky-900 border-sky-200 rounded-md text-x focus:ring-sky-500 focus:border-sky-500">
                <option>Q1 2025</option><option>Q2 2025</option><option>Q3 2025</option><option>Q4 2025</option>
              </select>
            </div>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50">
                <FiPrinter /> Print Page
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-gray-200 mb-6 pb-0">
          {mainTabsConfig.map(tabInfo => (
            <button 
              key={tabInfo.id} 
              onClick={() => setActiveTab(tabInfo.id)} 
              className={`flex items-center py-3 px-4 font-medium text-s rounded-t-lg -mb-px 
                          ${activeTab === tabInfo.id 
                            ? "text-sky-50 border-b-2 border-sky-600 bg-sky-800" 
                            : "text-sky-700 hover:text-sky-500 hover:bg-sky-100 border-b-2 border-transparent"
                          }`}
            >
              <tabInfo.icon className="mr-2 h-4 w-4" /> {tabInfo.label}
            </button>
          ))}
        <div className="relative ml-auto" ref={filtersRef}>
          <button onClick={() => setShowFilters(!showFilters)} className="py-2 px-3 text-gray-500 hover:text-blue-500 flex items-center text-s mb-px">
            <BsFilterIcon className="mr-1" /> Filters
          </button>
          {showFilters && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2"> {/* Increased z-index */}
              <div className="py-1">
                <label className="block text-x text-gray-700 mb-1">Time Period</label>
                <select className="w-full p-1 border border-gray-300 rounded text-x"><option>Next 3 Months</option><option>Next 6 Months</option></select>
              </div>
              <div className="py-1">
                <label className="block text-x text-gray-700 mb-1">Loan Type</label>
                <select className="w-full p-1 border border-gray-300 rounded text-x"><option>All Loans</option><option>Term Loans</option></select>
              </div>
              <button className="mt-2 w-full py-1 bg-blue-600 text-white rounded text-x">Apply Filters</button>
            </div>
          )}
        </div>
      </div>

      {/* Content based on activeTab */}
      {activeTab === "schedule" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"> {/* Changed md to lg for breakpoint */}
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-gray-200"> {/* Adjusted padding */}
              <h2 className="text-lg font-semibold text-sky-900 mb-4">Debt Summary</h2>
              <div className="space-y-3">
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                  <p className="text-x font-medium text-sky-600">Total Debt Outstanding</p>
                  <p className="text-xl font-bold text-sky-800">${totals.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
                </div>
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                  <p className="text-x font-medium text-sky-600">Total Principal Payments (Period)</p>
                  <p className="text-xl font-bold text-sky-800">${totals.principal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
                </div>
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                  <p className="text-x font-medium text-sky-600">Total Interest Payments (Period)</p>
                  <p className="text-xl font-bold text-sky-800">${totals.interest.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-200"> {/* Adjusted padding */}
              <h2 className="text-lg font-semibold text-sky-900 mb-4">Repayment Trend (Loan: {loans[0]?.name || 'N/A'})</h2>
              <div className="h-[280px]"> {/* Adjusted height */}
                <Bar data={repaymentChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false }, }, scales: { y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, title: { display: true, text: "Amount ($)" } }, x: { grid: { display: false }, title: { display: true, text: "Month" } }, }, }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg mt-5 border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                <h2 className="text-lg font-semibold text-sky-900">Loan Repayment Schedule & Adjustments</h2>
                <div className="flex space-x-2 mt-3 sm:mt-0">
                  {/* <label className="px-3 py-1.5 bg-blue-600 text-white text-x rounded-lg hover:bg-blue-700 cursor-pointer flex items-center"><FiDownload className="mr-1.5"/>Import<input type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden"/></label> */}
                  <button onClick={handleExport} className="px-3 py-1.5 bg-green-600 text-white text-x rounded-lg hover:bg-green-700 flex items-center"><FiUpload className="mr-1.5"/>Export</button>
                </div>
              </div>
              
              <div className="analytics-table-scroll overflow-x-auto max-h-[calc(100vh-200px)] relative"> {/* Adjusted max-h */}
                <table className="min-w-full divide-y divide-sky-100">
                  <thead className="bg-sky-50 sticky top-0 z-20"> {/* Increased z-index for thead */}
                    <tr>
                      <th className="px-3 py-3 text-left text-x font-semibold text-sky-900 uppercase sticky left-0 bg-sky-50 z-30 min-w-[180px]">Loan Name</th> {/* Increased z-index */}
                      <th className="px-3 py-3 text-left text-x font-semibold text-sky-700 uppercase min-w-[100px]">Type</th>
                      <th className="px-3 py-3 text-right text-x font-semibold text-sky-700 uppercase min-w-[150px]">Rem. Balance</th>
                      {["Jan 2025", "Feb 2025", "Mar 2025"].map(month => ( // Assuming these months, make dynamic if needed
                        <React.Fragment key={month}>
                            <th className="px-3 py-3 text-center text-x font-semibold text-sky-700 uppercase min-w-[100px] border-l border-sky-200">{month} (AI)</th>
                            <th className="px-3 py-3 text-center text-x font-semibold text-blue-600 uppercase min-w-[120px]">{month} (User Adj.)</th>
                        </React.Fragment>
                      ))}
                    </tr>
                     <tr className="bg-sky-100 sticky top-[48px] z-20"> {/* Sub-header, ensure top value is correct */}
                        <th className="sticky left-0 bg-sky-100 z-30"></th>
                        <th className="bg-sky-100"></th>
                        <th className="bg-sky-100"></th>
                        {["Jan 2025", "Feb 2025", "Mar 2025"].map(month => (
                            <React.Fragment key={`${month}-sub`}>
                                <th className="px-2 py-2 text-x font-medium text-sky-700 bg-sky-100 text-center border-l border-sky-200">P / I</th>
                                <th className="px-2 py-2 text-x font-medium text-blue-600 bg-sky-100 text-center">P / I</th>
                            </React.Fragment>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {loans.map((loan, index) => {
                        const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-sky-50/70";
                        return (
                        <tr key={loan.id} className={`${rowBgClass} hover:bg-sky-100/40`}>
                            <td className={`px-3 py-2.5 text-s sticky left-0 z-[5] ${rowBgClass}`}>
                                <div className="font-semibold text-sky-900">{loan.name}</div>
                                <div className="text-x text-sky-600">Rate: {loan.interestRate}%</div>
                            </td>
                            <td className="px-3 py-2.5 text-s text-sky-800">{loan.type}</td>
                            <td className="px-3 py-2.5 text-s text-sky-800 text-right">${loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                            
                            {loan.repaymentSchedule.map((pmt, pmtIdx) => (
                                <React.Fragment key={`${loan.id}-${pmt.month}`}>
                                    <td className="px-2 py-2 text-s text-sky-800 border-l border-sky-200">
                                        <div className="text-right">${loan.aiAdjustments[pmtIdx].principal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                                        <div className="text-right text-x text-gray-500">${loan.aiAdjustments[pmtIdx].interest.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                                    </td>
                                    <td className="px-2 py-2 text-s text-sky-800">
                                        <input type="number" placeholder="P" value={loan.userAdjustments[pmtIdx].principal || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleAdjustmentChange(loan.id, pmt.month, "principal", e.target.value)} className="w-full mb-1 p-1 border border-sky-300 rounded text-x text-right focus:ring-1 focus:ring-sky-500 bg-white"/>
                                        <input type="number" placeholder="I" value={loan.userAdjustments[pmtIdx].interest || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleAdjustmentChange(loan.id, pmt.month, "interest", e.target.value)} className="w-full p-1 border border-sky-300 rounded text-x text-right focus:ring-1 focus:ring-sky-500 bg-white"/>
                                    </td>
                                </React.Fragment>
                            ))}
                        </tr>
                        );
                    })}
                    <tr className="bg-sky-100 font-semibold sticky bottom-0 z-10">
                      <td className="px-3 py-3 text-s text-sky-900 sticky left-0 bg-sky-100 z-[15]">Total</td>
                      <td className="px-3 py-3 text-s text-sky-900 bg-sky-100"></td>
                      <td className="px-3 py-3 text-s text-sky-900 bg-sky-100 text-right">${totals.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      {["Jan 2025", "Feb 2025", "Mar 2025"].map((month, idx) => ( // Assuming 3 months
                        <React.Fragment key={`total-${month}`}>
                            <td className="px-2 py-3 text-s text-sky-900 bg-sky-200 text-right border-l border-sky-300">
                                <div>${loans.reduce((sum, l) => sum + toNum(l.aiAdjustments[idx]?.principal), 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                                <div className="text-x">${loans.reduce((sum, l) => sum + toNum(l.aiAdjustments[idx]?.interest), 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                            </td>
                            {/* toNum, not `|| 0`: userAdjustments can hold the raw string the
                                user is mid-typing, and `0 + "<string>"` concatenates instead of
                                adding — this total must also stay live as edits happen. */}
                            <td className="px-2 py-3 text-s text-sky-900 bg-sky-200 text-right">
                                <div>${loans.reduce((sum, l) => sum + toNum(l.userAdjustments[idx]?.principal), 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                                <div className="text-x">${loans.reduce((sum, l) => sum + toNum(l.userAdjustments[idx]?.interest), 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</div>
                            </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button onClick={handleSaveAll} disabled={!hasChanges} className={`px-6 py-2.5 text-s font-medium rounded-lg flex items-center transition-colors ${hasChanges ? "bg-sky-600 text-white hover:bg-sky-700 shadow-md" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}><FiSave className="mr-2"/>Save All Changes</button>
            </div>
          </div>
        </>
      )}

      {activeTab === "refinancing" && ( /* Refinancing Scenarios Tab */
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-sky-900 mb-6">Refinancing Scenario Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {refinancingScenarios.map((scenario) => (
              <div key={scenario.id} className="bg-sky-50 border border-sky-200 rounded-lg p-5 hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-lg font-semibold text-sky-800 mb-3 flex items-center"><FiRefreshCw className="mr-2"/>{scenario.name}</h3>
                <div className="space-y-1.5 text-s">
                  <div className="flex justify-between"><span className="text-sky-600">Interest Rate:</span> <span className="font-medium text-sky-800">{scenario.interestRate}%</span></div>
                  <div className="flex justify-between"><span className="text-sky-600">Term Extension:</span> <span className="font-medium text-sky-800">{scenario.termExtension} mo</span></div>
                  <div className="flex justify-between"><span className="text-sky-600">Upfront Fees:</span> <span className="font-medium text-sky-800">${scenario.fees.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span></div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-sky-200"><span className="text-sky-600">New Mthly Pmt:</span> <span className="font-semibold text-sky-900">${scenario.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span></div>
                  <div className="flex justify-between"><span className="text-sky-600">Total Est. Interest:</span> <span className="font-semibold text-sky-900">${scenario.totalInterest.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-sky-600">Potential Savings:</span> <span className={`font-bold ${scenario.savings > 0 ? 'text-green-600' : scenario.savings < 0 ? 'text-red-600' : 'text-sky-800'}`}>${scenario.savings.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "utilization" && ( /* Credit Utilization Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-sky-900 mb-4">Credit Utilization Trend</h2>
            <div className="h-[300px]">
              <Line data={utilizationChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false }, }, scales: { y: { beginAtZero: true, title: { display: true, text: "Amount ($)" }, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { callback: function(value) { return '$' + value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });}}}, x: { title: { display: true, text: "Month" }, grid: { display: false },},},}} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-sky-900 mb-4">Utilization Details</h2>
            <div className="analytics-table-scroll overflow-x-auto max-h-[300px]">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50 sticky top-0 z-10"><tr><th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase">Month</th><th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase">Available</th><th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase">Utilized</th><th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase">Rate (%)</th></tr></thead>
                <tbody className="divide-y divide-sky-100 bg-white">
                  {creditUtilization.map((item, index) => (<tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}><td className="px-4 py-3 text-s text-sky-800">{item.month}</td><td className="px-4 py-3 text-s text-sky-800 text-right">${item.available.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td><td className="px-4 py-3 text-s text-sky-800 text-right">${item.utilized.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td><td className="px-4 py-3 text-s text-sky-800 text-right">{item.utilizationRate}%</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ratios" && ( /* Financial Ratios Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-sky-900 mb-4">Key Financial Ratios</h2>
             <div className="h-[300px]">
              <Line data={ratiosChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false }, }, scales: { x: { title: { display: true, text: "Month" }, grid: { display: false }, }, y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Ratio (Leverage)' }, grid: { color: "rgba(0,0,0,0.05)" }, }, y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Ratio (Coverage/DSCR)' }, grid: { drawOnChartArea: false }, }, }, }} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-sky-900 mb-4">Ratio Details</h2>
            <div className="analytics-table-scroll overflow-x-auto max-h-[300px]">
              <table className="min-w-full divide-y divide-sky-100">
                <thead className="bg-sky-50 sticky top-0 z-10"><tr><th className="px-4 py-3 text-left text-x font-semibold text-sky-900 uppercase">Month</th><th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase">Leverage</th><th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase">Interest Cov.</th><th className="px-4 py-3 text-right text-x font-semibold text-sky-700 uppercase">DSCR</th></tr></thead>
                <tbody className="divide-y divide-sky-100 bg-white">
                  {financialRatios.map((item, index) => (<tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-sky-50/70"}><td className="px-4 py-3 text-s text-sky-800">{item.month}</td><td className="px-4 py-3 text-s text-sky-800 text-right">{item.leverageRatio.toFixed(getDecimalPrecision())}</td><td className="px-4 py-3 text-s text-sky-800 text-right">{item.interestCoverage.toFixed(getDecimalPrecision())}</td><td className="px-4 py-3 text-s text-sky-800 text-right">{item.dscr.toFixed(getDecimalPrecision())}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <ReactTooltip id="ai-tooltip" />
    </div>
  );
};

export default DebtInterestForecasting;

