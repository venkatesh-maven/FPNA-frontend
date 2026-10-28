import React from 'react';
import { FiKey } from 'react-icons/fi';

const RolesTab = () => {
  const roles = [
    { name: 'Admin', permissions: ['All'], users: 4 },
    { name: 'Finance Manager', permissions: ['Dashboard', 'Reports', 'Forecasting'], users: 5 },
    { name: 'Analyst', permissions: ['Dashboard', 'Reports'], users: 8 },
    { name: 'Viewer', permissions: ['Dashboard'], users: 12 },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <FiKey className="mr-2 text-blue-500" /> Access Control & Security Management
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {roles.map((role, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-lg mb-2">{role.name}</h4>
            <div className="mb-3">
              <span className="text-s text-gray-500">Permissions:</span>
              <ul className="mt-1 space-y-1">
                {role.permissions.map((perm, i) => (
                  <li key={i} className="text-s flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-6">
        <h4 className="font-semibold mb-4">Create New Role</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Role Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
              placeholder="eg Financial Analyst"
            />
          </div>
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Permissions</label>
            <select
              multiple
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-[100px]"
            >
              <option value="dashboard">Dashboard Access</option>
              <option value="reports">Report Generation</option>
              <option value="forecasting">Forecasting Tools</option>
              <option value="admin">Administration</option>
              <option value="export">Data Export</option>
            </select>
          </div>
          <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
            Save Role
          </button>
        </div>
      </div>
    </div>
  );
};

export default RolesTab;