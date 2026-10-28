import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';

const AddEditUserModal = ({ user, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    user_email: '',
    user_department: '',
    user_role: '',
    is_admin: false
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        user_email: user.user_email || user.email || '',
        user_department: user.department || '',
        user_role: user.role || '',
        is_admin: !!user.is_admin
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleIsAdmin = () => {
    setFormData(prev => ({ ...prev, is_admin: !prev.is_admin }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const departments = ["hr", "finance", "marketing", "sales", "ceo", "cfo", "administration", "it"];
  const roles = ["manager", "analyst", "viewer"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center border-b border-gray-200 p-4">
          <h3 className="text-lg font-semibold">
            {user ? 'Edit User' : 'Add New User'}
          </h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <FiX size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="user_email"
                value={formData.user_email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Department</label>
              <select
                name="user_department"
                value={formData.user_department}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Role</label>
              <select
                name="user_role"
                value={formData.user_role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Role</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-s font-medium text-gray-700">Is Admin</label>
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_admin}
                onClick={toggleIsAdmin}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 bg-white transition-colors duration-200 cursor-pointer ${
                  formData.is_admin ? "border-blue-500" : "border-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full transition-transform duration-200 ${
                    formData.is_admin ? "translate-x-5 bg-blue-500" : "translate-x-0.5 bg-gray-400"
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-s font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-s font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditUserModal;