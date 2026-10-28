import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronRight, FiDownload, FiSend, FiFileText } from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";

// Detail / drill-down page reached from every "Analyze" / "View More" action
// in the Recruitment Performance Analytics module (PDF section 13).

const kpiData = [
  { title: "Revenue", value: "$12,800,000", change: "+8.4%", isPositive: true, aiSuggestion: "Revenue is ahead of plan. Watch Acme Corporation concentration risk (18.2% of total)." },
  { title: "Gross Margin %", value: "31.6%", change: "-1.8 pts", isPositive: false, aiSuggestion: "Pay-rate increases and bench time are compressing margin. Review 5 placements below 28% GM." },
  { title: "Active Contractors", value: "486", change: "+29 QTD", isPositive: true, aiSuggestion: "Headcount growth is healthy; ensure recruiter capacity keeps pace." },
  { title: "Revenue per Recruiter", value: "$376,000", change: "+5.2%", isPositive: true, aiSuggestion: "Team average is trending up; Anita Rao and David Kim remain below the $650K target." },
  { title: "Rehire %", value: "28.4%", change: "+4.2 pts", isPositive: true, aiSuggestion: "Rehire recovery is reducing sourcing cost; 38 rehire-ready candidates match open requisitions." },
  { title: "Cost per Start", value: "$4,860", change: "+6.3%", isPositive: false, aiSuggestion: "Cost per start is rising faster than starts. Evaluate job-board spend efficiency." },
];

const recruiterScorecard = [
  { name: "Priya Shah", score: 88, starts: 14, revenue: "$812,000", gm: "35.2%", fillRate: "88%", timeToFill: "24 days", rehire: "41.7%", status: "Top" },
  { name: "Michael Lee", score: 76, starts: 12, revenue: "$705,000", gm: "32.8%", fillRate: "80%", timeToFill: "29 days", rehire: "28.6%", status: "On plan" },
  { name: "Anita Rao", score: 61, starts: 11, revenue: "$684,000", gm: "29.4%", fillRate: "71%", timeToFill: "36 days", rehire: "15.8%", status: "Margin risk" },
  { name: "David Kim", score: 54, starts: 8, revenue: "$472,000", gm: "31.1%", fillRate: "65%", timeToFill: "41 days", rehire: "22.0%", status: "Attention" },
];

const clientRevenue = [
  { client: "Acme Corporation", revenue: "$2,330,000", growth: "+12.0%", gm: "29.1%", openReq: 24, starts: 19, revenueAtRisk: "$180,000" },
  { client: "Globex Inc", revenue: "$1,860,000", growth: "+6.4%", gm: "33.5%", openReq: 18, starts: 14, revenueAtRisk: "$0" },
  { client: "Initech", revenue: "$1,540,000", growth: "-2.1%", gm: "31.0%", openReq: 12, starts: 9, revenueAtRisk: "$95,000" },
  { client: "Umbrella Corp", revenue: "$1,280,000", growth: "+4.8%", gm: "34.2%", openReq: 9, starts: 7, revenueAtRisk: "$0" },
];

const requisitions = [
  { id: "R-4410", client: "Acme Corporation", role: "Sr. Data Engineer", recruiter: "Anita Rao", status: "Open", daysOpen: 48, billRate: "$92/hr", payRate: "$71/hr", gm: "22.8%" },
  { id: "R-4423", client: "Globex Inc", role: "QA Manager", recruiter: "David Kim", status: "Open", daysOpen: 37, billRate: "$68/hr", payRate: "$54/hr", gm: "20.6%" },
  { id: "R-4431", client: "Initech", role: "Platform Engineer", recruiter: "Michael Lee", status: "Interviewing", daysOpen: 31, billRate: "$88/hr", payRate: "$70/hr", gm: "20.5%" },
  { id: "R-4438", client: "Acme Corporation", role: "Business Analyst", recruiter: "Anita Rao", status: "Open", daysOpen: 26, billRate: "$75/hr", payRate: "$60/hr", gm: "20.0%" },
  { id: "R-4442", client: "Umbrella Corp", role: "Frontend Engineer", recruiter: "Priya Shah", status: "Offer Extended", daysOpen: 19, billRate: "$85/hr", payRate: "$65/hr", gm: "23.5%" },
];

const rehirePool = [
  { candidate: "J. Alvarez", lastAssignment: "Acme Corporation — Data Engineer", gapDays: 22, matchScore: "94%", openReq: "Acme Corporation — Sr. Data Engineer" },
  { candidate: "S. Okafor", lastAssignment: "Globex Inc — QA Lead", gapDays: 45, matchScore: "89%", openReq: "Globex Inc — QA Manager" },
  { candidate: "R. Chen", lastAssignment: "Initech — DevOps", gapDays: 12, matchScore: "91%", openReq: "Initech — Platform Engineer" },
  { candidate: "M. Patel", lastAssignment: "Acme Corporation — BA", gapDays: 60, matchScore: "82%", openReq: "Acme Corporation — Business Analyst" },
];

const tabs = [
  { id: "kpis", label: "KPIs" },
  { id: "recruiters", label: "Recruiter Scorecard" },
  { id: "clients", label: "Client Revenue" },
  { id: "requisitions", label: "Requisitions / Placements" },
  { id: "rehire", label: "Rehire-Ready Pool" },
];

const aiSuggestions = {
  kpis: "Revenue and rehire % are trending favorably; gross margin is compressing due to pay-rate increases and bench time — prioritize the 5 at-risk placements.",
  recruiters: "Priya Shah is the top performer on the composite score. Anita Rao and David Kim need coaching on conversion speed and margin discipline.",
  clients: "Acme Corporation drives the largest share of revenue at risk; review overtime billing and rate-card exceptions before the next renewal.",
  requisitions: "Four of five open requisitions shown are aging past the 25-day policy threshold — escalate sourcing support for Acme Corporation and Globex Inc.",
  rehire: "38 rehire-ready candidates match current open requisitions; contacting the top matches first could accelerate starts by 10-15 days.",
};

const dataByTab = {
  kpis: kpiData.map((k) => ({ Metric: k.title, Value: k.value, "Change vs Plan": k.change })),
  recruiters: recruiterScorecard,
  clients: clientRevenue,
  requisitions: requisitions,
  rehire: rehirePool,
};

const RecruitmentPerformanceTable = () => {
  const [activeTab, setActiveTab] = useState("kpis");
  const [aiInput, setAiInput] = useState("");
  const [aiResponses, setAiResponses] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(false);

  const getCurrentData = () => dataByTab[activeTab] || [];

  const exportToExcel = (data, sheetName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `recruitment_${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleAskAI = () => {
    if (!aiInput.trim()) return;
    const mockResponse = `AI analysis for ${activeTab}: ${aiSuggestions[activeTab]}`;
    setAiResponses((prev) => ({ ...prev, [activeTab]: [...(prev[activeTab] || []), { query: aiInput, response: mockResponse }] }));
    setAiInput("");
    setShowAIDropdown(false);
  };

  const columns = {
    kpis: ["Metric", "Value", "Change vs Plan"],
    recruiters: ["name", "score", "starts", "revenue", "gm", "fillRate", "timeToFill", "rehire", "status"],
    clients: ["client", "revenue", "growth", "gm", "openReq", "starts", "revenueAtRisk"],
    requisitions: ["id", "client", "role", "recruiter", "status", "daysOpen", "billRate", "payRate", "gm"],
    rehire: ["candidate", "lastAssignment", "gapDays", "matchScore", "openReq"],
  };

  const columnLabels = {
    name: "Recruiter", score: "Score", starts: "Starts", revenue: "Revenue", gm: "GM %", fillRate: "Fill Rate", timeToFill: "Time-to-Fill", rehire: "Rehire %", status: "Status",
    client: "Client", growth: "Growth %", openReq: "Open Req.", revenueAtRisk: "Revenue at Risk",
    id: "Req ID", role: "Role", recruiter: "Recruiter", daysOpen: "Days Open", billRate: "Bill Rate", payRate: "Pay Rate",
    candidate: "Candidate", lastAssignment: "Last Assignment", gapDays: "Gap Days", matchScore: "Match Score",
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <nav className="flex mb-2" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
              <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z" />
              </svg>
              Home
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <Link to="/recruitment-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Recruitment Performance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Detail & Transaction View</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Recruitment Performance — Detail & Transaction View</h1>
            <p className="text-sky-100 text-x mt-1">Drill from summary KPIs to reconciled recruiter, client, requisition and candidate detail.</p>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => exportToExcel(getCurrentData(), activeTab)} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
              <FiDownload className="text-sky-50" />
              <span className="text-sky-50">Export Excel</span>
            </button>
            <CSVLink data={getCurrentData()} filename={`recruitment_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <FiFileText />
              <span>Export CSV</span>
            </CSVLink>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-sky-100 overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-s font-medium whitespace-nowrap ${activeTab === tab.id ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-500 hover:text-blue-500"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100 relative">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-s font-semibold text-sky-800">{tabs.find((t) => t.id === activeTab)?.label}</h3>
          <div className="relative">
            <button onClick={() => setShowAIDropdown(!showAIDropdown)} className="p-2 rounded hover:bg-gray-100" title="Ask AI">
              <BsStars />
            </button>
            {showAIDropdown && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute right-0 top-10 w-72 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-3">
                <p className="text-x text-blue-700 mb-2">{aiSuggestions[activeTab]}</p>
                <div className="flex gap-2">
                  <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Ask AI about this data..." className="w-full p-1 border border-gray-300 rounded text-x" />
                  <button onClick={handleAskAI} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!aiInput.trim()}>
                    <FiSend />
                  </button>
                </div>
                {aiResponses[activeTab]?.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {aiResponses[activeTab].map((r, i) => (
                      <p key={i} className="text-[10px] text-gray-600 italic">Q: {r.query} — {r.response}</p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {activeTab === "kpis" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {kpiData.map((k) => (
              <div key={k.title} className="border border-sky-100 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider">{k.title}</p>
                <p className="text-s font-bold text-sky-900 mt-1">{k.value}</p>
                <p className={`text-[10px] font-medium mt-1 ${k.isPositive ? "text-green-500" : "text-red-500"}`}>{k.change} {k.isPositive ? "↑" : "↓"} vs plan</p>
                <p className="text-[10px] text-gray-500 italic mt-2">{k.aiSuggestion}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-x text-gray-700">
              <thead>
                <tr className="border-b">
                  {columns[activeTab].map((col) => (
                    <th key={col} className="p-2 text-left">{columnLabels[col] || col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getCurrentData().map((row, i) => (
                  <tr key={i} className="border-b">
                    {columns[activeTab].map((col) => (
                      <td key={col} className="p-2">{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitmentPerformanceTable;
