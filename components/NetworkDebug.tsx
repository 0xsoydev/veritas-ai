'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';

export default function NetworkDebug() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [contractStatus, setContractStatus] = useState<string>('Checking...');
  const [networkName, setNetworkName] = useState<string>('Unknown');
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkContract = async () => {
    setIsChecking(true);
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new (await import('ethers')).BrowserProvider(window.ethereum);
        const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
        
        // Get network name
        try {
          const network = await provider.getNetwork();
          setNetworkName(network.name || 'Unknown');
          console.log('🌐 Network info:', { name: network.name, chainId: network.chainId.toString() });
        } catch (e) {
          setNetworkName('Unknown');
          console.error('❌ Failed to get network:', e);
        }
        
        if (!contractAddress) {
          setContractStatus('❌ No contract address in environment');
          return;
        }

        console.log('🔍 Checking contract at:', contractAddress);
        
        // Try to get the latest block first
        try {
          const blockNumber = await provider.getBlockNumber();
          console.log('📦 Current block number:', blockNumber);
        } catch (e) {
          console.error('❌ Failed to get block number:', e);
        }

        const code = await provider.getCode(contractAddress);
        console.log('📋 Contract code length:', code.length);
        
        if (code === '0x') {
          setContractStatus(`❌ No contract found at ${contractAddress}`);
        } else {
          setContractStatus(`✅ Contract found at ${contractAddress} (${code.length} bytes)`);
        }
      }
    } catch (error) {
      console.error('❌ Contract check error:', error);
      setContractStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkContract();
  }, []);

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-bold mb-2">Network Debug Info</h3>
      <div className="space-y-2">
        <p><strong>Wallet Connected:</strong> {isConnected ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Address:</strong> {address || 'Not connected'}</p>
        <p><strong>Network:</strong> {networkName} (ID: {chainId || 'Unknown'})</p>
        <p><strong>Expected Network:</strong> Polygon Amoy Testnet (ID: 80002)</p>
        <p><strong>RPC URL:</strong> https://rpc-amoy.polygon.technology</p>
        <p><strong>Currency:</strong> MATIC</p>
        <p><strong>Contract Status:</strong> {contractStatus}</p>
        <p><strong>Contract Address:</strong> {process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS}</p>
      </div>
      
      {chainId !== 80002 && (
        <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
          <p className="font-bold text-yellow-800">⚠️ Wrong Network!</p>
          <p className="text-sm text-yellow-700">
            Please switch to Polygon Amoy Testnet (Chain ID: 80002) in your wallet.
          </p>
        </div>
      )}
      
      <div className="mt-4">
        <button
          onClick={checkContract}
          disabled={isChecking}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? 'Checking...' : 'Refresh Contract Check'}
        </button>
      </div>
    </div>
  );
}
