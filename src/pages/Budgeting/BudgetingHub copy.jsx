import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { motion } from "framer-motion";
import {
  FiDollarSign,
  FiUsers,
  FiDownload,
  FiEdit,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiFilter,
  FiBriefcase,
  FiHardDrive,
  FiRefreshCw,
  FiSliders,
  FiFileText,
  FiArrowRight,
  FiTrendingUp,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// --- Mock Data ---
const baseKpiData = [
  {
    title: "Total Budget vs. Last Year",
    value: "$12.5M",
    change: "+5.2%",
    isPositive: true,
  },
  {
    title: "Revenue Budget vs. Last Year",
    value: "$25.0M",
    change: "+8.1%",
    isPositive: true,
  },
  {
    title: "Headcount (FTE) vs. Last Year",
    value: "150",
    change: "+15 FTEs",
    isPositive: false,
  },
  {
    title: "AI Optimization Potential",
    value: "$320K",
    change: "Identified Savings",
    isPositive: true,
  },
];
const baseChartData = {
  labels: ["Marketing", "Sales", "IT", "HR", "R&D", "G&A"],
  datasets: [
    {
      label: "FY2024 Actuals",
      data: [2.3, 2.8, 1.75, 1.1, 1.8, 1.4],
      backgroundColor: "rgba(107, 114, 128, 0.5)",
    },
    {
      label: "FY2025 Budget",
      data: [2.5, 3.0, 1.8, 1.2, 2.0, 1.5],
      backgroundColor: "rgba(59, 130, 246, 0.7)",
    },
  ],
};
const approvalStatusData = [
  {
    id: 1,
    name: "Revenue",
    status: 95,
    manager: "approved",
    fpa: "approved",
    controller: "pending",
  },
  {
    id: 2,
    name: "Operational Expenses",
    status: 85,
    manager: "approved",
    fpa: "pending",
    controller: "pending",
  },
  {
    id: 3,
    name: "Workforce & Payroll",
    status: 75,
    manager: "submitted",
    fpa: "pending",
    controller: "pending",
  },
  {
    id: 4,
    name: "Capital Expenditure (CAPEX)",
    status: 60,
    manager: "draft",
    fpa: "pending",
    controller: "pending",
  },
  {
    id: 5,
    name: "Zero-Based Packages",
    status: 100,
    manager: "approved",
    fpa: "approved",
    controller: "approved",
  },
];
const budgetingModules = [
  {
    path: "/revenue-based-budgeting",
    title: "Revenue Based Budgeting",
    description: "Dynamically link expenses and budgets to revenue streams.",
    icon: <FiTrendingUp className="text-xl text-white" />,
    bgColor: "bg-purple-500",
  },
  {
    path: "/operational-budgeting",
    title: "Operational Budgeting",
    description: "Plan and track core business expenses for all departments.",
    icon: <FiBriefcase className="text-xl text-white" />,
    bgColor: "bg-blue-500",
  },
  {
    path: "/workforce-budgeting",
    title: "Workforce & Payroll",
    description: "Manage headcount, compensation, and attrition costs.",
    icon: <FiUsers className="text-xl text-white" />,
    bgColor: "bg-teal-500",
  },
  {
    path: "/capex-budgeting",
    title: "Capital Expenditure",
    description: "Plan and analyze long-term asset investments and ROI.",
    icon: <FiHardDrive className="text-xl text-white" />,
    bgColor: "bg-indigo-500",
  },
  {
    path: "/zeroBased-Budgeting",
    title: "Zero-Based Budgeting",
    description:
      "Justify every expense from the ground up to drive efficiency.",
    icon: <FiFileText className="text-xl text-white" />,
    bgColor: "bg-slate-500",
  },
  {
    path: "/rolling-budgeting",
    title: "Rolling & Flexible",
    description: "Continuously adapt your budget to real-time performance.",
    icon: <FiRefreshCw className="text-xl text-white" />,
    bgColor: "bg-amber-500",
  },
  {
    path: "/scenario-modelling-budgeting",
    title: "Scenario & What-If",
    description: "Simulate the impact of business decisions on your budget.",
    icon: <FiSliders className="text-xl text-white" />,
    bgColor: "bg-rose-500",
  },
];

const useOutsideClick = (callback) => {
  const ref = useRef();
  useEffect(() => {
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) callback();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, callback]);
  return ref;
};

const BudgetingHub = () => {
  const navigate = useNavigate();
  const [planningHorizon, setPlanningHorizon] = useState("1-Year");
  const [kpiData, setKpiData] = useState(baseKpiData);
  const [chartData, setChartData] = useState(baseChartData);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useOutsideClick(() => setIsFilterOpen(false));

  useEffect(() => {
    if (planningHorizon === "1-Year") {
      setKpiData(baseKpiData);
      setChartData(baseChartData);
    } else if (planningHorizon === "3-Year") {
      setKpiData([
        {
          title: "3-Year Total Budget",
          value: "$45.0M",
          change: "12% CAGR",
          isPositive: true,
        },
        {
          title: "3-Year Revenue Target",
          value: "$90.0M",
          change: "15% CAGR",
          isPositive: true,
        },
        {
          title: "3-Year Headcount Target",
          value: "210 FTE",
          change: "+75 FTEs",
          isPositive: false,
        },
        {
          title: "3-Year Strategic Initiatives",
          value: "$5.0M",
          change: "AI & Automation",
          isPositive: true,
        },
      ]);
      setChartData({
        labels: ["Marketing", "Sales", "IT", "HR", "R&D", "G&A"],
        datasets: [
          {
            label: "3-Year Budget Total",
            data: [8, 10, 5, 4, 12, 6],
            backgroundColor: "rgba(59, 130, 246, 0.7)",
          },
        ],
      });
    } else if (planningHorizon === "5-Year") {
      setKpiData([
        {
          title: "5-Year Total Budget",
          value: "$80.0M",
          change: "15% CAGR",
          isPositive: true,
        },
        {
          title: "5-Year Revenue Target",
          value: "$175.0M",
          change: "18% CAGR",
          isPositive: true,
        },
        {
          title: "5-Year Headcount Target",
          value: "300 FTE",
          change: "+165 FTEs",
          isPositive: false,
        },
        {
          title: "5-Year Market Expansion",
          value: "$10.0M",
          change: "APAC & EMEA",
          isPositive: true,
        },
      ]);
      setChartData({
        labels: ["Marketing", "Sales", "IT", "HR", "R&D", "G&A"],
        datasets: [
          {
            label: "5-Year Budget Total",
            data: [15, 20, 8, 7, 20, 10],
            backgroundColor: "rgba(59, 130, 246, 0.7)",
          },
        ],
      });
    }
  }, [planningHorizon]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.07 } },
  };

  const StatusBadge = ({ status }) => {
    const statusStyles = {
      approved: {
        text: "Approved",
        icon: <FiCheckCircle />,
        className: "bg-green-100 text-green-700",
      },
      pending: {
        text: "Pending",
        icon: <FiClock />,
        className: "bg-gray-200 text-gray-700",
      },
      submitted: {
        text: "Submitted",
        icon: <FiCheckCircle />,
        className: "bg-blue-100 text-blue-700",
      },
      draft: {
        text: "Draft",
        icon: <FiEdit />,
        className: "bg-yellow-100 text-yellow-700",
      },
      rejected: {
        text: "Rejected",
        icon: <FiXCircle />,
        className: "bg-red-100 text-red-700",
      },
    };
    const style = statusStyles[status];
    if (!style) return null;
    return (
      <div
        className={`inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-1 text-x font-medium ${style.className}`}
        title={style.text}
      >
        {style.icon} <span>{style.text}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen relative bg-sky-50">
      <motion.div initial="hidden" animate="visible" variants={cardVariants}>
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-xl font-bold text-white">Budgeting Hub</h1>
              <p className="text-sky-100 text-s mt-1">
                Central dashboard for all budget planning, tracking, and
                analysis.
              </p>
            </div>
            <div className="flex items-center space-x-2 mt-3 md:mt-0">
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setIsFilterOpen((p) => !p)}
                  className="flex items-center py-2 px-3 text-s font-medium text-sky-800 bg-white rounded-lg hover:bg-sky-50"
                >
                  <FiFilter className="mr-1.5" />{" "}
                  <span>{planningHorizon} Plan</span>
                </button>
                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                    <div className="p-1">
                      {["1-Year", "3-Year", "5-Year"].map((horizon) => (
                        <button
                          key={horizon}
                          onClick={() => {
                            setPlanningHorizon(horizon);
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-s rounded-md ${
                            planningHorizon === horizon
                              ? "bg-sky-100 text-sky-700"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          {horizon} Plan
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate("/corporate-budget-guidelines")}
                className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-700 rounded-lg border border-sky-600 hover:bg-sky-600"
              >
                <FiEdit className="mr-1.5" /> Corporate Guidelines
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <motion.div
          variants={cardVariants}
          className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {kpiData.map((kpi, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"
            >
              <p className="text-s font-semibold text-sky-800">{kpi.title}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {kpi.value}
              </p>
              <div
                className={`flex items-center mt-2 text-s font-medium ${
                  kpi.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                <span>{kpi.change}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Budgeting Modules Hub */}
        <motion.div variants={cardVariants} className="mt-6">
          <h2 className="text-xl font-semibold text-sky-900 mb-4">
            Budgeting Modules & Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {budgetingModules.map((module) => (
              <motion.div
                key={module.title}
                variants={cardVariants}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div
                    className={`p-2.5 rounded-full inline-block ${module.bgColor}`}
                  >
                    {module.icon}
                  </div>
                  <h3 className="text-base font-semibold text-gray-800 mt-3">
                    {module.title}
                  </h3>
                  <p className="text-x text-gray-600 mt-1">
                    {module.description}
                  </p>
                </div>
                <Link
                  to={module.path}
                  className="mt-4 inline-flex items-center gap-2 text-s font-semibold text-sky-600 hover:text-sky-800"
                >
                  Go to Module <FiArrowRight />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Budget Status & Approvals Section */}
        <motion.div
          variants={cardVariants}
          className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-sky-900 mb-4">
            Budget Status & Approvals
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-x font-semibold text-gray-500 uppercase tracking-wider">
                    Department / Area
                  </th>
                  <th className="px-4 py-2 text-left text-x font-semibold text-gray-500 uppercase tracking-wider w-2/5">
                    Progress
                  </th>
                  <th className="px-4 py-2 text-center text-x font-semibold text-gray-500 uppercase tracking-wider">
                    Dept. Manager
                  </th>
                  <th className="px-4 py-2 text-center text-x font-semibold text-gray-500 uppercase tracking-wider">
                    FP&A Analyst
                  </th>
                  <th className="px-4 py-2 text-center text-x font-semibold text-gray-500 uppercase tracking-wider">
                    Controller
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvalStatusData.map((dept) => (
                  <tr key={dept.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 text-s">
                      {dept.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mr-3">
                          <div
                            className={`h-2.5 rounded-full ${
                              dept.status > 90 ? "bg-green-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${dept.status}%` }}
                          ></div>
                        </div>
                        <span className="text-s font-semibold text-gray-700">
                          {dept.status}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={dept.manager} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={dept.fpa} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={dept.controller} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Comparison Chart & AI Insights Section */}
        <motion.div
          variants={cardVariants}
          className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-sky-900 mb-4">
              Budget vs. Last Year by Department ({planningHorizon} View)
            </h3>
            <div className="h-80">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { stacked: false },
                    y: { ticks: { callback: (value) => `$${value}M` } },
                  },
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-sky-900 mb-4 flex items-center">
              <BsStars className="mr-2 text-yellow-400" /> AI Insights
            </h3>
            <div className="flex-grow space-y-4 text-s overflow-y-auto max-h-[320px] pr-2">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-semibold text-blue-800">
                  R&D Over-Budget Alert
                </p>
                <p className="text-gray-600 mt-1">
                  R&D budget is trending{" "}
                  <span className="font-bold text-red-500">11% above</span> last
                  year, exceeding the 8% corporate guideline.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-semibold text-blue-800">
                  Marketing Spend Efficiency
                </p>
                <p className="text-gray-600 mt-1">
                  AI predicts a{" "}
                  <span className="font-bold text-green-500">
                    15% increase in lead generation
                  </span>{" "}
                  with a flat budget due to channel mix optimization.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-semibold text-blue-800">Headcount Anomaly</p>
                <p className="text-gray-600 mt-1">
                  Sales headcount budget implies an average salary{" "}
                  <span className="font-bold text-yellow-500">8% higher</span>{" "}
                  than the company average. Please verify compensation bands.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-semibold text-blue-800">
                  IT Savings Opportunity
                </p>
                <p className="text-gray-600 mt-1">
                  AI has identified 3 SaaS tools with low utilization.
                  Consolidating these licenses could save approximately{" "}
                  <span className="font-bold text-green-500">$45,000</span>{" "}
                  annually.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BudgetingHub;
