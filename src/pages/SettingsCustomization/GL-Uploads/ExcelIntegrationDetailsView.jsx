import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiTrash2, FiDownload, FiChevronRight, FiChevronLeft, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../../config/config';
import { AuthContext } from '../../../context/AuthContext';
import { getDecimalPrecision } from '../../../utils/formatters';

const IntegrationDetails = () => {
    const { currentUser, token } = useContext(AuthContext);

  const { integrationId } = useParams();
  const navigate = useNavigate();
  const [integrationData, setIntegrationData] = useState(null);
  const [glEntries, setGlEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Fetch integration details
  const fetchIntegrationDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/integration-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch integration details');
      }

      const data = await response.json();
      const integration = data.records.find(item => item.id === integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }
      setIntegrationData(integration);
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      setIntegrationData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch GL entries for this integration
 const fetchGlEntries = async () => {
  try {
    setLoading(true);
    let url = `${API_BASE_URL}/api/v1/company/financial/integration-history/${integrationId}/gl-entries?page=${currentPage}&limit=${itemsPerPage}`;
    
    // Add search filters if they exist
    if (searchTerm) url += `&account_name=${encodeURIComponent(searchTerm)}`;
    if (dateFilter) url += `&date=${dateFilter}`;
    if (dateRange.from) url += `&date_from=${dateRange.from}`;
    if (dateRange.to) url += `&date_to=${dateRange.to}`;

    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized error (token expired or invalid)
        throw new Error('Session expired. Please login again.');
      }
      throw new Error('Failed to fetch GL entries');
    }

    const data = await response.json();
    setGlEntries(data.data || []);
    setTotalRecords(data.total_records || 0);
  } catch (error) {
    if (error.message === 'Session expired. Please login again.') {
      // Redirect to login or show a modal
      toast.error(error.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      // You might want to logout the user here
      // logout();
    } else {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
  } finally {
    setLoading(false);
  }
};

  // Handle delete integration
  const handleDeleteIntegration = async () => {
    try {
      if (!window.confirm('Are you sure you want to delete this integration and all its GL entries?')) {
        return;
      }

      setLoading(true);
      const toastId = toast.loading('Deleting integration...', {
        position: "top-right"
      });

      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/integration-history/${integrationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to delete integration');
      }

      toast.update(toastId, {
        render: 'Integration deleted successfully!',
        type: "success",
        isLoading: false,
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      navigate('/gl-Uploads');
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle delete GL entry
  const handleDeleteGlEntry = async (entryId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this GL entry?')) {
        return;
      }

      const toastId = toast.loading('Deleting GL entry...', {
        position: "top-right"
      });

      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-entries/item/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to delete GL entry');
      }

      toast.update(toastId, {
        render: 'GL entry deleted successfully!',
        type: "success",
        isLoading: false,
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      // Refresh the entries list
      fetchGlEntries();
    } catch (error) {
      toast.error(error.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
  };

  // Handle download as Excel
  const handleDownloadExcel = () => {
    try {
      if (glEntries.length === 0) {
        toast.warn('No data available to download', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        return;
      }

      const toastId = toast.loading('Preparing Excel file...', {
        position: "top-right"
      });

      const dataToExport = glEntries.map(entry => ({
        Date: new Date(entry.date).toLocaleDateString(),
        'GL Code': entry.general_ledger_code,
        'Account Name': entry.account_name,
        Category: entry.category,
        Description: entry.description,
        Debit: entry.debit,
        Credit: entry.credit,
        'Entry By': entry.entry_by,
        'Created At': new Date(entry.created_at).toLocaleString()
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'GL Entries');
      XLSX.write_file(wb, `integration_${integrationId}_entries.xlsx`);
      
      toast.update(toastId, {
        render: 'Excel file downloaded successfully!',
        type: "success",
        isLoading: false,
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      toast.error(`Failed to generate Excel: ${error.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
  };

  // Pagination functions
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(Math.ceil(totalRecords / itemsPerPage));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalRecords / itemsPerPage)));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  useEffect(() => {
    fetchIntegrationDetails();
    fetchGlEntries();
  }, [integrationId, currentPage, searchTerm, dateFilter, dateRange]);

  if (loading && !integrationData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#004a80]"></div>
      </div>
    );
  }

  if (!integrationData) {
    return <div className="text-center py-10">No integration data found</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link onClick={() => navigate(-1)} className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
              <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
              </svg>
              GL History
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">GL Entry Details</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="flex justify-between bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <p className='text-white'>Integration Details</p>
        
        <div className="flex space-x-3">
          {/* <button
            onClick={handleDownloadExcel}
            className="flex items-center bg-[#004a80] text-white px-3 py-1 rounded hover:bg-[#003366] text-s"
            disabled={glEntries.length === 0}
          >
            <FiDownload className="mr-1" /> Download Excel
          </button> */}
          
          <button
            onClick={handleDeleteIntegration}
            className="flex items-center bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-s"
          >
            <FiTrash2 className="mr-1" /> Delete Integration
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">Integration Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-s text-gray-600">Source Type</p>
            <p className="font-medium">{integrationData.source_type}</p>
          </div>
          <div>
            <p className="text-s text-gray-600">Status</p>
            <p className={`font-medium ${
              integrationData.status === 'success' ? 'text-green-600' : 
              integrationData.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {integrationData.status}
            </p>
          </div>
          <div>
            <p className="text-s text-gray-600">Date</p>
            <p className="font-medium">{new Date(integrationData.created_at).toLocaleString()}</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-s text-gray-600">Message</p>
            <p className="font-medium">{integrationData.message}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold text-lg mb-3">GL Entries ({totalRecords})</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Search by Account</label>
            <input
              type="text"
              placeholder="Search account name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
            />
          </div>
          
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Exact Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
            />
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-s font-medium text-gray-700 mb-1">Date From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-s font-medium text-gray-700 mb-1">Date To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
              />
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#004a80]"></div>
          </div>
        ) : glEntries.length === 0 ? (
          <div className="text-center py-6 text-gray-500">No GL entries found for this integration</div>
        ) : (
          <>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Date</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">GL Code</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Account Name</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Category</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Description</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Debit</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Credit</th>
                    <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider border">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {glEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        {entry.general_ledger_code}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        {entry.account_name}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        {entry.category}
                      </td>
                      <td className="px-4 py-2 text-s text-gray-900 border">
                        {entry.description}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        {entry.debit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        {entry.credit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-s text-gray-900 border">
                        <button
                          onClick={() => handleDeleteGlEntry(entry.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete entry"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-s font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === Math.ceil(totalRecords / itemsPerPage)}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-s font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-s text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalRecords)}</span> of{' '}
                    <span className="font-medium">{totalRecords}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={goToFirstPage}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="First Page"
                    >
                      <span className="sr-only">First</span>
                      <FiChevronsLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous Page"
                    >
                      <span className="sr-only">Previous</span>
                      <FiChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-s font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                      Page {currentPage} of {Math.ceil(totalRecords / itemsPerPage)}
                    </span>
                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === Math.ceil(totalRecords / itemsPerPage)}
                      className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next Page"
                    >
                      <span className="sr-only">Next</span>
                      <FiChevronRight className="h-5 w-5" />
                    </button>
                    <button
                      onClick={goToLastPage}
                      disabled={currentPage === Math.ceil(totalRecords / itemsPerPage)}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Last Page"
                    >
                      <span className="sr-only">Last</span>
                      <FiChevronsRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default IntegrationDetails;