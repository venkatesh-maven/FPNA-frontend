import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FiSave, FiUser, FiUsers } from 'react-icons/fi';

const RoleBasedFeatureAccess = ({ token }) => {
  const [roles, setRoles] = useState([
    {
      id: 1,
      name: 'Administrator',
      description: 'Full access to all features and settings',
      permissions: {
        dashboard: 'full',
        reports: 'full',
        transactions: 'full',
        settings: 'full',
        users: 'full'
      }
    },
    {
      id: 2,
      name: 'Finance Manager',
      description: 'Access to financial data and reports',
      permissions: {
        dashboard: 'full',
        reports: 'full',
        transactions: 'view',
        settings: 'limited',
        users: 'none'
      }
    },
    {
      id: 3,
      name: 'Accountant',
      description: 'Access to transaction data and basic reports',
      permissions: {
        dashboard: 'limited',
        reports: 'limited',
        transactions: 'full',
        settings: 'none',
        users: 'none'
      }
    },
    {
      id: 4,
      name: 'Viewer',
      description: 'Read-only access to dashboard and reports',
      permissions: {
        dashboard: 'view',
        reports: 'view',
        transactions: 'none',
        settings: 'none',
        users: 'none'
      }
    }
  ]);

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: {
      dashboard: 'none',
      reports: 'none',
      transactions: 'none',
      settings: 'none',
      users: 'none'
    }
  });

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePermissionChange = (roleId, feature, value) => {
    setRoles(roles.map(role => {
      if (role.id === roleId) {
        return {
          ...role,
          permissions: {
            ...role.permissions,
            [feature]: value
          }
        };
      }
      return role;
    }));
  };

  const handleNewRoleChange = (e) => {
    const { name, value } = e.target;
    if (name in newRole.permissions) {
      setNewRole({
        ...newRole,
        permissions: {
          ...newRole.permissions,
          [name]: value
        }
      });
    } else {
      setNewRole({
        ...newRole,
        [name]: value
      });
    }
  };

  const handleAddRole = () => {
    if (!newRole.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    setRoles([
      ...roles,
      {
        ...newRole,
        id: Math.max(...roles.map(r => r.id)) + 1
      }
    ]);
    setNewRole({
      name: '',
      description: '',
      permissions: {
        dashboard: 'none',
        reports: 'none',
        transactions: 'none',
        settings: 'none',
        users: 'none'
      }
    });
    setShowForm(false);
    toast.success('Role added successfully!');
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Role permissions saved successfully!');
    } catch (error) {
      toast.error('Failed to save role permissions');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionColor = (level) => {
    switch (level) {
      case 'full': return 'bg-green-100 text-green-800';
      case 'limited': return 'bg-blue-100 text-blue-800';
      case 'view': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#004a80] mb-4">Role-Based Feature Access</h2>
      <p className="text-gray-600 mb-6">Configure access control for different user roles.</p>

      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center bg-[#004a80] text-white px-4 py-2 rounded hover:bg-[#003366] mb-4"
        >
          <FiUser className="mr-2" />
          {showForm ? 'Cancel' : 'Add New Role'}
        </button>

        {showForm && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="font-medium text-gray-700 mb-4">Create New Role</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-s font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  name="name"
                  value={newRole.name}
                  onChange={handleNewRoleChange}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                  placeholder="e.g., Financial Analyst"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  value={newRole.description}
                  onChange={handleNewRoleChange}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                  placeholder="Brief description of the role"
                />
              </div>
            </div>
            
            <h4 className="text-s font-medium text-gray-700 mb-2">Permissions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {Object.keys(newRole.permissions).map(feature => (
                <div key={feature} className="bg-white p-3 rounded shadow-sm">
                  <label className="block text-s font-medium text-gray-700 mb-1 capitalize">{feature}</label>
                  <select
                    name={feature}
                    value={newRole.permissions[feature]}
                    onChange={handleNewRoleChange}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80] text-s"
                  >
                    <option value="none">No Access</option>
                    <option value="view">View Only</option>
                    <option value="limited">Limited Access</option>
                    <option value="full">Full Access</option>
                  </select>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleAddRole}
              className="flex items-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              <FiUser className="mr-2" />
              Create Role
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-[#004a80]">{role.name}</h3>
              <p className="text-s text-gray-600">{role.description}</p>
            </div>
            
            <div className="p-6">
              <h4 className="text-s font-medium text-gray-700 mb-3 flex items-center">
                <FiUsers className="mr-2" /> Permissions
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(role.permissions).map(([feature, level]) => (
                  <div key={feature} className="bg-gray-50 p-3 rounded">
                    <label className="block text-s font-medium text-gray-700 mb-1 capitalize">{feature}</label>
                    <select
                      value={level}
                      onChange={(e) => handlePermissionChange(role.id, feature, e.target.value)}
                      className={`w-full p-2 rounded text-s ${getPermissionColor(level).split(' ')[0]} ${getPermissionColor(level).split(' ')[1]}`}
                    >
                      <option value="none">No Access</option>
                      <option value="view">View Only</option>
                      <option value="limited">Limited Access</option>
                      <option value="full">Full Access</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center bg-[#004a80] text-white px-4 py-2 rounded hover:bg-[#003366] disabled:opacity-50"
        >
          <FiSave className="mr-2" />
          {loading ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
};

export default RoleBasedFeatureAccess;