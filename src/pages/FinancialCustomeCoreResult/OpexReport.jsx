import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { FinancialYearContext } from "../../context/FinancialYearContext";
import { Link } from "react-router-dom";
import {
  FiDownload,
  FiChevronDown,
  FiCalendar,
  FiDollarSign,
  FiPieChart,
  FiBarChart2,
  FiTrendingUp,
} from "react-icons/fi";
import { FaArrowTrendUp } from "react-icons/fa6";
import axios from "axios";
import FinancialDashboardSkeleton from "../../Skeletons/FinancialDashboardSkeleton";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import { Line, Doughnut, Bar } from "react-chartjs-2";
import { API_BASE_URL } from "../../config/config";
import { getDecimalPrecision } from '../../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const COLORS = [
  "rgba(54,162,235,0.7)",
  "rgba(255,99,132,0.7)",
  "rgba(255,206,86,0.7)",
  "rgba(75,192,192,0.7)",
  "rgba(153,102,255,0.7)",
  "rgba(255,159,64,0.7)",
];

// ------------------ CHART COMPONENTS ------------------

const OpexBarChart = ({ data }) => {
  const months = Object.keys(data);
  const categories = Object.values(data)[0]?.map((d) => d.account_name) || [];

  const datasets = categories.map((cat, i) => ({
    label: cat.replace(/([A-Z])/g, " $1").toLowerCase(),
    data: months.map(
      (m) => data[m].find((d) => d.account_name === cat)?.amount || 0
    ),
    backgroundColor: COLORS[i % COLORS.length],
  }));

  return (
    <Bar
      data={{ labels: months, datasets }}
      options={{ responsive: true, maintainAspectRatio: false }}
    />
  );
};

const OpexTrendChart = ({ data }) => {
  const quarters = Object.keys(data);
  const categories = Object.values(data)[0]?.map((d) => d.account_name) || [];

  const datasets = categories.map((cat, i) => ({
    label: cat,
    data: quarters.map(
      (q) => data[q].find((d) => d.account_name === cat)?.amount || 0
    ),
    borderColor: COLORS[i % COLORS.length].replace("0.7", "1"),
    backgroundColor: COLORS[i % COLORS.length],
    fill: false,
    tension: 0.4,
  }));

  return (
    <Line
      data={{ labels: quarters, datasets }}
      options={{ responsive: true, maintainAspectRatio: false }}
    />
  );
};

const OpexPieChart = ({ data }) => {
  const labels = Object.keys(data);
  const values = Object.values(data);

  return (
    <Doughnut
      data={{
        labels: labels.map((l) => l.replace(/([A-Z])/g, " $1").toLowerCase()),
        datasets: [
          {
            data: values,
            backgroundColor: COLORS,
            borderColor: COLORS.map((c) => c.replace("0.7", "1")),
            borderWidth: 1,
          },
        ],
      }}
      options={{ responsive: true, maintainAspectRatio: false }}
    />
  );
};

// ------------------ MAIN COMPONENT ------------------

const OpexReport = () => {
  const { token } = useContext(AuthContext);
  const { selectedYear, setSelectedYear, years: availableYears } =
    useContext(FinancialYearContext);

  const [loading, setLoading] = useState(true);
  const [opexData, setOpexData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("monthly");

  useEffect(() => {
    const fetchOpex = async () => {
      if (!selectedYear) return;
      try {
        setLoading(true);
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/company/financial/operation_expense/${selectedYear}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setOpexData(res.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOpex();
  }, [selectedYear, token]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" , minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }).format(amount);

  if (loading) return <FinancialDashboardSkeleton />;
  if (error)
    return (
      <div className="p-6">
        <div className="bg-sky-50 border border-sky-200 rounded p-4 text-sky-800">
          Error: {error}
        </div>
      </div>
    );
  if (!opexData)
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800">
          No Expense Data Found
        </div>
      </div>
    );

  return (
    <div className=" bg-gray-50 min-h-screen">
       <nav className="flex mb-3" aria-label="Breadcrumb ">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex text-sky-900 items-center">
            <a href="/" className="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600">
              <svg className="w-3 h-3 me-2.5 text-sky-900" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
              </svg>
              <span className="text-sky-900 hover:text-blue-500">Dashboard</span>
            </a>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
              <a href="/financial-core-reports" className="ms-1 text-s font-medium text-sky-900 hover:text-blue-600 md:ms-2">Operating Expense Report</a>
            </div>
          </li>
          {/* <li aria-current="page">
            <div className="flex items-center">
              <svg className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
              <span className="ms-1 text-s font-medium text-gray-500">Profit &amp; Loss</span>
            </div>
          </li> */}
        </ol>
      </nav>
      {/* Header */}
      <div className=" mb-5 flex items-center  justify-between bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">

        <div><h1 className="text-lg font-bold text-white">Operating Expense Report</h1>
        <p className="text-sky-100 text-x">
          Detailed breakdown of expenses across categories, departments, and time
        </p></div>
        



         {/* Year Selector */}
      <div className="flex items-center gap-4">
        <FiCalendar className="text-gray-500" />
        <span className="text-s font-medium text-gray-700">Financial Year:</span>
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        {/* <div className="text-s text-gray-500">
          {opexData.date_range.start_date.split("T")[0]} to{" "}
          {opexData.date_range.end_date.split("T")[0]}
        </div> */}
      </div>

      </div>






     
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <h3 className="text-s text-gray-500">Total Expenses</h3>
            <FiDollarSign className="text-sky-500" />
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(opexData.summary.total_expenses)}
          </p>
          <div className="flex items-center text-green-600 mt-1 text-s">
            <FaArrowTrendUp className="mr-1" /> YTD
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <h3 className="text-s text-gray-500">Top Category</h3>
            <FiTrendingUp className="text-sky-500" />
          </div>
          <p className="text-lg font-semibold capitalize">
            {opexData.summary.top_department.replace(/([A-Z])/g, " $1")}
          </p>
          <p className="text-s text-gray-500">
            {formatCurrency(opexData.summary.top_department_expense)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <h3 className="text-s text-gray-500">Monthly Avg</h3>
            <FiBarChart2 className="text-sky-500" />
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(opexData.summary.monthly_average_expense)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <h3 className="text-s text-gray-500">Categories</h3>
            <FiPieChart className="text-sky-500" />
          </div>
          <p className="text-2xl font-bold">
            {opexData.summary.department_count}
          </p>
          <p className="text-s text-gray-500">
            Avg: {formatCurrency(opexData.summary.average_expense_per_department)}
          </p>
        </div>
      </div>

      {/* Tabs & Charts */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-6 py-3 text-s border-b-2 ${
              activeTab === "monthly" ? "border-sky-500 text-sky-600" : "text-gray-500"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setActiveTab("quarterly")}
            className={`px-6 py-3 text-s border-b-2 ${
              activeTab === "quarterly" ? "border-sky-500 text-sky-600" : "text-gray-500"
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setActiveTab("yearly")}
            className={`px-6 py-3 text-s border-b-2 ${
              activeTab === "yearly" ? "border-sky-500 text-sky-600" : "text-gray-500"
            }`}
          >
            Yearly
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6" style={{height:"350px"}}>
          {activeTab === "monthly" && <OpexBarChart data={opexData.monthly_expenses} />}
          {activeTab === "quarterly" && <OpexTrendChart data={opexData.quarterly_expenses} />}
          {activeTab === "yearly" && <OpexPieChart data={opexData.yearly_expenses} />}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="bg-gray-50 px-4 py-3 border-b text-s font-medium text-gray-700">
            Monthly Expenses
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-s">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(opexData.monthly_expenses).map(([month, data]) => {
                  const total = data.reduce((sum, d) => sum + d.amount, 0);
                  return (
                    <tr key={month} className="border-b">
                      <td className="px-4 py-2 font-medium">{month}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quarterly Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="bg-gray-50 px-4 py-3 border-b text-s font-medium text-gray-700">
            Quarterly Expenses
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-s">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Quarter</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(opexData.quarterly_expenses).map(([q, data]) => {
                  const total = data.reduce((sum, d) => sum + d.amount, 0);
                  return (
                    <tr key={q} className="border-b">
                      <td className="px-4 py-2 font-medium">{q}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpexReport;
