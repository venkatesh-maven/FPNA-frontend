import React from 'react';
import { FiBell } from 'react-icons/fi';

const NotificationsTab = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <FiBell className="mr-2 text-blue-500" /> Notification & Communication Preferences
      </h3>
      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-lg mb-4">System Alerts</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Critical System Updates</p>
                <p className="text-s text-gray-600">Receive notifications for system maintenance or outages</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Security Alerts</p>
                <p className="text-s text-gray-600">Notifications for suspicious login attempts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-lg mb-4">Notification Channels</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-3">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span className="font-medium">Email</span>
              </div>
              <p className="text-s text-gray-600">Receive notifications via your registered email address</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-3">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span className="font-medium">In-App Notifications</span>
              </div>
              <p className="text-s text-gray-600">See notifications when logged into the platform</p>
            </div>
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-lg mb-4">Notification Schedule</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Daily Digest Time</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>6:00 AM</option>
                <option>8:00 AM</option>
                <option selected>5:00 PM</option>
                <option>9:00 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Do Not Disturb Hours</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>None</option>
                <option>10:00 PM - 6:00 AM</option>
                <option>11:00 PM - 7:00 AM</option>
                <option>12:00 AM - 8:00 AM</option>
              </select>
            </div>
          </div>
          <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
            Save Notification Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsTab;