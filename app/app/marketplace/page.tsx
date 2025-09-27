"use client";
import { AgentMarketplace } from '@/components/AgentMarketplace';
import { agentStorageService, StoredAgent } from '@/lib/agentStorageService';
import { NFTAgent, nftService } from '@/lib/nftService';
import { useWallet } from '@/lib/wallet-context';
import { useEffect, useState } from 'react';

export default function MarketplacePage() {
  const { address } = useWallet();
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [nftAgents, setNftAgents] = useState<NFTAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user agents when address changes
  useEffect(() => {
    const loadUserAgents = async () => {
      if (!address) {
        setAgents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userAgents = await agentStorageService.getUserAgents(address);
        setAgents(userAgents);
      } catch (error) {
        console.error('Failed to load user agents:', error);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    loadUserAgents();
  }, [address]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  return <AgentMarketplace agents={agents} nftAgents={nftAgents} />;
}