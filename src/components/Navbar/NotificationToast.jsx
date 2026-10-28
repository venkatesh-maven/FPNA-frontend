import React from 'react';
import { FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';

const NotificationToast = ({ type, message, onClose }) => {



  
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheck className="w-5 h-5 text-green-500" />;
      case 'error':
        return <FiX className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <FiAlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <FiCheck className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="flex items-center w-full max-w-xs p-4 mb-2 text-gray-500 bg-white rounded-lg shadow-sm">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-opacity-20">
        {getIcon()}
      </div>
      <div className="ms-3 text-s font-normal">{message}</div>
      <button 
        onClick={onClose}
        className="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8"
      >
        <FiX className="w-3 h-3" />
      </button>
    </div>
  );
};

export default NotificationToast;