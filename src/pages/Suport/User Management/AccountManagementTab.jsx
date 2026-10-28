import React, { useState, useContext } from 'react';
import { FiUserPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiSearch } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { toast } from 'react-toastify';
import { AuthContext } from '../../../context/AuthContext';
import AddEditUserModal from './AddEditUserModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import TwoFactorToggle from './TwoFactorToggle';

const AccountManagementTab = ({
  users,
  loading,
  searchTerm,
  setSearchTerm,
  departmentOptions,
  roleOptions,
  onUserAdded,
  onUserUpdated,
  onUserDeleted,
  onStatusToggled,
  on2FAToggled
}) => {
  const { token } = useContext(AuthContext);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const handleSaveUser = async (formData) => {
    try {
      setApiLoading(true);

      if (editingUser) {
        // Update user
        const response = await fetch(`${API_BASE_URL}/api/v1/company/management/update-user/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: editingUser.id,
            full_name: formData.full_name || null,
            user_email: formData.user_email || null,
            user_department: formData.user_department || null,
            user_role: formData.user_role || null,
            reset_password: false
          })
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message || responseData.detail || 'Failed to update user');
        }

        toast.success('User updated successfully!');
        onUserUpdated({
          id: editingUser.id,
          ...formData,
          is_active: editingUser.is_active,
          is_two_factor_enabled: editingUser.is_two_factor_enabled
        });
      } else {
        // Add new user
        const response = await fetch(`${API_BASE_URL}/api/v1/company/management/add-user/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message || responseData.detail || 'Failed to add user');
        }

        toast.success('User added successfully!');
        onUserAdded({
          id: responseData.user_id,
          ...formData,
          is_active: true,
          is_two_factor_enabled: false
        });
      }

      setShowAddEditModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('User operation error:', error);
      toast.error(error.message || 'Operation failed');
    } finally {
      setApiLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setApiLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/v1/company/management/delete-user/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userToDelete.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      toast.success('User deleted successfully');
      onUserDeleted(userToDelete.id);
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setApiLoading(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      setTogglingStatus(true);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/management/user/activate-deactivate?user_id=${userId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to toggle user status');
      }

      onStatusToggled(userId, !currentStatus);
      toast.success(`User has been ${currentStatus ? 'deactivated' : 'activated'}`);
    } catch (error) {
      console.error('Toggle user status error:', error);
      toast.error(error.message || 'Failed to toggle user status');
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h3 className="text-xl font-semibold flex items-center">
          <FiUserPlus className="mr-2 text-blue-500" /> User Account Management
        </h3>
        <button
          onClick={() => {
            setEditingUser(null);
            setShowAddEditModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <FiUserPlus className="mr-2" />
          Add User
        </button>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search users..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'No matching users found' : 'No users available'}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {user.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {user.user_email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-x rounded-full bg-blue-100 text-blue-800 capitalize">
                        {user.user_role || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-x rounded-full bg-gray-100 text-gray-800 capitalize">
                        {user.user_department || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-x rounded-full ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-s font-medium flex items-center space-x-2">
                      <TwoFactorToggle
                        userId={user.id}
                        isTwoFactorEnabled={user.is_two_factor_enabled}
                        onToggle={on2FAToggled}
                      />
                      <button
                        className="text-gray-600 hover:text-gray-900"
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        disabled={togglingStatus}
                        data-tooltip-id={`status-tooltip-${user.id}`}
                        data-tooltip-content={user.is_active ? 'Deactivate User' : 'Activate User'}
                      >
                        {user.is_active ? (
                          <FiToggleRight className="text-green-500" size={20} />
                        ) : (
                          <FiToggleLeft className="text-gray-400" size={20} />
                        )}
                      </button>
                      <Tooltip id={`status-tooltip-${user.id}`} />
                      
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => {
                          setEditingUser(user);
                          setShowAddEditModal(true);
                        }}
                        data-tooltip-id={`edit-tooltip-${user.id}`}
                        data-tooltip-content="Edit User"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <Tooltip id={`edit-tooltip-${user.id}`} />
                      
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => {
                          setUserToDelete(user);
                          setShowDeleteModal(true);
                        }}
                        data-tooltip-id={`delete-tooltip-${user.id}`}
                        data-tooltip-content="Delete User"
                      >
                        <FiTrash2 size={18} />
                      </button>
                      <Tooltip id={`delete-tooltip-${user.id}`} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAddEditModal && (
        <AddEditUserModal
          user={editingUser}
          onSave={handleSaveUser}
          onCancel={() => {
            setShowAddEditModal(false);
            setEditingUser(null);
          }}
          loading={apiLoading}
          departmentOptions={departmentOptions}
          roleOptions={roleOptions}
        />
      )}
      
      {showDeleteModal && (
        <DeleteConfirmModal
          user={userToDelete}
          onConfirm={handleDeleteUser}
          onCancel={() => setShowDeleteModal(false)}
          loading={apiLoading}
        />
      )}
    </div>
  );
};

export default AccountManagementTab;