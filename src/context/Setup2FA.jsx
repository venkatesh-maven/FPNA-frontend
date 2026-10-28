// src/pages/Setup2FA.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiCopy, FiCheck, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { LoginBG, offRobo } from '../assets/Assets';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/config';

  const Setup2FA = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { userEmail, complete2FASetup, loading: contextLoading } = useContext(AuthContext);
    
    // State
    const [qrCodeData, setQrCodeData] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [verificationCode, setVerificationCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [setupData, setSetupData] = useState(null);

    // Fetch QR code and backup codes
    useEffect(() => {
      const fetchData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/company/user/auth/2fa/setup/${token}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch 2FA setup data');
    }

    const data = await response.json();
    setSetupData(data);
    setQrCodeData(data.qr_code_base64 || '');
    // Assuming backup codes are in data.backup_codes
    setBackupCodes(data.backup_codes || []); // Make sure this is an array
    console.log(data, "API response data");
    return true
  } catch (err) {
    console.error(err);
    setError(err.message || 'Failed to load 2FA setup data');
    toast.error(err.message || 'Failed to load 2FA setup data');
  } finally {
    setLoading(false);
  }
};

      if (token) {
        fetchData();
      } else {
        navigate('/login');
      }
    }, [token, navigate]);

  // Handle copy backup codes
  const handleCopyCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Backup codes copied to clipboard');
  };

  // Submit verification code
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }

    try {
      const success = await complete2FASetup(verificationCode);
      if (success) {
        toast.success('2FA setup completed successfully!');
        navigate('/login'); // Redirect after successful setup
      }
    } catch (error) {
      toast.error(error.message || 'Failed to complete 2FA setup');
    }
  };

  if (loading || contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-sky-900">
        <div className="absolute inset-0 z-0">
          <video autoPlay loop muted className="w-full h-full object-cover">
            <source src={LoginBG} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
        </div>
        <div className="text-center z-10 text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto"></div>
          <h2 className="text-xl font-semibold mt-4">Setting up 2FA...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-sky-900">
        <div className="absolute inset-0 z-0">
          <video autoPlay loop muted className="w-full h-full object-cover">
            <source src={LoginBG} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
        </div>
        <div className="text-center z-10 bg-white bg-opacity-90 p-8 rounded-xl max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="text-red-600 text-2xl" />
          </div>
          <h2 className="text-xl font-semibold text-red-600">Setup Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors w-full"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-sky-900">
      {/* Video Background with Overlay */}
      <div className="absolute inset-0 z-0">
        <video autoPlay loop muted className="w-full h-full object-cover">
          <source src={LoginBG} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
      </div>

      <div className="container mx-auto px-4 flex flex-col lg:flex-row items-center justify-center gap-8 z-10 h-full py-8">
        {/* <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hidden lg:flex w-1/2 max-w-xl items-center justify-center"
        >
          <div className="relative w-full h-full max-h-[80vh]">
            <img 
              src={offRobo} 
              alt="Security Illustration" 
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div> */}

        {/* 2FA Setup Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full lg:w-1/2 max-w-2xl bg-white bg-opacity-90 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-600 to-sky-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
                <p className="text-sky-100">Secure your account with an extra layer</p>
              </div>
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <FiLock className="text-xl text-sky-900" />
              </div>
            </div>
            {userEmail && (
              <p className="mt-2 text-s text-sky-100">
                Setting up for: <span className="font-medium">{userEmail}</span>
              </p>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* QR Code Section */}
            <div className="bg-sky-50 rounded-xl p-5">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-sky-800 flex items-center gap-2">
                    <span className="bg-sky-100 text-sky-600 rounded-full w-6 h-6 flex items-center justify-center text-s">1</span>
                    Scan QR Code
                  </h3>
                  <p className="mt-1 text-s text-sky-600">
                    Open your authenticator app and scan this code
                  </p>
                  
                  {qrCodeData ? (
                    <div className="mt-4 flex justify-center">
                      <img
                        src={`data:image/png;base64,${qrCodeData}`}
                        alt="2FA QR Code"
                        className="rounded-lg w-40 h-40 object-contain border-4 border-white shadow"
                      />
                    </div>
                  ) : (
                    <p className="text-red-500 mt-4 text-s">QR code not available</p>
                  )}
                </div>

                {/* Verification Form */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-sky-800 flex items-center gap-2">
                    <span className="bg-sky-100 text-sky-600 rounded-full w-6 h-6 flex items-center justify-center text-s">2</span>
                    Enter Verification Code
                  </h3>
                  <p className="mt-1 text-s text-sky-600">
                    Enter the 6-digit code from your app
                  </p>

                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="6"
                        autoComplete="off"
                        required
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setVerificationCode(value.slice(0, 6));
                        }}
                        className="block w-full px-4 py-3 border border-sky-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-center font-mono text-xl tracking-widest shadow-sm"
                        placeholder="••••••"
                        disabled={contextLoading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contextLoading}
                      className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-md font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200 ${
                        contextLoading ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {contextLoading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Verifying...
                        </span>
                      ) : (
                        'Complete Setup'
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Manual Entry */}
              {setupData?.secret_key && (
                <div className="mt-6">
                  <h4 className="text-s font-medium text-sky-700">Can't scan the code?</h4>
                  <p className="text-x text-sky-500 mt-1">Enter this secret key manually:</p>
                  <div className="mt-2 px-4 py-2 bg-white rounded-lg border border-sky-200 font-mono text-s break-all text-sky-800 shadow-inner">
                    {setupData.secret_key}
                  </div>
                </div>
              )}
            </div>

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                  Backup Codes
                </h3>
                <p className="mt-1 text-s text-amber-600">
                  Save these codes securely. Each can be used once if you lose access to your device.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="font-mono text-s text-center py-2 bg-white rounded-lg border border-amber-200">
                      {code}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className="mt-4 w-full flex items-center justify-center px-4 py-2.5 border border-amber-300 rounded-lg text-s font-medium text-amber-700 bg-white hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                >
                  {copied ? (
                    <>
                      <FiCheck className="mr-2 text-green-500" />
                      Copied to clipboard
                    </>
                  ) : (
                    <>
                      <FiCopy className="mr-2" />
                      Copy All Codes
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button
                onClick={() => navigate('/login')}
                className="text-s font-medium text-sky-600 hover:text-sky-700 flex items-center transition-colors"
              >
                <FiArrowLeft className="mr-1" />
                Return to login
              </button>
              <span className="text-x text-gray-400">Security Level: <span className='text-red-500'>High</span></span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Setup2FA;