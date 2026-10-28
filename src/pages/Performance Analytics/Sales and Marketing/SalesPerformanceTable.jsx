import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiDownload, FiChevronRight, FiDollarSign, FiTrendingUp, FiUser, FiPieChart, FiFilter, FiSend } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { Tooltip } from 'react-tooltip';
import { motion } from 'framer-motion';

const SalesPerformanceTable = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('kpis');
  const [aiInput, setAiInput] = useState('');
  const [aiResponses, setAiResponses] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [showAdvancedInsights, setShowAdvancedInsights] = useState(false);

  // KPI Data
  const kpiData = [
    { 
      title: 'Total Revenue', 
      value: '$2,546,000', 
      change: '-25%', 
      isPositive: false, 
      icon: <FiDollarSign />,
      forecast: '$2.8M predicted next quarter',
      aiSuggestion: 'Revenue decline detected. Consider reviewing pricing strategy and customer retention programs.',
      winProbability: null
    },
    { 
      title: 'Revenue Per Segment', 
      value: '$152,000', 
      change: '+8%', 
      isPositive: true, 
      icon: <FiPieChart />,
      forecast: '$165K predicted next quarter',
      aiSuggestion: 'Strong growth in segment revenue. Identify top-performing segments for further investment.',
      winProbability: null
    },
    { 
      title: 'Sales Team Cost', 
      value: '$485,000', 
      change: '+12%', 
      isPositive: false, 
      icon: <FiUser />,
      forecast: '$520K predicted next quarter',
      aiSuggestion: 'Costs rising faster than revenue. Evaluate team productivity and compensation structure.',
      winProbability: null
    },
    { 
      title: 'Leads', 
      value: '12,500', 
      change: '+15%', 
      isPositive: true, 
      icon: <FiTrendingUp />,
      forecast: '13,500 predicted next quarter',
      aiSuggestion: 'Lead generation performing well. Focus on improving lead-to-opportunity conversion.',
      winProbability: null
    },
    { 
      title: 'Opportunities', 
      value: '4,890', 
      change: '+10%', 
      isPositive: true, 
      icon: <FiFilter />,
      forecast: '5,200 predicted next quarter',
      aiSuggestion: 'Opportunity growth is healthy. Review sales process for bottlenecks in later stages.',
      winProbability: null
    },
    { 
      title: 'Wins', 
      value: '628', 
      change: '+5%', 
      isPositive: true, 
      icon: <FiTrendingUp />,
      forecast: '700 predicted next quarter',
      aiSuggestion: 'Win rate needs improvement. Consider competitive analysis and deal coaching.',
      winProbability: null
    }
  ];

  // Enhanced Revenue Trend Data with Win Probability
  const revenueTrendData = [
    { week: 'Jun 1', opportunities: 320, wins: 40, revenue: '$150K', aiSuggestion: 'Starting point shows baseline performance', winProbability: '68%' },
    { week: 'Jun 8', opportunities: 310, wins: 45, revenue: '$160K', aiSuggestion: 'Slight dip in opportunities but win rate improved', winProbability: '72%' },
    { week: 'Jun 15', opportunities: 290, wins: 50, revenue: '$170K', aiSuggestion: 'Opportunities down but revenue up - higher value deals?', winProbability: '75%' },
    { week: 'Jun 22', opportunities: 330, wins: 55, revenue: '$180K', aiSuggestion: 'End-of-month push showing positive results', winProbability: '78%' },
    { week: 'Jun 29', opportunities: 340, wins: 60, revenue: '$190K', aiSuggestion: 'Consistent weekly growth pattern emerging', winProbability: '82%' },
    { week: 'Jul 6', opportunities: 350, wins: 65, revenue: '$200K', aiSuggestion: 'New quarter starting strong', winProbability: '85%' },
    { week: 'Jul 13', opportunities: 360, wins: 70, revenue: '$210K', aiSuggestion: 'Steady progression in all metrics', winProbability: '88%' },
    { week: 'Jul 20', opportunities: 370, wins: 75, revenue: '$220K', aiSuggestion: 'Mid-month performance consistent', winProbability: '90%' },
    { week: 'Jul 27', opportunities: 380, wins: 80, revenue: '$230K', aiSuggestion: 'End-of-month peak as expected', winProbability: '92%' },
    { week: 'Aug 3', opportunities: 390, wins: 85, revenue: '$240K', aiSuggestion: 'New month starting at higher baseline', winProbability: '94%' },
    { week: 'Aug 10', opportunities: 400, wins: 90, revenue: '$250K', aiSuggestion: 'Growth trend continuing', winProbability: '95%' },
    { week: 'Aug 17', opportunities: 410, wins: 95, revenue: '$260K', aiSuggestion: 'Performance accelerating', winProbability: '96%' },
    { week: 'Aug 24', opportunities: 420, wins: 100, revenue: '$270K', aiSuggestion: 'Approaching monthly record', winProbability: '97%' },
    { week: 'Aug 31', opportunities: 430, wins: 105, revenue: '$280K', aiSuggestion: 'Strong finish to the month', winProbability: '98%' }
  ];

  // Enhanced Lead Source Data with AI Scoring
  const leadSourceData = [
    { source: 'Web', opportunities: 1213, avgRevenue: '$152.8K', aiSuggestion: 'High volume with good revenue. Optimize web conversion paths.', aiScore: 85, optimalPricing: '+5-8%' },
    { source: 'Social Media', opportunities: 1136, avgRevenue: '$119.3K', aiSuggestion: 'Strong volume but lower value. Consider targeting higher-value segments.', aiScore: 72, optimalPricing: 'Current' },
    { source: 'Phone', opportunities: 948, avgRevenue: '$227.4K', aiSuggestion: 'Highest value leads. Increase outbound calling efforts.', aiScore: 92, optimalPricing: '+10-12%' },
    { source: 'Others', opportunities: 635, avgRevenue: '$201.4K', aiSuggestion: 'Miscellaneous sources performing well. Investigate top contributors.', aiScore: 78, optimalPricing: '+3-5%' },
    { source: 'Email', opportunities: 508, avgRevenue: '$137.6K', aiSuggestion: 'Moderate performance. Test new email strategies.', aiScore: 65, optimalPricing: 'Current' },
    { source: 'PPC', opportunities: 306, avgRevenue: '$94.8K', aiSuggestion: 'Lowest value leads. Review targeting and ad spend.', aiScore: 45, optimalPricing: '-5-8%' },
    { source: 'Event', opportunities: 153, avgRevenue: '$84.2K', aiSuggestion: 'Low volume and value. Evaluate event ROI.', aiScore: 38, optimalPricing: '-10-12%' }
  ];

  const productRevenueData = [
    { product: 'Data Science', revenue: '$1,650,000', percentage: '64.89%', aiSuggestion: 'Core revenue driver. Consider upselling/cross-selling opportunities.', pricingTier: 'Premium', discountRecommendation: 'Max 5%' },
    { product: 'Computer Science', revenue: '$480,000', percentage: '18.86%', aiSuggestion: 'Solid secondary product. Bundle with Data Science for growth.', pricingTier: 'Standard', discountRecommendation: '5-10%' },
    { product: 'Arts', revenue: '$210,000', percentage: '8.19%', aiSuggestion: 'Niche product with potential. Target specific buyer personas.', pricingTier: 'Value', discountRecommendation: '10-15%' },
    { product: 'Business', revenue: '$205,000', percentage: '8.07%', aiSuggestion: 'Balanced performance. Align with corporate training needs.', pricingTier: 'Standard', discountRecommendation: '5-10%' }
  ];

  const regionRevenueData = [
    { region: 'North America', revenue: '$1,500,000', percentage: '58.8%', aiSuggestion: 'Primary market. Focus on customer retention and expansion.', winRate: '28%', dealSize: '$45K' },
    { region: 'Europe', revenue: '$600,000', percentage: '23.5%', aiSuggestion: 'Strong secondary market. Localize marketing efforts.', winRate: '22%', dealSize: '$38K' },
    { region: 'Asia', revenue: '$300,000', percentage: '11.8%', aiSuggestion: 'High growth potential. Invest in local partnerships.', winRate: '18%', dealSize: '$32K' },
    { region: 'South America', revenue: '$100,000', percentage: '3.9%', aiSuggestion: 'Emerging market. Test localized offerings.', winRate: '15%', dealSize: '$28K' },
    { region: 'Africa', revenue: '$46,000', percentage: '1.8%', aiSuggestion: 'Nascent market. Focus on key urban centers.', winRate: '12%', dealSize: '$24K' }
  ];

  // Enhanced Customer Stage Data with Velocity Metrics
  const customerStageData = [
    { stage: 'Prospect', customers: 5000, aiSuggestion: 'Large pool. Improve qualification criteria.', avgDays: 5, conversionRate: '80%' },
    { stage: 'Qualify', customers: 4000, aiSuggestion: 'Good progression. Strengthen discovery process.', avgDays: 7, conversionRate: '75%' },
    { stage: 'Presentation/Demo', customers: 3000, aiSuggestion: 'Significant drop-off. Enhance demo effectiveness.', avgDays: 10, conversionRate: '60%' },
    { stage: 'Proposal', customers: 2000, aiSuggestion: 'Further attrition. Refine proposal strategy.', avgDays: 14, conversionRate: '50%' },
    { stage: 'Negotiation', customers: 1000, aiSuggestion: 'Half make it to negotiation. Improve deal shaping.', avgDays: 21, conversionRate: '40%' },
    { stage: 'Close', customers: 628, aiSuggestion: 'Final conversion needs work. Focus on closing techniques.', avgDays: 30, conversionRate: '25%' }
  ];

  // Enhanced Sales Person Data with Coaching Recommendations
  const salesPersonData = [
    { 
      name: 'Andree Repp', 
      revenue: '$227,412', 
      aiSuggestion: 'Top performer. Identify best practices for team.',
      winRate: '32%',
      coachingRecommendation: 'Mentor junior team members',
      dealVelocity: '22 days',
      strengths: 'Discovery, Closing'
    },
    { 
      name: 'Salla Yes', 
      revenue: '$201,384', 
      aiSuggestion: 'Strong results. Potential for further growth.',
      winRate: '28%',
      coachingRecommendation: 'Advanced negotiation training',
      dealVelocity: '28 days',
      strengths: 'Relationship Building'
    },
    { 
      name: 'Shannah Biden', 
      revenue: '$119,267', 
      aiSuggestion: 'Below average. Needs coaching or reassignment.',
      winRate: '18%',
      coachingRecommendation: 'Fundamentals bootcamp + shadowing',
      dealVelocity: '45 days',
      strengths: 'Product Knowledge'
    },
    { 
      name: 'Hanny Giraudoux', 
      revenue: '$152,803', 
      aiSuggestion: 'Solid middle performer. Could specialize.',
      winRate: '24%',
      coachingRecommendation: 'Industry specialization training',
      dealVelocity: '32 days',
      strengths: 'Prospecting'
    },
    { 
      name: 'Thali Bour', 
      revenue: '$94,763', 
      aiSuggestion: 'Lowest performer. Requires performance plan.',
      winRate: '15%',
      coachingRecommendation: 'Performance improvement plan',
      dealVelocity: '52 days',
      strengths: 'N/A'
    }
  ];

  const salesTeamCostData = [
    { category: 'Salaries', cost: '$300,000', percentage: '61.9%', aiSuggestion: 'Fixed cost. Ensure alignment with productivity.', roi: '4.2x' },
    { category: 'Commissions', cost: '$120,000', percentage: '24.7%', aiSuggestion: 'Performance-based. Review incentive structure.', roi: '5.8x' },
    { category: 'Training', cost: '$35,000', percentage: '7.2%', aiSuggestion: 'Investment in skills. Measure ROI.', roi: '3.1x' },
    { category: 'Travel', cost: '$20,000', percentage: '4.1%', aiSuggestion: 'Client-facing expense. Optimize with virtual meetings.', roi: '2.4x' },
    { category: 'Tools', cost: '$10,000', percentage: '2.1%', aiSuggestion: 'Enablement cost. Ensure full utilization.', roi: '6.2x' }
  ];

  const funnelMetricsData = [
    { stage: 'Leads', count: '12,500', conversion: '100%', aiSuggestion: 'Lead generation healthy. Focus on quality.', aiScore: 78 },
    { stage: 'Opportunities', count: '4,890', conversion: '39.1%', aiSuggestion: 'Qualification process needs refinement.', aiScore: 65 },
    { stage: 'Wins', count: '628', conversion: '12.8%', aiSuggestion: 'Closing rate low. Review sales process.', aiScore: 45 }
  ];

  // Enhanced AI Suggestions with Predictive Insights
  const aiSuggestions = {
    kpis: "Key metrics show mixed performance. Revenue is down but leads are up. Focus on improving conversion rates. AI predicts 72% chance of hitting Q4 targets if win rate improves by 5%.",
    revenueTrend: "Revenue shows steady weekly growth. The last week of each month shows strongest performance. AI detects 85% probability of maintaining growth if current trends continue.",
    leadSource: "Phone leads generate the highest average revenue (AI score: 92/100). Consider increasing phone-based outreach. Web leads could support 5-8% price increase based on elasticity modeling.",
    productRevenue: "Data Science dominates revenue. Consider bundling with other products to increase their performance. AI recommends testing 8% price increase on Data Science with 78% predicted acceptance rate.",
    regionRevenue: "North America is the strongest market (28% win rate). Asia shows potential for growth with targeted campaigns. AI suggests focusing on deals >$30K in Asia for optimal ROI.",
    customerStage: "Conversion drops significantly after Presentation stage (60% to 50%). Improve demo-to-proposal transition. AI identifies 22% faster deal velocity for reps who use discovery frameworks.",
    salesPerson: "Andree Repp is the top performer (32% win rate). Shannah Biden may need additional training (18% win rate). AI recommends pairing Shannah with Andree for mentorship.",
    salesTeamCost: "Salaries make up majority of costs (ROI: 4.2x). Commissions show highest ROI (5.8x). AI suggests reallocating 5% of salary budget to performance incentives for 12% predicted revenue lift.",
    funnelMetrics: "Opportunity-to-win conversion needs improvement (12.8%). AI identifies 3 key bottlenecks in the sales process that account for 68% of lost deals."
  };

  // Advanced AI Insights Data
  const advancedInsights = {
    winLossPrediction: [
      { opportunity: 'Acme Corp Expansion', stage: 'Proposal', value: '$150K', probability: '72%', keyFactors: ['Strong champion', 'Multi-year deal', 'Competitor weakness'] },
      { opportunity: 'Beta Inc Renewal', stage: 'Negotiation', value: '$85K', probability: '88%', keyFactors: ['Existing customer', 'High usage', 'Limited alternatives'] },
      { opportunity: 'Gamma Tech New Biz', stage: 'Presentation', value: '$210K', probability: '45%', keyFactors: ['New relationship', 'Budget constraints', 'Evaluation period'] }
    ],
    leadScoring: [
      { lead: 'Tech Solutions Inc', score: 92, factors: ['CTO engaged', 'Budget confirmed', 'Use case match'], recommendedAction: 'Prioritize - high intent' },
      { lead: 'Digital Innovators', score: 78, factors: ['Director level contact', 'Pilot discussed', 'Timeline Q2'], recommendedAction: 'Nurture - strong potential' },
      { lead: 'Cloud Advisors', score: 45, factors: ['Junior contact', 'No budget', 'Early research'], recommendedAction: 'Educate - long timeline' }
    ],
    repCoaching: [
      { rep: 'Shannah Biden', area: 'Discovery', recommendation: 'Implement SPIN questioning framework', resources: ['SPIN Selling Guide', 'Discovery Playbook'] },
      { rep: 'Thali Bour', area: 'Closing', recommendation: 'Practice objection handling drills', resources: ['Objection Library', 'Closing Scripts'] },
      { rep: 'Hanny Giraudoux', area: 'Prospecting', recommendation: 'Focus on ideal customer profile', resources: ['ICP Worksheet', 'Email Templates'] }
    ],
    pricingOptimization: [
      { product: 'Data Science', current: '$12K', recommended: '$12,960', confidence: '78%', expectedImpact: '+8% revenue, -3% volume' },
      { product: 'Arts', current: '$8K', recommended: '$7,200', confidence: '82%', expectedImpact: '-10% price, +15% volume' },
      { product: 'Business', current: '$10K', recommended: '$9,500', confidence: '65%', expectedImpact: '-5% price, +8% volume' }
    ]
  };

  const handleSendAIQuery = () => {
    if (!aiInput.trim()) return;
    const mockResponse = `AI analysis for ${activeTab}: ${aiSuggestions[activeTab]}`;
    setAiResponses(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), { query: aiInput, response: mockResponse }]
    }));
    setAiInput('');
  };

  const exportToExcel = (data, sheetName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'kpis': return kpiData;
      case 'revenueTrend': return revenueTrendData;
      case 'leadSource': return leadSourceData;
      case 'productRevenue': return productRevenueData;
      case 'regionRevenue': return regionRevenueData;
      case 'customerStage': return customerStageData;
      case 'salesPerson': return salesPersonData;
      case 'salesTeamCost': return salesTeamCostData;
      case 'funnelMetrics': return funnelMetricsData;
      default: return kpiData;
    }
  };

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'kpis':
        return [
          { header: 'KPI', accessor: 'title' },
          { header: 'Value', accessor: 'value' },
          { header: 'Change', accessor: 'change' },
          { header: 'Trend', accessor: 'isPositive' },
          { header: 'Forecast', accessor: 'forecast' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'revenueTrend':
        return [
          { header: 'Week', accessor: 'week' },
          { header: 'Opportunities', accessor: 'opportunities' },
          { header: 'Wins', accessor: 'wins' },
          { header: 'Revenue', accessor: 'revenue' },
          { header: 'Win Probability', accessor: 'winProbability' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'leadSource':
        return [
          { header: 'Lead Source', accessor: 'source' },
          { header: 'Opportunities', accessor: 'opportunities' },
          { header: 'Avg Revenue', accessor: 'avgRevenue' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'Optimal Pricing', accessor: 'optimalPricing' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'productRevenue':
        return [
          { header: 'Product', accessor: 'product' },
          { header: 'Revenue', accessor: 'revenue' },
          { header: 'Percentage', accessor: 'percentage' },
          { header: 'Pricing Tier', accessor: 'pricingTier' },
          { header: 'Discount Rec', accessor: 'discountRecommendation' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'regionRevenue':
        return [
          { header: 'Region', accessor: 'region' },
          { header: 'Revenue', accessor: 'revenue' },
          { header: 'Percentage', accessor: 'percentage' },
          { header: 'Win Rate', accessor: 'winRate' },
          { header: 'Avg Deal Size', accessor: 'dealSize' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'customerStage':
        return [
          { header: 'Stage', accessor: 'stage' },
          { header: 'Customers', accessor: 'customers' },
          { header: 'Avg Days', accessor: 'avgDays' },
          { header: 'Conversion', accessor: 'conversionRate' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'salesPerson':
        return [
          { header: 'Sales Person', accessor: 'name' },
          { header: 'Revenue', accessor: 'revenue' },
          { header: 'Win Rate', accessor: 'winRate' },
          { header: 'Coaching Rec', accessor: 'coachingRecommendation' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'salesTeamCost':
        return [
          { header: 'Category', accessor: 'category' },
          { header: 'Cost', accessor: 'cost' },
          { header: 'Percentage', accessor: 'percentage' },
          { header: 'ROI', accessor: 'roi' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'funnelMetrics':
        return [
          { header: 'Stage', accessor: 'stage' },
          { header: 'Count', accessor: 'count' },
          { header: 'Conversion', accessor: 'conversion' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Breadcrumb Navigation */}
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
              <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
              </svg>
              Home
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <Link to="/sales-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Sales Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Detailed View</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Sales Performance Data</h1>
            <p className="text-sky-100 text-x">Detailed tabular view of all sales metrics with AI insights</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => exportToExcel(getCurrentData(), activeTab)}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export to Excel
            </button>
            <CSVLink
              data={getCurrentData()}
              filename={`sales_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export to CSV
            </CSVLink>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'kpis', label: 'Key Metrics' },
            { id: 'revenueTrend', label: 'Revenue Trend' },
            { id: 'leadSource', label: 'Lead Source' },
            { id: 'productRevenue', label: 'Product Revenue' },
            { id: 'regionRevenue', label: 'Regional Revenue' },
            { id: 'customerStage', label: 'Customer Stage' },
            { id: 'salesPerson', label: 'Sales Team' },
            { id: 'salesTeamCost', label: 'Cost Analysis' },
            { id: 'funnelMetrics', label: 'Sales Funnel' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-3 text-s font-medium whitespace-nowrap ${activeTab === tab.id ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-blue-500'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {activeTab === 'kpis' && 'Key Performance Indicators'}
              {activeTab === 'revenueTrend' && 'Revenue Trend Data'}
              {activeTab === 'leadSource' && 'Lead Source Performance'}
              {activeTab === 'productRevenue' && 'Product Revenue Breakdown'}
              {activeTab === 'regionRevenue' && 'Regional Revenue Distribution'}
              {activeTab === 'customerStage' && 'Customer Stage Analysis'}
              {activeTab === 'salesPerson' && 'Sales Team Performance'}
              {activeTab === 'salesTeamCost' && 'Sales Team Cost Analysis'}
              {activeTab === 'funnelMetrics' && 'Sales Funnel Metrics'}
            </h2>
            <div className="flex space-x-2">
              {/* <button
                onClick={() => setShowAdvancedInsights(!showAdvancedInsights)}
                className="flex items-center px-3 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-s"
              >
                <BsStars className="mr-1" /> Predictive Insights
              </button> */}
              <button
                onClick={() => setShowAIDropdown(!showAIDropdown)}
                className="flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-s"
              >
                <BsStars className="mr-1" /> AI Insights
              </button>
            </div>
          </div>

          {showAIDropdown && (
            <motion.div
              className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-s font-semibold text-blue-800 mb-2">AI Suggestions</h3>
              <p className="text-s text-blue-700 mb-3">{aiSuggestions[activeTab]}</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask about this data..."
                  className="flex-1 p-2 border border-blue-300 rounded-lg text-s focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendAIQuery}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!aiInput.trim()}
                >
                  <FiSend />
                </button>
              </div>
              {aiResponses[activeTab]?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {aiResponses[activeTab].map((response, index) => (
                    <div key={index} className="text-x bg-white p-2 rounded border border-blue-100">
                      <strong>Q:</strong> {response.query}<br />
                      <strong>A:</strong> {response.response}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {showAdvancedInsights && (
            <motion.div
              className="bg-purple-50 rounded-lg p-4 mb-4 border border-purple-100"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-s font-semibold text-purple-800 mb-2">Advanced AI Insights</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Deal Win-Loss Prediction */}
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <h4 className="text-x font-bold text-purple-700 mb-2">Deal Win-Loss Prediction</h4>
                  <div className="space-y-2">
                    {advancedInsights.winLossPrediction.map((deal, index) => (
                      <div key={index} className="text-x">
                        <div className="font-medium">{deal.opportunity}</div>
                        <div className="flex justify-between">
                          <span>Value: {deal.value}</span>
                          <span className={`font-bold ${deal.probability > '70%' ? 'text-green-600' : 'text-yellow-600'}`}>
                            Win Prob: {deal.probability}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xxs mt-1">
                          Factors: {deal.keyFactors.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lead Scoring Optimization */}
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <h4 className="text-x font-bold text-purple-700 mb-2">Lead Scoring Optimization</h4>
                  <div className="space-y-2">
                    {advancedInsights.leadScoring.map((lead, index) => (
                      <div key={index} className="text-x">
                        <div className="font-medium">{lead.lead}</div>
                        <div className="flex justify-between">
                          <span>Score: {lead.score}/100</span>
                          <span className="font-medium">{lead.recommendedAction}</span>
                        </div>
                        <div className="text-gray-500 text-xxs mt-1">
                          Factors: {lead.factors.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales Rep Performance Coaching */}
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <h4 className="text-x font-bold text-purple-700 mb-2">Sales Rep Performance Coaching</h4>
                  <div className="space-y-2">
                    {advancedInsights.repCoaching.map((coaching, index) => (
                      <div key={index} className="text-x">
                        <div className="font-medium">{coaching.rep}</div>
                        <div>Focus Area: {coaching.area}</div>
                        <div>Recommendation: {coaching.recommendation}</div>
                        <div className="text-gray-500 text-xxs mt-1">
                          Resources: {coaching.resources.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing Optimization */}
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <h4 className="text-x font-bold text-purple-700 mb-2">Pricing Optimization</h4>
                  <div className="space-y-2">
                    {advancedInsights.pricingOptimization.map((pricing, index) => (
                      <div key={index} className="text-x">
                        <div className="font-medium">{pricing.product}</div>
                        <div className="flex justify-between">
                          <span>Current: {pricing.current}</span>
                          <span className="font-bold">Recommended: {pricing.recommended}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Confidence: {pricing.confidence}</span>
                          <span>Impact: {pricing.expectedImpact}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {getCurrentColumns().map((column, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left text-x font-bold text-gray-700 uppercase tracking-wider"
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentData().map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {getCurrentColumns().map((column, colIndex) => {
                      if (column.accessor === 'isPositive') {
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`inline-flex items-center ${row.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {row.isPositive ? (
                                <>
                                  <FiTrendingUp className="mr-1" /> Positive
                                </>
                              ) : (
                                <>
                                  <FiTrendingUp className="mr-1 transform rotate-180" /> Negative
                                </>
                              )}
                            </span>
                          </td>
                        );
                      }
                      if (column.accessor === 'aiSuggestion') {
                        return (
                          <td key={colIndex} className="px-4 py-3 text-s text-gray-700">
                            <div className="flex items-start">
                              <BsStars className="flex-shrink-0 mt-0.5 mr-2 text-blue-500" />
                              <span className="text-x">{row.aiSuggestion}</span>
                            </div>
                          </td>
                        );
                      }
                      if (column.accessor === 'aiScore' || column.accessor === 'winProbability') {
                        const score = row[column.accessor];
                        let bgColor = 'bg-red-100 text-red-800';
                        if (score >= 80) bgColor = 'bg-green-100 text-green-800';
                        else if (score >= 60) bgColor = 'bg-yellow-100 text-yellow-800';
                        
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`px-2 py-1 rounded-full text-x font-medium ${bgColor}`}>
                              {row[column.accessor]}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s text-gray-700">
                          {row[column.accessor]}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI Summary Box */}
          <motion.div 
            className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1">
                <BsStars className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-s font-semibold text-blue-800">AI Analysis Summary</h3>
                <p className="text-s text-blue-700 mt-1">{aiSuggestions[activeTab]}</p>
                {/* <button 
                  onClick={() => setShowAdvancedInsights(!showAdvancedInsights)}
                  className="mt-2 text-x text-purple-600 hover:text-purple-800 font-medium"
                >
                  {showAdvancedInsights ? 'Hide' : 'Show'} Advanced Insights →
                </button> */}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SalesPerformanceTable;