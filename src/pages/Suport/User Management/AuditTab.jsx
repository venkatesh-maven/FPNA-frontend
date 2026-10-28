import React from 'react';
import { FiActivity } from 'react-icons/fi';

const AuditTab = () => {
  const auditLogs = [
    { id: 1, user: 'John Smith', action: 'Logged in', timestamp: '2023-06-15 09:30:45', ip: '192.168.1.100' },
    { id: 2, user: 'Sarah Johnson', action: 'Updated forecast', timestamp: '2023-06-15 10:15:22', ip: '192.168.1.101' },
    { id: 3, user: 'Michael Chen', action: 'Exported report', timestamp: '2023-06-14 14:45:10', ip: '192.168.1.102' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold flex items-center">
          <FiActivity className="mr-2 text-blue-500" /> User Activity & Compliance Monitoring
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{log.timestamp}</td>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{log.user}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-x rounded-full bg-blue-100 text-blue-800">{log.action}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{log.ip}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button className="text-blue-600 hover:text-blue-900">View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTab;