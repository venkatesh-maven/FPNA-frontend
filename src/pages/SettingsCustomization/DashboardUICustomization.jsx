import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiSave, FiRefreshCw } from 'react-icons/fi';

const DashboardUICustomization = ({ token }) => {
  const [themeSettings, setThemeSettings] = useState({
    font_size: 'small',
    font_color: '#000000',
    background_color: '#ffffff',
    font_family: 'Arial',
    primary_color: '#004a80'
  });
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const BASE_URL = 'http://192.168.0.196:8000';

  // Fetch user's current theme settings
  useEffect(() => {
    const fetchUserTheme = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${BASE_URL}/api/v1/company/management/user/user_theme/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch theme settings');
        }

        const data = await response.json();
        if (data) {
          setThemeSettings({
            font_size: data.font_size || 'small',
            font_color: data.font_color || '#000000',
            background_color: data.background_color || '#ffffff',
            font_family: data.font_family || 'Arial',
            primary_color: data.primary_color || '#004a80'
          });
        }
      } catch (error) {
        toast.error('Failed to load theme settings');
        console.error(error);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    fetchUserTheme();
  }, [token]);

  const handleThemeChange = (field, value) => {
    setThemeSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/v1/company/management/user/update_theme/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(themeSettings)
      });

      if (!response.ok) {
        throw new Error('Failed to update theme settings');
      }

      toast.success('Theme settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save theme settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <div className="flex justify-center items-center h-64">
        <FiRefreshCw className="animate-spin text-2xl text-[#004a80]" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#004a80] mb-4">Dashboard & UI Customization</h2>
      <p className="text-gray-600 mb-6">Personalize your dashboard appearance and theme settings.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Font Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-3">Font Settings</h3>
          
          <div className="mb-4">
            <label className="block text-s font-medium text-gray-700 mb-1">Font Size</label>
            <select
              value={themeSettings.font_size}
              onChange={(e) => handleThemeChange('font_size', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-s font-medium text-gray-700 mb-1">Font Family</label>
            <input
              type="text"
              value={themeSettings.font_family}
              onChange={(e) => handleThemeChange('font_family', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Font Color</label>
            <div className="flex items-center">
              <input
                type="color"
                value={themeSettings.font_color}
                onChange={(e) => handleThemeChange('font_color', e.target.value)}
                className="w-10 h-10 border border-gray-300 rounded mr-2"
              />
              <span>{themeSettings.font_color}</span>
            </div>
          </div>
        </div>

        {/* Color Settings */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-3">Color Settings</h3>
          
          <div className="mb-4">
            <label className="block text-s font-medium text-gray-700 mb-1">Background Color</label>
            <div className="flex items-center">
              <input
                type="color"
                value={themeSettings.background_color}
                onChange={(e) => handleThemeChange('background_color', e.target.value)}
                className="w-10 h-10 border border-gray-300 rounded mr-2"
              />
              <span>{themeSettings.background_color}</span>
            </div>
          </div>

          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex items-center">
              <input
                type="color"
                value={themeSettings.primary_color}
                onChange={(e) => handleThemeChange('primary_color', e.target.value)}
                className="w-10 h-10 border border-gray-300 rounded mr-2"
              />
              <span>{themeSettings.primary_color}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center bg-[#004a80] text-white px-4 py-2 rounded hover:bg-[#003366] disabled:opacity-50"
        >
          {loading ? (
            <>
              <FiRefreshCw className="animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <FiSave className="mr-2" />
              Save Theme Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DashboardUICustomization;