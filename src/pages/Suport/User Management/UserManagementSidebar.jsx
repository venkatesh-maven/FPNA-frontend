import React from 'react';
import { FiKey, FiUserPlus, FiLock, FiActivity, FiBell, FiUsers } from 'react-icons/fi';

const UserManagementSidebar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { tab: 'roles', icon: FiKey, label: 'Roles & Permissions' },
    { tab: 'accounts', icon: FiUserPlus, label: 'Account Management' },
    { tab: 'security', icon: FiLock, label: 'Security Settings' },
    { tab: 'audit', icon: FiActivity, label: 'Audit Logs' },
    { tab: 'notifications', icon: FiBell, label: 'Notification Settings' }
  ];

  return (
    <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4">
      <h2 className="bg-gradient-to-r flex items-center font-semibold text-white from-blue-800 to-blue-400 p-4 rounded-lg shadow-sm mb-6">
        <FiUsers className="mr-2" size={20} /> User Management
      </h2>
      <nav>
        <ul className="space-y-1">
          {tabs.map(({ tab, icon: Icon, label }) => (
            <li key={tab}>
              <button
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center p-3 rounded-lg text-s font-medium ${
                  activeTab === tab ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="mr-3" />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default UserManagementSidebar;