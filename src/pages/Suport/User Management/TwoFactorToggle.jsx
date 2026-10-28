import React, { useState } from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';

const TwoFactorToggle = ({ userId, isTwoFactorEnabled, onToggle }) => {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    try {
      setLoading(true);
      await onToggle(userId, isTwoFactorEnabled);
    } catch (error) {
      // Error is already handled in the parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`mr-3 ${loading ? 'opacity-50' : ''}`}
        data-tooltip-id="2fa-tooltip"
        data-tooltip-content={isTwoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
      >
        {isTwoFactorEnabled ? (
          <FiLock className="inline text-green-500" size={20} />
        ) : (
          <FiUnlock className="inline text-gray-400" size={20} />
        )}
      </button>
      <Tooltip id="2fa-tooltip" />
    </>
  );
};

export default TwoFactorToggle;