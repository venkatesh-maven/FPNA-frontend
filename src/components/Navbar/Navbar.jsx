import React, { useState, useEffect, useRef, useContext } from 'react';
import { FiSearch, FiBell, FiMessageSquare, FiMenu } from 'react-icons/fi';
import { FaUserCircle } from 'react-icons/fa';
import { BsStars } from 'react-icons/bs';
import { Tooltip } from 'react-tooltip';
import SearchBar from './SearchBar';
import ProfileDropdown from './ProfileDropdown';
import NotificationToast from './NotificationToast';
import MessageNotification from './MessageNotification';
import { AuthContext } from '../../context/AuthContext';
import AIDropdown from './AIDropdown';

const Navbar = ({ toggleSidebar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const {currentUser} = useContext(AuthContext);
  
  // Create refs for each dropdown
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  const askAIRef = useRef(null);
  const messagesRef = useRef(null);

  // Sample data
  const notifications = [
    { id: 1, type: 'success', message: 'Item moved successfully' },
    { id: 2, type: 'error', message: 'Item has been deleted' },
    { id: 3, type: 'warning', message: 'Low inventory warning' },
  ];

  const messages = [
    { id: 1, sender: 'John Doe', message: 'Please review the report', time: '2 min ago' },
    { id: 2, sender: 'Jane Smith', message: 'Meeting at 3pm', time: '1 hour ago' },
  ];

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
      if (askAIRef.current && !askAIRef.current.contains(event.target)) {
        setIsAskAIOpen(false);
      }
      if (messagesRef.current && !messagesRef.current.contains(event.target)) {
        setIsMessagesOpen(false);
      }
    };

    // Add event listener when any dropdown is open
    if (isProfileOpen || isNotificationsOpen || isAskAIOpen || isMessagesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen, isNotificationsOpen, isAskAIOpen, isMessagesOpen]);

  return (
    <header className="bg-white shadow-sm z-40">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left Side - Mobile Menu Button */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full hover:bg-gray-100 lg:hidden"
        >
          <FiMenu className="text-gray-600 hover:text-gray-900" size={20} />
        </button>

        {/* Search Bar */}
        <div>
          <h1 className="text-2xl mx-5 font-bold text-sky-900 capitalize">Welcome, {currentUser.company_name}</h1>
        </div>

        {/* Right Side - Icons */}
        <div className="flex items-center space-x-4">
          {/* Ask AI Button */}
          <div className="relative" ref={askAIRef}>
            <button
              onClick={() => setIsAskAIOpen(!isAskAIOpen)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
              data-tooltip-id="ask-ai-tooltip"
              data-tooltip-content="Ask AI"
              data-tooltip-place="left" 
            >
              <BsStars className="text-gray-600 hover:text-gray-900" size={20} />
            </button>
            <Tooltip
              id="ask-ai-tooltip"
              place="bottom"
              className="bg-gray-800 text-white text-s rounded px-2 py-1"
            />

            {isAskAIOpen && (
              <AIDropdown 
                isOpen={isAskAIOpen} 
                onClose={() => setIsAskAIOpen(false)}
              />
            )}
          </div>

          {/* Messages Button */}
          <div className="relative" ref={messagesRef}>
            <button
              onClick={() => setIsMessagesOpen(!isMessagesOpen)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
            >
              <FiMessageSquare className="text-gray-600 hover:text-gray-900" size={20} />
              {messages.length > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-x flex items-center justify-center">
                  {messages.length}
                </span>
              )}
            </button>

            {isMessagesOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Messages ({messages.length})</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {messages.map((msg) => (
                    <MessageNotification
                      key={msg.id}
                      sender={msg.sender}
                      message={msg.message}
                      time={msg.time}
                      onClose={() => setIsMessagesOpen(false)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Notifications Button */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
            >
              <FiBell className="text-gray-600 hover:text-gray-900" size={20} />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-x flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Notifications ({notifications.length})</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <NotificationToast
                      key={notification.id}
                      type={notification.type}
                      message={notification.message}
                      onClose={() => setIsNotificationsOpen(false)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-2 border-2 p-1 hover:border-sky-700 border-sky-600 bg-white rounded-sm focus:outline-none shadow-2xl hover:bg-sky-900 hover:text-sky-50 text-sky-700 transition-all duration-200 transform hover:scale-[1.02]"
            >
              <span className="hidden capitalize md:inline-block text-s">
                {currentUser.user_name}
              </span>
              <FaUserCircle className="text-2xl" />
            </button>

            <ProfileDropdown
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;