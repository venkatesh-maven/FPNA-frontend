import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { FiArrowLeft } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { fevicon } from '../assets/Assets';
import { API_BASE_URL } from '../config/config';
import { AuthContext } from '../context/AuthContext';
import { getDecimalPrecision } from '../utils/formatters';
import FollowUpSuggestions from '../components/FollowUpSuggestions';

// Cap on how many prior turns we send back to the AI as context. Keeps the
// request small while still giving enough continuity for follow-ups.
const MAX_HISTORY_TURNS = 10;

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Parse a possibly comma/symbol-formatted value into a number (0 if not numeric).
const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[,$\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const fmt = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
const quarterOf = (period) => {
  const m = parseInt(String(period).split('-')[1], 10);
  return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
};

// Forecast dashboard returns full-year monthly arrays. Roll them up into quarter
// totals so answers line up with the quarter-filtered forecast screens.
const buildForecastContext = (data, year, currency) => {
  if (!data || typeof data !== 'object') return '';

  // [arrayKey, valueKey, aggregation] — headcount is end-of-quarter, others sum.
  const series = [
    ['revenue_forecasting', 'revenue', 'sum'],
    ['expense_forecasting', 'expenses', 'sum'],
    ['cash_flow_projections', 'cash_flow', 'sum'],
    ['capex_forecast', 'capex', 'sum'],
    ['payroll_forecast', 'payroll', 'sum'],
    ['headcount_forecast', 'headcount', 'last'],
  ];

  const quarters = { Q1: {}, Q2: {}, Q3: {}, Q4: {} };
  series.forEach(([arrKey, valKey, agg]) => {
    const arr = Array.isArray(data[arrKey]) ? data[arrKey] : [];
    arr.forEach((item) => {
      if (!item || !item.period) return; // skips trailing widget-meta object
      const q = quarterOf(item.period);
      const val = toNum(item[valKey]);
      if (agg === 'last') quarters[q][valKey] = val;
      else quarters[q][valKey] = (quarters[q][valKey] || 0) + val;
    });
  });

  const lines = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
    const d = quarters[q];
    return (
      `${q}: revenue=${fmt(d.revenue || 0)}, expenses=${fmt(d.expenses || 0)}, ` +
      `cash_flow=${fmt(d.cash_flow || 0)}, capex=${fmt(d.capex || 0)}, ` +
      `payroll=${fmt(d.payroll || 0)}, headcount(end of quarter)=${fmt(d.headcount || 0)}`
    );
  });

  const sm = data.summary_metrics || {};
  const fullYear =
    `Full-year totals: revenue=${fmt(toNum(sm.forecast_revenue))}, ` +
    `expenses=${fmt(toNum(sm.forecast_expenses))}, cash_flow=${fmt(toNum(sm.forecast_cashflow))}, ` +
    `capex=${fmt(toNum(sm.forecast_capex))}, payroll=${fmt(toNum(sm.forecast_payroll))}, ` +
    `headcount=${fmt(toNum(sm.forecast_headcount))}.`;

  return (
    `Forecast for fiscal year ${year} (currency ${currency}), by quarter ` +
    `(Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec). Use ONLY this as the source of truth:\n` +
    `${lines.join('\n')}\n${fullYear}`
  );
};

// Predefined categories. Each maps to its OWN backend endpoint, so the context
// sent to the AI matches the topic of the selected question (not always P&L).
const CATEGORIES = [
  {
    id: 'financial_reports',
    label: 'Financial Reports',
    endpoint: (y, c) => `/api/v1/company/financial/profitandloss_statement/${y}/${c}`,
    questions: [
      'What is the total revenue for the year?',
      'Which month had the highest revenue?',
      'What were the total operating expenses for the year?',
      'How did the cost of goods sold trend over the year?',
      'Which month was the most profitable?',
    ],
  },
  {
    id: 'financial_overview',
    label: 'Financial Overview',
    endpoint: (y, c) => `/api/v1/company/financial/financial-overview/${y}/${c}`,
    questions: [
      'Give me a short summary of the financial performance this year.',
      'What is the overall profit for the year?',
      'How does revenue compare to expenses?',
      'What stands out the most in the financials?',
    ],
  },
  {
    id: 'kpis',
    label: 'KPIs',
    endpoint: (y, c) => `/api/v1/company/financial/Key_Financial_KPIs/${y}/${c}`,
    questions: [
      'What is the profitability by segment?',
      'What is the marketing ROI?',
      'What is the revenue per employee?',
      'What is the cost per lead?',
      'Which KPI looks strongest right now?',
      'Which KPI needs the most attention?',
    ],
  },
  {
    id: 'forecasting',
    label: 'Forecasting',
    endpoint: (y, c) =>
      `/api/v1/forecasting/managemet/forecast_dashboard/${y}/${c}?currency_filter=actualvalue`,
    buildContext: buildForecastContext,
    questions: [
      'What is the forecasted revenue by quarter?',
      'What are the forecasted expenses by quarter?',
      'What is the projected cash flow by quarter?',
      'What is the forecasted CAPEX spend by quarter?',
      'What are the forecasted payroll and headcount by quarter?',
      'Which quarter looks strongest in the forecast?',
    ],
  },
];

// Keys that are filter dropdowns / UI widgets, not analytical data. Stripped so
// the context stays focused and small.
const NOISE_KEYS = new Set([
  'entities', 'costcenters', 'cost_centers', 'profitcenters', 'profit_centers',
  'customers', 'products', 'versions', 'departments', 'widgets', 'regions',
  'region', 'aiDriver',
]);

const stripNoise = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (NOISE_KEYS.has(k)) continue;
    out[k] = obj[k];
  }
  return out;
};

// Reduce a raw API response to just the meaningful analytical data.
const cleanForContext = (data) => {
  if (Array.isArray(data)) {
    return data
      .filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const keys = Object.keys(item);
        // drop pure filter-list wrappers like { entities: [...] }
        return !(keys.length === 1 && NOISE_KEYS.has(keys[0]));
      })
      .map(stripNoise);
  }
  return stripNoise(data);
};

const SmallAIChatBot = ({ isExpanded = false }) => {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [messages, setMessages] = useState([
    { id: 1, text: 'Hi! Pick a topic below and choose a question — I will answer using that report’s data.', sender: 'ai', time: nowTime() },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  // Cache of context strings keyed by category id (avoids refetching).
  const [contextCache, setContextCache] = useState({});
  // AI-generated follow-up questions for the current topic conversation.
  // Empty means "show the topic's canned starter questions instead".
  const [followUps, setFollowUps] = useState([]);
  // { role: 'user' | 'assistant', content }[] for the active topic only —
  // reset whenever the topic changes so unrelated report context doesn't leak
  // into a new conversation.
  const [conversationHistory, setConversationHistory] = useState([]);

  const messagesEndRef = useRef(null);

  // Fetch the data for a specific category and build its context string.
  const fetchCategoryContext = async (category) => {
    if (!token || !selectedYear || !selectedCurrency) return '';
    try {
      const url = `${API_BASE_URL}${category.endpoint(selectedYear, selectedCurrency)}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      });

      // Categories may supply a custom builder (e.g. quarterly rollups); else
      // fall back to a generic cleaned-JSON context.
      if (category.buildContext) {
        return category.buildContext(data, selectedYear, selectedCurrency);
      }

      const cleaned = cleanForContext(data);
      let ctx =
        `Application report data for "${category.label}" ` +
        `(fiscal year ${selectedYear}, currency ${selectedCurrency}). ` +
        `Use ONLY this as the source of truth:\n${JSON.stringify(cleaned)}`;
      if (ctx.length > 8000) ctx = ctx.slice(0, 8000) + ' ...[truncated]';
      return ctx;
    } catch (err) {
      console.error(`Failed to load context for "${category.label}":`, err);
      return '';
    }
  };

  // Get a category's context from cache, fetching (and caching) if needed.
  const getCategoryContext = async (category) => {
    if (contextCache[category.id]) return contextCache[category.id];
    const ctx = await fetchCategoryContext(category);
    if (ctx) setContextCache((prev) => ({ ...prev, [category.id]: ctx }));
    return ctx;
  };

  // The cached context is year/currency specific — clear it when either changes
  // so the next question refetches data for the newly selected period.
  useEffect(() => {
    setContextCache({});
  }, [selectedYear, selectedCurrency]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const askQuestion = async (category, question) => {
    if (isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: question, sender: 'user', time: nowTime() },
    ]);
    setIsLoading(true);
    setFollowUps([]); // hide stale suggestions while the new answer loads

    try {
      const ctx = await getCategoryContext(category);

      const { data } = await axios.post(`${API_BASE_URL}/api/v1/ai`, {
        message: question,
        context: ctx || undefined,
        history: conversationHistory,
      });

      const replyText = data?.reply || 'Sorry, I could not generate a response.';

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: replyText, sender: 'ai', time: nowTime() },
      ]);
      setConversationHistory((prev) =>
        [...prev, { role: 'user', content: question }, { role: 'assistant', content: replyText }].slice(
          -MAX_HISTORY_TURNS
        )
      );
      setFollowUps(Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 5) : []);
    } catch (error) {
      console.error('AI chat request failed:', error);
      const detail = error?.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text:
            (typeof detail === 'string' && detail) ||
            'Sorry, something went wrong while contacting the AI service. Please try again.',
          sender: 'ai',
          time: nowTime(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setFollowUps([]);
    setConversationHistory([]);
  };

  const backToTopics = () => {
    setSelectedCategory(null);
    setFollowUps([]);
    setConversationHistory([]);
  };

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory) || null;

  return (
    <div className="flex w-[100%] h-full bg-sky-50">
      {/* Chat Area */}
      <div className="flex-1 justify-center items-center flex flex-col">
        {/* Header */}
        <div className="p-4 bg-sky-50 gap-5 border-b w-full">
          <div className="flex gap-4 items-center">
            <img src={fevicon} width="50px" alt="logo" />
            <h2 className="text-lg text-sky-900">𝙵P𝚗AI𝚗𝚂𝚒𝚐𝚑𝚝𝙰𝙸</h2>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-sky-50 w-full">
          <div className={`space-y-4 ${isExpanded ? 'w-full' : 'max-w-3xl mx-auto'}`}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg px-4 py-2 ${
                    isExpanded ? 'max-w-xl xl:max-w-2xl' : 'max-w-xs md:max-w-md lg:max-w-lg'
                  } ${
                    message.sender === 'user'
                      ? 'bg-sky-600 text-sky-50 rounded-br-none'
                      : 'bg-white border border-sky-200 text-sky-900 rounded-bl-none shadow-sm'
                  }`}
                >
                  <div className="text-s whitespace-pre-line">{message.text}</div>
                  <div className={`text-x mt-1 ${message.sender === 'user' ? 'text-sky-200' : 'text-sky-500'}`}>
                    {message.time}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2 bg-white border border-sky-200 text-sky-900 rounded-bl-none shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Selection Area (no free-text input) */}
        <div className="p-4 border-t border-sky-200 bg-white w-full">
          <div className={isExpanded ? 'w-full' : 'max-w-3xl mx-auto'}>
            {!activeCategory ? (
              <>
                <p className="text-s font-semibold text-sky-900 mb-1">Choose a topic</p>
                <div className={`grid gap-1.5 ${isExpanded ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat.id)}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-3 py-1.5 text-s font-medium text-sky-800 bg-sky-100 hover:bg-sky-200 rounded-lg border border-sky-200 disabled:opacity-50"
                    >
                      <BsStars className="text-sky-600" /> {cat.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={backToTopics}
                    className="flex items-center gap-1 text-s text-sky-700 hover:text-sky-900"
                  >
                    <FiArrowLeft /> Topics
                  </button>
                  <span className="text-s font-semibold text-sky-900">{activeCategory.label}</span>
                </div>
                {conversationHistory.length > 0 ? (
                  // Once the topic has an AI response, always show a "Suggested
                  // follow-ups" section — falling back to the topic's canned
                  // questions when the backend returns no causal suggestions,
                  // so the section never silently disappears mid-conversation.
                  <FollowUpSuggestions
                    suggestions={followUps.length > 0 ? followUps : activeCategory.questions}
                    onSelect={(q) => askQuestion(activeCategory, q)}
                    disabled={isLoading}
                  />
                ) : (
                  <div
                    className={`gap-2 overflow-y-auto pr-1 ${
                      isExpanded ? 'grid grid-cols-2 max-h-48' : 'flex flex-col max-h-28'
                    }`}
                  >
                    {activeCategory.questions.map((q) => (
                      <button
                        key={q}
                        onClick={() => askQuestion(activeCategory, q)}
                        disabled={isLoading}
                        className="text-left px-3 py-2 text-s text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="text-x text-sky-500 mt-3">
              FPnAInsights may produce inaccurate information about financial data. Always verify critical insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmallAIChatBot;
