// src/pages/Verify2FA.js
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { LoginBG, offRobo } from '../assets/Assets';

const Verify2FA = () => { 
  const { twoFALoginToken, userEmail, verify2FALogin, loading } = useContext(AuthContext);
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!twoFALoginToken) {
      navigate('/login');
    }
  }, [twoFALoginToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      await verify2FALogin(code);
    } catch (error) {
      toast.error(error.message || '2FA verification failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Video Background with Overlay */}
      <div className="absolute inset-0 z-0">
        <video 
          autoPlay 
          loop 
          muted 
          className="w-full h-full object-cover"
        >
          <source src={LoginBG} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative left-0 z-15 h-[500px] w-full max-w-md bg-opacity-90 rounded-xl"
      >
        <img src={offRobo} alt="Robot" className="h-full w-full object-contain" />
      </motion.div>

      {/* 2FA Verification Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative right-15 z-10 w-full max-w-md bg-white bg-opacity-90 backdrop-blur-sm rounded-xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sky-900 mb-2">Two-Factor Authentication</h1>
          <p className="text-sky-600">Enter the 6-digit code from your authenticator app</p>
          {userEmail && (
            <p className="mt-1 text-s text-sky-500">
              For account: <span className="font-medium">{userEmail}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="code" className="block text-s font-medium text-sky-700 mb-1">
              Verification Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiLock className="h-5 w-5 text-sky-400" />
              </div>
              <input
                id="code"
                name="code"
                type="text"
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-center font-mono text-xl tracking-widest"
                placeholder="••••••"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-s font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-s font-medium text-sky-600 hover:text-sky-500 flex items-center justify-center"
          >
            <FiArrowLeft className="mr-1" />
            Back to login
          </button>
        </div>

        <div className="mt-6 text-center text-s text-sky-500">
          <p>Having trouble? Contact support for assistance.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Verify2FA;