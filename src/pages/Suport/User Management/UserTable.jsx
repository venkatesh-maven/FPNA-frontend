import React from 'react';
import { FiSearch, FiToggleLeft, FiToggleRight, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import TwoFactorToggle from './TwoFactorToggle';

const UserTable = ({
  searchTerm,
  setSearchTerm,
  loading,
  filteredUsers,
  toggleUserStatus,
  togglingStatus,
  handleToggle2FA,
  setEditingUser,
  setShowAddEditModal,
  setUserToDelete,
  setShowDeleteModal,
  setViewingUser // Add this prop
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold flex items-center">
          User Account Management
        </h3>
      </div>
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search users..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Name</th>
                {/* <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Email</th> */}
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Role</th>
                {/* <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Department</th> */}
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {user.name || user.full_name || 'N/A'}
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {user.user_email || user.email || 'N/A'}
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-x rounded-full bg-blue-100 text-blue-800 capitalize">
                        {user.role || 'N/A'}
                      </span>
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-x text-blue-800 capitalize">
                        {user.department || 'N/A'}
                      </span>
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-x rounded-full ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s font-medium">
                      <div className="flex items-center space-x-2">
                        {/* View Button */}
                        <button
                          onClick={() => setViewingUser(user)}
                          className="p-1 text-blue-500 hover:text-blue-700"
                          data-tooltip-id="view-tooltip"
                          data-tooltip-content="View Details"
                        >
                          <FiEye size={18} />
                        </button>
                        <Tooltip id="view-tooltip" />

                        {/* 2FA Toggle */}
                        <TwoFactorToggle
                          userId={user.id}
                          isTwoFactorEnabled={user.is_two_factor_enabled}
                          onToggle={handleToggle2FA}
                        />

                        {/* Status Toggle */}
                        <button
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          disabled={togglingStatus}
                          data-tooltip-id="status-tooltip"
                          data-tooltip-content={user.is_active ? 'Deactivate User' : 'Activate User'}
                        >
                          {user.is_active ? (
                            <FiToggleRight className="text-green-500" size={20} />
                          ) : (
                            <FiToggleLeft className="text-gray-400" size={20} />
                          )}
                        </button>
                        <Tooltip id="status-tooltip" />

                        {/* Edit Button */}
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => {
                            setEditingUser(user);
                            setShowAddEditModal(true);
                          }}
                          data-tooltip-id="edit-tooltip"
                          data-tooltip-content="Edit User"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <Tooltip id="edit-tooltip" />

                        {/* Delete Button */}
                        <button
                          className="text-red-600 hover:text-red-900"
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteModal(true);
                          }}
                          data-tooltip-id="delete-tooltip"
                          data-tooltip-content="Delete User"
                        >
                          <FiTrash2 size={18} />
                        </button>
                        <Tooltip id="delete-tooltip" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserTable;