import React, { useState, useRef, useEffect } from 'react';
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
  Legend
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiDollarSign, 
  FiPieChart,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiPlus,
  FiChevronDown,
  FiX
} from 'react-icons/fi';
import { BsStars, BsThreeDotsVertical } from 'react-icons/bs';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import SmallAIChatBot from '../../pages/SmallAIChatBot';

// Register ChartJS components
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

const FinancialOverviewOld = () => {
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('Acme Corporation');
  const [activeWidgets, setActiveWidgets] = useState([
    'revenueTrend',
    'expenseBreakdown',
    'profitAnalysis',
    'cashFlow'
  ]);
  
  const [chartTypes, setChartTypes] = useState({
    revenueTrend: 'line',
    expenseBreakdown: 'pie',
    profitAnalysis: 'bar',
    cashFlow: 'line'
  });

  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({
    revenueTrend: false,
    expenseBreakdown: false,
    profitAnalysis: false,
    cashFlow: false
  });

  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
      if (aiChatbotRef.current && !aiChatbotRef.current.contains(event.target)) {
        setShowAIChatbot(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Enhanced chart data with additional details
  const revenueData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Revenue',
        data: [12000, 19000, 15000, 18000, 22000, 25000],
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        borderColor: 'rgba(14, 165, 233, 1)',
        borderWidth: 2,
        tension: 0.4,
      },
    ],
    details: [
      { month: 'January', value: '$12,000', change: '+5%', trend: 'up' },
      { month: 'February', value: '$19,000', change: '+58%', trend: 'up' },
      { month: 'March', value: '$15,000', change: '-21%', trend: 'down' },
      { month: 'April', value: '$18,000', change: '+20%', trend: 'up' },
      { month: 'May', value: '$22,000', change: '+22%', trend: 'up' },
      { month: 'June', value: '$25,000', change: '+14%', trend: 'up' }
    ]
  };

  const expenseData = {
    labels: ['Salaries', 'Marketing', 'Operations', 'R&D', 'IT'],
    datasets: [
      {
        label: 'Expenses',
        data: [50000, 20000, 15000, 10000, 5000],
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(234, 179, 8, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(139, 92, 246, 0.7)',
        ],
      },
    ],
    details: [
      { category: 'Salaries', value: '$50,000', percentage: '50%', color: 'bg-red-500' },
      { category: 'Marketing', value: '$20,000', percentage: '20%', color: 'bg-blue-500' },
      { category: 'Operations', value: '$15,000', percentage: '15%', color: 'bg-yellow-500' },
      { category: 'R&D', value: '$10,000', percentage: '10%', color: 'bg-green-500' },
      { category: 'IT', value: '$5,000', percentage: '5%', color: 'bg-purple-500' }
    ]
  };

  const profitData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Gross Profit',
        data: [45000, 48000, 52000, 55000],
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
      },
    ],
    details: [
      { quarter: 'Q1', value: '$45,000', change: '+8%', trend: 'up' },
      { quarter: 'Q2', value: '$48,000', change: '+7%', trend: 'up' },
      { quarter: 'Q3', value: '$52,000', change: '+8%', trend: 'up' },
      { quarter: 'Q4', value: '$55,000', change: '+6%', trend: 'up' }
    ]
  };

  const cashFlowData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Cash Flow',
        data: [5000, 7000, 4000, 9000, 6000, 8000],
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 2,
        tension: 0.4,
      },
    ],
    details: [
      { month: 'January', value: '$5,000', change: '+25%', trend: 'up' },
      { month: 'February', value: '$7,000', change: '+40%', trend: 'up' },
      { month: 'March', value: '$4,000', change: '-43%', trend: 'down' },
      { month: 'April', value: '$9,000', change: '+125%', trend: 'up' },
      { month: 'May', value: '$6,000', change: '-33%', trend: 'down' },
      { month: 'June', value: '$8,000', change: '+33%', trend: 'up' }
    ]
  };

  // Toggle chart type
  const toggleChartType = (widgetId, type) => {
    setChartTypes({
      ...chartTypes,
      [widgetId]: type
    });
    setShowChartTypeDropdown({
      ...showChartTypeDropdown,
      [widgetId]: false
    });
  };

  // Toggle chart type dropdown
  const toggleChartTypeDropdown = (widgetId) => {
    setShowChartTypeDropdown({
      ...showChartTypeDropdown,
      [widgetId]: !showChartTypeDropdown[widgetId]
    });
  };

  // Render chart based on type
  const renderChart = (type, data, options = {}) => {
    switch(type) {
      case 'line':
        return <Line data={data} options={options} />;
      case 'bar':
        return <Bar data={data} options={options} />;
      case 'pie':
        return <Pie data={data} options={options} />;
      case 'doughnut':
        return <Doughnut data={data} options={options} />;
      default:
        return <Line data={data} options={options} />;
    }
  };

  // Enhanced ChartCard component with larger chart and smaller content
  const EnhancedChartCard = ({ title, chartType, chartData, children, widgetId }) => {
    return (
      <div className="bg-white p-6 rounded-xl  hover:shadow-md transition-all duration-300 ">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-sky-900">{title}</h3>
          <div className="flex space-x-2 relative">
            <div className="relative">
              <button 
                onClick={() => toggleChartTypeDropdown(widgetId)}
                className="p-1 rounded hover:bg-gray-100"
                data-tooltip-id="chart-type-tooltip"
                data-tooltip-content="Change chart type"
              >
                <BsThreeDotsVertical />
              </button>
              {showChartTypeDropdown[widgetId] && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <div className="py-1">
                    <button 
                      onClick={() => toggleChartType(widgetId, 'line')}
                      className="block w-full text-left px-4 py-2 text-s text-gray-700 hover:bg-gray-100"
                    >
                      Line Chart
                    </button>
                    <button 
                      onClick={() => toggleChartType(widgetId, 'bar')}
                      className="block w-full text-left px-4 py-2 text-s text-gray-700 hover:bg-gray-100"
                    >
                      Bar Chart
                    </button>
                    <button 
                      onClick={() => toggleChartType(widgetId, 'pie')}
                      className="block w-full text-left px-4 py-2 text-s text-gray-700 hover:bg-gray-100"
                    >
                      Pie Chart
                    </button>
                    <button 
                      onClick={() => toggleChartType(widgetId, 'doughnut')}
                      className="block w-full text-left px-4 py-2 text-s text-gray-700 hover:bg-gray-100"
                    >
                      Doughnut Chart
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowAIChatbot(!showAIChatbot)}
              className="p-1 rounded hover:bg-gray-100"
              data-tooltip-id="ai-tooltip"
              data-tooltip-content="Ask AI"
            >
              <BsStars />
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Larger chart area - now taking 2/3 of space */}
          <div className="w-full md:w-2/3 h-auto">
            {renderChart(chartType, {
              labels: chartData.labels,
              datasets: chartData.datasets
            })}
          </div>
          {/* Smaller content area - now taking 1/3 of space */}
          <div className="w-full md:w-1/3">
            {children}
          </div>
        </div>
      </div>
    );
  };

  // Compact DataDisplay components
  const RevenueDataDisplay = ({ data }) => (
    <div className="overflow-y-auto max-h-64">
      <h4 className="font-medium text-gray-700 mb-2 text-s">Monthly Breakdown</h4>
      <div className="space-y-1">
        {data.details.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded text-x">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                item.trend === 'up' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">{item.month}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">{item.value}</span>
              <span className={`px-1 py-0.5 rounded ${
                item.trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {item.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ExpenseDataDisplay = ({ data }) => (
    <div className="overflow-y-auto max-h-64">
      <h4 className="font-medium text-gray-700 mb-2 text-s">Expense Categories</h4>
      <div className="space-y-2">
        {data.details.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between text-x mb-0.5">
              <span className="font-medium">{item.category}</span>
              <span>{item.value} ({item.percentage})</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${item.color}`} 
                style={{ width: item.percentage }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ProfitDataDisplay = ({ data }) => (
    <div className="overflow-y-auto max-h-64">
      <h4 className="font-medium text-gray-700 mb-2 text-s">Quarterly Performance</h4>
      <div className="space-y-1">
        {data.details.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded text-x">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                item.trend === 'up' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">{item.quarter}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">{item.value}</span>
              <span className={`px-1 py-0.5 rounded ${
                item.trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {item.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const CashFlowDataDisplay = ({ data }) => (
    <div className="overflow-y-auto max-h-64">
      <h4 className="font-medium text-gray-700 mb-2 text-s">Monthly Cash Flow</h4>
      <div className="space-y-1">
        {data.details.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded text-x">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                item.trend === 'up' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">{item.month}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium mr-2">{item.value}</span>
              <span className={`px-1 py-0.5 rounded ${
                item.trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {item.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4 min-h-screen relative">
      {/* AI Chatbot */}
      {showAIChatbot && (
        <div className="fixed right-0 top-17 h-[90%] z-50" ref={aiChatbotRef}>
          <SmallAIChatBot onClose={() => setShowAIChatbot(false)} />
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Financial Overview</h1>
            <p className="text-sky-100 text-s">{selectedCompany}</p>
          </div>
          <div className="flex space-x-2">
            <button 
              type="button" 
              className="flex items-center py-2 px-3 text-s font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter className="mr-1" />
              Filters
            </button>
            <button 
              type="button" 
              className="flex items-center py-2 px-3 text-s font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiPlus className="mr-1" />
              Add Widget
            </button>
          </div>
        </div>
      </div>
      
      {/* Filter Options (Collapsible) */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Date Range</label>
              <select className="w-full p-2 border border-gray-300 rounded-md">
                <option>Month</option>
                <option>Quarter</option>
                <option>YTD</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Business Unit</label>
              <select className="w-full p-2 border border-gray-300 rounded-md">
                <option>All</option>
                <option>North America</option>
                <option>Europe</option>
                <option>Asia</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Geography</label>
              <select className="w-full p-2 border border-gray-300 rounded-md">
                <option>All</option>
                <option>USA</option>
                <option>UK</option>
                <option>Germany</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Client Demographics</label>
              <select className="w-full p-2 border border-gray-300 rounded-md">
                <option>All</option>
                <option>By Industry</option>
                <option>By Sales Person</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Revenue" 
          value="$250,000" 
          change="+13.6%" 
          isPositive={true} 
          icon={<FiTrendingUp className="text-green-500" size={24} />}
          onAIClick={() => setShowAIChatbot(!showAIChatbot)}
        />
        <KPICard 
          title="Total Expenses" 
          value="$85,000" 
          change="+6.2%" 
          isPositive={false} 
          icon={<FiTrendingDown className="text-red-500" size={24} />}
          onAIClick={() => setShowAIChatbot(!showAIChatbot)}
        />
        <KPICard 
          title="Gross Profit" 
          value="$165,000" 
          change="+18.9%" 
          isPositive={true} 
          icon={<FiDollarSign className="text-blue-500" size={24} />}
          onAIClick={() => setShowAIChatbot(!showAIChatbot)}
        />
        <KPICard 
          title="EBITDA" 
          value="$64,000" 
          change="+15.3%" 
          isPositive={true} 
          icon={<FiPieChart className="text-purple-500" size={24} />}
          onAIClick={() => setShowAIChatbot(!showAIChatbot)}
        />
      </div>
      
      {/* Charts Section - Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Widget */}
        {activeWidgets.includes('revenueTrend') && (
          <EnhancedChartCard 
            title="Revenue Trend"
            chartType={chartTypes.revenueTrend}
            chartData={revenueData}
            widgetId="revenueTrend"
          >
            <RevenueDataDisplay data={revenueData} />
          </EnhancedChartCard>
        )}

        {/* Expense Breakdown Widget */}
        {activeWidgets.includes('expenseBreakdown') && (
          <EnhancedChartCard 
            title="Expense Breakdown"
            chartType={chartTypes.expenseBreakdown}
            chartData={expenseData}
            widgetId="expenseBreakdown"
          >
            <ExpenseDataDisplay data={expenseData} />
          </EnhancedChartCard>
        )}

        {/* Profit Analysis Widget */}
        {activeWidgets.includes('profitAnalysis') && (
          <EnhancedChartCard 
            title="Profit Analysis"
            chartType={chartTypes.profitAnalysis}
            chartData={profitData}
            widgetId="profitAnalysis"
          >
            <ProfitDataDisplay data={profitData} />
          </EnhancedChartCard>
        )}

        {/* Cash Flow Widget */}
        {activeWidgets.includes('cashFlow') && (
          <EnhancedChartCard 
            title="Cash Flow"
            chartType={chartTypes.cashFlow}
            chartData={cashFlowData}
            widgetId="cashFlow"
          >
            <CashFlowDataDisplay data={cashFlowData} />
          </EnhancedChartCard>
        )}
      </div>

      {/* Tooltips */}
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

// KPI Card Component with AI Button
const KPICard = ({ title, value, change, isPositive, icon, onAIClick }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 group border border-sky-100">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-s font-medium text-sky-700">{title}</p>
            <button 
              onClick={onAIClick}
              className="text-gray-400 hover:text-sky-600"
              data-tooltip-id="ai-tooltip"
              data-tooltip-content="Ask AI"
            >
              <BsStars size={14} />
            </button>
          </div>
          <h3 className="text-2xl font-bold mt-1 text-sky-900">{value}</h3>
          <div className={`flex items-center mt-2 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            <span className="text-s font-medium">
              {change} {isPositive ? '↑' : '↓'} vs last period
            </span>
          </div>
        </div>
        <div className="p-3 rounded-full bg-sky-100 group-hover:bg-sky-200 transition-colors duration-200">
          <div className="text-sky-600 group-hover:text-sky-800 transition-colors duration-200">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialOverviewOld;