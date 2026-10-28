import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { FiSave, FiPrinter, FiDollarSign, FiCheckCircle,FiChevronRight, FiXCircle, FiClock, FiPlusCircle, FiFilter, FiTrash2 } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- MOCK DATA ---
const DEPARTMENTS = ["All", "Marketing", "IT", "Sales", "R&D"];

const initialDecisionPackages = [
  { id: 1, department: "Marketing", name: "Q3 Digital Ad Campaign", requestedAmount: 150000, justification: "Drive 500 new MQLs for the upcoming product launch. Based on historical $300 CPL.", priority: "High", status: "Approved", aiAnalysis: "Request is aligned with historical CPL. High probability of achieving MQL target." },
  { id: 2, department: "IT", name: "New Cybersecurity Software", requestedAmount: 85000, justification: "Address critical security vulnerability identified in Q1 audit. Vendor quote attached.", priority: "High", status: "Approved", aiAnalysis: "This is a critical, non-discretionary expense to mitigate security risks." },
  { id: 3, department: "Sales", name: "Team Attendance at 'Global Sales Summit'", requestedAmount: 45000, justification: "Networking and lead generation opportunities. Historically generates 3x ROI in pipeline.", priority: "Medium", status: "Pending", aiAnalysis: "Historical ROI is strong, but discretionary. Consider approving if Q2 revenue targets are met." },
  { id: 4, department: "Marketing", name: "Agency for Brand Refresh Project", requestedAmount: 75000, justification: "Update company branding to appeal to a younger demographic. Proposal from 'Creative Inc.'", priority: "Low", status: "Rejected", aiAnalysis: "AI suggests reallocating this budget to the higher-ROI digital ad campaign for more immediate impact." },
  { id: 5, department: "R&D", name: "Cloud-Based ML Training Servers", requestedAmount: 120000, justification: "Required to train new AI models for the 'Predictive Insights' feature.", priority: "High", status: "Approved", aiAnalysis: "Essential R&D infrastructure. Cost is 10% below market average for this compute power." },
  { id: 6, department: "IT", name: "Office Printer Fleet Upgrade", requestedAmount: 25000, justification: "Replace aging printers to reduce maintenance calls.", priority: "Low", status: "Rejected", aiAnalysis: "Low operational impact. Current maintenance cost is $5k/year. AI suggests deferring this for 12 months." },
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

const ZeroBasedBudgeting = () => {
  const [packages, setPackages] = useState(initialDecisionPackages);
  const [activeDepartment, setActiveDepartment] = useState("All");

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);

  const filteredPackages = useMemo(() => {
    if (activeDepartment === "All") return packages;
    return packages.filter(p => p.department === activeDepartment);
  }, [packages, activeDepartment]);

  const summary = useMemo(() => {
    const totalRequested = packages.reduce((sum, p) => sum + p.requestedAmount, 0);
    const totalApproved = packages.filter(p => p.status === 'Approved').reduce((sum, p) => sum + p.requestedAmount, 0);
    const totalPending = packages.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.requestedAmount, 0);
    const totalRejected = packages.filter(p => p.status === 'Rejected').reduce((sum, p) => sum + p.requestedAmount, 0);
    return { totalRequested, totalApproved, totalPending, totalRejected };
  }, [packages]);

  const chartData = useMemo(() => {
    const dataByDept = {};
    DEPARTMENTS.slice(1).forEach(dept => {
      dataByDept[dept] = packages
        .filter(p => p.department === dept && p.status === 'Approved')
        .reduce((sum, p) => sum + p.requestedAmount, 0);
    });
    return {
      labels: Object.keys(dataByDept),
      datasets: [{
        label: 'Approved Budget',
        data: Object.values(dataByDept),
        backgroundColor: ['#0ea5e9', '#ef4444', '#f97316', '#14b8a6'],
      }]
    };
  }, [packages]);

  const handlePackageChange = (id, field, value) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  
  const addPackage = () => {
      const newId = Math.max(0, ...packages.map(p => p.id)) + 1;
      setPackages(prev => [...prev, {
          id: newId, department: activeDepartment === 'All' ? 'G&A' : activeDepartment, name: '', requestedAmount: 0,
          justification: '', priority: 'Medium', status: 'Pending', aiAnalysis: 'Awaiting justification and amount.'
      }]);
  };
  
  const deletePackage = (id) => {
      setPackages(prev => prev.filter(p => p.id !== id));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved': return <FiCheckCircle className="text-green-500" />;
      case 'Rejected': return <FiXCircle className="text-red-500" />;
      case 'Pending': return <FiClock className="text-amber-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
        <nav className="flex mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
                                <li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Zero Based</span></div></li>
                            </ol>
                        </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md">
        <h1 className="text-xl font-bold text-white">Zero-Based Budgeting (ZBB)</h1>
        <p className="text-sky-100 text-s mt-1">Build your budget from the ground up. Every expense requires justification and approval.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Approved Budget" value={formatCurrency(summary.totalApproved)} change={`${(summary.totalApproved / summary.totalRequested * 100).toFixed(getDecimalPrecision())}% of Requested`} icon={<FiCheckCircle />} />
        <KPICard title="Total Requested" value={formatCurrency(summary.totalRequested)} icon={<FiDollarSign />} />
        <KPICard title="Pending Approval" value={formatCurrency(summary.totalPending)} icon={<FiClock />} />
        <KPICard title="Potential Savings (Rejected)" value={formatCurrency(summary.totalRejected)} icon={<FiXCircle />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-sky-900 mb-3">Approved Budget by Department</h2>
              <div className="h-80"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }}}}/></div>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-sky-900 mb-4">AI Reallocation Insights</h2>
              <div className="space-y-3">
                  {packages.filter(p => p.status === 'Rejected').slice(0, 3).map(p => (
                      <div key={p.id} className="p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                          <BsStars className="text-blue-500 text-xl mt-0.5 flex-shrink-0" />
                          <div>
                              <h4 className="font-semibold text-blue-800">Reallocate <span className="font-bold">{formatCurrency(p.requestedAmount)}</span></h4>
                              <p className="text-s text-blue-700">The rejected '{p.name}' budget could be reallocated to a high-priority pending item like the 'Global Sales Summit' to accelerate ROI.</p>
                          </div>
                      </div>
                  ))}
              </div>
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
                <button onClick={addPackage} className="px-4 py-2 bg-sky-600 text-white text-s rounded-lg hover:bg-sky-700 flex items-center"><FiPlusCircle className="mr-2" /> Add Decision Package</button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s">
            <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3">Decision Package</th>
                <th className="p-3">Justification / Business Case</th>
                <th className="p-3 text-right">Requested Amount</th>
                <th className="p-3 text-center">Priority</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">AI Analysis</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-sky-50">
                    <td className="p-3 align-top">
                        <input type="text" value={p.name} placeholder="Package Name" onChange={e => handlePackageChange(p.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full mb-1" />
                        <div className="text-x text-gray-500">{p.department}</div>
                    </td>
                    <td className="p-3 align-top">
                        <textarea value={p.justification} onChange={e => handlePackageChange(p.id, 'justification', e.target.value)} placeholder="Justify the need and expected outcome..." rows="2" className="w-full text-x bg-transparent border border-gray-300 rounded p-1 focus:ring-1 focus:ring-sky-500"></textarea>
                    </td>
                    <td className="p-3 align-top text-right">
                        <input type="number" value={p.requestedAmount} onChange={e => handlePackageChange(p.id, 'requestedAmount', parseFloat(e.target.value))} className="w-28 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/>
                    </td>
                    <td className="p-3 align-top text-center">
                        <select value={p.priority} onChange={e => handlePackageChange(p.id, 'priority', e.target.value)} className="p-1 text-x bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500">
                            <option>High</option><option>Medium</option><option>Low</option>
                        </select>
                    </td>
                    <td className="p-3 align-top text-center">
                         <select value={p.status} onChange={e => handlePackageChange(p.id, 'status', e.target.value)} className={`p-1 text-x font-medium border rounded w-full bg-transparent focus:ring-1 focus:ring-sky-500 
                            ${p.status === 'Approved' ? 'border-green-300 text-green-800' : p.status === 'Rejected' ? 'border-red-300 text-red-800' : 'border-amber-300 text-amber-800'}`}>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </td>
                    <td className="p-3 align-top text-x text-blue-800 max-w-xs">
                        <div className="flex items-start"><BsStars className="mr-2 mt-0.5 flex-shrink-0" /><span>{p.aiAnalysis}</span></div>
                    </td>
                    <td className="p-3 align-top text-center">
                        <button onClick={() => deletePackage(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <FiTrash2 className="h-4 w-4" />
                        </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ZeroBasedBudgeting;