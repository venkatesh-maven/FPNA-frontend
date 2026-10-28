import React from 'react';
import { FiX, FiUser, FiLock, FiUnlock, FiEdit2, FiTrash2, FiMail, FiBriefcase, FiShield, FiUserCheck, FiUserX, FiSettings } from 'react-icons/fi';

const ViewUserModal = ({ user, onClose, onEdit, onDelete, onToggleStatus, onToggle2FA }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <FiUser className="mr-2 text-blue-500" />
              User Profile
            </h2>
            <p className="text-s text-gray-500">Detailed user information and actions</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* User Summary */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
              <FiUser size={28} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800">
                {user.name || user.full_name || 'N/A'}
              </h3>
              <p className="text-blue-600">{user.user_email || user.email || 'N/A'}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Role */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-2 text-gray-500">
                <FiBriefcase className="mr-2" />
                <span className="text-s font-medium">Role</span>
              </div>
              <p className="text-gray-800 font-medium capitalize">
                {user.user_role || user.role || 'N/A'}
              </p>
            </div>

            {/* Department */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-2 text-gray-500">
                <FiBriefcase className="mr-2" />
                <span className="text-s font-medium">Department</span>
              </div>
              <p className="text-gray-800 font-medium capitalize">
                {user.user_department || user.department || 'N/A'}
              </p>
            </div>

            {/* Status */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-2 text-gray-500">
                {user.is_active ? (
                  <FiUserCheck className="mr-2 text-green-500" />
                ) : (
                  <FiUserX className="mr-2 text-red-500" />
                )}
                <span className="text-s font-medium">Status</span>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-x font-medium ${
                user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* 2FA Status */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center mb-2 text-gray-500">
                <FiShield className="mr-2" />
                <span className="text-s font-medium">2FA Status</span>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-x font-medium ${
                user.is_two_factor_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {user.is_two_factor_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="border-t border-gray-200 pt-5">
            <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
              <FiSettings className="mr-2 text-blue-500" />
              User Actions
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Status Toggle */}
              <button
                onClick={() => onToggleStatus(user.id, user.is_active)}
                className={`flex items-center justify-center px-4 py-2 rounded-lg text-s font-medium transition-all ${
                  user.is_active 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {user.is_active ? (
                  <FiUserX className="mr-2" />
                ) : (
                  <FiUserCheck className="mr-2" />
                )}
                {user.is_active ? 'Deactivate User' : 'Activate User'}
              </button>
              
              {/* 2FA Toggle */}
              <button
                onClick={() => onToggle2FA(user.id, user.is_two_factor_enabled)}
                className={`flex items-center justify-center px-4 py-2 rounded-lg text-s font-medium transition-all ${
                  user.is_two_factor_enabled 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {user.is_two_factor_enabled ? (
                  <FiUnlock className="mr-2" />
                ) : (
                  <FiLock className="mr-2" />
                )}
                {user.is_two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
              
              {/* Edit */}
              <button
                onClick={() => onEdit(user)}
                className="flex items-center justify-center px-4 py-2 rounded-lg text-s font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
              >
                <FiEdit2 className="mr-2" />
                Edit Profile
              </button>
              
              {/* Delete */}
              <button
                onClick={() => onDelete(user)}
                className="flex items-center justify-center px-4 py-2 rounded-lg text-s font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all"
              >
                <FiTrash2 className="mr-2" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewUserModal;