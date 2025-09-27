"use client";
import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWallet } from '@/lib/wallet-context';

export function WalletConnection() {
  const { isConnected, isVerified, isVerifying, error, verifyUser, clearVerificationCache } = useWallet();

  return (
    <div className="flex items-center space-x-4">
      <ConnectButton />
      
      {isConnected && (
        <div className="flex items-center space-x-2">
          {isVerifying ? (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Checking verification...</span>
            </div>
          ) : isVerified ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Verified</span>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => verifyUser(true)}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors"
                  title="Force refresh verification"
                >
                  🔄
                </button>
                <button
                  onClick={clearVerificationCache}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
                  title="Clear verification cache"
                >
                  🗑️
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => verifyUser()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
              >
                Verify Identity
              </button>
              {error && (
                <div className="flex flex-col items-end">
                  <span className="text-red-600 text-xs max-w-xs truncate" title={error}>
                    {error}
                  </span>
                  <button
                    onClick={() => verifyUser()}
                    className="text-blue-600 text-xs hover:text-blue-800 underline"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
