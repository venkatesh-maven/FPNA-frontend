import { useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiAlertTriangle,
  FiTrendingUp,
  FiDollarSign,
  FiPieChart,
  FiUsers,
  FiBriefcase,
  FiBarChart2,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const AIFinancialRecommendations = () => {
  const [expandedSections, setExpandedSections] = useState({
    cost: false,
    revenue: false,
    profit: false,
    investment: false,
    vendor: false,
    tax: false,
  });

  // Chart data
  const costOptimizationData = {
    labels: [
      "Software Licenses",
      "Marketing Spend",
      "Office Operations",
      "Travel",
      "Utilities",
    ],
    datasets: [
      {
        data: [18, 25, 22, 15, 20],
        backgroundColor: [
          "rgba(255, 99, 132, 0.7)",
          "rgba(54, 162, 235, 0.7)",
          "rgba(255, 206, 86, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(153, 102, 255, 0.7)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const revenueGrowthData = {
    labels: ["Current", "Next Quarter", "6 Months", "1 Year"],
    datasets: [
      {
        label: "Projected Revenue ($K)",
        data: [450, 510, 580, 680],
        backgroundColor: "rgba(75, 192, 192, 0.7)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const profitCompositionData = {
    labels: ["Direct Costs", "Operating Expenses", "Taxes", "Net Profit"],
    datasets: [
      {
        data: [42, 38, 8, 12],
        backgroundColor: [
          "rgba(255, 99, 132, 0.7)",
          "rgba(54, 162, 235, 0.7)",
          "rgba(255, 206, 86, 0.7)",
          "rgba(75, 192, 192, 0.7)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const investmentROIData = {
    labels: [
      "Marketing",
      "R&D",
      "Equipment",
      "Facilities",
      "IT Infrastructure",
    ],
    datasets: [
      {
        label: "Projected ROI (%)",
        data: [120, 85, 65, 45, 90],
        backgroundColor: "rgba(153, 102, 255, 0.7)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 1,
      },
    ],
  };

  const vendorPerformanceData = {
    labels: [
      "Supplier A",
      "Supplier B",
      "Supplier C",
      "Supplier D",
      "Supplier E",
    ],
    datasets: [
      {
        label: "Cost Competitiveness",
        data: [85, 92, 78, 65, 88],
        backgroundColor: "rgba(54, 162, 235, 0.7)",
      },
      {
        label: "On-Time Delivery",
        data: [92, 85, 90, 75, 95],
        backgroundColor: "rgba(75, 192, 192, 0.7)",
      },
    ],
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/cost-optimization-suggestions");
  };

  const handleNavigate2 = () =>{
    navigate("/revenue-growth-strategies")
  }


  const handlenavigate3 = ( ) => {
    navigate("/InvestmentCapitalAllocation");
  }

  const handleNavigate4 = () =>{
    navigate("/ProfitabilityEnhancement");
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">
              AI-Powered Financial Recommendations
            </h1>
            <p className="text-sky-100 text-s">
              Actionable insights to optimize financial performance
            </p>
          </div>
          <div className="flex space-x-2">
            <button className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <FiDownload className="mr-1" /> Export All
            </button>
          </div>
        </div>
      </div>

      {/* Cost Optimization */}
      <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection("cost")}
        >
          <div className="flex items-center">
            <FiAlertTriangle className="text-red-500 mr-3 text-xl" />
            <div>
              <h3 className="text-lg font-semibold">
                Cost Optimization Opportunities
              </h3>
              <p className="text-s text-gray-500">
                Potential savings identified by AI analysis
              </p>
              
            </div>
            
          </div>
          <div className="flex items-center justify-between">
            {expandedSections.cost ? (
              <div className="bg-sky-800 flex items-center gap-3 rounded-3xl p-2 px-5 text-white">
              <button onClick={handleNavigate} className="  ">View more  </button><p ><FiChevronRight /></p>
              </div>
            ) : (
              ""
            )}

            {expandedSections.cost ? <FiChevronDown /> : <FiChevronRight />}
          </div>
        </div>

        {expandedSections.cost && (
          <div className="grid md:grid-cols-2 gap-6 p-4 border-t">
            <div className="h-64">
              <Doughnut
                data={costOptimizationData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "right" },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.label}: ${context.raw}% of total costs`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">
                Top Recommendations:
              </h4>
              <ul className="space-y-3">
                <li className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <strong className="block">
                    Consolidate software licenses
                  </strong>
                  <p className="text-s">
                    18% savings potential by eliminating redundant SaaS tools.
                    AI identified 12 underutilized licenses.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Potential savings: $28,500/yr</span>
                    <span className="font-medium">Priority: High</span>
                  </div>
                </li>
                <li className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <strong className="block">
                    Optimize marketing spend allocation
                  </strong>
                  <p className="text-s">
                    25% of marketing budget could be reallocated to higher-ROI
                    channels based on conversion data.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Potential savings: $45,000/yr</span>
                    <span className="font-medium">Priority: Medium</span>
                  </div>
                </li>
                <li className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <strong className="block">
                    Implement remote work policies
                  </strong>
                  <p className="text-s">
                    22% reduction in office operations costs possible with
                    hybrid work model.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Potential savings: $62,000/yr</span>
                    <span className="font-medium">Priority: Medium</span>
                  </div>
                </li>
              </ul>
              <button className="mt-4 flex items-center text-blue-600 hover:text-blue-800 text-s">
                <FiDownload className="mr-2" />
                Download Detailed Cost Analysis Report
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Growth */}
      <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection("revenue")}
        >
          <div className="flex items-center">
            <FiTrendingUp className="text-green-500 mr-3 text-xl" />
            <div>
              <h3 className="text-lg font-semibold">
                Revenue Growth Strategies
              </h3>
              <p className="text-s text-gray-500">
                AI-identified opportunities to accelerate revenue
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {expandedSections.revenue ? (
              <div className="bg-sky-800 flex items-center gap-3 rounded-3xl p-2 px-5 text-white">
              <button onClick={handleNavigate2} className="  ">View more  </button><p ><FiChevronRight /></p>
              </div>
            ) : (
              ""
            )}

            {/* {expandedSections.revenue ? <FiChevronDown /> : <FiChevronRight />} */}
          </div>





          {/* {expandedSections.revenue ? <FiChevronDown /> : <FiChevronRight />} */}
        </div>

        {expandedSections.revenue && (
          <div className="grid md:grid-cols-2 gap-6 p-4 border-t">
            <div className="h-64">
              <Line
                data={{
                  labels: ["Current", "Next Quarter", "6 Months", "1 Year"],
                  datasets: [
                    {
                      label: "Baseline Projection",
                      data: [450, 490, 540, 610],
                      borderColor: "rgba(200, 200, 200, 1)",
                      borderWidth: 2,
                      borderDash: [5, 5],
                      fill: false,
                    },
                    {
                      label: "Optimized Scenario",
                      data: [450, 510, 580, 680],
                      borderColor: "rgba(75, 192, 192, 1)",
                      borderWidth: 3,
                      fill: false,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: false,
                      title: {
                        display: true,
                        text: "Revenue ($K)",
                      },
                    },
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.dataset.label}: $${context.raw}K`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">
                Strategic Opportunities:
              </h4>
              <ul className="space-y-3">
                <li className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <strong className="block">
                    Expand to Southeast Asia market
                  </strong>
                  <p className="text-s">
                    Projected $120K new revenue in first year with 35% gross
                    margin.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Confidence: 82%</span>
                    <span className="font-medium">
                      Implementation: 3-6 months
                    </span>
                  </div>
                </li>
                <li className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <strong className="block">Upsell premium services</strong>
                  <p className="text-s">
                    28% conversion potential among existing customers, $65K ARR
                    increase.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Confidence: 78%</span>
                    <span className="font-medium">
                      Implementation: 1-3 months
                    </span>
                  </div>
                </li>
                <li className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <strong className="block">Launch subscription pricing</strong>
                  <p className="text-s">
                    Projected 22% higher customer lifetime value with recurring
                    revenue model.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Confidence: 85%</span>
                    <span className="font-medium">
                      Implementation: 4-8 months
                    </span>
                  </div>
                </li>
              </ul>
              <div className="mt-4 flex space-x-3">
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-s">
                  Create Growth Plan
                </button>
                <button className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 text-s">
                  Compare Scenarios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profitability Enhancement */}
      <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection("profit")}
        >
          <div className="flex items-center">
            <FiDollarSign className="text-yellow-500 mr-3 text-xl" />
            <div>
              <h3 className="text-lg font-semibold">
                Profitability Enhancement
              </h3>
              <p className="text-s text-gray-500">
                Strategies to improve gross and net margins
              </p>
            </div>
          </div>


           <div className="flex items-center justify-between">
            {expandedSections.profit ? (
              <div className="bg-sky-800 flex items-center gap-3 rounded-3xl p-2 px-5 text-white">
              <button onClick={handleNavigate4} className="  ">View more  </button><p ><FiChevronRight /></p>
              </div>
            ) : (
              ""
            )}
            </div>

          
          {/* {expandedSections.profit ? <FiChevronDown /> : <FiChevronRight />} */}
        </div>

        {expandedSections.profit && (
          <div className="grid md:grid-cols-2 gap-6 p-4 border-t">
            <div className="h-64">
              <Doughnut
                data={profitCompositionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "right" },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.label}: ${context.raw}% of revenue`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">
                Margin Improvement Actions:
              </h4>
              <ul className="space-y-3">
                <li className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                  <strong className="block">
                    Renegotiate supplier contracts
                  </strong>
                  <p className="text-s">
                    5-8% potential COGS reduction through bulk purchasing and
                    early payment discounts.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Impact: +2.5% gross margin</span>
                    <span className="font-medium">Priority: High</span>
                  </div>
                </li>
                <li className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                  <strong className="block">Automate accounts payable</strong>
                  <p className="text-s">
                    $15K annual savings in administrative costs with 6-month
                    payback period.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Impact: +0.8% net margin</span>
                    <span className="font-medium">Priority: Medium</span>
                  </div>
                </li>
                <li className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                  <strong className="block">
                    Shift product mix to higher-margin items
                  </strong>
                  <p className="text-s">
                    12% potential EBITDA improvement by reallocating resources
                    to top-performing products.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Impact: +4.2% net margin</span>
                    <span className="font-medium">Priority: High</span>
                  </div>
                </li>
              </ul>
              <div className="mt-4">
                <div className="flex items-center text-s text-gray-600 mb-2">
                  <span className="w-32">Current Net Margin:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: "12%" }}
                    ></div>
                  </div>
                  <span className="ml-2 w-12">12%</span>
                </div>
                <div className="flex items-center text-s text-gray-600">
                  <span className="w-32">Target Net Margin:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full"
                      style={{ width: "18%" }}
                    ></div>
                  </div>
                  <span className="ml-2 w-12">18%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Investment & Capital Allocation */}
      <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection("investment")}
        >
          <div className="flex items-center">
            <FiBriefcase className="text-purple-500 mr-3 text-xl" />
            <div>
              <h3 className="text-lg font-semibold">
                Investment & Capital Allocation
              </h3>
              <p className="text-s text-gray-500">
                Data-driven guidance on capital deployment
              </p>
            </div>
          </div>


          {/* {expandedSections.investment ? (<button onClick={handlenavigate3}>View more</button>) : <FiChevronRight />} */}

 <div className="flex items-center justify-between">
            {expandedSections.investment ? (
              <div className="bg-sky-800 flex items-center gap-3 rounded-3xl p-2 px-5 text-white">
              <button onClick={handlenavigate3} className="  ">View more  </button><p ><FiChevronRight /></p>
              </div>
            ) : (
              ""
            )}
            </div>
          {/* {expandedSections.investment ? <FiChevronDown /> : <FiChevronRight />} */}

        

        </div>

        {expandedSections.investment && (
          <div className="grid md:grid-cols-2 gap-6 p-4 border-t">
            <div className="h-64">
              <Bar
                data={investmentROIData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: "Projected ROI (%)",
                      },
                    },
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.raw}% ROI`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">
                Capital Allocation Recommendations:
              </h4>
              <ul className="space-y-3">
                <li className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <strong className="block">
                    Increase marketing automation investment
                  </strong>
                  <p className="text-s">
                    120% projected ROI with payback in 9 months. Top performing
                    category.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Recommended allocation: $75K</span>
                    <span className="font-medium">Confidence: 88%</span>
                  </div>
                </li>
                <li className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <strong className="block">Upgrade IT infrastructure</strong>
                  <p className="text-s">
                    90% ROI with productivity gains and reduced downtime.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Recommended allocation: $120K</span>
                    <span className="font-medium">Confidence: 82%</span>
                  </div>
                </li>
                <li className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <strong className="block">Defer facilities expansion</strong>
                  <p className="text-s">
                    45% ROI doesn't meet current hurdle rate. Recommend
                    postponing 12 months.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Savings: $250K</span>
                    <span className="font-medium">Confidence: 75%</span>
                  </div>
                </li>
              </ul>
              <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-s">
                View Capital Investment Plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vendor Contract Optimization */}
      <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection("vendor")}
        >
          <div className="flex items-center">
            <FiUsers className="text-orange-500 mr-3 text-xl" />
            <div>
              <h3 className="text-lg font-semibold">
                Vendor Contract Optimization
              </h3>
              <p className="text-s text-gray-500">
                AI-driven insights for supplier negotiations
              </p>
            </div>
          </div>
          {expandedSections.vendor ? <FiChevronDown /> : <FiChevronRight />}
        </div>

        {expandedSections.vendor && (
          <div className="grid md:grid-cols-2 gap-6 p-4 border-t">
            <div className="h-64">
              <Bar
                data={vendorPerformanceData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      title: {
                        display: true,
                        text: "Performance Score (0-100)",
                      },
                    },
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.dataset.label}: ${context.raw}/100`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">
                Negotiation Recommendations:
              </h4>
              <ul className="space-y-3">
                <li className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                  <strong className="block">Renegotiate with Supplier D</strong>
                  <p className="text-s">
                    65% cost competitiveness score suggests 12-15% price
                    reduction possible.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Potential savings: $18K/yr</span>
                    <span className="font-medium">Priority: High</span>
                  </div>
                </li>
                <li className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                  <strong className="block">
                    Consolidate orders with Supplier B
                  </strong>
                  <p className="text-s">
                    92% cost score and 85% delivery. Volume discounts could save
                    8%.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Potential savings: $12K/yr</span>
                    <span className="font-medium">Priority: Medium</span>
                  </div>
                </li>
                <li className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                  <strong className="block">
                    Alternative sourcing for Supplier C
                  </strong>
                  <p className="text-s">
                    78% score with inconsistent delivery. AI identified 3 better
                    alternatives.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Potential savings: $22K/yr</span>
                    <span className="font-medium">Priority: High</span>
                  </div>
                </li>
              </ul>
              <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-s">
                Generate Negotiation Briefs
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tax Optimization */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection("tax")}
        >
          <div className="flex items-center">
            <FiPieChart className="text-indigo-500 mr-3 text-xl" />
            <div>
              <h3 className="text-lg font-semibold">
                Tax Optimization Strategies
              </h3>
              <p className="text-s text-gray-500">
                Legal ways to reduce tax liability
              </p>
            </div>
          </div>
          {expandedSections.tax ? <FiChevronDown /> : <FiChevronRight />}
        </div>

        {expandedSections.tax && (
          <div className="grid md:grid-cols-2 gap-6 p-4 border-t">
            <div className="h-64 flex items-center justify-center bg-indigo-50 rounded-lg">
              <div className="text-center p-4">
                <FiBarChart2 className="text-indigo-500 text-4xl mx-auto mb-3" />
                <h4 className="font-medium text-gray-700">
                  Current Effective Tax Rate
                </h4>
                <div className="text-3xl font-bold text-indigo-600 my-2">
                  24%
                </div>
                <p className="text-s text-gray-600">
                  vs. industry average of 21%
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">
                Tax Efficiency Recommendations:
              </h4>
              <ul className="space-y-3">
                <li className="p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                  <strong className="block">
                    Accelerate R&D tax credit claims
                  </strong>
                  <p className="text-s">
                    $45K potential credit based on current R&D spend. 92%
                    confidence.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Impact: -3% effective rate</span>
                    <span className="font-medium">Priority: High</span>
                  </div>
                </li>
                <li className="p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                  <strong className="block">
                    Restructure bonus depreciation
                  </strong>
                  <p className="text-s">
                    $28K tax deferral possible by adjusting capital expenditure
                    timing.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Impact: -2% effective rate</span>
                    <span className="font-medium">Priority: Medium</span>
                  </div>
                </li>
                <li className="p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                  <strong className="block">Optimize state tax nexus</strong>
                  <p className="text-s">
                    $15K savings by adjusting multi-state filing strategy.
                  </p>
                  <div className="mt-2 flex justify-between text-x text-gray-600">
                    <span>Impact: -1% effective rate</span>
                    <span className="font-medium">Priority: Low</span>
                  </div>
                </li>
              </ul>
              <div className="mt-4 flex space-x-3">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-s">
                  View Detailed Tax Plan
                </button>
                <button className="px-4 py-2  border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 text-s">
                  Schedule Tax Review
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIFinancialRecommendations;
