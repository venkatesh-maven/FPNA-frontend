// EntriesTab.js
import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';

const EntriesTab = ({ apiService }) => {
  const [entries, setEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    fetchEntries();
  }, [currentPage]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getCRMEntries(currentPage, limit);
      setEntries(response.items || []);
      setTotalPages(response.total_pages || 0);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (opportunity_id) => {
    if (window.confirm('Are you sure you want to delete this CRM entry?')) {
      try {
        await apiService.deleteCRMEntry(opportunity_id);
        toast.success('CRM entry deleted successfully');
        fetchEntries();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-sky-200 bg-sky-50">
        <h3 className="font-medium text-sky-800">CRM Entries</h3>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading CRM entries...
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No CRM entries found. Upload a file to get started.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-200">
              <thead className="bg-sky-50">
                <tr>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Opportunity ID</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Deal Amount</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sky-200">
                {entries.map((entry) => (
                  <tr key={entry.opportunity_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">{entry.opportunity_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">
                      <div className="font-medium">{entry.customer_name}</div>
                      <div className="text-sky-500">{entry.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">{entry.contact_person}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">{entry.product}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">{entry.deal_amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-x rounded-full ${
                        entry.stage === 'Closed Won' ? 'bg-green-100 text-green-800' :
                        entry.stage === 'Closed Lost' ? 'bg-red-100 text-red-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {entry.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s text-sky-900">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toast.info('Edit functionality coming soon')}
                          className="text-sky-600 hover:text-sky-800 p-1"
                          data-tooltip-id={`edit-${entry.opportunity_id}`}
                          data-tooltip-content="Edit entry"
                        >
                          <FiEdit2 />
                          <Tooltip id={`edit-${entry.opportunity_id}`} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.opportunity_id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          data-tooltip-id={`delete-${entry.opportunity_id}`}
                          data-tooltip-content="Delete entry"
                        >
                          <FiTrash2 />
                          <Tooltip id={`delete-${entry.opportunity_id}`} />
                        </button>
                      </div>
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

export default EntriesTab;