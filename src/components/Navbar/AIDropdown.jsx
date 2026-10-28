import React, { useEffect, useRef, useState } from 'react';

const AIDropdown = ({ isOpen, onClose }) => {
  const dropdownRef = useRef(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);

  const menuItems = {
    title: "AI-driven Insights & Alerts",
    children: [
      {
        title: "Smart Financial Alerts",
        type: "sub",
        children: [
          { title: "Smart Financial Alerts Overview", path: "/smart-financial-alerts" },
          { title: "Cash Shortfall Warning", path: "/CashShortfallWarning" },
          { title: "Budget Overrun Alerts", path: "/BudgetOverrunAlerts" },
          { title: "Revenue Drop & Sales Decline Alerts", path: "/RevenueDropAlerts" },
          { title: "Expense Spike Detection", path: "/ExpenseSpikeDetection" },
          { title: "Accounts Receivable Aging Alerts", path: "/AccountsReceivableAlerts" },
          { title: "Accounts Payable Due Alerts", path: "/AccountsPayableAlerts" }
        ]
      },
      {
        title: "AI-Powered Financial Recommendations",
        type: "sub",
        children: [
          { title: "AI-Powered Overview", path: "/aI-financial-recommendations" },
          { title: "Cost Optimization Suggestions", path: "/cost-optimization-suggestions" },
          { title: "Revenue Growth Strategies", path: "/revenue-growth-strategies" },
          { title: "Profitability Enhancement Plans", path: "/ProfitabilityEnhancement" },
          { title: "Investment & Capital Allocation Advice", path: "/InvestmentCapitalAllocation" },
          // { title: "Vendor Contract Negotiation Suggestions", path: "#" },
          // { title: "Tax Optimization & Compliance Suggestions", path: "#" }
        ]
      },
      {
        title: "Predictive Risk Management",
        type: "sub",
        children: [
          { title: "Predictive Risk Management", path: "PredictiveRiskManagement" },
          // { title: "Financial Fraud & Anomaly Detection", path: "#fraud-detection" },
          // { title: "Operational Risk Alerts", path: "#operational-risk" },
          // { title: "Market Volatility & External Risk Alerts", path: "#market-risk" },
          // { title: "Debt Repayment & Interest Rate Risks", path: "#debt-risk" },
          // { title: "Customer Churn Risk Forecasting", path: "#churn-risk" },
          // { title: "Credit Risk Exposure", path: "#credit-risk" }
        ]
      },
      {
        title: "AI-Driven Forecast Accuracy Monitoring",
        type: "sub",
        children: [
          { title: "AI-Driven Forecast Accuracy Monitoring", path: "/ForecastAccuracyMonitoring" },
          // { title: "Revenue Forecast Deviation Analysis", path: "ForecastAccuracyMonitoring" },
          // { title: "Expense Forecast Accuracy", path: "#expense-forecast" },
          // { title: "Cash Flow Forecast Reliability", path: "#cashflow-forecast" },
          // { title: "AI Model Confidence Scores", path: "#model-confidence" },
          // { title: "Forecast Adjustment History", path: "#forecast-history" }
        ]
      },
      {
        title: "AI-Powered Benchmarking & Peer Comparisons",
        type: "sub",
        children: [
          { title: "Benchmarking & Peer Comparisons", path: "/BenchmarkingPeerComparisons" },
          // { title: "Industry Profitability Comparison", path: "#profitability-comparison" },
          // { title: "Revenue Growth Benchmarking", path: "#revenue-benchmark" },
          // { title: "Operational Cost Efficiency Index", path: "#cost-efficiency" },
          // { title: "Debt & Leverage Comparisons", path: "#debt-comparison" },
          // { title: "Employee Productivity Metrics", path: "#productivity-metrics" },
          // { title: "Market Expansion & Performance Trends", path: "#market-expansion" }
        ]
      }
    ]
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
        setOpenSubmenu(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  }, [isOpen, onClose, hoverTimeout]);

  const handleMouseEnter = (index) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoverTimeout(setTimeout(() => {
      setOpenSubmenu(index);
    }, 200));
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoverTimeout(setTimeout(() => {
      setOpenSubmenu(null);
    }, 200));
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl z-50 overflow-visible border border-gray-200"
    >
      <div className="p-4 border-b border-gray-200 bg-sky-50">
        <h3 className="text-sky-800 font-semibold text-lg">{menuItems.title}</h3>
      </div>
      
      <div className="py-2">
        {menuItems.children.map((item, index) => (
          <div 
            key={index} 
            className="relative"
            onMouseEnter={() => item.type === 'sub' ? handleMouseEnter(index) : null}
            onMouseLeave={handleMouseLeave}
          >
            <div 
              className={`flex justify-between items-center px-4 py-3 text-gray-700 hover:text-white hover:bg-sky-600 cursor-pointer transition-colors duration-200 ${openSubmenu === index ? 'bg-sky-100 text-sky-800' : ''}`}
            >
              <div className="flex-1 font-medium">{item.title}</div>
              {item.type === 'sub' && (
                <svg 
                  className={`w-4 h-4 transform transition-transform ${openSubmenu === index ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
            
            {item.type === 'sub' && openSubmenu === index && (
              <div 
                className="absolute left-full top-0 ml-1 w-72 bg-sky-200 border-b-sky-900 border border-gray-200 rounded-r-lg shadow-lg z-50 overflow-hidden"
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="max-h-96 overflow-y-auto">
                  {item.children.map((subItem, subIndex) => (
                    <a 
                      key={subIndex} 
                      href={subItem.path}
                      className="block px-4 py-3 hover:bg-sky-50 transition-colors border-b border-gray-100 last:border-b-0 text-s text-sky-800"
                    >
                      {subItem.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIDropdown;