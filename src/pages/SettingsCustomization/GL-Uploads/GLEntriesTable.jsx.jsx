import React from 'react';
import { FiEdit2, FiSearch, FiTrash2 } from 'react-icons/fi';
import { getDecimalPrecision } from '../../../utils/formatters';

const GLEntriesTable = ({ 
  data, 
  loading, 
  currentPage, 
  itemsPerPage, 
  totalPages, 
  onPageChange, 
  onEdit, 
  onDelete,
  searchTerm,
  onSearchChange
}) => {
  const filteredData = data.filter(item =>
    item.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.general_ledger_code.toString().includes(searchTerm) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Search GL entries..."
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
              {/* <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">ID</th> */}
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">GL Code</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Account</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Debit</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Credit</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#004a80]"></div>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-s text-gray-500">No GL entries found</td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id}>
                                    {/* <td className="px-6 py-4 text-s text-gray-900">{item.id}</td> */}

                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                    {new Date(item.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.general_ledger_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.account_name}</td>
                  <td className="px-6 py-4 text-s text-gray-900">{item.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                    {item.debit > 0 ? item.debit.toFixed(getDecimalPrecision()) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                    {item.credit > 0 ? item.credit.toFixed(getDecimalPrecision()) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-500 hover:text-blue-700 mr-2"
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => onDelete(item.id, `${item.account_name} (${new Date(item.date).toLocaleDateString()})`)}
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

      {!loading && (
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
              disabled={currentPage === totalPages}
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

export default GLEntriesTable;