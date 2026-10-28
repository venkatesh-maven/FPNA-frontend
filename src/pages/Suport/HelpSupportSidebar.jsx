import React from 'react';
import { 
  FiHelpCircle, 
  FiBookOpen, 
  FiMessageSquare, 
  FiCalendar,
  FiUsers,
  FiLifeBuoy
} from 'react-icons/fi';

const HelpSupportSidebar = ({ activeTab, setActiveTab }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
        <FiHelpCircle className="mr-2" /> Help & Support
      </h2>
      
      <nav>
        <ul className="space-y-1">
          {/* <li>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`w-full flex items-center p-3 rounded-lg ${activeTab === 'knowledge' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiBookOpen className="mr-3" />
              <span>Knowledge Base</span>
            </button>
          </li> */}
          <li>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`w-full flex items-center p-3 rounded-lg ${activeTab === 'tickets' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiLifeBuoy className="mr-3" />
              <span>Ticketing System</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('training')}
              className={`w-full flex items-center p-3 rounded-lg ${activeTab === 'training' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiCalendar className="mr-3" />
              <span>Training & Webinars</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default HelpSupportSidebar;