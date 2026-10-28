import React, { useState, useRef, useEffect, useContext } from 'react';
import { FiUsers, FiUserPlus, FiUserMinus, FiSettings, FiSearch, FiDownload, FiMenu, FiBriefcase } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../config/config';
import DeleteConfirmModal from './DeleteConfirmModal';
import AddEditUserModal from './AddEditUserModal';
import UserTable from './UserTable';
import RolesTab from './RolesTab';
import SecurityTab from './SecurityTab';
import AuditTab from './AuditTab';
import NotificationsTab from './NotificationsTab';
import ViewUserModal from './ViewUserModal';
import OrganizationDetailsTab from './OrganizationDetailsTab';

const UserManagement = () => {
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/management/company-users/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.users || !Array.isArray(data.users)) {
        throw new Error('Invalid data format: expected users array');
      }

      const userArray = data.users.map(user => ({
        ...user,
        is_two_factor_enabled: user.is_2FA_enabled ?? false,
        user_email: user.email,
        user_role: user.role,
        user_department: user.department,
        is_admin: user.is_admin ?? false,
        name: user.full_name
      }));
      
      setUsers(userArray);
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error(error.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const filteredUsers = users.filter(user =>
    (user.name || user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.user_email || user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveUser = async (formData) => {
    try {
      setApiLoading(true);
      const url = editingUser 
        ? `${API_BASE_URL}/api/v1/company/management/update-user/`
        : `${API_BASE_URL}/api/v1/company/management/add-user/`;

      const method = editingUser ? 'PATCH' : 'POST';
      
      const body = editingUser
        ? {
            user_id: editingUser.id,
            user_email: formData.user_email,
            user_department: formData.user_department,
            user_role: formData.user_role,
            is_admin: formData.is_admin,
            reset_password: false
          }
        : {
            full_name: formData.full_name,
            user_email: formData.user_email,
            user_department: formData.user_department,
            user_role: formData.user_role,
            is_admin: formData.is_admin
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.message || 
                            responseData.detail || 
                            editingUser ? 'Failed to update user' : 'Failed to add user';
        throw new Error(errorMessage);
      }

      toast.success(editingUser ? 'User updated successfully!' : 'User added successfully!');
      await fetchUsers();
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
      await fetchUsers();
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
    
    // Construct URL with query parameters
    const url = new URL(`${API_BASE_URL}/api/v1/company/management/user/activate-deactivate/`);
    url.searchParams.append('user_id', userId);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to toggle user status');
    }

    // Update the users state
    setUsers(users.map(user => 
      user.id === userId ? { ...user, is_active: !currentStatus } : user
    ));

    toast.success(
      `User has been ${currentStatus ? 'deactivated' : 'activated'}`
    );
  } catch (error) {
    console.error('Toggle user status error:', error);
    toast.error(error.message || 'Failed to toggle user status');
  } finally {
    setTogglingStatus(false);
  }
};

 const handleToggle2FA = async (userId, currentStatus) => {
  try {
    setTogglingStatus(true);
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/user/auth/enable-disable/2fa/${userId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to toggle 2FA status');
    }
        toast.success(`2FA has been ${currentStatus ? 'disabled' : 'enabled'}`);

    // Return the new status so the component can update
    return !currentStatus;
  } catch (error) {
    console.error('Toggle 2FA error:', error);
    toast.error(error.message || 'Failed to toggle 2FA status');
    throw error; // Re-throw to let the component know it failed
  } finally {
    setTogglingStatus(false);
  }
};

  const exportAuditLogs = () => {
    toast.info('Export feature coming soon');
  };

  const navItems = [
    { tab: 'accounts', icon: FiUserPlus, label: 'Account Management' },
    { tab: 'organization', icon: FiBriefcase, label: 'Organization Details' }
  ];
  return (
    <div className="relative min-h-screen bg-sky-50">
      {/* Mobile Menu Button */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-blue-600 text-white"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      <div className="flex flex-col md:flex-row">
        {/* Sidebar Navigation - Mobile */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden">
            <div className="w-64 h-full bg-white p-4 transform transition-transform">
              <h2 className="bg-gradient-to-r flex items-center font-semibold text-white from-[#004a80] to-[#91c8f3] p-4 rounded-lg shadow-sm mb-6">
                <FiUsers className="mr-2" size={20} /> User Management
              </h2>
              <nav>
                <ul className="space-y-1">
                  {navItems.map(({ tab, icon: Icon, label }) => (
                    <li key={tab}>
                      <button
                        onClick={() => {
                          setActiveTab(tab);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center p-3 rounded-lg text-s font-medium ${
                          activeTab === tab ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="mr-3" />
                        <span>{label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        )}

        {/* Sidebar Navigation - Desktop */}
        <div className="hidden md:block w-64 sticky top-0 h-screen bg-white border-r border-gray-200 p-4">
          <h2 className="bg-gradient-to-r flex items-center font-semibold text-white from-[#004a80] to-[#91c8f3] p-4 rounded-lg shadow-sm mb-6">
            <FiUsers className="mr-2" size={20} /> User Management
          </h2>
          <nav>
            <ul className="space-y-1">
              {navItems.map(({ tab, icon: Icon, label }) => (
                <li key={tab}>
                  <button
                    onClick={() => setActiveTab(tab)}
                    className={`w-full flex items-center p-3 rounded-lg text-s font-medium ${
                      activeTab === tab ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="mr-3" />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 w-full overflow-x-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
              <div>
                <h1 className="text-lg font-bold text-white">User Management Dashboard</h1>
                <p className="text-sky-100 text-x">Manage roles, accounts, and security settings</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200 whitespace-nowrap"
                  onClick={() => {
                    setEditingUser(null);
                    setShowAddEditModal(true);
                  }}
                >
                  <FiUserPlus className="mr-1" />
                  Add User
                </button>
                <button
                  type="button"
                  className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200 whitespace-nowrap"
                  onClick={exportAuditLogs}
                >
                  <FiDownload className="mr-1" />
                  Export Logs
                </button>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="overflow-x-auto">
            {activeTab === 'roles' && <RolesTab />}
            {activeTab === 'organization' && <OrganizationDetailsTab />}
            {activeTab === 'accounts' && (
              <UserTable 
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                loading={loading}
                filteredUsers={filteredUsers}
                toggleUserStatus={toggleUserStatus}
                togglingStatus={togglingStatus}
                handleToggle2FA={handleToggle2FA}
                setEditingUser={(user) => {
                  setEditingUser(user);
                  setShowAddEditModal(true);
                }}
                setUserToDelete={setUserToDelete}
                setShowDeleteModal={setShowDeleteModal}
                    setViewingUser={setViewingUser} // Add this line

              />
            )}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
          </div>

          {/* Modals */}
{/* Modals */}
{viewingUser && (
  <ViewUserModal
    user={viewingUser}
    onClose={() => setViewingUser(null)}
    onEdit={(user) => {
      setViewingUser(null);
      setEditingUser(user);
      setShowAddEditModal(true);
    }}
    onDelete={(user) => {
      setViewingUser(null);
      setUserToDelete(user);
      setShowDeleteModal(true);
    }}
    onToggleStatus={toggleUserStatus}
    onToggle2FA={handleToggle2FA}
  />
)}

{showAddEditModal && (
  <AddEditUserModal
    user={editingUser}
    onSave={handleSaveUser}
    onCancel={() => {
      setShowAddEditModal(false);
      setEditingUser(null);
    }}
    loading={apiLoading}
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

          
          {showAddEditModal && (
            <AddEditUserModal
              user={editingUser}
              onSave={handleSaveUser}
              onCancel={() => {
                setShowAddEditModal(false);
                setEditingUser(null);
              }}
              loading={apiLoading}
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
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
      <Tooltip id="edit-tooltip" />
      <Tooltip id="status-tooltip" />
      <Tooltip id="delete-tooltip" />
    </div>
  );
};

export default UserManagement;