import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { FiLock, FiMail, FiEye, FiEyeOff, FiUser, FiHome, FiGlobe, FiBriefcase, FiPhone } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { LoginBG, offRobo } from '../assets/Assets';
import { Link, useNavigate } from 'react-router-dom';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    company_name: '',
    legal_name: '',
    bio: '',
    address: '',
    home_country: 'United States',
    company_logo_url: '',
    has_branches: false,
    password: '',
    email: '',
    phone_number: '',
    plan: 'free'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { register } = useContext(useAuth);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (register(formData)) {
      navigate('/login');
    } else {
      setError('Registration failed. Please check your details.');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Video Background with Overlay */}
      <div className="absolute inset-0 z-0">
        <video autoPlay loop muted className="w-full object-contain">
          <source src={LoginBG} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-2xl bg-white bg-opacity-90 backdrop-blur-sm rounded-xl shadow-xl py-4 px-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sky-900 mb-2">Register Your Company</h1>
          <p className="text-sky-600">Join FPnAInsights financial network</p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiBriefcase className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  name="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="SkyPeak Innovations"
                />
              </div>
            </div>

            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Legal Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiUser className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  name="legal_name"
                  required
                  value={formData.legal_name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="SkyPeak Innovations Ltd."
                />
              </div>
            </div>

            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Company Bio (max 200 chars)
              </label>
              <textarea
                name="bio"
                maxLength={200}
                value={formData.bio}
                onChange={handleChange}
                className="block w-full p-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows="5"
                placeholder="Innovating the future of..."
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiMail className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="contact@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiLock className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5 text-sky-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-sky-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiPhone className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="+1-303-555-9876"
                />
              </div>
            </div>

            <div>
              <label className="block text-s font-medium text-sky-700 mb-1">
                Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiHome className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="789 Skyline Avenue, Denver, CO 80202"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                name="has_branches"
                type="checkbox"
                checked={formData.has_branches}
                onChange={handleChange}
                className="h-4 w-4 text-sky-600 focus:ring-sky-500"
              />
              <label className="ml-2 text-s text-sky-700">
                Has Branches
              </label>
            </div>
          </div>

          <div className="col-span-full">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
            >
              Register Company
            </button>
          </div>

          {error && (
            <div className="col-span-full text-red-500 text-s text-center">
              {error}
            </div>
          )}

          <div className="col-span-full text-center text-s text-sky-600">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-700 hover:text-sky-600">
              Login here
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default RegisterPage;