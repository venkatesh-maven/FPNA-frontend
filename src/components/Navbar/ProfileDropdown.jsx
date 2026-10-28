import React, { useEffect, useRef, useContext } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfileDropdown = ({ isOpen, onClose }) => {
  const dropdownRef = useRef(null);
  const { logout, currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const ProfileHandle = () => {
    navigate('/profile-details');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 pt-2 w-64 bg-gradient-to-t from-[#012036] to-[#146ec7] rounded-lg shadow-2xl z-50"
    >
      <div className="flex flex-col items-center px-4 pb-4">
        <FaUserCircle className="w-20 h-20 text-gray-50 mt-1" />

        <h5 className="text-base font-semibold text-white mt-2 text-center leading-tight">
          {currentUser?.user_name}
        </h5>

        <div className="flex gap-2 mt-3 flex-wrap justify-center">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
            <span className="text-sky-300 text-[9px] font-semibold uppercase tracking-wide">Dept</span>
            <span className="text-white text-[11px] font-bold uppercase">
              {currentUser?.user_department || '—'}
            </span>
          </span>
        </div>

        <div className="flex mt-4 space-x-2">
          <button
            onClick={ProfileHandle}
            className="px-4 py-2 text-s font-medium text-white bg-sky-700 rounded-lg hover:bg-sky-900"
          >
            Profile
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 text-s font-medium text-gray-900 bg-white rounded-lg hover:bg-sky-700 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileDropdown;
