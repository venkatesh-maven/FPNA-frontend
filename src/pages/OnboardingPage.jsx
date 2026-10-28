import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { FiMail } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { RiBuilding2Line } from 'react-icons/ri';

const OnboardingPage = () => {
  const [email, setEmail] = useState('');
//   const [organization, setOrganization] = useState('');
  const { requestPasswordReset } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await requestPasswordReset(email);
    if (success) {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video autoPlay loop muted className="w-full h-full object-cover">
          <source src="https://via.placeholder.com/1920x1080.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md bg-white bg-opacity-90 backdrop-blur-sm rounded-xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sky-900 mb-2">Onboard to FPnAInsights</h1>
          <p className="text-sky-600">Add your organization and email to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-s font-medium text-sky-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiMail className="h-5 w-5 text-sky-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sky-800 placeholder-sky-400"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="organization" className="block text-s font-medium text-sky-700 mb-1">
              Organization Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 Đồng thời center pointer-events-none">
             <RiBuilding2Line  className="h-5 w-5 text-sky-400" />
              </div>
              <input
                id="organization"
                name="organization"
                type="text"
                required
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sky-800 placeholder-sky-400"
                placeholder="Your Organization"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-s font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200"
            >
              Submit
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-s text-sky-600">
            Already have an account?{' '}
            <Link to="/login" className="font-light text-blue-700 hover:text-blue-600">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default OnboardingPage;