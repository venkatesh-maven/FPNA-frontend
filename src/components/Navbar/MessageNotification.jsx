import React from 'react';
import { FiX } from 'react-icons/fi';

const MessageNotification = ({ sender, message, time, onClose }) => {
  return (
    <div className="w-full max-w-xs p-4 text-gray-900 bg-white rounded-lg shadow-sm">
      <div className="flex items-center mb-2">
        <span className="text-s font-semibold">New  message</span>
        <button 
          onClick={onClose}
          className="ms-auto text-gray-400 hover:text-gray-900 rounded-lg p-1 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8"
        >
          <FiX className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center">
        <div className="relative inline-block shrink-0">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600">{sender.charAt(0)}</span>
          </div>
          <span className="absolute bottom-0 right-0 inline-flex items-center justify-center w-5 h-5 bg-blue-600 rounded-full text-x text-white">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 18">
              <path d="M18 4H16V9C16 10.0609 15.5786 11.0783 14.8284 11.8284C14.0783 12.5786 13.0609 13 12 13H9L6.846 14.615C7.17993 14.8628 7.58418 14.9977 8 15H11.667L15.4 17.8C15.5731 17.9298 15.7836 18 16 18C16.2652 18 16.5196 17.8946 16.7071 17.7071C16.8946 17.5196 17 17.2652 17 17V15H18C18.5304 15 19.0391 14.7893 19.4142 14.4142C19.7893 14.0391 20 13.5304 20 13V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4Z"/>
            </svg>
          </span>
        </div>
        <div className="ms-3 text-s">
          <div className="font-semibold text-gray-900">{sender}</div>
          <div className="font-normal">{message}</div> 
          <span className="text-x text-blue-600">{time}</span>   
        </div>
      </div>
    </div>
  );
};

export default MessageNotification;