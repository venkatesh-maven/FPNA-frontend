import React, { useState, useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiSettings } from 'react-icons/fi';
import DashboardUICustomization from './DashboardUICustomization';
import ReportWorkflowAutomation from './ReportWorkflowAutomation';
import AlertsNotificationPreferences from './AlertsNotificationPreferences';
import FYManagement from './FYManagement';
import SystemDataPreferences from './SystemDataPreferences';
import RoleBasedFeatureAccess from './RoleBasedFeatureAccess';
import HRFileUpload from './HR File Upload/HRFileUpload';
import CRMFileUpload from './CRM File Upload/CRMFileUpload';
import Integrations from './Integrations';
import { AuthContext } from '../../context/AuthContext';

const SettingsCustomization = () => {
  const { token } = useContext(AuthContext);
  const { tab: tabParam } = useParams();
  const [activeTab, setActiveTab] = useState('system-data');
  const [selectedSystemData, setSelectedSystemData] = useState('system-data');

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
      if (tabParam === 'system-data') {
        setSelectedSystemData('system-data');
      }
    }
  }, [tabParam]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleSystemDataChange = (e) => {
    setSelectedSystemData(e.target.value);
    setActiveTab('dashboard-ui');
  };

  return (
    <div className="p- bg-sky-50 min-h-screen transition-all duration-300 ease-in-out">
      <ToastContainer position="top-right" autoClose={3000} newestOnTop />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center">
            <FiSettings className="w-6 h-6 text-white mr-3" />
            <h1 className="text-lg md:text-xl font-bold text-white whitespace-nowrap">
              Settings & Customization
            </h1>
          </div>

          {/* Navigation Tabs - only shown for the General Ledger / System Data section.
              Alerts & Currency Settings, FY Management, and Report & Workflow are each
              their own standalone page (reached via the sidebar) and do not share this
              switcher. */}
          {activeTab !== 'alerts-notifications' && activeTab !== 'fy-management' && activeTab !== 'report-workflow' && activeTab !== 'integrations' && (
            <div className="w-full md:w-auto">
              <nav className="flex flex-wrap items-center gap-2">
                {/* System & Data Dropdown */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <select
                      id="system-data-select"
                      value={selectedSystemData}
                      onChange={handleSystemDataChange}
                      className={`w-full sm:w-38 appearance-none cursor-pointer pl-4 pr-4 py-2 text-s font-medium rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all ${
                        activeTab === 'dashboard-ui'
                          ? 'bg-sky-700 text-white'
                          : 'bg-white text-sky-900 hover:bg-sky-50'
                      }`}
                    >
                      <option value="system-data">GL File Upload</option>
                      <option value="hr-upload">HR File Upload</option>
                      <option value="crm-upload">CRM File Upload</option>
                    </select>

                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg
                        className={`w-4 h-4 ${
                          activeTab === 'dashboard-ui' ? 'text-white' : 'text-sky-600'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg  transition-all duration-300">
        {activeTab === 'report-workflow' && <ReportWorkflowAutomation token={token} />}
        {activeTab === 'alerts-notifications' && <AlertsNotificationPreferences token={token} />}
        {activeTab === 'fy-management' && <FYManagement />}
        {activeTab === 'integrations' && <Integrations />}
        {activeTab === 'system-data' && <SystemDataPreferences token={token} />}
        {/* {activeTab === 'role-access' && <RoleBasedFeatureAccess token={token} />} */}
        {/* {activeTab === 'dashboard-ui' && <DashboardUICustomization token={token} />} */}

        {/* File Upload Components */}
        {activeTab === 'dashboard-ui' && selectedSystemData === 'system-data' && (
          <SystemDataPreferences token={token} />
        )}
        {activeTab === 'dashboard-ui' && selectedSystemData === 'hr-upload' && (
          <HRFileUpload token={token} />
        )}
        {activeTab === 'dashboard-ui' && selectedSystemData === 'crm-upload' && (
          <CRMFileUpload token={token} />
        )}
      </div>
    </div>
  );
};

export default SettingsCustomization;
