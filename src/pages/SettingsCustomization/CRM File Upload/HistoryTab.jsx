// HistoryTab.js
import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiAlertCircle, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';

const HistoryTab = ({ apiService }) => {
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 100;

  useEffect(() => {
    fetchHistory();
  }, [currentPage]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getIntegrationHistory(currentPage, limit);
      setHistory(response.records || []);
      setTotalPages(Math.ceil(response.total_records / limit) || 0);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (integration_id) => {
    if (window.confirm('Are you sure you want to delete this integration history?')) {
      try {
        await apiService.deleteIntegration(integration_id);
        toast.success('Integration history deleted successfully');
        fetchHistory();
      } catch (error) {
        console.error('Error deleting integration:', error);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <FiCheckCircle className="text-green-500" />;
      case 'failed':
        return <FiAlertCircle className="text-red-500" />;
      case 'partial_success':
        return <FiAlertCircle className="text-amber-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-sky-200 bg-sky-50">
        <h3 className="font-medium text-sky-800">Integration History</h3>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading integration history...
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No integration history found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-200">
              <thead className="bg-sky-50">
                <tr>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Source Type</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Message</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sky-200">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">
                      {item.source_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(item.status)}
                        <span className="ml-2">{item.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-s text-sky-900">
                      {item.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        data-tooltip-id={`delete-${item.id}`}
                        data-tooltip-content="Delete integration"
                      >
                        <FiTrash2 />
                        <Tooltip id={`delete-${item.id}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-sky-50 border-t border-sky-200 flex items-center justify-between">
            <div className="flex-1 flex justify-between items-center">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}

                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-sky-300 text-s font-medium rounded-md text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="prev-page"
                data-tooltip-content="Previous page"
              >
                <FiChevronLeft className="mr-1" /> Previous
                <Tooltip id="prev-page" />
              </button>
              <span className="text-s text-sky-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="relative inline-flex items-center px-4 py-2 border border-sky-300 text-s font-medium rounded-md text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
                data-tooltip-id="next-page"
                data-tooltip-content="Next page"
              >
                Next <FiChevronRight className="ml-1" />
                <Tooltip id="next-page" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HistoryTab;