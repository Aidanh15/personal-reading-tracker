import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const OfflineIndicator: React.FC = () => {
  const { isOffline, wasOffline, isOnline } = useOnlineStatus();

  if (isOnline && !wasOffline) {
    return null; // Don't show anything when online and never was offline
  }

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium
        transition-all duration-300 ease-in-out
        ${isOffline 
          ? 'bg-red-600 text-white transform translate-y-0' 
          : 'bg-green-600 text-white transform -translate-y-full'
        }
      `}
    >
      {isOffline ? (
        <div className="flex items-center justify-center space-x-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
          </svg>
          <span>You're offline. Some features may not work.</span>
        </div>
      ) : (
        <div className="flex items-center justify-center space-x-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>You're back online!</span>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;