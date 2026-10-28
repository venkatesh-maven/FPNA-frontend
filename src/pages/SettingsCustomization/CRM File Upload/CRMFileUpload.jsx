// CRMFileUpload.js
import React, { useState, useContext } from 'react';
import { Tooltip } from 'react-tooltip';
import { AuthContext } from '../../../context/AuthContext';
import CRMApiService from './CRMApiService';
import UploadTab from './UploadTab';
import ViewTab from './ViewTab';
import EntriesTab from './EntriesTab';
import HistoryTab from './HistoryTab';
import 'react-tooltip/dist/react-tooltip.css';

const CRMFileUpload = () => {
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('create');
  const apiService = new CRMApiService(token);

  const tabs = [
    { id: 'create', label: 'Upload CRM File' },
    { id: 'view', label: 'View CRM Data' },
    { id: 'entries', label: 'CRM Entries' },
    { id: 'history', label: 'Integration History' },
  ];

  return (
    <div className="space-y-6  max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-[#004a80] mb-4">CRM Accounts Management</h2>
        <p className="text-gray-600 mb-6">Manage CRM accounts, entries, and integration history.</p>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex flex-wrap border-b border-sky-200">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 font-medium text-s rounded-t-lg mr-2 ${
                  activeTab === id
                    ? 'bg-sky-800 text-white'
                    : 'bg-sky-50 text-sky-700 hover:bg-gray-100'
                }`}
                data-tooltip-id="crm-tabs-tooltip"
                data-tooltip-content={`${label} Tab`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && <UploadTab apiService={apiService} />}
      {activeTab === 'view' && <ViewTab apiService={apiService} />}
      {activeTab === 'entries' && <EntriesTab apiService={apiService} />}
      {activeTab === 'history' && <HistoryTab apiService={apiService} />}

      {/* Single tooltip instance */}
      <Tooltip id="crm-tabs-tooltip" />
    </div>
  );
};

export default CRMFileUpload;
