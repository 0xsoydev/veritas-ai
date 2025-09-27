"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { clientPrimusService, VerificationResult } from './clientPrimusService';

interface WalletContextType {
  isConnected: boolean;
  address: string | undefined;
  isVerified: boolean;
  verificationResult: VerificationResult | null;
  isVerifying: boolean;
  verifyUser: (forceRefresh?: boolean) => Promise<void>;
  clearVerificationCache: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [isVerified, setIsVerified] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug auto-connect on mount
  useEffect(() => {
    console.log('🚀 WalletProvider mounted, checking initial state:', { isConnected, address });
  }, []);

  const verifyUser = useCallback(async (forceRefresh: boolean = false) => {
    if (!address) {
      setError('No wallet address available');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      console.log('🔐 Starting Primus verification for address:', address, forceRefresh ? '(force refresh)' : '');
      const result = await clientPrimusService.verifyUserIdentity(address, forceRefresh);
      
      console.log('🔐 Verification result:', result);
      setVerificationResult(result);
      setIsVerified(result.success);
      
      if (!result.success) {
        setError(result.error || 'Verification failed');
      }
    } catch (err: unknown) {
      console.error('🔐 Verification error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  }, [address]);

  const clearVerificationCache = useCallback(async () => {
    if (!address) {
      console.warn('No wallet address available for cache clearing');
      return;
    }

    try {
      console.log('🗑️ Clearing verification cache for:', address);
      await clientPrimusService.clearVerificationCache(address);
      console.log('✅ Verification cache cleared');
    } catch (err: unknown) {
      console.error('💥 Error clearing verification cache:', err);
    }
  }, [address]);

  const disconnect = () => {
    wagmiDisconnect();
    setIsVerified(false);
    setVerificationResult(null);
    setError(null);
  };

  // Auto-check verification when wallet connects
  useEffect(() => {
    console.log('🔍 Wallet state changed:', { isConnected, address, isVerified, isVerifying });
    
    if (isConnected && address && !isVerified && !isVerifying) {
      console.log('🔍 Wallet connected, checking for cached verification...');
      verifyUser(false); // Check cache first, don't force refresh
    } else if (!isConnected) {
      console.log('🔍 Wallet disconnected, clearing verification state');
      setIsVerified(false);
      setVerificationResult(null);
      setError(null);
    }
  }, [isConnected, address, isVerified, isVerifying, verifyUser]);

  const value: WalletContextType = {
    isConnected: !!isConnected,
    address,
    isVerified,
    verificationResult,
    isVerifying,
    verifyUser,
    clearVerificationCache,
    disconnect,
    error,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
