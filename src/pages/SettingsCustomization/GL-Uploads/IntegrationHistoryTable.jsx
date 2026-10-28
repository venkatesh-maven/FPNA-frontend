import React from 'react';
import { FiSearch, FiTrash2, FiEye } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const IntegrationHistoryTable = ({ 
  data, 
  loading, 
  currentPage, 
  itemsPerPage, 
  totalPages, 
  onPageChange, 
  onDelete,
  searchTerm,
  onSearchChange
}) => {
  const navigate = useNavigate();

  const handleRowClick = (id) => {
    navigate(`/gl-uploads/integration/${id}`);
  };

  // Make sure data is properly extracted from the response
  // If the API response is { data: [...] }, then use data.data
  // If the API response is the array directly, then use data directly
  const historyData = Array.isArray(data) ? data : (data?.data || data?.records || []);

  const filteredData = historyData.filter(item =>
    item?.source_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item?.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item?.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={onSearchChange}
            className="pl-10 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Message</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#004a80]"></div>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-s text-gray-500">
                  {historyData.length === 0 ? 'No integration history data available' : 'No matching records found'}
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(item.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.source_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-s">
                    <span className={`px-2 py-1 rounded-full text-x ${
                      item.status === 'success' ? 'bg-green-100 text-green-800' :
                      item.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-s text-gray-900">{item.message}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id, `${item.source_type} (${new Date(item.created_at).toLocaleDateString()})`);
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
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

      {!loading && historyData.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="text-s text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of{' '}
              <span className="font-medium">{filteredData.length}</span> results
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-s font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || currentPage * itemsPerPage >= filteredData.length}
              className="px-3 py-1 border border-gray-300 rounded text-s font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationHistoryTable;