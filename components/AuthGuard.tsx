"use client";
import React from 'react';
import { useWallet } from '@/lib/wallet-context';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isConnected, isVerified, isVerifying } = useWallet();

  // Show loading state while verifying
  if (isConnected && isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Checking Verification Status</h2>
          <p className="text-gray-600">Looking for cached verification or starting fresh verification...</p>
        </div>
      </div>
    );
  }

  // Show wallet connection prompt if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Veritas</h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to access the AI Agent Platform. Your identity will be verified using 
              Primus ZKTLS technology to ensure you&apos;re a real human.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Connect Your Wallet</h2>
            <ConnectButton />
            <p className="text-sm text-gray-500 mt-4">
              After connecting, we'll verify your identity using zero-knowledge technology.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show verification required message if connected but not verified
  if (isConnected && !isVerified) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Verification Failed</h1>
            <p className="text-gray-600 mb-8">
              Your wallet is connected, but identity verification failed. Please try again using the buttons in the header.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Verification</h2>
            <p className="text-sm text-gray-600 mb-4">
              Use the "Verify Identity" button in the header above to retry verification, or try the force refresh option.
            </p>
            <div className="text-sm text-gray-500">
              This ensures you&apos;re a real human and helps maintain platform security.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is connected and verified, show the protected content
  return <>{children}</>;
}
