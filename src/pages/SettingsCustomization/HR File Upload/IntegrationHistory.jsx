import React, { useState, useEffect } from 'react';
import { 
  FiChevronLeft, 
  FiChevronRight, 
  FiTrash2, 
  FiEye, 
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiLoader
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Tooltip as ReactTooltip } from "react-tooltip";
import 'react-tooltip/dist/react-tooltip.css';
import { 
  getHRIntegrationHistory, 
  getHRIntegrationEntries,
  deleteHRIntegration 
} from './hrApiService';
import { getDecimalPrecision } from '../../../utils/formatters';

const IntegrationModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b p-4">
          <h3 className="text-lg text-sky-800 font-semibold">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const IntegrationHistory = ({ token }) => {
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entriesModal, setEntriesModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [integrationEntries, setIntegrationEntries] = useState([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesTotalPages, setEntriesTotalPages] = useState(1);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const fetchIntegrationHistory = async () => {
    try {
      setLoading(true);
      const response = await getHRIntegrationHistory(token, currentPage, 10);
      
      if (response) {
        setHistory(response.records || []);
        setTotalRecords(response.total_records || 0);
        setTotalPages(Math.ceil(response.total_records / response.limit) || 1);
      }
    } catch (error) {
      console.error('Error fetching integration history:', error);
      toast.error(`Failed to load integration history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrationEntries = async (integrationId) => {
    try {
      setEntriesLoading(true);
      const response = await getHRIntegrationEntries(token, integrationId, entriesPage, 10);
      
      if (response) {
        setIntegrationEntries(response.entries || []);
        setEntriesTotalPages(Math.ceil(response.total_entries / response.limit) || 1);
      }
    } catch (error) {
      console.error('Error fetching integration entries:', error);
      toast.error(`Failed to load integration entries: ${error.message}`);
    } finally {
      setEntriesLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrationHistory();
  }, [currentPage, token]);

  useEffect(() => {
    if (selectedIntegration) {
      fetchIntegrationEntries(selectedIntegration.id);
    }
  }, [entriesPage, selectedIntegration]);

  const handleViewEntries = (integration) => {
    setSelectedIntegration(integration);
    setEntriesPage(1);
    setEntriesModal(true);
  };

  const handleDeleteIntegration = async (integrationId) => {
    try {
      await deleteHRIntegration(token, integrationId);
      toast.success('Integration deleted successfully');
      fetchIntegrationHistory();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast.error(`Failed to delete integration: ${error.message}`);
    }
  };

  const confirmDelete = (integration) => {
    toast.info(
      <div>
        <p>Are you sure you want to delete this integration record?</p>
        <div className="flex justify-end mt-2 space-x-2">
          <button 
            onClick={() => {
              toast.dismiss();
              handleDeleteIntegration(integration.id);
            }}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
          <button 
            onClick={() => toast.dismiss()}
            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>,
      {
        autoClose: false,
        closeButton: false,
      }
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

const getStatusIcon = (status) => {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';

  switch (normalized) {
    case 'success':
      return <FiCheckCircle className="text-green-500" />;
    case 'failed':
      return <FiAlertCircle className="text-red-500" />;
    case 'processing':
      return <FiLoader className="text-amber-500 animate-spin" />;
    default:
      return <FiClock className="text-gray-500" />;
  }
};


  return (
    <div className="space-y-6">
      <ReactTooltip id="tooltip" place="top" effect="solid" />
      
      {/* Entries Modal */}
      <IntegrationModal 
        isOpen={entriesModal} 
        onClose={() => setEntriesModal(false)}
        title={`Integration Entries - ${selectedIntegration?.id || ''}`}
      >
        {entriesLoading ? (
          <div className="flex justify-center items-center py-8">
            <FiLoader className="animate-spin text-sky-500 text-2xl mr-2" />
            <span>Loading entries...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-sky-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-s font-medium text-gray-500">Integration ID</p>
                  <p className="text-s text-gray-900">{selectedIntegration?.id}</p>
                </div>
                <div>
                  <p className="text-s font-medium text-gray-500">Status</p>
                  <div className="flex items-center">
                    {getStatusIcon(selectedIntegration?.status)}
                    <span className="ml-1 capitalize">{selectedIntegration?.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-s font-medium text-gray-500">Date</p>
                  <p className="text-s text-gray-900">{formatDate(selectedIntegration?.created_at)}</p>
                </div>
                <div>
                  <p className="text-s font-medium text-gray-500">Source</p>
                  <p className="text-s text-gray-900">{selectedIntegration?.source_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-s font-medium text-gray-500">Message</p>
                  <p className="text-s text-gray-900">{selectedIntegration?.message || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                    <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {integrationEntries.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center text-s text-gray-500">
                        No entries found
                      </td>
                    </tr>
                  ) : (
                    integrationEntries.map((entry, index) => (
                      <tr key={`${entry.employee_id}-${index}`}>
                        <td className="px-4 py-4 whitespace-nowrap text-s font-medium text-gray-900">
                          {entry.name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-s text-gray-900">
                          {entry.email}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-s text-gray-900">
                          {entry.department || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-s text-gray-900">
                          {entry.job_title || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${
                            entry.status === 'Active' 
                              ? 'bg-green-100 text-green-800' 
                              : entry.status === 'Terminated' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-4">
              <span className="text-s text-gray-600">
                Showing page {entriesPage} of {entriesTotalPages}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEntriesPage(p => Math.max(p - 1, 1))}
                  disabled={entriesPage === 1 || entriesLoading}
                  className="p-1 disabled:opacity-50 text-gray-600 hover:text-gray-800 disabled:hover:text-gray-600"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setEntriesPage(p => Math.min(p + 1, entriesTotalPages))}
                  disabled={entriesPage === entriesTotalPages || entriesLoading}
                  className="p-1 disabled:opacity-50 text-gray-600 hover:text-gray-800 disabled:hover:text-gray-600"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </IntegrationModal>

      {/* Main History Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-medium text-gray-800">HR Integration History</h3>
          <div className="text-s text-gray-600">
            Total Records: {totalRecords.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Message</th>
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-s text-gray-500">
                    <div className="flex justify-center items-center">
                      <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" />
                      Loading integration history...
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-s text-gray-500">
                    No integration history found
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-s font-medium text-gray-900">
                      <span className="truncate max-w-xs inline-block" title={record.id}>
                        {record.id}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-s text-gray-900">
                      {formatDate(record.created_at)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-s text-gray-900 capitalize">
                      {record.source_type || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(record.status)}
                        <span className="ml-1 capitalize">{record.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-s text-gray-900">
                      {record.message || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-s text-gray-900 flex space-x-2">
                      <button 
                        className="text-sky-600 hover:text-sky-800 p-1 rounded hover:bg-sky-100"
                        onClick={() => handleViewEntries(record)}
                        data-tooltip-id="tooltip"
                        data-tooltip-content="View Entries"
                      >
                        <FiEye />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100"
                        onClick={() => confirmDelete(record)}
                        data-tooltip-id="tooltip"
                        data-tooltip-content="Delete Integration"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <span className="text-s text-gray-600">
            Showing page {currentPage} of {totalPages} (Total: {totalRecords.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="p-1 disabled:opacity-50 text-gray-600 hover:text-gray-800 disabled:hover:text-gray-600"
              data-tooltip-id="tooltip"
              data-tooltip-content="Previous Page"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              className="p-1 disabled:opacity-50 text-gray-600 hover:text-gray-800 disabled:hover:text-gray-600"
              data-tooltip-id="tooltip"
              data-tooltip-content="Next Page"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationHistory;