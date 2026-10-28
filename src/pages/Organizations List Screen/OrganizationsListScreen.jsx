import React, { useState, useEffect, useContext } from 'react';
import { FiUsers, FiSettings, FiLogOut, FiLock } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_BASE_URL } from '../../config/config';
import { AuthContext } from '../../context/AuthContext';


const ProfileDetailsScreen = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { token, isAdmin } = useContext(AuthContext);


  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/company/management/account/profile/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        setProfileData(response.data);
      } catch (err) {
        setError(err.message);
        toast.error('Failed to fetch profile data');
      } finally {
        setLoading(false);
      }
    };


    fetchProfileData();
  }, []);

  const handleNavigateToUsers = () => navigate('/user-management');
  const handleChangePassword = () => navigate('/forgot-password');
  const handleLogout = () => {
    // Implement your logout logic here
    navigate('/login');
  };

  // Format the joined date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Org-admin gate (matches the sidebar's User Management gate)
  const isAdminIT = isAdmin;

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Profile Details</h1>
            <p className="text-sky-100 text-x">Manage your account settings</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#004a80] to-[#82bfee] h-34">
                <img
                  src={
                    profileData?.company?.company_logo_url
                      ? `${API_BASE_URL}/${profileData.company.company_logo_url.replace(/\\/g, '/')}`
                      : '/images/profile-placeholder.png'
                  }
                  alt="Company Logo"
                  className="w-full h-full object-contain rounded-lg"
                />

                {/* <div className="absolute inset-0 bg-gradient-to-r from-[#004a80] to-[#82bfee] opacity-50"> */}
              </div>
              <div className="px-6 pb-6 pt-2 relative">
                <div className="flex justify-center -mt-12 mb-4">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-[#004a80] to-[#82bfee] border-4 border-white shadow-md flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-50">
                      {profileData?.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900">
                    {profileData?.user?.full_name || 'N/A'}
                  </h2>
                  <p className="text-s text-gray-600">
                    <span className='uppercase text-s text-gray-700'>{profileData?.user?.role || 'N/A'}</span> • {profileData?.company?.company_name || 'N/A'}
                  </p>
                  <p className="mt-1 text-x text-gray-500">
                    {profileData?.user?.email || 'N/A'}
                  </p>
                </div>

                <div className="mt-6 flex flex-col space-y-3">
                  <button
                    onClick={handleChangePassword}
                    className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-s font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <FiLock className="mr-2" /> Change Password
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-s font-medium text-red-600 hover:bg-red-50"
                  >
                    <FiLogOut className="mr-2" /> Logout
                  </button>
                </div>
              </div>
            </div>

            {isAdminIT && (
              <div className="bg-white mt-3 shadow rounded-lg p-2 px-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <button
                    onClick={handleNavigateToUsers}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg mr-4">
                        <FiUsers className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">User Management</h3>
                        <p className="text-s text-gray-500">Manage all system users</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                  {/* <button
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="p-3 bg-purple-100 rounded-lg mr-4">
                        <FiSettings className="text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">System Settings</h3>
                        <p className="text-s text-gray-500">Configure application</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button> */}
                </div>
              </div>
            )}
          </div>



          {/* Right Column - Details */}
          <div className="lg:col-span-2">
            {/* Personal Information */}
            <div className="bg-white shadow rounded-lg p-2 px-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                <span className={`px-3 py-1 rounded-full text-x font-medium ${profileData?.user?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {profileData?.user?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-s font-medium text-gray-500">Full Name</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.user?.full_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Email Address</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.user?.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Company</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.company_name || 'N/A'}
                  </p>
                </div>
                 <div>
                  <h3 className="text-s font-medium text-gray-500">2FA Enabled</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.user?.is_2FA_enabled ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Role</h3>
                  <p className="mt-1 text-s uppercase  text-gray-900">
                    {profileData?.user?.role || 'N/A'}
                  </p>
                </div>


                <div>
                  <h3 className="text-s font-medium text-gray-500">Department</h3>
                  <p className="mt-1 text-s uppercase  text-gray-900">
                    {profileData?.user?.department || 'N/A'}
                  </p>
                </div>


                <div>
                  <h3 className="text-s font-medium text-gray-500">Member Since</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {formatDate(profileData?.user?.created_at)}
                  </p>
                </div>
               
                <div>
                  <h3 className="text-s font-medium text-gray-500">Last Updated</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {formatDate(profileData?.user?.updated_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div className="bg-white shadow rounded-lg p-2 px-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-s font-medium text-gray-500">Legal Name</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.legal_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Email</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Phone Number</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.phone_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Address</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.address || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Plan</h3>
                  <p className="mt-1 text-s text-gray-900 capitalize">
                    {profileData?.company?.plan || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Next Billing Date</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {formatDate(profileData?.company?.next_billing_date)}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Users Count</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.users_count || '0'}
                  </p>
                </div>
                <div>
                  <h3 className="text-s font-medium text-gray-500">Status</h3>
                  <p className="mt-1 text-s text-gray-900">
                    {profileData?.company?.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>

            {/* Admin Section - Only visible for IT Admins */}
            {/* {isAdminIT && (
              <div className="bg-white shadow rounded-lg p-2 px-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleNavigateToUsers}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg mr-4">
                        <FiUsers className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">User Management</h3>
                        <p className="text-s text-gray-500">Manage all system users</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                  <button
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="p-3 bg-purple-100 rounded-lg mr-4">
                        <FiSettings className="text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">System Settings</h3>
                        <p className="text-s text-gray-500">Configure application</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                </div>
              </div>
            )} */}
          </div>
        </div>
      </div>
      <Tooltip id="profile-tooltip" />
    </div>
  );
};

export default ProfileDetailsScreen;