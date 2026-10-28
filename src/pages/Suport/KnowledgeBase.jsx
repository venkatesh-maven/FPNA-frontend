import React, { useState } from 'react';
import { FiBookOpen, FiHelpCircle, FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi';

const KnowledgeBase = () => {
  const [activeFaq, setActiveFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sample data
  const knowledgeBase = [
    {
      id: 1,
      title: "Getting Started Guide",
      category: "Onboarding",
      views: 1245,
      updated: "2 days ago"
    },
    {
      id: 2,
      title: "Advanced Forecasting Techniques",
      category: "Forecasting",
      views: 892,
      updated: "1 week ago"
    },
    {
      id: 3,
      title: "Troubleshooting Data Imports",
      category: "Technical",
      views: 567,
      updated: "3 days ago"
    }
  ];

  const faqs = [
    {
      id: 1,
      question: "How do I create a new expense forecast?",
      answer: "Navigate to the Forecasting tab and click 'New Forecast'. You can either start from scratch or duplicate an existing forecast template."
    },
    {
      id: 2,
      question: "How does AI categorize fixed vs variable expenses?",
      answer: "Our AI analyzes historical spending patterns, vendor contracts, and expense descriptions to automatically classify costs. You can manually override any categorization."
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold flex items-center">
          <FiBookOpen className="mr-2 text-blue-500" /> Knowledge Base & Documentation
        </h3>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
          Suggest Article
        </button>
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search documentation..."
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {knowledgeBase.map(article => (
          <div key={article.id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-lg mb-2">{article.title}</h4>
            <div className="flex justify-between text-s text-gray-500 mb-3">
              <span>{article.category}</span>
              <span>{article.views} views</span>
            </div>
            <p className="text-s text-gray-600">Updated {article.updated}</p>
            <button className="mt-3 text-blue-600 hover:text-blue-800 text-s font-medium">
              Read Article →
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="font-semibold mb-4 flex items-center">
          <FiHelpCircle className="mr-2 text-blue-500" /> Frequently Asked Questions
        </h4>
        <div className="space-y-4">
          {faqs.map(faq => (
            <div key={faq.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                className="w-full flex justify-between items-center p-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setActiveFaq(activeFaq === faq.id ? null : faq.id)}
              >
                <span className="font-medium text-gray-800">{faq.question}</span>
                {activeFaq === faq.id ? (
                  <FiChevronUp className="text-gray-500" />
                ) : (
                  <FiChevronDown className="text-gray-500" />
                )}
              </button>
              {activeFaq === faq.id && (
                <div className="p-4 bg-white text-gray-600 border-t border-gray-200">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;