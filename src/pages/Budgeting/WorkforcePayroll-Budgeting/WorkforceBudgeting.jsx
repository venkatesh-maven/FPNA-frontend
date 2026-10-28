import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { FiSave, FiPrinter, FiUsers, FiDollarSign, FiTrendingUp, FiChevronRight, FiUserPlus, FiUserMinus, FiPlusCircle, FiTrash2 } from "react-icons/fi";
import { BsStars } from 'react-icons/bs';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- MOCK DATA ---
const CURRENT_YEAR = 2025;
const DEPARTMENTS = ["All", "Sales", "R&D", "Marketing", "G&A"];
const MOCK_REVENUE = 25000000; // Total company revenue for ratio calculations

const initialWorkforceData = [
  { id: 1, name: 'Ava Chen', title: 'Lead Engineer', department: 'R&D', status: 'Active', salary: 160000, merit: 4, bonus: 15, startDate: '2023-01-15', termDate: null, aiInsight: 'Top performer. 4% merit increase is aligned with performance review.' },
  { id: 2, name: 'Ben Carter', title: 'Sales Director', department: 'Sales', status: 'Active', salary: 140000, merit: 3, bonus: 25, startDate: '2022-05-20', termDate: null, aiInsight: 'Standard 3% merit increase. Bonus is tied to team performance.' },
  { id: 3, name: 'Cora Diaz', title: 'Marketing Manager', department: 'Marketing', status: 'Active', salary: 95000, merit: 5, bonus: 10, startDate: '2023-08-01', termDate: '2025-06-30', aiInsight: 'Planned attrition. Replacement hire should be budgeted for Q3.' },
  { id: 4, name: 'Dan Evans', title: 'Accountant', department: 'G&A', status: 'Active', salary: 80000, merit: 3, bonus: 5, startDate: '2024-02-10', termDate: null, aiInsight: 'Standard G&A compensation plan.' },
  { id: 5, name: 'New Hire', title: 'Software Engineer', department: 'R&D', status: 'New Hire', salary: 120000, merit: 0, bonus: 10, startDate: '2025-03-01', termDate: null, aiInsight: 'Budgeted at market rate for mid-level engineer to support Project Titan.' },
  { id: 6, name: 'New Hire', title: 'Account Executive', department: 'Sales', status: 'New Hire', salary: 85000, merit: 0, bonus: 30, startDate: '2025-04-01', termDate: null, aiInsight: 'Hire to expand into the new West Coast territory.' },
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

const WorkforceBudgeting = () => {
  const [workforceData, setWorkforceData] = useState(initialWorkforceData);
  const [activeDepartment, setActiveDepartment] = useState("All");
  const [benefitsLoad, setBenefitsLoad] = useState(18); // 18% for taxes, healthcare, etc.
  const [avgAttritionRate, setAvgAttritionRate] = useState(8); // 8% annual attrition
  const [avgReplacementCost, setAvgReplacementCost] = useState(50000); // Cost per replacement
  
  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: getDecimalPrecision() }).format(value);
  
  const calculateTotalComp = (employee) => {
    const proratedMonths = getProratedMonths(employee.startDate, employee.termDate);
    if (proratedMonths <= 0) return 0;
    
    const baseSalary = employee.status === 'New Hire' ? employee.salary : employee.salary * (1 + employee.merit / 100);
    const bonusAmount = baseSalary * (employee.bonus / 100);
    const salaryAndBonus = baseSalary + bonusAmount;
    const totalWithBenefits = salaryAndBonus * (1 + benefitsLoad / 100);
    
    return (totalWithBenefits / 12) * proratedMonths;
  };

  const getProratedMonths = (startDateStr, termDateStr) => {
    const startDate = new Date(startDateStr);
    const termDate = termDateStr ? new Date(termDateStr) : null;
    let startMonth = startDate.getFullYear() < CURRENT_YEAR ? 0 : startDate.getMonth();
    let endMonth = termDate && termDate.getFullYear() === CURRENT_YEAR ? termDate.getMonth() : 11;
    return Math.max(0, endMonth - startMonth + 1);
  };
  
  const filteredData = useMemo(() => {
    if (activeDepartment === "All") return workforceData;
    return workforceData.filter(emp => emp.department === activeDepartment);
  }, [workforceData, activeDepartment]);
  
  const totalWorkforceCost = useMemo(() => workforceData.reduce((sum, emp) => sum + calculateTotalComp(emp), 0), [workforceData, benefitsLoad]);

  const attritionCost = useMemo(() => {
    const terminatedEmployees = workforceData.filter(emp => emp.termDate);
    const savedSalary = terminatedEmployees.reduce((sum, emp) => {
      const fullYearCost = calculateTotalComp({...emp, termDate: null});
      const proratedCost = calculateTotalComp(emp);
      return sum + (fullYearCost - proratedCost);
    }, 0);
    const replacementHiringCost = terminatedEmployees.length * avgReplacementCost;
    return { savedSalary, replacementHiringCost, netImpact: replacementHiringCost - savedSalary };
  }, [workforceData, benefitsLoad, avgReplacementCost]);
  
  const chartData = useMemo(() => {
    const dataByDept = {};
    DEPARTMENTS.slice(1).forEach(dept => {
      dataByDept[dept] = workforceData
        .filter(emp => emp.department === dept)
        .reduce((sum, emp) => sum + calculateTotalComp(emp), 0);
    });
    return {
      labels: Object.keys(dataByDept),
      datasets: [{
        label: 'Total Workforce Cost',
        data: Object.values(dataByDept),
        backgroundColor: ['#f97316', '#14b8a6', '#0ea5e9', '#8b5cf6'],
      }]
    };
  }, [workforceData, benefitsLoad]);

  const handleDataChange = (id, field, value) => {
    setWorkforceData(prev => prev.map(emp => emp.id === id ? { ...emp, [field]: value } : emp));
  };
  
  const addNewHire = () => {
    const newId = Math.max(0, ...workforceData.map(e => e.id)) + 1;
    setWorkforceData(prev => [...prev, {
      id: newId, name: 'New Hire', title: '', department: activeDepartment === 'All' ? 'G&A' : activeDepartment, status: 'New Hire',
      salary: 80000, merit: 0, bonus: 10, startDate: `${CURRENT_YEAR}-01-01`, termDate: null, aiInsight: 'Enter justification for new role.'
    }]);
  };

  const handleDelete = (idToDelete) => {
    setWorkforceData(prev => prev.filter(emp => emp.id !== idToDelete));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
        <nav className="flex mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li><Link to="/budgeting-hub" className="text-s font-medium text-gray-700 hover:text-blue-600">Budgeting Hub</Link></li>
                                <li><div className="flex items-center"><FiChevronRight className="w-3 h-3 text-gray-400 mx-1" /><span className="text-s font-medium text-gray-500">Workforce & Payroll</span></div></li>
                            </ol>
                        </nav>
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md">
        <h1 className="text-xl font-bold text-white">Workforce & Payroll Budgeting</h1>
        <p className="text-sky-100 text-s mt-1">Strategically manage staffing costs, from hiring to compensation and attrition.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Total Workforce Cost" value={formatCurrency(totalWorkforceCost)} change={`${workforceData.length} Total Headcount`} icon={<FiUsers />} />
        <KPICard title="Avg. Cost Per Employee" value={workforceData.length > 0 ? formatCurrency(totalWorkforceCost / workforceData.length) : '$0'} change={`Includes ${benefitsLoad}% benefits load`} icon={<FiDollarSign />} />
        <KPICard title="New Hires Planned" value={workforceData.filter(e => e.status === 'New Hire').length} change={`Cost: ${formatCurrency(workforceData.filter(e => e.status === 'New Hire').reduce((s,e) => s + calculateTotalComp(e), 0))}`} icon={<FiUserPlus />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-sky-900 mb-3">Workforce Cost by Department</h2>
              <div className="h-80"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }}}}/></div>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-sky-900 mb-4">AI Workforce Insights</h2>
              <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                      <BsStars className="text-blue-500 text-xl mt-0.5 flex-shrink-0" />
                      <div>
                          <h4 className="font-semibold text-blue-800">Compensation Ratio</h4>
                          <p className="text-s text-blue-700">Your total workforce cost is <span className="font-bold">{((totalWorkforceCost / MOCK_REVENUE) * 100).toFixed(getDecimalPrecision())}%</span> of revenue. This is 5% below the industry benchmark, suggesting efficient staffing.</p>
                      </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                      <BsStars className="text-blue-500 text-xl mt-0.5 flex-shrink-0" />
                      <div>
                          <h4 className="font-semibold text-blue-800">Department Efficiency</h4>
                          <p className="text-s text-blue-700">The Sales department shows the highest <span className="font-bold">Revenue per Employee</span>. Consider allocating the next marketing hire to support this high-performing team.</p>
                      </div>
                  </div>
                   <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                      <BsStars className="text-blue-500 text-xl mt-0.5 flex-shrink-0" />
                      <div>
                          <h4 className="font-semibold text-blue-800">Attrition Risk</h4>
                          <p className="text-s text-blue-700">AI predicts a potential attrition risk in the R&D team due to below-market merit increases. Recommend reviewing compensation for key engineers.</p>
                      </div>
                  </div>
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
                <button onClick={addNewHire} className="px-4 py-2 bg-green-600 text-white text-s rounded-lg hover:bg-green-700 flex items-center"><FiPlusCircle className="mr-2" /> Add New Hire</button>
                <button className="px-4 py-2 bg-sky-600 text-white text-s rounded-lg hover:bg-sky-700 flex items-center"><FiSave className="mr-2" /> Save Plan</button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s">
            <thead className="text-left text-x text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3">Employee / Role</th>
                <th className="p-3 text-right">Base Salary</th>
                <th className="p-3 text-center">Merit %</th>
                <th className="p-3 text-center">Bonus %</th>
                <th className="p-3 text-center">Start Date</th>
                <th className="p-3 text-center">Term Date</th>
                <th className="p-3 text-right">Total Annual Cost</th>
                <th className="p-3">AI Insight</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(emp => (
                  <tr key={emp.id} className={`border-b border-gray-100 hover:bg-sky-50 ${emp.status === 'New Hire' ? 'bg-green-50' : ''} ${emp.termDate ? 'bg-red-50' : ''}`}>
                    <td className="p-3">
                        <input type="text" value={emp.name} onChange={(e) => handleDataChange(emp.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full" />
                        <input 
                            type="text" 
                            value={emp.title} 
                            placeholder="Enter Title"
                            onChange={(e) => handleDataChange(emp.id, 'title', e.target.value)} 
                            className="text-x text-gray-500 bg-transparent w-full placeholder:italic placeholder:text-gray-400" 
                        />
                    </td>
                    <td className="p-3 text-right"><input type="number" value={emp.salary} onChange={(e) => handleDataChange(emp.id, 'salary', parseFloat(e.target.value))} className="w-24 p-1 text-right bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-center"><input type="number" value={emp.merit} onChange={(e) => handleDataChange(emp.id, 'merit', parseFloat(e.target.value))} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-center"><input type="number" value={emp.bonus} onChange={(e) => handleDataChange(emp.id, 'bonus', parseFloat(e.target.value))} className="w-16 p-1 text-center bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-center"><input type="date" value={emp.startDate} onChange={(e) => handleDataChange(emp.id, 'startDate', e.target.value)} className="p-1 text-x bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-center"><input type="date" value={emp.termDate || ''} onChange={(e) => handleDataChange(emp.id, 'termDate', e.target.value)} className="p-1 text-x bg-transparent border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"/></td>
                    <td className="p-3 text-right font-mono font-semibold text-gray-800">{formatCurrency(calculateTotalComp(emp))}</td>
                    <td className="p-3 text-x text-blue-800">
                        <div className="flex items-start"><BsStars className="mr-2 mt-0.5 flex-shrink-0" /><span>{emp.aiInsight}</span></div>
                    </td>
                    <td className="p-3 text-center">
                        <button onClick={() => handleDelete(emp.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <FiTrash2 className="h-4 w-4" />
                        </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-sky-900 mb-4">Attrition & Replacement Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-s font-medium text-gray-700 mb-1">Benefits & Payroll Tax Load (%)</label>
                  <input type="number" value={benefitsLoad} onChange={e => setBenefitsLoad(parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-sky-500"/>
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-s font-medium text-gray-700 mb-1">Avg. Replacement & Hiring Cost</label>
                  <input type="number" value={avgReplacementCost} onChange={e => setAvgReplacementCost(parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-sky-500"/>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-s font-semibold text-green-800 flex items-center gap-2"><FiUserMinus/> Cost Savings from Attrition</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(attritionCost.savedSalary)}</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-s font-semibold text-red-800 flex items-center gap-2"><FiUserPlus/> Budgeted Replacement Costs</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(attritionCost.replacementHiringCost)}</p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default WorkforceBudgeting;